import { createClient, SupabaseClient } from "@supabase/supabase-js";

let clientInstance: SupabaseClient | null = null;

const DEFAULT_SUPABASE_URL = "https://mwnyspuszkwrxpwsxtwb.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_6Za3M-Tf8njgL6oTDaHQwQ_fFZqPjwj";

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_ANON_KEY;
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
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const url = rawUrl && !rawUrl.includes("your-project-id") ? rawUrl : DEFAULT_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      DEFAULT_ANON_KEY;

    clientInstance = createClient(url, key);
  }
  return clientInstance;
}
