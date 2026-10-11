"use client";

import React from "react";
import { QueueStatus } from "@/types/queue";
import { Clock, Bell, PackageCheck, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface StatusBadgeProps {
  status: QueueStatus;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({ status, size = "md", showIcon = true, className = "" }: StatusBadgeProps) {
  const configs: Record<
    QueueStatus,
    { label: string; bg: string; text: string; border: string; glow: string; icon: React.ReactNode }
  > = {
    waiting: {
      label: "مستني دورك",
      bg: "bg-amber-950/40",
      text: "text-amber-300",
      border: "border-amber-500/40",
      glow: "shadow-[0_0_12px_rgba(245,158,11,0.2)]",
      icon: <Clock className="w-3.5 h-3.5 inline-block ms-1.5 animate-pulse" />,
    },
    called: {
      label: "جه دورك! اتفضل استلم",
      bg: "bg-blue-950/60",
      text: "text-blue-300",
      border: "border-blue-400",
      glow: "shadow-[0_0_20px_rgba(59,130,246,0.5)] animate-pulse",
      icon: <Bell className="w-3.5 h-3.5 inline-block ms-1.5 animate-bounce" />,
    },
    processing: {
      label: "جاري تجهيز الطلب",
      bg: "bg-indigo-950/40",
      text: "text-indigo-300",
      border: "border-indigo-500/40",
      glow: "shadow-[0_0_12px_rgba(99,102,241,0.25)]",
      icon: <PackageCheck className="w-3.5 h-3.5 inline-block ms-1.5" />,
    },
    completed: {
      label: "استلمت طلبك",
      bg: "bg-emerald-950/40",
      text: "text-emerald-300",
      border: "border-emerald-500/40",
      glow: "shadow-[0_0_12px_rgba(16,185,129,0.2)]",
      icon: <CheckCircle2 className="w-3.5 h-3.5 inline-block ms-1.5" />,
    },
    skipped: {
      label: "تخطي الدور",
      bg: "bg-slate-900/60",
      text: "text-slate-400",
      border: "border-slate-700",
      glow: "",
      icon: <AlertTriangle className="w-3.5 h-3.5 inline-block ms-1.5" />,
    },
    cancelled: {
      label: "إلغاء الدور",
      bg: "bg-rose-950/40",
      text: "text-rose-400",
      border: "border-rose-700/50",
      glow: "",
      icon: <XCircle className="w-3.5 h-3.5 inline-block ms-1.5" />,
    },
  };

  const config = configs[status] || configs.waiting;

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs font-medium rounded-full",
    md: "px-3 py-1 text-sm font-semibold rounded-full",
    lg: "px-4 py-1.5 text-base font-bold rounded-xl",
  };

  return (
    <span
      className={`inline-flex items-center justify-center border transition-all ${config.bg} ${config.text} ${config.border} ${config.glow} ${sizeStyles[size]} ${className}`}
    >
      {showIcon && config.icon}
      <span>{config.label}</span>
    </span>
  );
}
