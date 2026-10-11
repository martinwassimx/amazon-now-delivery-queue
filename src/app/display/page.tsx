"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Tv, 
  Maximize, 
  Minimize, 
  Volume2, 
  VolumeX, 
  Bell, 
  Package, 
  CheckCircle2, 
  Clock, 
  Truck 
} from "lucide-react";
import { QueueEntry, QueueStats } from "@/types/queue";
import { formatQueueNumber, formatCairoTime } from "@/lib/date-format";
import { playCallChime } from "@/lib/audio";
import { LiveClock } from "@/components/LiveClock";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function PublicDisplayPage() {
  const [activeQueue, setActiveQueue] = useState<QueueEntry[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousCalledRef = useRef<number | null>(null);

  const fetchDisplayData = async () => {
    try {
      const [queueRes, statsRes] = await Promise.all([
        fetch("/api/queue/active"),
        fetch("/api/queue/stats"),
      ]);

      const qData = await queueRes.json();
      const sData = await statsRes.json();

      if (qData.success) {
        setActiveQueue(qData.entries);
      }

      if (sData.success) {
        const newStats = sData.stats as QueueStats;
        // Check if a new number was called
        if (
          newStats.current_called_number &&
          newStats.current_called_number !== previousCalledRef.current
        ) {
          if (soundEnabled && previousCalledRef.current !== null) {
            playCallChime();
          }
          previousCalledRef.current = newStats.current_called_number;
        }
        setStats(newStats);
      }
    } catch (err) {
      console.error("Failed to update public display:", err);
    }
  };

  useEffect(() => {
    fetchDisplayData();

    const supabase = getSupabaseBrowserClient();
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

    if (supabase) {
      try {
        const client = supabase;
        channel = client
          .channel("public-display")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "queue_entries" },
            () => {
              fetchDisplayData();
            }
          )
          .subscribe();
      } catch (e) {
        console.warn("Public display realtime error:", e);
      }
    }

    const interval = setInterval(fetchDisplayData, 3000);
    return () => {
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [soundEnabled]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const calledEntries = activeQueue.filter((e) => e.status === "called");
  const processingEntries = activeQueue.filter((e) => e.status === "processing");
  const waitingEntries = activeQueue.filter((e) => e.status === "waiting");

  // The most prominent called entry
  const currentCalled = calledEntries[0] || null;
  // Other called entries
  const otherCalled = calledEntries.slice(1);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 select-none overflow-hidden">
      {/* Top TV Bar */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl overflow-hidden shadow-lg border border-blue-400/40 bg-[#0071dc] shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/amazon-now-logo.png" alt="Amazon Now" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              أمازون ناو — شاشة الطابور العامة
            </h1>
            <p className="text-xs sm:text-sm text-amber-400 font-semibold">
              محطة توزيع أمازون ناو — الهرم • شباك تسليم الشحنات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <LiveClock showDate={true} className="text-lg font-bold" />

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
            title={soundEnabled ? "كتم الصوت" : "تشغيل الصوت"}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-amber-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
            title="وضع ملء الشاشة"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Grid: Prominent Called Hero on Left/Right, Supporting Queue on other */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 items-stretch">
        {/* Main "الدور الحالي" Hero Display (Occupies 7 cols on desktop) */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl bg-gradient-to-br from-blue-950/70 via-slate-900 to-slate-950 border-2 border-blue-500/60 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold text-sm">
              <Bell className="w-4 h-4 animate-bounce" />
              <span>الدور الحالي — اتفضل عند الشباك</span>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              NOW SERVING
            </div>
          </div>

          {currentCalled ? (
            <div className="my-auto py-8 text-center space-y-4">
              <div className="text-8xl sm:text-9xl font-black text-amber-400 font-mono tracking-tighter drop-shadow-[0_0_40px_rgba(245,158,11,0.5)]">
                {formatQueueNumber(currentCalled.queue_number)}
              </div>

              <div className="space-y-1">
                <p className="text-2xl sm:text-3xl font-extrabold text-white">
                  {currentCalled.driver_name ? `كابتن: ${currentCalled.driver_name}` : "رقم الدور المطلوب"}
                </p>
                {currentCalled.order_reference && (
                  <p className="text-lg font-mono text-blue-300">
                    رقم الشحنة: {currentCalled.order_reference}
                  </p>
                )}
              </div>

              {/* Other recently called numbers */}
              {otherCalled.length > 0 && (
                <div className="pt-6 border-t border-slate-800/80">
                  <span className="text-xs text-slate-400 block mb-2 font-bold">
                    أدوار تم النداء عليها أيضاً:
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {otherCalled.map((entry) => (
                      <span
                        key={entry.id}
                        className="px-4 py-2 rounded-2xl bg-slate-950 border border-blue-500/40 text-blue-300 font-mono text-xl font-bold"
                      >
                        {formatQueueNumber(entry.queue_number)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="my-auto py-12 text-center space-y-3">
              <div className="text-6xl sm:text-7xl font-black text-slate-600 font-mono">
                ----
              </div>
              <p className="text-lg font-bold text-slate-400">
                في انتظار استدعاء الدور القادم من موظف الشباك
              </p>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-900">
            <span>تحديث لحظي ومستمر</span>
            <span>يرجى تجهيز هويتك ورقم الشحنة</span>
          </div>
        </div>

        {/* Right Columns: "جاري تجهيز الطلب" & "الأدوار اللي جاية" (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6 justify-between">
          {/* Section: جاري تجهيز الطلب (Processing) */}
          <div className="flex-1 rounded-3xl bg-slate-900/90 border border-indigo-500/30 p-5 sm:p-6 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <Package className="w-4 h-4" />
                <span>جاري تجهيز الطلب ({processingEntries.length})</span>
              </div>
              <span className="text-xs text-slate-500 font-mono">PREPARING</span>
            </div>

            <div className="my-3">
              {processingEntries.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  لا توجد طلبات قيد التجهيز حالياً
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {processingEntries.map((e) => (
                    <div
                      key={e.id}
                      className="p-3 rounded-2xl bg-slate-950 border border-indigo-500/40 text-center"
                    >
                      <span className="font-mono text-2xl font-black text-indigo-300 block">
                        {formatQueueNumber(e.queue_number)}
                      </span>
                      {e.driver_name && (
                        <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                          {e.driver_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-[11px] text-indigo-300/70 pt-2 border-t border-slate-800/80">
              الشحنات دي بتتجهز في المخزن وهتكون عند الشباك قريباً
            </div>
          </div>

          {/* Section: الأدوار اللي جاية (Next Waiting in Queue) */}
          <div className="flex-1 rounded-3xl bg-slate-900/90 border border-amber-500/20 p-5 sm:p-6 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Clock className="w-4 h-4" />
                <span>الأدوار اللي جاية في الطابور ({waitingEntries.length})</span>
              </div>
              <span className="text-xs text-slate-500 font-mono">UP NEXT</span>
            </div>

            <div className="my-3">
              {waitingEntries.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  مفيش حد مستني في الطابور
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {waitingEntries.slice(0, 8).map((e, idx) => (
                    <div
                      key={e.id}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center relative"
                    >
                      <span className="absolute top-1 start-2 text-[10px] text-slate-600 font-bold">
                        #{idx + 1}
                      </span>
                      <span className="font-mono text-2xl font-black text-slate-200 block pt-1">
                        {formatQueueNumber(e.queue_number)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
              الأدوار مرتبة بأسبقية الحضور (FIFO)
            </div>
          </div>
        </div>
      </main>

      {/* Footer Instructions for Drivers Waiting in Hall */}
      <footer className="border-t border-slate-900 pt-3 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
        <p>
          لو لسه ما دخلتش الطابور، امسح كود الـ QR المعلق بجانب الباب واضغط &quot;ادخل الطابور&quot;
        </p>
        <div className="flex items-center gap-4 text-slate-500">
          <span>نظام طابور التوصيل الذكي</span>
          <span>•</span>
          <span>أمازون ناو مصر</span>
        </div>
      </footer>
    </div>
  );
}
