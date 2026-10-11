import { NextRequest, NextResponse } from "next/server";
import { getActiveQueue, getQueueStats } from "@/lib/queue-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("site_id") || undefined;

    const [entries, stats] = await Promise.all([
      getActiveQueue(siteId),
      getQueueStats(siteId),
    ]);

    return NextResponse.json({
      success: true,
      entries,
      count: entries.length,
      stats,
    });
  } catch (error) {
    console.error("API /api/queue/active error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحميل الطابور النشط" },
      { status: 500 }
    );
  }
}
