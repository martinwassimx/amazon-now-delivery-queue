"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { 
  QrCode, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  ExternalLink, 
  Truck, 
  ShieldCheck, 
  Smartphone, 
  Sparkles 
} from "lucide-react";
import { StaffNav } from "@/components/StaffNav";

export default function StaffQrManagementPage() {
  const [siteUrl, setSiteUrl] = useState<string>("");
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Generate full URL pointing to driver join page
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const targetUrl = `${origin}/`;
    setSiteUrl(targetUrl);

    // Generate high resolution QR Code
    QRCode.toDataURL(
      targetUrl,
      {
        width: 600,
        margin: 2,
        color: {
          dark: "#090d16",
          light: "#ffffff",
        },
      },
      (err, url) => {
        if (!err && url) {
          setQrPngDataUrl(url);
        }
      }
    );
  }, []);

  const handleCopyLink = () => {
    if (!siteUrl) return;
    navigator.clipboard.writeText(siteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPng = () => {
    if (!qrPngDataUrl) return;
    const a = document.createElement("a");
    a.href = qrPngDataUrl;
    a.download = "amazon-now-delivery-queue-qr.png";
    a.click();
  };

  const handlePrintPoster = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <div className="print:hidden">
        <StaffNav />
      </div>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header (Hidden in Print) */}
        <div className="print:hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <QrCode className="w-6 h-6 text-amber-400" />
              <span>إدارة كود الـ QR الدائم للمحطة</span>
            </h1>
            <p className="text-xs text-slate-400">
              كود QR دائم وثابت يعلق في ساحة استلام الشحنات لجميع السائقين والمندوبين
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPoster}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة بوستر A4</span>
            </button>
            <button
              onClick={handleDownloadPng}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              <Download className="w-4 h-4" />
              <span>تحميل PNG</span>
            </button>
          </div>
        </div>

        {/* Link Copy Box (Hidden in Print) */}
        <div className="print:hidden p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400 overflow-hidden">
            <span className="font-semibold text-slate-300 shrink-0">رابط الدخول المباشر:</span>
            <code className="text-amber-400 truncate dir-ltr">{siteUrl}</code>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 transition font-bold"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "تم النسخ!" : "نسخ الرابط"}</span>
            </button>
            <a
              href={siteUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 transition"
              title="فتح الرابط"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* PRINTABLE POSTER TEMPLATE (Optimized for both screen preview & physical A4 printing) */}
        <div className="bg-white text-slate-950 rounded-3xl p-8 sm:p-12 shadow-2xl border border-slate-300 max-w-xl mx-auto text-center space-y-6 print:shadow-none print:border-none print:p-4 print:max-w-none print:w-full print:m-0">
          {/* Poster Top Brand */}
          <div className="border-b-2 border-slate-950 pb-5 space-y-2 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md border-2 border-blue-500/40 bg-[#0071dc] mb-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/amazon-now-logo.png" alt="Amazon Now" className="w-full h-full object-cover" />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600 text-white font-black text-xs uppercase tracking-wide">
              <span>محطة توزيع أمازون ناو — الهرم</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950 pt-1">
              طابور استلام الشحنات
            </h2>
            <p className="text-sm font-bold text-slate-600">
              امسح الكود بكاميرا الموبايل عشان تاخد رقمك فوراً
            </p>
          </div>

          {/* QR Code Big Center */}
          <div className="py-2 flex flex-col items-center justify-center space-y-3">
            <div className="p-4 rounded-3xl bg-slate-50 border-4 border-slate-950 shadow-inner inline-block">
              {qrPngDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrPngDataUrl}
                  alt="Amazon Delivery Queue Permanent QR Code"
                  className="w-64 h-64 sm:w-80 sm:h-80 object-contain mx-auto"
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-slate-400">
                  جاري تجهيز الكود...
                </div>
              )}
            </div>

            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
              SCAN TO JOIN QUEUE
            </span>
          </div>

          {/* Instructions Box in Egyptian Arabic */}
          <div className="bg-slate-100 rounded-2xl p-5 border border-slate-300 text-start space-y-3">
            <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-600" />
              <span>خطوات الدخول في ثواني:</span>
            </h3>

            <ol className="space-y-2 text-sm text-slate-800 font-medium">
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-slate-950 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  ١
                </span>
                <span>افتح كاميرا موبايلك وامسح كود الـ QR ده.</span>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-slate-950 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  ٢
                </span>
                <span>اكتب اسمك الثلاثي واضغط على الزر الكبير <strong>&quot;ادخل الطابور&quot;</strong>.</span>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-slate-950 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  ٣
                </span>
                <span>هتاخد رقمك وترتيبك فوراً، ولما يجي دورك هيرن موبايلك وهتلاقي رقمك على الشاشة الكبيرة.</span>
              </li>
            </ol>
          </div>

          {/* Poster Footer Notice */}
          <div className="pt-2 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>بدون تسجيل حساب — لا يتطلب إدخال رقم هاتف أو بريد إلكتروني</span>
          </div>
        </div>
      </main>
    </div>
  );
}
