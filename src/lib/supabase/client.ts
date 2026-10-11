import { createClient, SupabaseClient } from "@supabase/supabase-js";

let clientInstance: SupabaseClient | null = null;

const DEFAULT_SUPABASE_URL = "https://mwnyspuszkwrxpwsxtwb.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_6Za3M-Tf8njgL6oTDaHQwQ_fFZqPjwj";

function cleanSecret(val: string | undefined, defaultVal: string): string {
  if (!val) return defaultVal;
  const lines = val.trim().split(/[\r\n]+/);
  for (const line of lines) {
    const cleaned = line.trim();
    if (cleaned.startsWith("eyJ") || cleaned.startsWith("http") || cleaned.startsWith("sb_")) {
      return cleaned;
    }
  }
  return lines[0]?.trim() || defaultVal;
}

export function isSupabaseConfigured(): boolean {
  const url = cleanSecret(process.env.NEXT_PUBLIC_SUPABASE_URL, DEFAULT_SUPABASE_URL);
  const key = cleanSecret(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    DEFAULT_ANON_KEY
  );
  return Boolean(
    url &&
    key &&
    url.startsWith("http") &&
    !url.includes("your-project-id")
  );
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!isSupabaseConfigured()) return null;

  if (!clientInstance) {
    const url = cleanSecret(process.env.NEXT_PUBLIC_SUPABASE_URL, DEFAULT_SUPABASE_URL);
    const key = cleanSecret(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      DEFAULT_ANON_KEY
    );

    clientInstance = createClient(url, key);
  }
  return clientInstance;
}
