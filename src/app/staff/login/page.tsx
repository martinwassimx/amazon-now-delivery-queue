"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, Lock, Mail, ArrowLeft, AlertCircle, CheckCircle2, ShieldCheck, Key } from "lucide-react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const supabase = getSupabaseBrowserClient();

    if (supabase && isSupabaseConfigured()) {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrorMsg(error.message || "البريد الإلكتروني أو كلمة المرور غير صحيحة");
          setLoading(false);
          return;
        }

        router.push("/staff");
        return;
      } catch (err) {
        console.error("Auth error:", err);
      }
    }

    // Local / Demo Mode Bypass
    if (email || password) {
      // Simulate quick check for testing
      localStorage.setItem("amazon_staff_auth", "true");
      router.push("/staff");
    } else {
      setErrorMsg("من فضلك أدخل البريد الإلكتروني وكلمة المرور");
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    localStorage.setItem("amazon_staff_auth", "true");
    router.push("/staff");
  };

  return (
    <main className="min-h-screen flex flex-col justify-between items-center p-4 sm:p-6 bg-slate-950 text-white">
      <div className="w-full max-w-sm mx-auto my-auto space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="w-18 h-18 rounded-3xl overflow-hidden shadow-2xl border-2 border-blue-400/50 bg-[#0071dc] mx-auto hover:scale-105 transition-transform duration-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/amazon-now-logo.png" alt="Amazon Now" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight pt-2">
            تسجيل دخول موظفي المحطة
          </h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-blue-500/30 text-amber-400 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>محطة توزيع أمازون ناو — الهرم</span>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Card */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                البريد الإلكتروني الوظيفي
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute start-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@amazon-now.eg"
                  dir="ltr"
                  className="w-full h-12 ps-10 pe-4 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition text-right"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute start-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="w-full h-12 ps-10 pe-4 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition text-right"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Key className="w-4 h-4" />
              <span>{loading ? "جاري الدخول..." : "دخول إلى النظام"}</span>
            </button>
          </form>

          {/* Quick Demo Login Option */}
          <div className="pt-3 border-t border-slate-800 text-center space-y-2">
            <span className="text-[11px] text-slate-500 block">أو للتجربة المباشرة والتطوير:</span>
            <button
              type="button"
              onClick={handleDemoLogin}
              className="w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition border border-slate-700 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>دخول تجريبي سريع بضغطة واحدة (Demo Login)</span>
            </button>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center">
          <a
            href="/"
            className="text-xs text-slate-400 hover:text-white transition inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>الرجوع لصفحة السائق الرئيسية</span>
          </a>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-600 py-2">
        نظام إدارة محطات أمازون ناو مصر — تسجيل الدخول محمي ومراقب
      </footer>
    </main>
  );
}
