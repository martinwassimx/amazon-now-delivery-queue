import { NextRequest, NextResponse } from "next/server";
import { getQueueStats } from "@/lib/queue-service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("site_id") || undefined;

    const stats = await getQueueStats(siteId);

    let supabase_diagnostic = null;
    const adminClient = getSupabaseAdminClient();
    if (adminClient) {
      try {
        const t0 = Date.now();
        const { data, error } = await adminClient.from("sites").select("id, name").limit(1);
        supabase_diagnostic = {
          time_ms: Date.now() - t0,
          data,
          error,
          env_url: process.env.NEXT_PUBLIC_SUPABASE_URL || "using-default",
          has_service_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        };
      } catch (e: any) {
        supabase_diagnostic = {
          exception: e.message,
        };
      }
    }

    return NextResponse.json({
      success: true,
      stats,
      supabase_diagnostic,
    });
  } catch (error) {
    console.error("API /api/queue/stats error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحميل إحصائيات الطابور" },
      { status: 500 }
    );
  }
}
