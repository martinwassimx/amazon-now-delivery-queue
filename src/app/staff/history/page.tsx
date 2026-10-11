"use client";

import React, { useState, useEffect } from "react";
import { History, Search, RefreshCw, Calendar, PackageCheck, Truck } from "lucide-react";
import { StaffNav } from "@/components/StaffNav";
import { StatusBadge } from "@/components/StatusBadge";
import { QueueEntry } from "@/types/queue";
import { formatQueueNumber, formatCairoTime, formatCairoDate } from "@/lib/date-format";

export default function StaffHistoryPage() {
  const [history, setHistory] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/queue/history?limit=100");
      const data = await res.json();
      if (data.success) {
        setHistory(data.entries);
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredHistory = history.filter((entry) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(entry.queue_number).includes(q) ||
      (entry.order_reference && entry.order_reference.toLowerCase().includes(q)) ||
      (entry.driver_name && entry.driver_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <StaffNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <History className="w-6 h-6 text-amber-400" />
              <span>سجل الطلبات السابقة</span>
            </h1>
            <p className="text-xs text-slate-400">
              جميع الطلبات التي تم إنهاؤها أو تسليمها أو تخطيها اليوم
            </p>
          </div>

          <button
            onClick={fetchHistory}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>تحديث السجل</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث برقم الطابور أو رقم الشحنة أو اسم السائق..."
            className="w-full h-11 ps-10 pe-4 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        {/* History Table */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
            <p className="text-sm text-slate-400">جاري تحميل سجل الطلبات...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-20 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-2 p-6">
            <PackageCheck className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">لا توجد طلبات سابقة في السجل</h3>
            <p className="text-xs text-slate-400">أي طلب يتم إتمامه سيظهر هنا تلقائياً بالوقت والتاريخ.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-xs font-semibold">
                  <tr>
                    <th className="py-4 px-6 text-start">رقم الطابور</th>
                    <th className="py-4 px-4 text-start">الحالة النهائية</th>
                    <th className="py-4 px-4 text-start">رقم الشحنة</th>
                    <th className="py-4 px-4 text-start">اسم السائق</th>
                    <th className="py-4 px-4 text-start">وقت الدخول</th>
                    <th className="py-4 px-4 text-start">وقت الإنهاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredHistory.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-4 px-6">
                        <span className="font-mono text-xl font-black text-amber-400">
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
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-300 font-medium">
                        {entry.driver_name || <span className="text-slate-600">سائق</span>}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-400">
                        {formatCairoTime(entry.joined_at)}
                      </td>
                      <td className="py-4 px-4 text-xs text-emerald-400 font-semibold">
                        {formatCairoTime(entry.completed_at || entry.updated_at)}
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
