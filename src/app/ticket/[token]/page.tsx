"use client";

import React, { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { 
  Truck, 
  Bell, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  Users, 
  Package, 
  AlertTriangle,
  Volume2,
  VolumeX,
  Sparkles
} from "lucide-react";
import confetti from "canvas-confetti";
import { QueueEntry } from "@/types/queue";
import { StatusBadge } from "@/components/StatusBadge";
import { formatQueueNumber, formatCairoTime } from "@/lib/date-format";
import { playDriverTurnAlert, unlockAudioContext, triggerVibration } from "@/lib/audio";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function TicketContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const router = useRouter();
  const { token } = use(params);

  const [ticket, setTicket] = useState<QueueEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cooldownSec, setCooldownSec] = useState<number>(0);
  const previousStatusRef = useRef<string | null>(null);
  const retryCountRef = useRef<number>(0);

  // Unlock Web Audio API on first mobile tap/click
  useEffect(() => {
    const handleUnlock = () => unlockAudioContext();
    window.addEventListener("click", handleUnlock, { once: true });
    window.addEventListener("touchstart", handleUnlock, { once: true });
    return () => {
      window.removeEventListener("click", handleUnlock);
      window.removeEventListener("touchstart", handleUnlock);
    };
  }, []);

  const formatCooldown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Fetch ticket details from API with retry resiliency
  const fetchTicket = async () => {
    try {
      const res = await fetch(`/api/queue/ticket/${token}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        // If ticket was already loaded once, ignore transient network hiccup
        if (previousStatusRef.current) return;

        // Allow up to 3 retries (1.2s each) before declaring not found
        if (retryCountRef.current < 3) {
          retryCountRef.current += 1;
          setTimeout(fetchTicket, 1200);
          return;
        }

        setErrorMessage(data.error || "التذكرة غير موجودة");
        setLoading(false);
        return;
      }

      const current = data.entry as QueueEntry;
      setTicket(current);
      setErrorMessage(null);
      setLoading(false);
      retryCountRef.current = 0;

      // If completed, initialize 5-minute cooldown (300 seconds)
      if (current.status === "completed") {
        const completedTime = new Date(current.completed_at || current.updated_at).getTime();
        const elapsedSec = Math.floor((Date.now() - completedTime) / 1000);
        const remaining = Math.max(0, 300 - elapsedSec);
        setCooldownSec(remaining);
        try {
          localStorage.setItem("amazon_last_completed_at", current.completed_at || current.updated_at);
          localStorage.setItem("amazon_last_completed_token", current.ticket_token);
        } catch {}
      }

      // Check if status changed to 'called' to alert driver with a loud siren/alarm!
      if (previousStatusRef.current && previousStatusRef.current !== "called" && current.status === "called") {
        if (soundEnabled) {
          playDriverTurnAlert();
        }
        triggerVibration([500, 200, 500, 200, 800, 300, 800]);
        // Trigger celebratory confetti
        try {
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.6 },
          });
        } catch {}
      }

      previousStatusRef.current = current.status;
    } catch (err) {
      console.error("Failed to fetch ticket:", err);
    }
  };

  // 1-second interval countdown for 5-minute cooldown
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const interval = setInterval(() => {
      setCooldownSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSec]);

  useEffect(() => {
    fetchTicket();

    // Set up Realtime via Supabase if configured
    const supabase = getSupabaseBrowserClient();
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

    if (supabase) {
      try {
        channel = supabase
          .channel(`ticket-${token}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "queue_entries",
              filter: `ticket_token=eq.${token}`,
            },
            () => {
              fetchTicket();
            }
          )
          .subscribe();
      } catch (err) {
        console.warn("Supabase realtime subscription failed, polling active:", err);
      }
    }

    // Polling fallback every 3.5 seconds
    const interval = setInterval(fetchTicket, 3500);

    return () => {
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [token, soundEnabled]);

  const handleStartNewOrder = () => {
    try {
      localStorage.removeItem("amazon_active_ticket_token");
      localStorage.removeItem("amazon_active_ticket_number");
    } catch {}
    router.push("/");
  };

  if (loading) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full border-4 border-amber-500 border-t-transparent animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-white">جاري تحميل تذكرتك...</h2>
        <p className="text-sm text-slate-400 mt-1">خليك معانا ثانية واحدة</p>
      </main>
    );
  }

  if (errorMessage || !ticket) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-rose-950/80 border border-rose-800 flex items-center justify-center mb-1">
          <AlertTriangle className="w-8 h-8 text-rose-400" />
        </div>
        <h2 className="text-xl font-bold text-white">التذكرة غير صالحة</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          {errorMessage || "مقدرناش نلاقي التذكرة دي. ممكن تكون انتهت أو الرابط غير صحيح."}
        </p>
        <div className="w-full space-y-2.5 pt-3">
          <button
            onClick={() => {
              setLoading(true);
              setErrorMessage(null);
              retryCountRef.current = 0;
              fetchTicket();
            }}
            className="w-full h-13 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة المحاولة الآن</span>
          </button>
          <button
            onClick={handleStartNewOrder}
            className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded-xl border border-slate-700 transition cursor-pointer"
          >
            ادخل الطابور من جديد
          </button>
        </div>
      </main>
    );
  }

  const isCalled = ticket.status === "called";
  const isCompleted = ticket.status === "completed";
  const isProcessing = ticket.status === "processing";

  return (
    <main className="flex-1 flex flex-col justify-between max-w-md w-full mx-auto px-4 py-5">
      {/* Top Bar with Branding & Sound Toggle */}
      <header className="flex items-center justify-between border-b border-slate-900 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md border border-blue-400/40 bg-[#0071dc]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/amazon-now-logo.png" alt="Amazon Now" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-xs text-blue-400 font-semibold block">أمازون ناو مصر</span>
            <span className="text-sm font-bold text-white">محطة توزيع الهرم</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "كتم صوت التنبيه" : "تفعيل صوت التنبيه"}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </header>

      {/* Prominent Banner when CALLED */}
      {isCalled && (
        <div className="my-3 p-5 rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 border-2 border-blue-300 text-white shadow-2xl animate-urgent-glow text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white text-blue-600 shadow-lg mb-1 ring-4 ring-white/20">
            <Bell className="w-8 h-8 animate-bounce" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow">
            دورك جه! اتفضل استلم طلبك
          </h2>
          <p className="text-sm sm:text-base text-blue-50 font-semibold max-w-sm mx-auto">
            اتوجه لشباك التسليم فوراً وورّي الموظف رقم تذكرتك
          </p>

          <button
            onClick={() => playDriverTurnAlert()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white text-blue-700 hover:bg-blue-50 font-black text-xs sm:text-sm shadow-xl transition active:scale-95 cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-blue-600 animate-pulse" />
            <span>تشغيل صوت التنبيه</span>
          </button>
        </div>
      )}

      {/* Processing Banner */}
      {isProcessing && (
        <div className="my-3 p-3.5 rounded-2xl bg-indigo-950/70 border border-indigo-700/60 text-center space-y-1">
          <div className="flex items-center justify-center gap-2 text-indigo-300 font-bold text-base">
            <Package className="w-5 h-5 animate-pulse" />
            <span>جاري تجهيز طلبك دلوقتي</span>
          </div>
          <p className="text-xs text-indigo-200">
            فريق العمل بيجهز شحنتك، خليك قريب من شباك التسليم
          </p>
        </div>
      )}

      {/* Main Ticket Card */}
      <div className="my-auto py-3">
        <div className="relative rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-2xl overflow-hidden text-center space-y-5">
          {/* Background Ambient Glow */}
          <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
            isCalled ? "bg-blue-500" : isCompleted ? "bg-emerald-500" : "bg-amber-500"
          }`} />

          {/* Status Badge */}
          <div className="flex justify-center">
            <StatusBadge status={ticket.status} size="lg" />
          </div>

          {/* Queue Number Display */}
          <div className="space-y-1">
            <span className="text-xs sm:text-sm font-semibold text-slate-400 tracking-wider">
              رقمك في الطابور
            </span>
            <div className={`text-6xl sm:text-7xl font-black tracking-tighter ${
              isCalled ? "text-blue-400 scale-105 transition-transform" : isCompleted ? "text-emerald-400" : "text-amber-400"
            }`}>
              {formatQueueNumber(ticket.queue_number)}
            </div>
          </div>

          {/* Optional Driver / Order Information */}
          {(ticket.order_reference || ticket.driver_name) && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-slate-800/80 text-xs text-slate-300">
              {ticket.order_reference && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-amber-300">
                  شحنة: {ticket.order_reference}
                </span>
              )}
              {ticket.driver_name && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
                  كابتن: {ticket.driver_name}
                </span>
              )}
            </div>
          )}

          {/* Waiting Queue Position Cards (Only visible if waiting) */}
          {ticket.status === "waiting" && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>ترتيبك في الطابور</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {ticket.position ?? 1}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>قبلك كام واحد</span>
                </div>
                <div className="text-2xl font-bold text-amber-400">
                  {ticket.people_ahead ?? 0}
                </div>
              </div>
            </div>
          )}

          {/* Estimated Waiting Time */}
          {ticket.status === "waiting" && ticket.estimated_wait_minutes && (
            <div className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <span>الوقت التقريبي المتبقي:</span>
              <strong className="text-slate-200">حوالي {ticket.estimated_wait_minutes} دقائق</strong>
            </div>
          )}

          {/* Joined Time */}
          <div className="text-[11px] text-slate-500">
            وقت الدخول: {formatCairoTime(ticket.joined_at)}
          </div>
        </div>
      </div>

      {/* Completion or Repeat Order Section */}
      {isCompleted ? (
        <div className="space-y-4 text-center pb-2">
          <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-200 text-sm space-y-1">
            <div className="flex items-center justify-center gap-2 font-bold text-emerald-300">
              <CheckCircle2 className="w-5 h-5" />
              <span>تم استلام الطلب بنجاح!</span>
            </div>
            <p className="text-xs text-emerald-300/80 leading-relaxed">
              تسلم يا بطل! تم إنهاء طلبك وإزالته من الطابور.
            </p>
          </div>

          {cooldownSec > 0 ? (
            <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-600/70 text-amber-200 space-y-2 text-start">
              <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                <span>فترة راحة إلزامية (٥ دقائق):</span>
                <span dir="ltr" className="font-mono text-sm text-white bg-slate-950 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                  {formatCooldown(cooldownSec)}
                </span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                تقدر تدخل الطابور لشحنة جديدة فور انتهاء وقت الراحة. الزر هيفتح تلقائياً.
              </p>
            </div>
          ) : null}

          <button
            onClick={handleStartNewOrder}
            disabled={cooldownSec > 0}
            className={`w-full h-15 rounded-2xl font-black text-lg transition shadow-xl flex items-center justify-center gap-2 select-none ${
              cooldownSec > 0
                ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed opacity-90"
                : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 cursor-pointer active:scale-[0.98]"
            }`}
          >
            {cooldownSec > 0 ? (
              <div className="flex items-center justify-center gap-2 text-base">
                <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                <span>برجاء الانتظار</span>
                <span dir="ltr" className="font-mono font-bold text-amber-300">
                  ({formatCooldown(cooldownSec)})
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <RotateCcw className="w-5 h-5" />
                <span>طلب جديد (ادخل الطابور تاني)</span>
              </div>
            )}
          </button>
        </div>
      ) : (
        <div className="text-center space-y-3 pb-2">
          <p className="text-xs text-slate-400">
            الصفحة دي بتتحدث تلقائياً. تقدر تسيبها مفتوحة وهيجيلك تنبيه بصوت واهتزاز أول ما دورك يجي.
          </p>

          <button
            onClick={fetchTicket}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition py-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>تحديث يدوي للحالة</span>
          </button>
        </div>
      )}
    </main>
  );
}

export default function DriverTicketPage(props: {
  params: Promise<{ token: string }>;
}) {
  return (
    <React.Suspense
      fallback={
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full border-4 border-amber-500 border-t-transparent animate-spin mb-4" />
          <h2 className="text-xl font-bold text-white">جاري تحميل تذكرتك...</h2>
          <p className="text-sm text-slate-400 mt-1">خليك معانا ثانية واحدة</p>
        </main>
      }
    >
      <TicketContent params={props.params} />
    </React.Suspense>
  );
}
