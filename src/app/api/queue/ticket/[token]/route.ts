import { NextRequest, NextResponse } from "next/server";
import { getTicketByToken } from "@/lib/queue-service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "رمز التذكرة غير صالح" },
        { status: 400 }
      );
    }

    const entry = await getTicketByToken(token);

    if (!entry) {
      return NextResponse.json(
        { success: false, error: "التذكرة غير موجودة أو انتهت صلاحيتها" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      entry,
    });
  } catch (error) {
    console.error("API /api/queue/ticket error:", error);
    return NextResponse.json(
      { success: false, error: "حصلت مشكلة أثناء تحميل التذكرة، حاول تاني" },
      { status: 500 }
    );
  }
}
