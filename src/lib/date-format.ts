/**
 * Date and Time utilities formatted for Egyptian Arabic (ar-EG) and Cairo Timezone (Africa/Cairo)
 * أدوات تنسيق التاريخ والوقت باللهجة المصرية وتوقيت القاهرة
 */

const CAIRO_TIMEZONE = "Africa/Cairo";
const EGYPTIAN_LOCALE = "ar-EG";

/**
 * Format a UTC timestamp into Cairo local time (e.g., 02:45 م)
 */
export function formatCairoTime(dateString?: string | null): string {
  if (!dateString) return "--:--";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "--:--";

  return new Intl.DateTimeFormat(EGYPTIAN_LOCALE, {
    timeZone: CAIRO_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Format date in Egyptian Arabic (e.g., الأحد، ١١ أكتوبر ٢٠٢٦)
 */
export function formatCairoDate(dateString?: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(EGYPTIAN_LOCALE, {
    timeZone: CAIRO_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Calculate elapsed waiting duration in natural Egyptian Arabic
 * حساب وقت الانتظار المنقضي بالدقائق والثواني
 */
export function formatElapsedArabic(joinedAt: string): string {
  const start = new Date(joinedAt).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - start) / 1000));

  if (diffSec < 60) {
    return "أقل من دقيقة";
  }
  const minutes = Math.floor(diffSec / 60);
  if (minutes === 1) return "دقيقة واحدة";
  if (minutes === 2) return "دقيقتين";
  if (minutes >= 3 && minutes <= 10) return `${minutes} دقائق`;
  if (minutes > 10 && minutes < 60) return `${minutes} دقيقة`;

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours} ساعة ${remMinutes > 0 ? `و ${remMinutes} دقيقة` : ""}`;
}

/**
 * Pad a queue number with leading zero for clear display (e.g., 42 -> "0042" or "42")
 */
export function formatQueueNumber(num: number): string {
  return String(num).padStart(3, "0");
}
