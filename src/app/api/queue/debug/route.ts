import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT_SET";
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "NOT_SET";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "NOT_SET";

  const client = getSupabaseAdminClient();

  let dbResult: unknown = null;
  let dbError: unknown = null;
  let duration = 0;

  if (client) {
    const start = Date.now();
    try {
      // Set a 4-second timeout to avoid Vercel 504
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Supabase query timed out after 4s")), 4000)
      );
      const queryPromise = client.from("queue_sessions").select("*").limit(1);

      const res = (await Promise.race([queryPromise, timeoutPromise])) as { data: unknown; error: unknown };
      duration = Date.now() - start;
      dbResult = res.data;
      dbError = res.error;
    } catch (e) {
      duration = Date.now() - start;
      dbError = (e as Error).message || String(e);
    }
  }

  return NextResponse.json({
    envUrl: envUrl.slice(0, 30) + "...",
    envKeyPrefix: envKey.slice(0, 15) + "...",
    anonKeyPrefix: anonKey.slice(0, 15) + "...",
    clientCreated: Boolean(client),
    durationMs: duration,
    dbResult,
    dbError,
  });
}
