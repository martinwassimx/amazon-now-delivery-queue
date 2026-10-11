import { NextRequest, NextResponse } from "next/server";
import { getHistory } from "@/lib/queue-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("site_id") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const entries = await getHistory(siteId, limit);

    return NextResponse.json({
      success: true,
      entries,
      count: entries.length,
    });
  } catch (error) {
    console.error("API /api/queue/history error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحميل سجل الطلبات" },
      { status: 500 }
    );
  }
}
