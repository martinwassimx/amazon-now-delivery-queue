import { NextRequest, NextResponse } from "next/server";
import { getQueueStats } from "@/lib/queue-service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("site_id") || undefined;

    const stats = await getQueueStats(siteId);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("API /api/queue/stats error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحميل إحصائيات الطابور" },
      { status: 500 }
    );
  }
}
