import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminInstance: SupabaseClient | null = null;

const DEFAULT_SUPABASE_URL = "https://mwnyspuszkwrxpwsxtwb.supabase.co";
const DEFAULT_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnlzcHVzemt3cnhwd3N4dHdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTc0NTI1MywiZXhwIjoyMTA3MzIxMjUzfQ.mGKyQQ0e1cj4x5xLTzqC-G6JvEABJanY5k-Bvh5Ep50";

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

export function isSupabaseAdminConfigured(): boolean {
  const url = cleanSecret(process.env.NEXT_PUBLIC_SUPABASE_URL, DEFAULT_SUPABASE_URL);
  const key = cleanSecret(process.env.SUPABASE_SERVICE_ROLE_KEY, DEFAULT_SERVICE_ROLE_KEY);
  return Boolean(
    url &&
    key &&
    url.startsWith("http") &&
    !url.includes("your-project-id")
  );
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseAdminConfigured()) return null;

  if (!adminInstance) {
    const url = cleanSecret(process.env.NEXT_PUBLIC_SUPABASE_URL, DEFAULT_SUPABASE_URL);
    const key = cleanSecret(process.env.SUPABASE_SERVICE_ROLE_KEY, DEFAULT_SERVICE_ROLE_KEY);

    adminInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    });
  }
  return adminInstance;
}
