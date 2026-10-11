import { NextRequest, NextResponse } from "next/server";
import { getAuditLogs } from "@/lib/queue-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("site_id") || undefined;
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    const logs = await getAuditLogs(siteId, limit);

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error("API /api/queue/audit error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحميل سجل الرقابة" },
      { status: 500 }
    );
  }
}
