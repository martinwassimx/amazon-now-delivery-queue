import { NextRequest, NextResponse } from "next/server";
import { joinQueue, getTicketByToken } from "@/lib/queue-service";
import { DriverJoinRequest } from "@/types/queue";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DriverJoinRequest;

    if (!body || !body.idempotency_key || typeof body.idempotency_key !== "string") {
      return NextResponse.json(
        { success: false, error: "مفتاح العملية (idempotency key) مطلوب لمنع التكرار" },
        { status: 400 }
      );
    }

    // 1. Mandatory driver name validation
    if (!body.driver_name || !body.driver_name.trim()) {
      return NextResponse.json(
        { success: false, error: "لازم تكتب اسمك أو كود المندوب عشان نقدر ننده عليك عند الشباك" },
        { status: 400 }
      );
    }

    // 2. Enforce 5-minute cooldown for drivers who just completed an order
    if (body.last_completed_token) {
      const lastTicket = await getTicketByToken(body.last_completed_token);
      if (lastTicket && lastTicket.completed_at) {
        const completedTime = new Date(lastTicket.completed_at).getTime();
        const diffSeconds = Math.floor((Date.now() - completedTime) / 1000);
        const cooldownSeconds = 5 * 60; // 5 minutes = 300s
        if (diffSeconds < cooldownSeconds) {
          const remaining = cooldownSeconds - diffSeconds;
          const remMin = Math.floor(remaining / 60);
          const remSec = remaining % 60;
          return NextResponse.json(
            {
              success: false,
              error: `استلمت طلبك بالفعل! لازم تستنى ٥ دقائق راحة قبل دخول الطابور تاني (متبقي ${remMin} دقيقة و ${remSec} ثانية)`,
              cooldown_remaining_seconds: remaining,
            },
            { status: 429 }
          );
        }
      }
    }

    const { entry, isDuplicate } = await joinQueue({
      site_id: body.site_id,
      driver_name: body.driver_name.trim(),
      order_reference: body.order_reference?.trim() || undefined,
      idempotency_key: body.idempotency_key.trim(),
    });

    return NextResponse.json({
      success: true,
      entry,
      isDuplicate,
      message: isDuplicate ? "تم استرجاع دورك السابق" : "دخلت الطابور بنجاح",
    });
  } catch (error) {
    console.error("API /api/queue/join error:", error);
    const errMessage = (error as Error)?.message || "";
    if ((error as unknown as { session_closed?: boolean })?.session_closed || errMessage.includes("مغلق")) {
      return NextResponse.json(
        {
          success: false,
          error: errMessage || "الطابور مغلق حالياً من قِبل إدارة المحطة",
          session_closed: true,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: errMessage || "حصلت مشكلة في حجز الدور، حاول تاني" },
      { status: 500 }
    );
  }
}
