"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Users, 
  Bell, 
  Package, 
  CheckCircle2, 
  RefreshCw, 
  Search, 
  Clock, 
  PhoneCall, 
  Play, 
  AlertTriangle, 
  X, 
  Volume2, 
  VolumeX, 
  User, 
  Check,
  Filter,
  Lock,
  Unlock,
  Sparkles
} from "lucide-react";
import { StaffNav } from "@/components/StaffNav";
import { StatusBadge } from "@/components/StatusBadge";
import { QueueEntry, QueueStats, QueueStatus } from "@/types/queue";
import { formatQueueNumber, formatCairoTime, formatElapsedArabic } from "@/lib/date-format";
import { playCallChime, playUrgentChime } from "@/lib/audio";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function StaffDashboardPage() {
  const [activeQueue, setActiveQueue] = useState<QueueEntry[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    waiting_count: 0,
    called_count: 0,
    processing_count: 0,
    completed_today_count: 0,
    avg_wait_minutes: 4,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    entry: QueueEntry | null;
    action: "skip" | "cancel";
    title: string;
    message: string;
  }>({
    isOpen: false,
    entry: null,
    action: "skip",
    title: "",
    message: "",
  });

  const previousCountRef = useRef<number>(0);

  // Fetch active queue and stats atomically
  const refreshData = async () => {
    try {
      const queueRes = await fetch("/api/queue/active");
      const queueData = await queueRes.json();

      if (queueData.success) {
        const entries = queueData.entries as QueueEntry[];
        // Play notification chime if new driver joined
        if (entries.length > previousCountRef.current && previousCountRef.current > 0 && soundEnabled) {
          playCallChime();
        }
        previousCountRef.current = entries.length;
        setActiveQueue(entries);

        if (queueData.stats) {
          setStats(queueData.stats);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("Failed to load staff data:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();

    // Supabase Realtime subscription
    const supabase = getSupabaseBrowserClient();
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

    if (supabase) {
      try {
        channel = supabase
          .channel("staff-dashboard")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "queue_entries" },
            () => {
              refreshData();
            }
          )
          .subscribe();
      } catch (e) {
        console.warn("Realtime subscription fallback to polling:", e);
      }
    }

    const interval = setInterval(refreshData, 3000);
    return () => {
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [soundEnabled]);

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Perform a queue action (call_next, process, complete, recall, skip, cancel)
  const handleAction = async (
    action: "call_next" | "call" | "recall" | "process" | "complete" | "skip" | "cancel",
    entryId?: string
  ) => {
    if (action === "call_next" && waitingCount === 0) {
      showNotification("مفيش حد مستني في الطابور دلوقتي", "error");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/queue/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          entry_id: entryId,
          staff_name: "موظف المحطة",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showNotification(data.error || "حصلت مشكلة أثناء تنفيذ الإجراء", "error");
      } else {
        showNotification(data.message || "تم تنفيذ الإجراء بنجاح", "success");
        if (action === "call_next" || action === "call" || action === "recall") {
          if (soundEnabled) playCallChime();
        }
        await refreshData();
      }
    } catch (err) {
      console.error("Action error:", err);
      showNotification("فشل الاتصال بالخادم، حاول تاني", "error");
    } finally {
      setActionLoading(false);
      setConfirmModal({ isOpen: false, entry: null, action: "skip", title: "", message: "" });
    }
  };

  const openConfirmation = (entry: QueueEntry, action: "skip" | "cancel") => {
    setConfirmModal({
      isOpen: true,
      entry,
      action,
      title: action === "skip" ? "تأكيد تخطي الدور" : "تأكيد إلغاء الدور",
      message:
        action === "skip"
          ? `هل أنت متأكد من تخطي دور السائق رقم ${formatQueueNumber(entry.queue_number)}؟ سيتم نقله من الطابور النشط.`
          : `هل أنت متأكد من إلغاء دور السائق رقم ${formatQueueNumber(entry.queue_number)} نهائياً؟`,
    });
  };

  const handleSessionAction = async (action: "start_new" | "open" | "close") => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/queue/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, staff_name: "مشرف محطة الهرم" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showNotification(data.error || "حصلت مشكلة أثناء تحديث الجلسة", "error");
      } else {
        showNotification(data.message || "تم تحديث الجلسة بنجاح", "success");
        await refreshData();
      }
    } catch (err) {
      showNotification("فشل الاتصال بالخادم", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const triggerStartNewSession = () => {
    if (
      window.confirm(
        "هل أنت متأكد من بدء جلسة عمل جديدة؟\n\n- سيتم تصفير عداد الأرقام ليبدأ الطابور من رقم 001.\n- سيتم فتح الطابور لاستقبال السائقين فوراً.\n- لن يؤثر ذلك على سجل الطلبات السابقة."
      )
    ) {
      handleSessionAction("start_new");
    }
  };

  // Derive strictly synchronized counts directly from activeQueue
  const waitingCount = activeQueue.filter((e) => e.status === "waiting").length;
  const calledCount = activeQueue.filter((e) => e.status === "called").length;
  const processingCount = activeQueue.filter((e) => e.status === "processing").length;

  // Filter queue entries
  const filteredQueue = activeQueue.filter((entry) => {
    const matchesStatus =
      statusFilter === "all" ? true : entry.status === statusFilter;
    const matchesSearch =
      searchQuery.trim() === ""
        ? true
        : String(entry.queue_number).includes(searchQuery) ||
          (entry.order_reference && entry.order_reference.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (entry.driver_name && entry.driver_name.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <StaffNav />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Toast Notification */}
        {notification && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between shadow-xl transition-all ${
              notification.type === "success"
                ? "bg-emerald-950 border border-emerald-700 text-emerald-200"
                : "bg-rose-950 border border-rose-700 text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2.5 font-bold text-sm">
              {notification.type === "success" ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              )}
              <span>{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. Session Control Bar (فتح / قفل الطابور + بدء جلسة جديدة) */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shrink-0 ${
              (stats.is_session_active ?? true)
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
            }`}>
              {(stats.is_session_active ?? true) ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : (
                <Lock className="w-6 h-6 text-rose-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-base text-white">حالة استقبال المناديب:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                  (stats.is_session_active ?? true)
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    (stats.is_session_active ?? true) ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                  }`} />
                  <span>{(stats.is_session_active ?? true) ? "الطابور مفتوح ويستقبل مناديب" : "الطابور مغلق (الاستقبال متوقف)"}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {(stats.is_session_active ?? true)
                  ? "السائقين يقدروا يمسحوا كود الـ QR ويدخلوا الطابور ويحجزوا أدوارهم حالياً."
                  : "أي سائق هيمسح الـ QR هيظهرله إن الطابور مغلق ومش هيقدر يحجز دور حتى تفتح الجلسة."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {/* Toggle Open / Close Queue */}
            {(stats.is_session_active ?? true) ? (
              <button
                onClick={() => handleSessionAction("close")}
                disabled={actionLoading}
                className="flex-1 md:flex-none h-12 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-rose-500/50 hover:border-rose-400 text-rose-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow"
                title="إغلاق الطابور لمنع دخول سائقين جدد"
              >
                <Lock className="w-4 h-4 text-rose-400" />
                <span>إغلاق الطابور مؤقتاً</span>
              </button>
            ) : (
              <button
                onClick={() => handleSessionAction("open")}
                disabled={actionLoading}
                className="flex-1 md:flex-none h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-95"
                title="فتح الطابور لبدء استقبال السائقين"
              >
                <Unlock className="w-4 h-4" />
                <span>فتح استقبال المناديب</span>
              </button>
            )}

            {/* Start New Session (Reset Counter) */}
            <button
              onClick={triggerStartNewSession}
              disabled={actionLoading}
              className="flex-1 md:flex-none h-12 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-95"
              title="بدء جلسة عمل جديدة وتصفير عداد الأرقام ليبدأ من رقم 001"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>بدء جلسة جديدة (تصفير العداد)</span>
            </button>
          </div>
        </div>

        {/* Top Control Bar: Fast Call Next & Sound Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-xl">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <span>إدارة الطابور النشط</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                {waitingCount} سائق في الانتظار
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              المحطة: محطة توزيع أمازون ناو — الهرم — نظام استلام طلبات الشحن
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "كتم الصوت" : "تفعيل أصوات التنبيه"}
              className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 transition"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5 text-amber-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
            </button>

            {/* Prominent "نده على اللي بعده" Button */}
            <button
              id="call-next-driver-button"
              onClick={() => handleAction("call_next")}
              disabled={actionLoading || waitingCount === 0}
              className="flex-1 sm:flex-none h-14 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-lg transition duration-150 cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              <span>نده على اللي بعده</span>
              {waitingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-950 text-amber-400 text-xs font-mono font-bold">
                  {waitingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. عدد اللي مستنيين */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-amber-500/20 shadow-md space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs sm:text-sm font-semibold">عدد اللي مستنيين</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-black text-amber-400">
              {waitingCount}
            </div>
            <p className="text-[11px] text-slate-500">في انتظار النداء</p>
          </div>

          {/* 2. الطلبات اللي اتنده عليها */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-blue-500/20 shadow-md space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs sm:text-sm font-semibold">الطلبات اللي اتنده عليها</span>
              <Bell className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-black text-blue-400">
              {calledCount}
            </div>
            <p className="text-[11px] text-slate-500">جاهزين عند الشباك</p>
          </div>

          {/* 3. الطلبات الجاري تجهيزها */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-indigo-500/20 shadow-md space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs sm:text-sm font-semibold">جاري تجهيزها</span>
              <Package className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-black text-indigo-400">
              {processingCount}
            </div>
            <p className="text-[11px] text-slate-500">تحت التحضير الفعلي</p>
          </div>

          {/* 4. الطلبات اللي خلصت النهارده */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-emerald-500/20 shadow-md space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs sm:text-sm font-semibold">خلصت النهارده</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-black text-emerald-400">
              {stats.completed_today_count}
            </div>
            <p className="text-[11px] text-slate-500">تم تسليمها بنجاح</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 sm:p-4 rounded-2xl border border-slate-800">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الطابور أو رقم الشحنة أو اسم السائق..."
              className="w-full h-11 ps-10 pe-4 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                statusFilter === "all"
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              الكل ({activeQueue.length})
            </button>
            <button
              onClick={() => setStatusFilter("waiting")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                statusFilter === "waiting"
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              مستني دورك ({waitingCount})
            </button>
            <button
              onClick={() => setStatusFilter("called")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                statusFilter === "called"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              اتنده عليه ({calledCount})
            </button>
            <button
              onClick={() => setStatusFilter("processing")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                statusFilter === "processing"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              جاري تجهيزه ({processingCount})
            </button>
          </div>
        </div>

        {/* Active Queue List / Table */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
            <p className="text-sm text-slate-400">جاري تحميل بيانات الطابور...</p>
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="py-20 text-center rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-3 p-6">
            <div className="w-14 h-14 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-slate-600">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">مفيش حد مستني دلوقتي</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              الطابور فاضي حالياً. لما أي سائق يمسح كود الـ QR ويضغط &quot;ادخل الطابور&quot;، هيظهر اسمه ورقمه هنا فوراً في نفس اللحظة.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl">
              <table className="w-full text-start text-sm">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-xs font-semibold">
                  <tr>
                    <th className="py-4 px-6 text-start">رقم الطابور</th>
                    <th className="py-4 px-4 text-start">الحالة</th>
                    <th className="py-4 px-4 text-start">رقم الشحنة</th>
                    <th className="py-4 px-4 text-start">اسم السائق</th>
                    <th className="py-4 px-4 text-start">وقت الدخول</th>
                    <th className="py-4 px-4 text-start">مدة الانتظار</th>
                    <th className="py-4 px-6 text-end">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredQueue.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        entry.status === "called"
                          ? "bg-blue-950/20"
                          : entry.status === "processing"
                          ? "bg-indigo-950/20"
                          : ""
                      }`}
                    >
                      <td className="py-4 px-6">
                        <span className="font-mono text-2xl font-black text-amber-400 tracking-wider">
                          {formatQueueNumber(entry.queue_number)}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <StatusBadge status={entry.status} size="sm" />
                      </td>

                      <td className="py-4 px-4 font-mono text-xs text-slate-300">
                        {entry.order_reference ? (
                          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-300">
                            {entry.order_reference}
                          </span>
                        ) : (
                          <span className="text-slate-600">غير محدد</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-slate-300 font-medium">
                        {entry.driver_name || <span className="text-slate-600">سائق</span>}
                      </td>

                      <td className="py-4 px-4 text-xs text-slate-400">
                        {formatCairoTime(entry.joined_at)}
                      </td>

                      <td className="py-4 px-4 text-xs font-semibold text-slate-300">
                        {formatElapsedArabic(entry.joined_at)}
                      </td>

                      <td className="py-4 px-6 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* If waiting: Call */}
                          {entry.status === "waiting" && (
                            <button
                              onClick={() => handleAction("call", entry.id)}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow flex items-center gap-1"
                            >
                              <Bell className="w-3.5 h-3.5" />
                              <span>نده على السائق</span>
                            </button>
                          )}

                          {/* If called: Recall or Start Processing or Complete */}
                          {entry.status === "called" && (
                            <>
                              <button
                                onClick={() => handleAction("recall", entry.id)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition border border-slate-700"
                                title="إعادة النداء بصوت"
                              >
                                <span>نده تاني</span>
                              </button>
                              <button
                                onClick={() => handleAction("process", entry.id)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow"
                              >
                                <span>ابدأ التجهيز</span>
                              </button>
                              <button
                                onClick={() => handleAction("complete", entry.id)}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>تم استلام الطلب</span>
                              </button>
                            </>
                          )}

                          {/* If processing: Complete order */}
                          {entry.status === "processing" && (
                            <button
                              onClick={() => handleAction("complete", entry.id)}
                              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow flex items-center gap-1"
                            >
                              <Check className="w-4 h-4" />
                              <span>تم استلام الطلب</span>
                            </button>
                          )}

                          {/* Secondary options: Skip or Cancel */}
                          <button
                            onClick={() => openConfirmation(entry, "skip")}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition text-xs"
                            title="تخطي الدور"
                          >
                            تخطي
                          </button>
                          <button
                            onClick={() => openConfirmation(entry, "cancel")}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 transition text-xs"
                            title="إلغاء الدور"
                          >
                            إلغاء
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards View */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
              {filteredQueue.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-4 rounded-3xl border transition space-y-3.5 shadow-lg ${
                    entry.status === "called"
                      ? "bg-slate-900 border-blue-500/80 ring-1 ring-blue-500/30"
                      : entry.status === "processing"
                      ? "bg-slate-900 border-indigo-500/50"
                      : "bg-slate-900/90 border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 font-semibold block">رقم الدور</span>
                      <span className="text-3xl font-black text-amber-400 font-mono tracking-tight">
                        {formatQueueNumber(entry.queue_number)}
                      </span>
                    </div>
                    <StatusBadge status={entry.status} size="sm" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/80">
                    <div>
                      <span className="text-slate-500 block">وقت الدخول</span>
                      <span className="text-slate-300 font-medium">{formatCairoTime(entry.joined_at)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">مدة الانتظار</span>
                      <span className="text-slate-300 font-semibold">{formatElapsedArabic(entry.joined_at)}</span>
                    </div>
                    {entry.order_reference && (
                      <div className="col-span-2">
                        <span className="text-slate-500 block">رقم الشحنة</span>
                        <span className="text-amber-300 font-mono">{entry.order_reference}</span>
                      </div>
                    )}
                    {entry.driver_name && (
                      <div className="col-span-2">
                        <span className="text-slate-500 block">السائق</span>
                        <span className="text-slate-200">{entry.driver_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Mobile Action Buttons */}
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2">
                    {entry.status === "waiting" && (
                      <button
                        onClick={() => handleAction("call", entry.id)}
                        className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                      >
                        <Bell className="w-4 h-4" />
                        <span>نده على السائق</span>
                      </button>
                    )}

                    {entry.status === "called" && (
                      <>
                        <button
                          onClick={() => handleAction("complete", entry.id)}
                          className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow"
                        >
                          <Check className="w-4 h-4" />
                          <span>تم استلام الطلب</span>
                        </button>
                        <button
                          onClick={() => handleAction("process", entry.id)}
                          className="px-3 h-11 rounded-xl bg-indigo-600 text-white font-bold text-xs"
                        >
                          بدء التجهيز
                        </button>
                        <button
                          onClick={() => handleAction("recall", entry.id)}
                          className="px-2.5 h-11 rounded-xl bg-slate-800 text-slate-300 text-xs"
                          title="إعادة النداء"
                        >
                          نداء تاني
                        </button>
                      </>
                    )}

                    {entry.status === "processing" && (
                      <button
                        onClick={() => handleAction("complete", entry.id)}
                        className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow"
                      >
                        <Check className="w-4 h-4" />
                        <span>تم استلام الطلب</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1 w-full justify-end pt-1">
                      <button
                        onClick={() => openConfirmation(entry, "skip")}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1"
                      >
                        تخطي الدور
                      </button>
                      <span className="text-slate-700">•</span>
                      <button
                        onClick={() => openConfirmation(entry, "cancel")}
                        className="text-xs text-rose-400 hover:text-rose-200 px-2 py-1"
                      >
                        إلغاء الدور
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Dialog Modal for Skip or Cancel */}
      {confirmModal.isOpen && confirmModal.entry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">{confirmModal.title}</h3>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, entry: null, action: "skip", title: "", message: "" })}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => handleAction(confirmModal.action, confirmModal.entry?.id)}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white transition ${
                  confirmModal.action === "cancel"
                    ? "bg-rose-600 hover:bg-rose-500"
                    : "bg-amber-600 hover:bg-amber-500"
                }`}
              >
                تأكيد الإجراء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
