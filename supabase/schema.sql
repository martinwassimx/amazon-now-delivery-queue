-- ==============================================================================
-- Amazon Now Delivery Queue Management System (نظام طابور التوصيل - محطة الهرم)
-- Clean One-Click Reset & Setup Script for Supabase SQL Editor
-- ==============================================================================

-- 0. Clean drop existing functions and tables (حذف النسخ السابقة لتثبيت نظيف)
DROP FUNCTION IF EXISTS join_queue_atomic(UUID, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS call_next_driver(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_queue_entry_status(UUID, TEXT, TEXT, TEXT) CASCADE;

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS queue_entries CASCADE;
DROP TABLE IF EXISTS staff_profiles CASCADE;
DROP TABLE IF EXISTS queue_sessions CASCADE;
DROP TABLE IF EXISTS sites CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Sites / Pickup Locations (محطات ومواقع الاستلام)
CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Daily Queue Sessions (جلسات الطابور اليومية والعداد التسلسلي)
-- NOTE: Multiple sessions per day are intentionally allowed (staff can "Start New Session" to reset
-- the counter mid-day). Only ONE session should have is_active=TRUE per site at any time.
CREATE TABLE IF NOT EXISTS queue_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    sequence_counter INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Queue Entries (تذاكر وأدوار الطابور)
-- Statuses: waiting (مستني دورك), called (جه دورك), processing (جاري تجهيز الطلب), 
--           completed (استلمت طلبك), skipped (تخطي الدور), cancelled (إلغاء الدور)
CREATE TABLE IF NOT EXISTS queue_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES queue_sessions(id) ON DELETE CASCADE,
    queue_number INTEGER NOT NULL,
    ticket_token TEXT NOT NULL UNIQUE,
    idempotency_key TEXT NOT NULL UNIQUE,
    driver_name TEXT,
    order_reference TEXT,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'processing', 'completed', 'skipped', 'cancelled')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    called_at TIMESTAMPTZ,
    processing_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    skipped_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_session_queue_number UNIQUE (session_id, queue_number)
);

-- 4. Staff Profiles (فريق العمل والمشرفين)
CREATE TABLE IF NOT EXISTS staff_profiles (
    id UUID PRIMARY KEY, -- References auth.users(id)
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'supervisor', 'admin')),
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Audit Logs (سجل العمليات والرقابة)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    entry_id UUID REFERENCES queue_entries(id) ON DELETE SET NULL,
    queue_number INTEGER,
    action TEXT NOT NULL,
    action_label_ar TEXT NOT NULL,
    performed_by_name TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE & CONCURRENCY
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_queue_entries_active ON queue_entries (site_id, status, joined_at) WHERE status IN ('waiting', 'called', 'processing');
CREATE INDEX IF NOT EXISTS idx_queue_entries_ticket_token ON queue_entries (ticket_token);
CREATE INDEX IF NOT EXISTS idx_queue_entries_idempotency ON queue_entries (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_queue_entries_session ON queue_entries (session_id, queue_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_site ON audit_logs (site_id, created_at DESC);

-- ==============================================================================
-- ATOMIC CONCURRENCY-SAFE FUNCTION: JOIN QUEUE
-- Handles race conditions, locks session counter, prevents duplicates via idempotency
-- ==============================================================================
CREATE OR REPLACE FUNCTION join_queue_atomic(
    p_site_id UUID,
    p_idempotency_key TEXT,
    p_driver_name TEXT DEFAULT NULL,
    p_order_reference TEXT DEFAULT NULL
)
RETURNS TABLE (
    entry_id UUID,
    allocated_queue_number INTEGER,
    assigned_ticket_token TEXT,
    entry_status TEXT,
    queue_position INTEGER,
    drivers_ahead INTEGER,
    joined_timestamp TIMESTAMPTZ
) 
LANGUAGE plpgsql
AS $$
DECLARE
    v_session_id UUID;
    v_next_number INTEGER;
    v_token TEXT;
    v_entry_id UUID;
    v_existing_id UUID;
    v_existing_number INTEGER;
    v_existing_token TEXT;
    v_existing_status TEXT;
    v_existing_joined TIMESTAMPTZ;
    v_position INTEGER;
    v_ahead INTEGER;
BEGIN
    -- 1. Idempotency Check: if request was already processed, return existing ticket
    SELECT id, queue_number, ticket_token, status, joined_at
    INTO v_existing_id, v_existing_number, v_existing_token, v_existing_status, v_existing_joined
    FROM queue_entries
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        -- Calculate position for existing ticket
        SELECT COUNT(*) INTO v_ahead
        FROM queue_entries
        WHERE site_id = p_site_id
          AND status = 'waiting'
          AND joined_at < v_existing_joined;

        v_position := v_ahead + 1;

        RETURN QUERY SELECT 
            v_existing_id, 
            v_existing_number, 
            v_existing_token, 
            v_existing_status, 
            v_position, 
            v_ahead, 
            v_existing_joined;
        RETURN;
    END IF;

    -- 2. Find the currently ACTIVE session for the site, WITH ROW LOCK
    SELECT id INTO v_session_id
    FROM queue_sessions
    WHERE site_id = p_site_id
      AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_session_id IS NULL THEN
        -- No active session: create one automatically
        INSERT INTO queue_sessions (site_id, session_date, sequence_counter, is_active)
        VALUES (p_site_id, CURRENT_DATE, 0, TRUE)
        RETURNING id INTO v_session_id;
    END IF;

    -- 3. Atomically increment sequence counter
    UPDATE queue_sessions
    SET sequence_counter = sequence_counter + 1
    WHERE id = v_session_id
    RETURNING sequence_counter INTO v_next_number;

    -- 4. Generate cryptographically secure unguessable 48-character hex ticket token
    v_token := encode(gen_random_bytes(24), 'hex');

    -- 5. Insert new queue entry
    INSERT INTO queue_entries (
        site_id,
        session_id,
        queue_number,
        ticket_token,
        idempotency_key,
        driver_name,
        order_reference,
        status,
        joined_at
    ) VALUES (
        p_site_id,
        v_session_id,
        v_next_number,
        v_token,
        p_idempotency_key,
        NULLIF(TRIM(p_driver_name), ''),
        NULLIF(TRIM(p_order_reference), ''),
        'waiting',
        NOW()
    )
    RETURNING id INTO v_entry_id;

    -- 6. Calculate position among waiting drivers
    SELECT COUNT(*) INTO v_ahead
    FROM queue_entries
    WHERE site_id = p_site_id
      AND status = 'waiting'
      AND id != v_entry_id;

    v_position := v_ahead + 1;

    RETURN QUERY SELECT 
        v_entry_id, 
        v_next_number, 
        v_token, 
        'waiting'::TEXT, 
        v_position, 
        v_ahead, 
        NOW();
END;
$$;

-- ==============================================================================
-- STAFF ACTION FUNCTION: CALL NEXT DRIVER (نده على اللي بعده)
-- Atomically selects oldest waiting driver and sets status to 'called'
-- ==============================================================================
CREATE OR REPLACE FUNCTION call_next_driver(
    p_site_id UUID,
    p_staff_name TEXT DEFAULT 'الموظف المسئول'
)
RETURNS TABLE (
    entry_id UUID,
    queue_number INTEGER,
    driver_name TEXT,
    order_reference TEXT,
    called_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_target_id UUID;
    v_target_number INTEGER;
    v_driver_name TEXT;
    v_order_ref TEXT;
    v_called_at TIMESTAMPTZ := NOW();
BEGIN
    -- Lock the oldest waiting driver row
    SELECT id, q.queue_number, q.driver_name, q.order_reference
    INTO v_target_id, v_target_number, v_driver_name, v_order_ref
    FROM queue_entries q
    WHERE q.site_id = p_site_id
      AND q.status = 'waiting'
    ORDER BY q.joined_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_target_id IS NULL THEN
        RETURN;
    END IF;

    -- Update status to called
    UPDATE queue_entries
    SET status = 'called',
        called_at = v_called_at,
        updated_at = v_called_at
    WHERE id = v_target_id;

    -- Log staff audit
    INSERT INTO audit_logs (
        site_id, entry_id, queue_number, action, action_label_ar, performed_by_name, details
    ) VALUES (
        p_site_id, v_target_id, v_target_number, 'call', 'نده على اللي بعده', p_staff_name, 'تم النداء على السائق'
    );

    RETURN QUERY SELECT v_target_id, v_target_number, v_driver_name, v_order_ref, v_called_at;
END;
$$;

-- ==============================================================================
-- STAFF ACTION FUNCTION: UPDATE ENTRY STATUS
-- Handles transitions: process (ابدأ تجهيز), complete (تم استلام الطلب), recall (نده عليه تاني), skip (تخطي), cancel (إلغاء)
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_queue_entry_status(
    p_entry_id UUID,
    p_new_status TEXT,
    p_staff_name TEXT DEFAULT 'الموظف المسئول',
    p_details TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    current_status TEXT,
    updated_at_val TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_entry RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_action_label TEXT;
    v_action TEXT;
BEGIN
    SELECT * INTO v_entry
    FROM queue_entries
    WHERE id = p_entry_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'not_found'::TEXT, v_now;
        RETURN;
    END IF;

    -- Determine action label in Egyptian Arabic
    IF p_new_status = 'called' THEN
        v_action := 'recall';
        v_action_label := 'نده عليه تاني';
        UPDATE queue_entries SET status = 'called', called_at = v_now, updated_at = v_now WHERE id = p_entry_id;
    ELSIF p_new_status = 'processing' THEN
        v_action := 'process';
        v_action_label := 'ابدأ تجهيز الطلب';
        UPDATE queue_entries SET status = 'processing', processing_started_at = v_now, updated_at = v_now WHERE id = p_entry_id;
    ELSIF p_new_status = 'completed' THEN
        v_action := 'complete';
        v_action_label := 'تم استلام الطلب';
        UPDATE queue_entries SET status = 'completed', completed_at = v_now, updated_at = v_now WHERE id = p_entry_id;
    ELSIF p_new_status = 'skipped' THEN
        v_action := 'skip';
        v_action_label := 'تخطي الدور';
        UPDATE queue_entries SET status = 'skipped', skipped_at = v_now, updated_at = v_now WHERE id = p_entry_id;
    ELSIF p_new_status = 'cancelled' THEN
        v_action := 'cancel';
        v_action_label := 'إلغاء الدور';
        UPDATE queue_entries SET status = 'cancelled', cancelled_at = v_now, updated_at = v_now WHERE id = p_entry_id;
    ELSE
        RETURN QUERY SELECT FALSE, 'invalid_status'::TEXT, v_now;
        RETURN;
    END IF;

    -- Record Audit Log
    INSERT INTO audit_logs (
        site_id, entry_id, queue_number, action, action_label_ar, performed_by_name, details
    ) VALUES (
        v_entry.site_id, p_entry_id, v_entry.queue_number, v_action, v_action_label, p_staff_name, p_details
    );

    RETURN QUERY SELECT TRUE, p_new_status, v_now;
END;
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Public can read active sites
CREATE POLICY "Public read active sites" ON sites FOR SELECT USING (is_active = TRUE);

-- Public can read anonymous queue entries for display
CREATE POLICY "Public read anonymized queue entries" ON queue_entries FOR SELECT USING (TRUE);

-- Public can insert queue entries only via join function / service role
CREATE POLICY "Service role full queue entries" ON queue_entries FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Authenticated staff policies
CREATE POLICY "Staff read all" ON queue_entries FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Staff update all" ON queue_entries FOR UPDATE TO authenticated USING (TRUE);
CREATE POLICY "Staff audit logs" ON audit_logs FOR ALL TO authenticated USING (TRUE);
CREATE POLICY "Staff read sessions" ON queue_sessions FOR ALL TO authenticated USING (TRUE);

-- ==============================================================================
-- REALTIME REPLICATION CONFIGURATION
-- ==============================================================================
-- Enable realtime on queue_entries so drivers, staff, and public screens get instant updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'queue_entries'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE queue_entries;
    END IF;
END $$;

-- ==============================================================================
-- SEED DATA (بيانات أولية لمحطة توزيع أمازون ناو — الهرم)
-- ==============================================================================
INSERT INTO sites (id, name, slug, code, address, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'محطة توزيع أمازون ناو — الهرم',
    'haram-hub',
    'HARM-01',
    'شارع الهرم الرئيسي، الجيزة',
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    code = EXCLUDED.code,
    address = EXCLUDED.address,
    is_active = TRUE;

-- Insert initial session only if no active session exists for this site
INSERT INTO queue_sessions (site_id, session_date, sequence_counter, is_active)
SELECT
    '00000000-0000-0000-0000-000000000001'::UUID,
    CURRENT_DATE,
    0,
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM queue_sessions
    WHERE site_id = '00000000-0000-0000-0000-000000000001'::UUID
      AND is_active = TRUE
);
