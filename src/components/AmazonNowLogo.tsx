import React from "react";

export function AmazonNowLogo({ 
  className = "", 
  withBadge = true, 
  hubName = "محطة توزيع أمازون ناو — الهرم",
  size = "md",
}: { 
  className?: string; 
  withBadge?: boolean; 
  hubName?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "w-14 h-14 rounded-2xl",
    md: "w-28 h-28 sm:w-32 sm:h-32 rounded-3xl",
    lg: "w-36 h-36 sm:w-40 sm:h-40 rounded-[32px]",
  }[size];

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Official Amazon Now Blue Brand Icon */}
      <div className={`relative ${sizeClasses} overflow-hidden shadow-2xl shadow-[#0071dc]/40 border-2 border-blue-400/50 bg-[#0071dc] hover:scale-105 transition-all duration-300 group`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src="/images/amazon-now-logo.png" 
          alt="أمازون ناو — Amazon Now" 
          className="w-full h-full object-cover select-none"
          loading="eager"
        />
        {/* Sheen glass reflection overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
      </div>

      {withBadge && (
        <div dir="rtl" className="mt-3.5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/95 border border-blue-500/50 text-blue-200 text-xs sm:text-sm font-bold shadow-xl shadow-blue-950/60 backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse inline-block shadow-[0_0_10px_#f59e0b]" />
          <span>{hubName}</span>
        </div>
      )}
    </div>
  );
}
