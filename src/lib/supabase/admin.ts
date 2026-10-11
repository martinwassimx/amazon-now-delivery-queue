import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminInstance: SupabaseClient | null = null;

const DEFAULT_SUPABASE_URL = "https://mwnyspuszkwrxpwsxtwb.supabase.co";
const DEFAULT_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnlzcHVzemt3cnhwd3N4dHdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTc0NTI1MywiZXhwIjoyMTA3MzIxMjUzfQ.mGKyQQ0e1cj4x5xLTzqC-G6JvEABJanY5k-Bvh5Ep50";

export function isSupabaseAdminConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_ROLE_KEY;
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
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const url = rawUrl && !rawUrl.includes("your-project-id") ? rawUrl : DEFAULT_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_ROLE_KEY;

    adminInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return adminInstance;
}
