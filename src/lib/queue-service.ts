import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { QueueEntry, QueueStats, QueueStatus, StaffAuditLog, DriverJoinRequest } from "@/types/queue";
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from "./supabase/admin";

const DEFAULT_SITE_ID = process.env.NEXT_PUBLIC_DEFAULT_SITE_ID || "00000000-0000-0000-0000-000000000001";

// ==============================================================================
// In-Memory Dev Store (Persistent across hot-reloads via globalThis)
// Used when Supabase credentials are not yet entered during local dev/preview
// ==============================================================================
export interface SessionInfo {
  id: string;
  site_id: string;
  session_date: string;
  sequence_counter: number;
  is_active: boolean;
  created_at: string;
}

interface MemoryStore {
  counter: number;
  entries: QueueEntry[];
  auditLogs: StaffAuditLog[];
  currentSession: SessionInfo;
}

declare global {
  // eslint-disable-next-line no-var
  var __QUEUE_MEMORY_STORE__: MemoryStore | undefined;
}

function getMemoryStore(): MemoryStore {
  if (!globalThis.__QUEUE_MEMORY_STORE__) {
    globalThis.__QUEUE_MEMORY_STORE__ = {
      counter: 0,
      entries: [],
      auditLogs: [],
      currentSession: {
        id: "local-session-" + new Date().toISOString().slice(0, 10),
        site_id: DEFAULT_SITE_ID,
        session_date: new Date().toISOString().slice(0, 10),
        sequence_counter: 0,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    };
  } else if (!globalThis.__QUEUE_MEMORY_STORE__.currentSession) {
    globalThis.__QUEUE_MEMORY_STORE__.currentSession = {
      id: "local-session-" + new Date().toISOString().slice(0, 10),
      site_id: DEFAULT_SITE_ID,
      session_date: new Date().toISOString().slice(0, 10),
      sequence_counter: 0,
      is_active: true,
      created_at: new Date().toISOString(),
    };
  }
  return globalThis.__QUEUE_MEMORY_STORE__;
}

// ==============================================================================
// Helper to calculate dynamic queue metrics for an entry
// ==============================================================================
function enrichEntryMetrics(entry: QueueEntry, allEntries: QueueEntry[]): QueueEntry {
  if (entry.status === "waiting") {
    const waitingBefore = allEntries.filter(
      (e) => e.site_id === entry.site_id &&
             e.status === "waiting" &&
             new Date(e.joined_at).getTime() < new Date(entry.joined_at).getTime()
    );
    const peopleAhead = waitingBefore.length;
    const position = peopleAhead + 1;
    // Estimate ~3 minutes per person ahead, minimum 2 min
    const estimatedWait = Math.max(2, (peopleAhead + 1) * 3);

    return {
      ...entry,
      people_ahead: peopleAhead,
      position,
      estimated_wait_minutes: estimatedWait,
    };
  }

  return {
    ...entry,
    people_ahead: 0,
    position: 0,
    estimated_wait_minutes: 0,
  };
}

// ==============================================================================
// PUBLIC QUEUE SERVICE METHODS
// ==============================================================================

export async function joinQueue(params: DriverJoinRequest): Promise<{ entry: QueueEntry; isDuplicate: boolean }> {
  const siteId = params.site_id || DEFAULT_SITE_ID;
  const idempotencyKey = params.idempotency_key;

  // 0. Verify queue session is currently active
  const session = await getCurrentSession(siteId);
  if (!session.is_active) {
    const error = new Error("الطابور مغلق حالياً من قِبل إدارة محطة الهرم، لا يمكن حجز دور حتى يتم فتح جلسة جديدة من قِبل المشرفين");
    (error as unknown as { session_closed: boolean }).session_closed = true;
    throw error;
  }

  const adminClient = getSupabaseAdminClient();

  if (adminClient && isSupabaseAdminConfigured()) {
    try {
      // 1. Check idempotency first: if already joined with this key, return existing ticket
      const { data: existing } = await adminClient
        .from("queue_entries")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existing) {
        const { data: waitingData } = await adminClient
          .from("queue_entries")
          .select("id, site_id, status, joined_at")
          .eq("site_id", siteId)
          .eq("status", "waiting");
        return {
          entry: enrichEntryMetrics(existing as QueueEntry, (waitingData || []) as QueueEntry[]),
          isDuplicate: true,
        };
      }

      // 2. Call atomic database stored procedure for fresh ticket
      const { data, error } = await adminClient.rpc("join_queue_atomic", {
        p_site_id: siteId,
        p_idempotency_key: idempotencyKey,
        p_driver_name: params.driver_name || null,
        p_order_reference: params.order_reference || null,
      });

      if (!error && data && data.length > 0) {
        const row = data[0];
        const entry: QueueEntry = {
          id: row.entry_id,
          site_id: siteId,
          session_id: row.entry_id,
          queue_number: row.allocated_queue_number,
          ticket_token: row.assigned_ticket_token,
          idempotency_key: idempotencyKey,
          driver_name: params.driver_name,
          order_reference: params.order_reference,
          status: row.entry_status as QueueStatus,
          joined_at: row.joined_timestamp,
          created_at: row.joined_timestamp,
          updated_at: row.joined_timestamp,
          position: row.queue_position,
          people_ahead: row.drivers_ahead,
          estimated_wait_minutes: Math.max(2, (row.drivers_ahead + 1) * 3),
        };
        return { entry, isDuplicate: false };
      } else {
        console.warn("Supabase join_queue_atomic failed, executing direct table insert:", error);

        let activeSessionId = session.id;
        if (!activeSessionId || activeSessionId.startsWith("local-")) {
          const { data: dbSession } = await adminClient
            .from("queue_sessions")
            .select("id")
            .eq("site_id", siteId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (dbSession) {
            activeSessionId = dbSession.id;
          } else {
            const { data: createdSession } = await adminClient
              .from("queue_sessions")
              .insert({
                site_id: siteId,
                session_date: new Date().toISOString().slice(0, 10),
                sequence_counter: 0,
                is_active: true,
              })
              .select("id")
              .single();
            if (createdSession) activeSessionId = createdSession.id;
          }
        }

        // Get highest queue number for THIS session
        const { data: maxRow } = await adminClient
          .from("queue_entries")
          .select("queue_number")
          .eq("site_id", siteId)
          .eq("session_id", activeSessionId)
          .order("queue_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        const queueNumber = (maxRow?.queue_number || 0) + 1;
        const now = new Date().toISOString();
        const ticketToken = crypto.randomBytes(24).toString("hex");

        // Keep session counter synchronized
        await adminClient
          .from("queue_sessions")
          .update({ sequence_counter: queueNumber })
          .eq("id", activeSessionId);

        const { data: inserted, error: insertError } = await adminClient
          .from("queue_entries")
          .insert({
            site_id: siteId,
            session_id: activeSessionId,
            queue_number: queueNumber,
            ticket_token: ticketToken,
            idempotency_key: idempotencyKey,
            driver_name: params.driver_name ? params.driver_name.trim() : null,
            order_reference: params.order_reference ? params.order_reference.trim() : null,
            status: "waiting",
            joined_at: now,
          })
          .select()
          .single();

        if (!insertError && inserted) {
          const { data: waitingData } = await adminClient
            .from("queue_entries")
            .select("id, site_id, status, joined_at")
            .eq("site_id", siteId)
            .eq("status", "waiting");
          return {
            entry: enrichEntryMetrics(inserted as QueueEntry, (waitingData || []) as QueueEntry[]),
            isDuplicate: false,
          };
        }
      }
    } catch (err) {
      console.error("Failed to execute RPC / direct insert:", err);
    }
  }

  // Fallback to concurrency-safe Memory Store
  const store = getMemoryStore();

  // 1. Check idempotency: If this key already joined, return existing entry!
  const existing = store.entries.find((e) => e.idempotency_key === idempotencyKey);
  if (existing) {
    return {
      entry: enrichEntryMetrics(existing, store.entries),
      isDuplicate: true,
    };
  }

  // 2. Increment atomic counter
  store.counter += 1;
  const queueNumber = store.counter;
  const now = new Date().toISOString();
  const ticketToken = crypto.randomBytes(24).toString("hex");

  const newEntry: QueueEntry = {
    id: uuidv4(),
    site_id: siteId,
    session_id: "local-session-" + new Date().toISOString().slice(0, 10),
    queue_number: queueNumber,
    ticket_token: ticketToken,
    idempotency_key: idempotencyKey,
    driver_name: params.driver_name ? params.driver_name.trim() : null,
    order_reference: params.order_reference ? params.order_reference.trim() : null,
    status: "waiting",
    joined_at: now,
    created_at: now,
    updated_at: now,
  };

  store.entries.push(newEntry);

  // Log audit
  store.auditLogs.unshift({
    id: uuidv4(),
    site_id: siteId,
    entry_id: newEntry.id,
    queue_number: newEntry.queue_number,
    action: "call",
    action_label_ar: "دخول الطابور",
    performed_by_name: params.driver_name || "سائق جديد",
    details: `تم حجز رقم ${queueNumber} بنجاح`,
    created_at: now,
  });

  return {
    entry: enrichEntryMetrics(newEntry, store.entries),
    isDuplicate: false,
  };
}

export async function getTicketByToken(token: string): Promise<QueueEntry | null> {
  const adminClient = getSupabaseAdminClient();

  if (adminClient && isSupabaseAdminConfigured()) {
    try {
      const { data, error } = await adminClient
        .from("queue_entries")
        .select("*")
        .eq("ticket_token", token)
        .single();

      if (!error && data) {
        // Fetch waiting entries to calculate accurate position
        const { data: waitingData } = await adminClient
          .from("queue_entries")
          .select("id, site_id, status, joined_at")
          .eq("site_id", data.site_id)
          .eq("status", "waiting");

        const allWaiting = (waitingData || []) as QueueEntry[];
        return enrichEntryMetrics(data as QueueEntry, allWaiting);
      }
    } catch (err) {
      console.error("Supabase getTicketByToken error:", err);
    }
  }

  const store = getMemoryStore();
  const entry = store.entries.find((e) => e.ticket_token === token);
  if (!entry) return null;

  return enrichEntryMetrics(entry, store.entries);
}

export async function getActiveQueue(siteId: string = DEFAULT_SITE_ID): Promise<QueueEntry[]> {
  const adminClient = getSupabaseAdminClient();

  if (adminClient && isSupabaseAdminConfigured()) {
    try {
      const { data, error } = await adminClient
        .from("queue_entries")
        .select("*")
        .eq("site_id", siteId)
        .in("status", ["waiting", "called", "processing"])
        .order("joined_at", { ascending: true });

      if (!error && data) {
        return (data as QueueEntry[]).map((entry, _, arr) => enrichEntryMetrics(entry, arr));
      }
    } catch (err) {
      console.error("Supabase getActiveQueue error:", err);
    }
  }

  const store = getMemoryStore();
  const active = store.entries.filter(
    (e) => e.site_id === siteId && ["waiting", "called", "processing"].includes(e.status)
  ).sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

  return active.map((entry) => enrichEntryMetrics(entry, active));
}

export async function getHistory(siteId: string = DEFAULT_SITE_ID, limit: number = 50): Promise<QueueEntry[]> {
  const adminClient = getSupabaseAdminClient();

  if (adminClient && isSupabaseAdminConfigured()) {
    try {
      const { data, error } = await adminClient
        .from("queue_entries")
        .select("*")
        .eq("site_id", siteId)
        .in("status", ["completed", "skipped", "cancelled"])
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (!error && data) {
        return data as QueueEntry[];
      }
    } catch (err) {
      console.error("Supabase getHistory error:", err);
    }
  }

  const store = getMemoryStore();
  return store.entries
    .filter((e) => e.site_id === siteId && ["completed", "skipped", "cancelled"].includes(e.status))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, limit);
}

export async function callNextDriver(siteId: string = DEFAULT_SITE_ID, staffName: string = "فريق العمل"): Promise<QueueEntry | null> {
  const adminClient = getSupabaseAdminClient();

  if (adminClient && isSupabaseAdminConfigured()) {
    try {
      const { data, error } = await adminClient.rpc("call_next_driver", {
        p_site_id: siteId,
        p_staff_name: staffName,
      });

      if (!error && data && data.length > 0) {
        const row = data[0];
        return {
          id: row.entry_id,
          site_id: siteId,
          session_id: row.entry_id,
          queue_number: row.queue_number,
          ticket_token: "",
          idempotency_key: "",
          driver_name: row.driver_name,
          order_reference: row.order_reference,
          status: "called",
          joined_at: row.called_at,
          called_at: row.called_at,
          created_at: row.called_at,
          updated_at: row.called_at,
        };
      }

      // Direct Supabase table fallback if RPC returned empty or failed:
      const { data: waitingEntry } = await adminClient
        .from("queue_entries")
        .select("*")
        .eq("site_id", siteId)
        .eq("status", "waiting")
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (waitingEntry) {
        const now = new Date().toISOString();
        const { data: updated, error: updateErr } = await adminClient
          .from("queue_entries")
          .update({
            status: "called",
            called_at: now,
            updated_at: now,
          })
          .eq("id", waitingEntry.id)
          .select()
          .maybeSingle();

        if (!updateErr && updated) {
          try {
            await adminClient.from("audit_logs").insert({
              site_id: siteId,
              entry_id: updated.id,
              queue_number: updated.queue_number,
              action: "call",
              action_label_ar: "نده على اللي بعده",
              performed_by_name: staffName,
              details: `تم النداء على السائق صاحب الرقم ${updated.queue_number}`,
            });
          } catch {}

          return enrichEntryMetrics(updated as QueueEntry, []);
        }
      } else {
        // Explicitly return null if no waiting entries in database
        return null;
      }
    } catch (err) {
      console.error("Supabase call_next_driver error:", err);
    }
  }

  const store = getMemoryStore();
  // Find oldest waiting driver
  const waitingEntries = store.entries
    .filter((e) => e.site_id === siteId && e.status === "waiting")
    .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

  if (waitingEntries.length === 0) return null;

  const target = waitingEntries[0];
  const now = new Date().toISOString();
  target.status = "called";
  target.called_at = now;
  target.updated_at = now;

  store.auditLogs.unshift({
    id: uuidv4(),
    site_id: siteId,
    entry_id: target.id,
    queue_number: target.queue_number,
    action: "call",
    action_label_ar: "نده على اللي بعده",
    performed_by_name: staffName,
    details: `تم النداء على السائق صاحب الرقم ${target.queue_number}`,
    created_at: now,
  });

  return enrichEntryMetrics(target, store.entries);
}

export async function updateEntryStatus(
  entryId: string,
  newStatus: QueueStatus,
  staffName: string = "فريق العمل",
  details?: string
): Promise<QueueEntry | null> {
  const adminClient = getSupabaseAdminClient();

  if (adminClient && isSupabaseAdminConfigured()) {
    try {
      const { data, error } = await adminClient.rpc("update_queue_entry_status", {
        p_entry_id: entryId,
        p_new_status: newStatus,
        p_staff_name: staffName,
        p_details: details || null,
      });

      if (!error && data && data.length > 0 && data[0].success) {
        const { data: updatedEntry } = await adminClient
          .from("queue_entries")
          .select("*")
          .eq("id", entryId)
          .maybeSingle();
        if (updatedEntry) return updatedEntry as QueueEntry;
      }

      // Direct Supabase table fallback
      const now = new Date().toISOString();
      const updatePayload: Record<string, unknown> = {
        status: newStatus,
        updated_at: now,
      };
      if (newStatus === "called") updatePayload.called_at = now;
      if (newStatus === "processing") updatePayload.processing_started_at = now;
      if (newStatus === "completed") updatePayload.completed_at = now;
      if (newStatus === "skipped") updatePayload.skipped_at = now;
      if (newStatus === "cancelled") updatePayload.cancelled_at = now;

      const { data: updatedDirect } = await adminClient
        .from("queue_entries")
        .update(updatePayload)
        .eq("id", entryId)
        .select()
        .maybeSingle();

      if (updatedDirect) {
        try {
          await adminClient.from("audit_logs").insert({
            site_id: updatedDirect.site_id,
            entry_id: updatedDirect.id,
            queue_number: updatedDirect.queue_number,
            action: newStatus === "called" ? "recall" : newStatus === "processing" ? "process" : newStatus === "completed" ? "complete" : newStatus === "skipped" ? "skip" : "cancel",
            action_label_ar: newStatus,
            performed_by_name: staffName,
            details: details || `تم تغيير الحالة إلى ${newStatus}`,
          });
        } catch {}

        return updatedDirect as QueueEntry;
      }
    } catch (err) {
      console.error("Supabase update_queue_entry_status error:", err);
    }
  }

  const store = getMemoryStore();
  const entry = store.entries.find((e) => e.id === entryId);
  if (!entry) return null;

  const now = new Date().toISOString();
  entry.status = newStatus;
  entry.updated_at = now;

  let actionLabel = "";
  let actionCode: StaffAuditLog["action"] = "manual_override";

  switch (newStatus) {
    case "called":
      entry.called_at = now;
      actionCode = "recall";
      actionLabel = "نده عليه تاني";
      break;
    case "processing":
      entry.processing_started_at = now;
      actionCode = "process";
      actionLabel = "ابدأ تجهيز الطلب";
      break;
    case "completed":
      entry.completed_at = now;
      actionCode = "complete";
      actionLabel = "تم استلام الطلب";
      break;
    case "skipped":
      entry.skipped_at = now;
      actionCode = "skip";
      actionLabel = "تخطي الدور";
      break;
    case "cancelled":
      entry.cancelled_at = now;
      actionCode = "cancel";
      actionLabel = "إلغاء الدور";
      break;
  }

  store.auditLogs.unshift({
    id: uuidv4(),
    site_id: entry.site_id,
    entry_id: entry.id,
    queue_number: entry.queue_number,
    action: actionCode,
    action_label_ar: actionLabel,
    performed_by_name: staffName,
    details: details || `تم تغيير الحالة إلى ${actionLabel}`,
    created_at: now,
  });

  return enrichEntryMetrics(entry, store.entries);
}

// Short in-memory cache for session to avoid excessive DB polling
let sessionCache: { [siteId: string]: { session: SessionInfo; expires: number } } = {};

export function invalidateSessionCache(siteId: string = DEFAULT_SITE_ID) {
  delete sessionCache[siteId];
}

export async function getCurrentSession(siteId: string = DEFAULT_SITE_ID): Promise<SessionInfo> {
  const cached = sessionCache[siteId];
  if (cached && cached.expires > Date.now()) {
    return cached.session;
  }

  const adminClient = getSupabaseAdminClient();

  if (adminClient && isSupabaseAdminConfigured()) {
    try {
      const { data, error } = await adminClient
        .from("queue_sessions")
        .select("*")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const session: SessionInfo = {
          id: data.id,
          site_id: data.site_id,
          session_date: data.session_date,
          sequence_counter: data.sequence_counter || 0,
          is_active: data.is_active ?? true,
          created_at: data.created_at,
        };
        sessionCache[siteId] = { session, expires: Date.now() + 3500 };
        return session;
      }
    } catch (err) {
      console.warn("Supabase getCurrentSession error, falling back to local:", err);
    }
  }

  const store = getMemoryStore();
  if (!store.currentSession) {
    store.currentSession = {
      id: "local-session-" + new Date().toISOString().slice(0, 10),
      site_id: siteId,
      session_date: new Date().toISOString().slice(0, 10),
      sequence_counter: store.counter || 0,
      is_active: true,
      created_at: new Date().toISOString(),
    };
  }
  return store.currentSession;
}

export async function startNewSession(siteId: string = DEFAULT_SITE_ID, staffName: string = "فريق العمل"): Promise<SessionInfo> {
  invalidateSessionCache(siteId);
  const adminClient = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (adminClient && isSupabaseAdminConfigured()) {
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Check if session exists for today
      const { data: existingSession } = await adminClient
        .from("queue_sessions")
        .select("*")
        .eq("site_id", siteId)
        .eq("session_date", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        // Cascade delete previous session so counter resets cleanly to 0 and queue starts from 1
        await adminClient
          .from("queue_sessions")
          .delete()
          .eq("id", existingSession.id);
      }

      // Insert fresh active session for today
      const { data: newSession, error: createError } = await adminClient
        .from("queue_sessions")
        .insert({
          site_id: siteId,
          session_date: today,
          sequence_counter: 0,
          is_active: true,
        })
        .select()
        .single();

      if (!createError && newSession) {
        try {
          await adminClient.from("audit_logs").insert({
            site_id: siteId,
            action: "manual_override",
            action_label_ar: "بدء جلسة جديدة",
            performed_by_name: staffName,
            details: "تم بدء جلسة عمل جديدة وتصفير عداد الطابور بنجاح",
          });
        } catch {}

        const res: SessionInfo = {
          id: newSession.id,
          site_id: newSession.site_id,
          session_date: newSession.session_date,
          sequence_counter: 0,
          is_active: true,
          created_at: newSession.created_at,
        };
        sessionCache[siteId] = { session: res, expires: Date.now() + 3500 };
        return res;
      }
    } catch (err) {
      console.error("Supabase startNewSession error:", err);
    }
  }

  // Memory fallback
  const store = getMemoryStore();
  store.counter = 0;
  store.entries = [];
  store.currentSession = {
    id: "session-" + Date.now(),
    site_id: siteId,
    session_date: new Date().toISOString().slice(0, 10),
    sequence_counter: 0,
    is_active: true,
    created_at: now,
  };

  store.auditLogs.unshift({
    id: uuidv4(),
    site_id: siteId,
    action: "manual_override",
    action_label_ar: "بدء جلسة جديدة",
    performed_by_name: staffName,
    details: "تم بدء جلسة عمل جديدة وتصفير عداد الطابور بنجاح",
    created_at: now,
  });

  return store.currentSession;
}

export async function setSessionActive(
  siteId: string = DEFAULT_SITE_ID,
  isActive: boolean,
  staffName: string = "فريق العمل"
): Promise<SessionInfo> {
  invalidateSessionCache(siteId);
  const adminClient = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (adminClient && isSupabaseAdminConfigured()) {
    try {
      const { data: latest } = await adminClient
        .from("queue_sessions")
        .select("id")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest) {
        const { data, error } = await adminClient
          .from("queue_sessions")
          .update({ is_active: isActive })
          .eq("id", latest.id)
          .select()
          .single();

        if (!error && data) {
          try {
            await adminClient.from("audit_logs").insert({
              site_id: siteId,
              action: "manual_override",
              action_label_ar: isActive ? "فتح الطابور" : "إغلاق الطابور",
              performed_by_name: staffName,
              details: isActive ? "تم فتح الطابور واستقبال المناديب" : "تم إغلاق الطابور ووقف حجز أدوار جديدة",
            });
          } catch {}

          const res: SessionInfo = {
            id: data.id,
            site_id: data.site_id,
            session_date: data.session_date,
            sequence_counter: data.sequence_counter || 0,
            is_active: isActive,
            created_at: data.created_at,
          };
          sessionCache[siteId] = { session: res, expires: Date.now() + 3500 };
          return res;
        }
      }
    } catch (err) {
      console.error("Supabase setSessionActive error:", err);
    }
  }

  // Memory fallback
  const store = getMemoryStore();
  store.currentSession.is_active = isActive;

  store.auditLogs.unshift({
    id: uuidv4(),
    site_id: siteId,
    action: "manual_override",
    action_label_ar: isActive ? "فتح الطابور" : "إغلاق الطابور",
    performed_by_name: staffName,
    details: isActive ? "تم فتح الطابور واستقبال المناديب" : "تم إغلاق الطابور ووقف حجز أدوار جديدة",
    created_at: now,
  });

  return store.currentSession;
}

export async function getQueueStats(siteId: string = DEFAULT_SITE_ID): Promise<QueueStats> {
  const adminClient = getSupabaseAdminClient();
  const session = await getCurrentSession(siteId);

  if (adminClient && isSupabaseAdminConfigured()) {
    try {
      const { data: entries, error } = await adminClient
        .from("queue_entries")
        .select("status, queue_number, called_at")
        .eq("site_id", siteId);

      if (!error && entries) {
        const waiting = entries.filter((e) => e.status === "waiting");
        const called = entries.filter((e) => e.status === "called");
        const processing = entries.filter((e) => e.status === "processing");
        const completed = entries.filter((e) => e.status === "completed");

        const latestCalled = called.sort((a, b) => {
          const tA = a.called_at ? new Date(a.called_at).getTime() : 0;
          const tB = b.called_at ? new Date(b.called_at).getTime() : 0;
          return tB - tA;
        });

        return {
          waiting_count: waiting.length,
          called_count: called.length,
          processing_count: processing.length,
          completed_today_count: completed.length,
          avg_wait_minutes: 4,
          current_called_number: latestCalled.length > 0 ? latestCalled[0].queue_number : null,
          latest_numbers_called: latestCalled.slice(0, 5).map((e) => e.queue_number),
          is_session_active: session.is_active,
          session_id: session.id,
        };
      }
    } catch (err) {
      console.warn("Supabase getQueueStats error, falling back to local:", err);
    }
  }

  const store = getMemoryStore();
  const siteEntries = store.entries.filter((e) => e.site_id === siteId);

  const waiting = siteEntries.filter((e) => e.status === "waiting");
  const called = siteEntries.filter((e) => e.status === "called");
  const processing = siteEntries.filter((e) => e.status === "processing");
  const completed = siteEntries.filter((e) => e.status === "completed");

  const latestCalled = called.sort((a, b) => {
    const tA = a.called_at ? new Date(a.called_at).getTime() : 0;
    const tB = b.called_at ? new Date(b.called_at).getTime() : 0;
    return tB - tA;
  });

  return {
    waiting_count: waiting.length,
    called_count: called.length,
    processing_count: processing.length,
    completed_today_count: completed.length,
    avg_wait_minutes: 4, // average wait time in Cairo distribution hubs
    current_called_number: latestCalled.length > 0 ? latestCalled[0].queue_number : null,
    latest_numbers_called: latestCalled.slice(0, 5).map((e) => e.queue_number),
    is_session_active: session.is_active,
    session_id: session.id,
  };
}

export async function getAuditLogs(siteId: string = DEFAULT_SITE_ID, limit: number = 30): Promise<StaffAuditLog[]> {
  const adminClient = getSupabaseAdminClient();

  if (adminClient && isSupabaseAdminConfigured()) {
    try {
      const { data, error } = await adminClient
        .from("audit_logs")
        .select("*")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!error && data) {
        return data as StaffAuditLog[];
      }
    } catch (err) {
      console.warn("Supabase getAuditLogs error, falling back to local:", err);
    }
  }

  const store = getMemoryStore();
  return store.auditLogs
    .filter((l) => l.site_id === siteId)
    .slice(0, limit);
}
