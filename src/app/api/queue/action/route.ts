import { NextRequest, NextResponse } from "next/server";
import { callNextDriver, updateEntryStatus } from "@/lib/queue-service";
import { QueueStatus, StaffActionRequest } from "@/types/queue";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StaffActionRequest;

    if (!body || !body.action) {
      return NextResponse.json(
        { success: false, error: "نوع الإجراء مطلوب" },
        { status: 400 }
      );
    }

    const staffName = body.staff_name || "موظف الاستلام";

    if (body.action === "call_next") {
      const entry = await callNextDriver(body.site_id, staffName);
      if (!entry) {
        return NextResponse.json({
          success: false,
          error: "مفيش حد مستني في الطابور دلوقتي",
        });
      }
      return NextResponse.json({
        success: true,
        entry,
        message: `تم النداء على رقم ${entry.queue_number}`,
      });
    }

    if (!body.entry_id) {
      return NextResponse.json(
        { success: false, error: "معرف السائق / الدور مطلوب" },
        { status: 400 }
      );
    }

    let targetStatus: QueueStatus | null = null;
    let message = "";

    switch (body.action) {
      case "call":
      case "recall":
        targetStatus = "called";
        message = "تمت إعادة النداء على السائق";
        break;
      case "process":
        targetStatus = "processing";
        message = "جاري تجهيز الطلب الآن";
        break;
      case "complete":
        targetStatus = "completed";
        message = "تم استلام الطلب وإنهاء الدور بنجاح";
        break;
      case "skip":
        targetStatus = "skipped";
        message = "تم تخطي الدور";
        break;
      case "cancel":
        targetStatus = "cancelled";
        message = "تم إلغاء الدور";
        break;
      default:
        return NextResponse.json(
          { success: false, error: "إجراء غير معروف" },
          { status: 400 }
        );
    }

    const updated = await updateEntryStatus(
      body.entry_id,
      targetStatus,
      staffName,
      body.notes
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "لم يتم العثور على هذا الدور" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      entry: updated,
      message,
    });
  } catch (error) {
    console.error("API /api/queue/action error:", error);
    const errMessage = (error as Error)?.message || String(error);
    return NextResponse.json(
      { success: false, error: errMessage || "حصلت مشكلة في تنفيذ الإجراء، حاول تاني" },
      { status: 500 }
    );
  }
}
