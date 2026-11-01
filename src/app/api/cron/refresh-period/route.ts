import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  // 1. Verifikasi header Authorization
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // 2. Inisialisasi Supabase client dengan Service Role Key
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { success: false, error: "Missing Supabase service configuration" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3. Ambil seluruh room aktif
  const { data: rooms, error: fetchError } = await supabase
    .from("rooms")
    .select("id")
    .eq("status", "active");

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 500 }
    );
  }

  const roomList = rooms ?? [];
  let refreshed = 0;
  let skipped = 0;
  let failed = 0;

  // 4. Loop dan refresh periode setiap room
  for (const room of roomList) {
    const { data: periodId, error: rpcError } = await supabase.rpc("refresh_current_period", {
      p_room: room.id,
    });
    if (rpcError) {
      failed += 1;
      console.error(`Failed to refresh period for room ${room.id}:`, rpcError);
    } else if (periodId) {
      refreshed += 1;
    } else {
      skipped += 1;
    }
  }

  // Failed rooms must also be visible in the cron's HTTP status and Vercel logs.
  return NextResponse.json(
    {
      success: failed === 0,
      message: `${refreshed} rooms refreshed, ${skipped} skipped, ${failed} failed`,
      refreshed,
      skipped,
      failed,
    },
    { status: failed > 0 ? 500 : 200 },
  );
}
