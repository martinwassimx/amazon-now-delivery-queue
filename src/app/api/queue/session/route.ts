import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, startNewSession, setSessionActive } from "@/lib/queue-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("site_id") || undefined;
    const session = await getCurrentSession(siteId);

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("API GET /api/queue/session error:", error);
    return NextResponse.json(
      { success: false, error: "فشل استرجاع بيانات الجلسة" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as "start_new" | "open" | "close";
    const siteId = body.site_id || undefined;
    const staffName = body.staff_name || "مشرف المحطة";

    if (!action || !["start_new", "open", "close"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "إجراء غير صالح. الإجراءات المتاحة: start_new, open, close" },
        { status: 400 }
      );
    }

    let session;
    let message = "";

    if (action === "start_new") {
      session = await startNewSession(siteId, staffName);
      message = "تم بدء جلسة عمل جديدة وتصفير العداد بنجاح";
    } else if (action === "open") {
      session = await setSessionActive(siteId, true, staffName);
      message = "تم فتح الطابور وبدء استقبال المناديب";
    } else if (action === "close") {
      session = await setSessionActive(siteId, false, staffName);
      message = "تم إغلاق الطابور ووقف استقبال طلبات جديدة";
    }

    return NextResponse.json({
      success: true,
      session,
      message,
    });
  } catch (error) {
    console.error("API POST /api/queue/session error:", error);
    return NextResponse.json(
      { success: false, error: "حدث خطأ أثناء تعديل حالة الجلسة" },
      { status: 500 }
    );
  }
}
