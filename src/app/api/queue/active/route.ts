import { NextRequest, NextResponse } from "next/server";
import { getActiveQueue } from "@/lib/queue-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("site_id") || undefined;

    const entries = await getActiveQueue(siteId);

    return NextResponse.json({
      success: true,
      entries,
      count: entries.length,
    });
  } catch (error) {
    console.error("API /api/queue/active error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحميل الطابور النشط" },
      { status: 500 }
    );
  }
}
