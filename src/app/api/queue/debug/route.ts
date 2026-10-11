import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = "https://mwnyspuszkwrxpwsxtwb.supabase.co/rest/v1/queue_sessions?select=*";
  const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnlzcHVzemt3cnhwd3N4dHdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTc0NTI1MywiZXhwIjoyMTA3MzIxMjUzfQ.mGKyQQ0e1cj4x5xLTzqC-G6JvEABJanY5k-Bvh5Ep50";

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    return NextResponse.json({
      durationMs: Date.now() - start,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body: text.slice(0, 500),
    });
  } catch (err) {
    return NextResponse.json({
      durationMs: Date.now() - start,
      error: (err as Error).message || String(err),
      name: (err as Error).name,
    });
  }
}
