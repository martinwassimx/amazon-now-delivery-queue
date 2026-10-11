"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Truck, 
  ArrowLeft, 
  ShieldCheck, 
  RefreshCw, 
  AlertCircle, 
  User, 
  Hourglass,
  Clock,
  Lock
} from "lucide-react";
import { LiveClock } from "@/components/LiveClock";
import { AmazonNowLogo } from "@/components/AmazonNowLogo";

const COOLDOWN_DURATION_SEC = 5 * 60; // 5 minutes = 300 seconds

export default function DriverJoinPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [existingActiveTicket, setExistingActiveTicket] = useState<{ token: string; number: number } | null>(null);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(true);
  
  // 5-minute Cooldown State
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [lastCompletedToken, setLastCompletedToken] = useState<string | null>(null);

  // Initialize and check 5-minute cooldown
  useEffect(() => {
    const key = typeof crypto !== "undefined" && crypto.randomUUID 
      ? crypto.randomUUID() 
      : "idemp-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9);
    setIdempotencyKey(key);

    // 1. Check if driver has an existing ticket (active or recently completed)
    try {
      const savedToken = localStorage.getItem("amazon_active_ticket_token");
      const savedNumber = localStorage.getItem("amazon_active_ticket_number");

      if (savedToken) {
        fetch(`/api/queue/ticket/${savedToken}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.entry) {
              const ticket = data.entry;
              if (ticket.status === "completed") {
                // Order completed! Remove from active and enforce 5-minute cooldown
                localStorage.removeItem("amazon_active_ticket_token");
                localStorage.removeItem("amazon_active_ticket_number");
                setExistingActiveTicket(null);
                setLastCompletedToken(savedToken);

                const completedTime = new Date(ticket.completed_at || ticket.updated_at).getTime();
                const elapsedSec = Math.floor((Date.now() - completedTime) / 1000);
                if (elapsedSec < COOLDOWN_DURATION_SEC) {
                  setCooldownRemaining(COOLDOWN_DURATION_SEC - elapsedSec);
                  localStorage.setItem("amazon_last_completed_at", ticket.completed_at || ticket.updated_at);
                  localStorage.setItem("amazon_last_completed_token", savedToken);
                }
              } else if (["waiting", "called", "processing"].includes(ticket.status)) {
                setExistingActiveTicket({
                  token: savedToken,
                  number: ticket.queue_number,
                });
              }
            }
          })
          .catch(() => {});
      }
    } catch {}

    // 2. Check cached 5-minute cooldown timestamp
    try {
      const completedAtStr = localStorage.getItem("amazon_last_completed_at");
      const completedToken = localStorage.getItem("amazon_last_completed_token");
      if (completedToken) setLastCompletedToken(completedToken);

      if (completedAtStr) {
        const completedTime = new Date(completedAtStr).getTime();
        const elapsedSec = Math.floor((Date.now() - completedTime) / 1000);
        if (elapsedSec < COOLDOWN_DURATION_SEC) {
          setCooldownRemaining(COOLDOWN_DURATION_SEC - elapsedSec);
        } else {
          localStorage.removeItem("amazon_last_completed_at");
        }
      }
    } catch {}
  }, []);

  // Check Session Open/Closed status every 3.5s
  useEffect(() => {
    const checkSession = () => {
      fetch("/api/queue/stats")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.stats && data.stats.is_session_active !== undefined) {
            setIsSessionActive(data.stats.is_session_active);
          }
        })
        .catch(() => {});
    };

    checkSession();
    const interval = setInterval(checkSession, 3500);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          try {
            localStorage.removeItem("amazon_last_completed_at");
          } catch {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Format seconds to MM:SS (e.g. 04:35)
  const formatCooldown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleJoinQueue = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;

    // 0. Enforce session active check
    if (!isSessionActive) {
      setErrorMessage("الطابور مغلق حالياً من قِبل إدارة محطة الهرم، لا يمكن حجز دور حتى يتم فتح جلسة جديدة من قِبل المشرفين.");
      return;
    }

    // 1. Enforce 5-minute cooldown check
    if (cooldownRemaining > 0) {
      const remM = Math.floor(cooldownRemaining / 60);
      const remS = cooldownRemaining % 60;
      setErrorMessage(`استلمت طلبك للتو! يجب الانتظار ٥ دقائق راحة قبل دخول الطابور مرة أخرى (متبقي ${remM} دقيقة و ${remS} ثانية)`);
      return;
    }

    // 2. Enforce Mandatory Driver Name
    if (!driverName.trim()) {
      setErrorMessage("من فضلك اكتب اسمك أو كود المندوب الأول عشان نقدر ننده عليك عند الشباك!");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          driver_name: driverName.trim(),
          last_completed_token: lastCompletedToken || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.session_closed) {
          setIsSessionActive(false);
        }
        if (data.cooldown_remaining_seconds) {
          setCooldownRemaining(data.cooldown_remaining_seconds);
        }
        setErrorMessage(data.error || "حصلت مشكلة في الدخول للطابور، حاول تاني");
        setLoading(false);
        return;
      }

      const { entry } = data;
      // Save in localStorage for convenient resumption
      try {
        localStorage.setItem("amazon_active_ticket_token", entry.ticket_token);
        localStorage.setItem("amazon_active_ticket_number", String(entry.queue_number));
        // Also save name for convenience next time
        localStorage.setItem("amazon_saved_driver_name", driverName.trim());
      } catch {}

      // Navigate to driver's private ticket page
      router.push(`/ticket/${entry.ticket_token}`);
    } catch (err) {
      console.error("Join queue network error:", err);
      setErrorMessage("مشكلة في الاتصال بالشبكة، تأكد من الإنترنت وحاول تاني");
      setLoading(false);
    }
  };

  // Pre-fill previously saved name on client
  useEffect(() => {
    try {
      const saved = localStorage.getItem("amazon_saved_driver_name");
      if (saved && !driverName) setDriverName(saved);
    } catch {}
  }, []);

  return (
    <main className="flex-1 flex flex-col justify-between max-w-md w-full mx-auto px-4 py-5">
      {/* Top Header / Amazon Now Branding */}
      <header className="text-center space-y-2 pt-1">
        <div className="flex justify-center mb-1">
          <AmazonNowLogo className="w-40 sm:w-44 h-auto" withBadge={true} hubName="محطة توزيع أمازون ناو — الهرم" />
        </div>

        <div className="flex justify-center pt-1">
          <LiveClock showDate={false} />
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">
          طابور استلام الشحنات
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 px-2 leading-relaxed">
          أهلاً بيك يا كابتن! اكتب اسمك واضغط على الزر عشان تاخد دورك فوراً.
        </p>
      </header>

      {/* Session Closed Alert Banner */}
      {!isSessionActive && (
        <div className="my-3.5 p-4 rounded-2xl bg-rose-950/80 border border-rose-700 text-rose-200 shadow-xl space-y-2 animate-pulse">
          <div className="flex items-center gap-2.5 font-bold text-sm text-rose-300">
            <Lock className="w-5 h-5 text-rose-400 shrink-0" />
            <span>الطابور مغلق حالياً (استقبال المناديب متوقف)</span>
          </div>
          <p className="text-xs text-rose-200/90 leading-relaxed">
            محطة توزيع الهرم أغلقت استقبال الطلبات حالياً. برجاء الانتظار حتى يقوم الموظف بفتح جلسة عمل جديدة.
          </p>
        </div>
      )}

      {/* 5-minute Cooldown Alert Banner */}
      {cooldownRemaining > 0 && (
        <div className="my-3.5 p-4 rounded-2xl bg-amber-950/70 border border-amber-600/70 text-amber-200 shadow-xl space-y-2 animate-pulse">
          <div className="flex items-center gap-2.5 font-bold text-sm text-amber-300">
            <Hourglass className="w-5 h-5 text-amber-400 animate-spin" />
            <span>فترة راحة إلزامية: ٥ دقائق بعد استلام الشحنة</span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            استلمت شحنتك بنجاح! تنص تعليمات محطة الهرم على الانتظار ٥ دقائق قبل دخول الطابور مرة أخرى.
          </p>
          <div className="pt-1 flex items-center justify-between text-xs font-bold text-white bg-slate-950/70 px-3.5 py-2 rounded-xl border border-amber-500/20">
            <span>متبقي لفتح الطابور:</span>
            <div className="flex items-center gap-1.5">
              <span dir="ltr" className="text-amber-400 text-base font-mono font-black">
                {formatCooldown(cooldownRemaining)}
              </span>
              <span className="text-slate-400 text-xs">دقيقة</span>
            </div>
          </div>
        </div>
      )}

      {/* Existing Ticket Banner if driver already has one */}
      {existingActiveTicket && (
        <div className="my-3 p-4 rounded-2xl bg-blue-950/40 border border-blue-800/60 flex items-center justify-between gap-3 text-sm">
          <div className="space-y-0.5">
            <span className="text-xs text-blue-400 font-semibold">تذكرتك الحالية محفوظة</span>
            <p className="text-white font-bold">رقمك: {existingActiveTicket.number}</p>
          </div>
          <button
            onClick={() => router.push(`/ticket/${existingActiveTicket.token}`)}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow"
          >
            <span>عرض التذكرة</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Action Form */}
      <form onSubmit={handleJoinQueue} className="my-auto py-4 space-y-5">
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-xs sm:text-sm">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Mandatory Driver Name Field */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <User className="w-4 h-4 text-amber-400" />
              <span>اسمك أو كود المندوب</span>
            </span>
            <span className="text-xs text-amber-400 font-semibold">(مطلوب)</span>
          </label>
          <div className="relative">
            <input
              id="driver-name-input"
              type="text"
              required
              value={driverName}
              onChange={(e) => {
                setDriverName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="اكتب اسمك الثلاثي أو كود المندوب..."
              className="w-full h-14 px-4 rounded-2xl bg-slate-900 border-2 border-slate-700 focus:border-amber-500 text-white placeholder-slate-500 text-base font-semibold shadow-inner focus:outline-none transition-all"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            هننده عليك باسمك ده عند شباك الاستلام أول ما طلبك يجهز.
          </p>
        </div>

        {/* The Big Join Button */}
        <div className="relative group pt-1">
          <div className={`absolute -inset-1 rounded-3xl blur-lg transition duration-300 ${
            cooldownRemaining > 0 || !isSessionActive
              ? "bg-slate-700 opacity-30" 
              : "bg-gradient-to-r from-amber-500 to-amber-600 opacity-70 group-hover:opacity-100"
          }`}></div>
          <button
            id="join-queue-button"
            type="submit"
            disabled={loading || cooldownRemaining > 0 || !isSessionActive}
            className={`relative w-full h-18 sm:h-20 rounded-2xl font-black text-xl sm:text-2xl flex items-center justify-center gap-3 shadow-xl transition-all duration-200 select-none ${
              cooldownRemaining > 0 || !isSessionActive
                ? "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700"
                : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-slate-950 cursor-pointer"
            }`}
          >
            {loading ? (
              <div className="flex items-center gap-3">
                <RefreshCw className="w-7 h-7 animate-spin text-slate-950" />
                <span className="text-lg font-bold">جاري حجز دورك...</span>
              </div>
            ) : !isSessionActive ? (
              <div className="flex items-center justify-center gap-2 text-base sm:text-lg">
                <Lock className="w-5 h-5 text-rose-400 shrink-0" />
                <span>الطابور مغلق حالياً (غير متاح)</span>
              </div>
            ) : cooldownRemaining > 0 ? (
              <div className="flex items-center justify-center gap-2 text-base sm:text-lg">
                <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                <span>برجاء الانتظار</span>
                <span dir="ltr" className="font-mono font-bold text-amber-300">
                  ({formatCooldown(cooldownRemaining)})
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span>ادخل الطابور</span>
                <ArrowLeft className="w-7 h-7 transition-transform group-hover:-translate-x-1" />
              </div>
            )}
          </button>
        </div>

        {/* Badges / Guarantees */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 text-center pt-1">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>بدون تسجيل حساب — دورك فوري بنظام الأسبقية</span>
        </div>
      </form>

      {/* Footer */}
      <footer className="pt-4 border-t border-slate-900/60 flex flex-col items-center gap-1.5 text-center text-xs text-slate-500">
        <p>© أمازون ناو مصر — محطة توزيع الهرم</p>
      </footer>
    </main>
  );
}
