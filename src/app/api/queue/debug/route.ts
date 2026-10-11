import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
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
    clientCreated: Boolean(admin),
    adminTime,
    adminRes,
    adminErr,
  });
}
