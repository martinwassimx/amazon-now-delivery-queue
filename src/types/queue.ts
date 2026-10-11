export type QueueStatus = 
  | 'waiting'      // مستني دورك
  | 'called'       // جه دورك
  | 'processing'   // جاري تجهيز الطلب
  | 'completed'    // استلمت طلبك / تم استلام الطلب
  | 'skipped'      // تخطي الدور
  | 'cancelled';   // إلغاء الدور

export interface Site {
  id: string;
  name: string;
  slug: string;
  code: string;
  address?: string;
  is_active: boolean;
  created_at: string;
}

export interface QueueSession {
  id: string;
  site_id: string;
  session_date: string;
  sequence_counter: number;
  is_active: boolean;
  created_at: string;
}

export interface QueueEntry {
  id: string;
  site_id: string;
  session_id: string;
  queue_number: number;
  ticket_token: string;
  idempotency_key: string;
  driver_name?: string | null;
  order_reference?: string | null;
  status: QueueStatus;
  joined_at: string;
  called_at?: string | null;
  processing_started_at?: string | null;
  completed_at?: string | null;
  skipped_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  // Computed fields when fetched by driver:
  position?: number;
  people_ahead?: number;
  estimated_wait_minutes?: number | null;
}

export interface StaffAuditLog {
  id: string;
  site_id: string;
  entry_id?: string | null;
  queue_number?: number | null;
  action: 'call' | 'recall' | 'process' | 'complete' | 'skip' | 'cancel' | 'manual_override';
  action_label_ar: string;
  performed_by_name: string;
  details?: string | null;
  created_at: string;
}

export interface QueueStats {
  waiting_count: number;        // عدد اللي مستنيين
  called_count: number;         // الطلبات اللي اتنده عليها
  processing_count: number;     // الطلبات الجاري تجهيزها
  completed_today_count: number;// الطلبات اللي خلصت النهارده
  avg_wait_minutes: number;     // متوسط وقت الانتظار
  current_called_number?: number | null;
  latest_numbers_called?: number[];
}

export interface DriverJoinRequest {
  site_id?: string;
  driver_name: string; // اسم السائق إجباري
  order_reference?: string;
  idempotency_key: string;
  last_completed_token?: string;
}

export interface StaffActionRequest {
  entry_id?: string;
  action: 'call_next' | 'call' | 'recall' | 'process' | 'complete' | 'skip' | 'cancel';
  site_id?: string;
  staff_name?: string;
  notes?: string;
}
