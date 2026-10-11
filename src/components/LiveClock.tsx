"use client";

import { useEffect, useState } from "react";
import { formatCairoTime, formatCairoDate } from "@/lib/date-format";
import { Clock } from "lucide-react";

export function LiveClock({ showDate = true, className = "" }: { showDate?: boolean; className?: string }) {
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");

  useEffect(() => {
    const update = () => {
      const now = new Date().toISOString();
      setTimeStr(formatCairoTime(now));
      setDateStr(formatCairoDate(now));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timeStr) return null;

  return (
    <div className={`flex items-center gap-2 text-slate-300 ${className}`}>
      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
      <span className="font-mono text-sm font-semibold tracking-wider text-amber-300">{timeStr}</span>
      {showDate && (
        <>
          <span className="text-slate-600">|</span>
          <span className="text-xs text-slate-400 hidden sm:inline">{dateStr}</span>
        </>
      )}
    </div>
  );
}
