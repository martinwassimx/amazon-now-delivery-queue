"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, RefreshCw, UserCheck, Clock, FileText } from "lucide-react";
import { StaffNav } from "@/components/StaffNav";
import { StaffAuditLog } from "@/types/queue";
import { formatCairoTime, formatCairoDate, formatQueueNumber } from "@/lib/date-format";

export default function StaffAuditPage() {
  const [logs, setLogs] = useState<StaffAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/queue/audit?limit=50");
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <StaffNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 text-amber-400" />
              <span>سجل الرقابة والعمليات (Audit Log)</span>
            </h1>
            <p className="text-xs text-slate-400">
              سجل تفصيلي بكل إجراء اتخذه فريق العمل (نداء، تجهيز، استلام، تخطي، إلغاء) لضمان الشفافية.
            </p>
          </div>

          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>تحديث السجل</span>
          </button>
        </div>

        {/* Logs Timeline / Table */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
            <p className="text-sm text-slate-400">جاري تحميل سجل الرقابة...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-2 p-6">
            <FileText className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">لا توجد عمليات مسجلة حتى الآن</h3>
            <p className="text-xs text-slate-400">كل حركة يقوم بها الموظف تسجل هنا فوراً.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-xs font-semibold">
                  <tr>
                    <th className="py-4 px-6 text-start">الوقت</th>
                    <th className="py-4 px-4 text-start">نوع الإجراء</th>
                    <th className="py-4 px-4 text-start">رقم الطابور</th>
                    <th className="py-4 px-4 text-start">القائم بالعملية</th>
                    <th className="py-4 px-6 text-start">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-4 px-6 text-xs text-slate-400 font-mono">
                        {formatCairoTime(log.created_at)}
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 border border-slate-700 text-amber-300">
                          {log.action_label_ar}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-white">
                        {log.queue_number ? formatQueueNumber(log.queue_number) : "—"}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-300">
                        {log.performed_by_name}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400">
                        {log.details || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
