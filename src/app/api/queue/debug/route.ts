import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = "https://mwnyspuszkwrxpwsxtwb.supabase.co";
  const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnlzcHVzemt3cnhwd3N4dHdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTc0NTI1MywiZXhwIjoyMTA3MzIxMjUzfQ.mGKyQQ0e1cj4x5xLTzqC-G6JvEABJanY5k-Bvh5Ep50";

  // Test 1: Standard client
  let client1Res: unknown = null;
  let client1Err: unknown = null;
  let client1Time = 0;
  try {
    const c1 = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const s1 = Date.now();
    const { data, error } = await c1.from("queue_sessions").select("*").limit(1);
    client1Time = Date.now() - s1;
    client1Res = data;
    client1Err = error;
  } catch (e) {
    client1Err = (e as Error).message;
  }

  // Test 2: Client with custom fetch (cache: no-store)
  let client2Res: unknown = null;
  let client2Err: unknown = null;
  let client2Time = 0;
  try {
    const c2 = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    });
    const s2 = Date.now();
    const { data, error } = await c2.from("queue_sessions").select("*").limit(1);
    client2Time = Date.now() - s2;
    client2Res = data;
    client2Err = error;
  } catch (e) {
    client2Err = (e as Error).message;
  }

  return NextResponse.json({
    client1: { time: client1Time, res: client1Res, err: client1Err },
    client2: { time: client2Time, res: client2Res, err: client2Err },
  });
}
