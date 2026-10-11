import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const admin = getSupabaseAdminClient();
  let adminRes = null;
  let adminErr = null;
  let adminTime = 0;
  if (admin) {
    const s = Date.now();
    try {
      const { data, error } = await admin.from("queue_sessions").select("*").limit(1);
      adminTime = Date.now() - s;
      adminRes = data;
      adminErr = error;
    } catch (e) {
      adminErr = (e as Error).message;
    }
  }

  return NextResponse.json({
    envUrlRaw: envUrl,
    envServiceKeyLength: envServiceKey?.length,
    envServiceKeyStart: envServiceKey?.slice(0, 10),
    envServiceKeyEnd: envServiceKey?.slice(-10),
    envAnonKeyStart: envAnonKey?.slice(0, 10),
    adminTime,
    adminRes,
    adminErr,
  });
}
