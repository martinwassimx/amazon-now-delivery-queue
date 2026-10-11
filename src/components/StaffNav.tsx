"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Users, 
  History, 
  QrCode, 
  Tv, 
  ShieldAlert, 
  Truck, 
  Menu, 
  X, 
  LogOut,
  Sparkles
} from "lucide-react";
import { LiveClock } from "./LiveClock";

export function StaffNav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/staff", label: "الطابور الحالي", icon: Users },
    { href: "/staff/history", label: "سجل الطلبات", icon: History },
    { href: "/staff/audit", label: "سجل الرقابة", icon: ShieldAlert },
    { href: "/staff/qr", label: "كود الـ QR والطباعة", icon: QrCode },
    { href: "/display", label: "شاشة العرض (TV)", icon: Tv, target: "_blank" },
  ];

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Hub Branding */}
          <div className="flex items-center gap-3">
            <Link href="/staff" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md border border-blue-400/40 bg-[#0071dc] group-hover:scale-105 transition-transform duration-200 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/amazon-now-logo.png" alt="Amazon Now" className="w-full h-full object-cover" />
              </div>
              <div className="leading-tight">
                <span className="font-extrabold text-base text-white block group-hover:text-blue-300 transition-colors">أمازون ناو — لوحة التحكم</span>
                <span className="text-[11px] text-amber-400 font-semibold">محطة توزيع أمازون ناو — الهرم</span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.target}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Tools & Clock */}
          <div className="hidden md:flex items-center gap-4">
            <LiveClock showDate={false} />
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition"
              title="صفحة دخول السائق"
            >
              صفحة السائق
            </Link>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center gap-2">
            <LiveClock showDate={false} className="text-xs" />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 pt-3 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                target={item.target}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold ${
                  isActive
                    ? "bg-amber-500 text-slate-950 font-black"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="pt-2 border-t border-slate-800">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-white px-3 py-2"
            >
              <Truck className="w-4 h-4 text-amber-400" />
              <span>فتح صفحة السائق (ادخل الطابور)</span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
