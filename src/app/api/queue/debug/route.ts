import { NextResponse } from "next/server";
import { joinQueue, callNextDriver } from "@/lib/queue-service";

export const dynamic = "force-dynamic";

export async function GET() {
  let joinResult = null;
  let joinError: unknown = null;

  try {
    const res = await joinQueue({
      site_id: "00000000-0000-0000-0000-000000000001",
      driver_name: "سائق تجريبي ديباج",
      idempotency_key: "debug-join-" + Date.now(),
    });
    joinResult = res;
  } catch (err: unknown) {
    joinError = {
      message: (err as Error)?.message,
      stack: (err as Error)?.stack,
      raw: String(err),
      keys: Object.keys(err || {}),
      errObj: err,
    };
  }

  return NextResponse.json({
    joinResult,
    joinError,
  });
}
