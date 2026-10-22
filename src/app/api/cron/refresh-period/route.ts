import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  // 1. Verifikasi header Authorization
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

  const supabase = createClient(supabaseUrl, serviceRoleKey);

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

  // 4. Loop dan refresh periode setiap room
  for (const room of roomList) {
    const { error: rpcError } = await supabase.rpc("refresh_current_period", {
      p_room: room.id,
    });
    if (rpcError) {
      console.error(`Failed to refresh period for room ${room.id}:`, rpcError);
    }
  }

  // 5. Kembalikan response sukses
  return NextResponse.json({
    success: true,
    message: `${roomList.length} rooms refreshed`,
  });
}
