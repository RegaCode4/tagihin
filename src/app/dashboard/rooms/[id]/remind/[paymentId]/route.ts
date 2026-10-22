import { NextResponse } from "next/server";
import { createClient } from "../../../../../../../lib/supabase/server-client";
import { buildReminderMessage, buildWhatsAppUrl } from "../../../../../../../lib/reminder";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string; paymentId: string }> }
) {
  const { id: roomId, paymentId } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Not Found", { status: 404 });
  }

  // Muat payment + member + period + room (RLS aktif)
  const { data: payment, error } = await supabase
    .from("payments")
    .select(`
      id,
      amount_due,
      status,
      period:periods!inner(
        id,
        room_id,
        due_date,
        total_amount,
        room:rooms!inner(
          id,
          owner_id,
          title,
          payment_instruction
        )
      ),
      member:members!inner(
        id,
        name,
        phone
      )
    `)
    .eq("id", paymentId)
    .eq("period.room_id", roomId)
    .maybeSingle();

  if (error || !payment) {
    return new Response("Not Found", { status: 404 });
  }

  const p = payment as unknown as {
    id: string;
    amount_due: number;
    status: string;
    period: {
      id: string;
      room_id: string;
      due_date: string;
      total_amount: number;
      room: {
        id: string;
        owner_id: string;
        title: string;
        payment_instruction: string | null;
      };
    };
    member: {
      id: string;
      name: string;
      phone: string;
    };
  };

  // Tolak bila bukan milik room ini, bukan milik pengguna, atau sudah lunas (404)
  if (p.period.room.id !== roomId || p.period.room.owner_id !== user.id || p.status === "paid") {
    return new Response("Not Found", { status: 404 });
  }

  // Bangun pesan WhatsApp menggunakan lib/reminder.ts
  const message = buildReminderMessage({
    memberName: p.member.name,
    roomTitle: p.period.room.title,
    dueDate: p.period.due_date,
    totalAmount: Number(p.period.total_amount),
    amountDue: Number(p.amount_due),
    paymentInstruction: p.period.room.payment_instruction,
  });

  const waUrl = buildWhatsAppUrl(p.member.phone, message);

  // Insert baris reminder_logs
  await supabase.from("reminder_logs").insert({
    payment_id: paymentId,
    channel: "wa_link",
  });

  // Redirect 302 ke URL wa.me
  return NextResponse.redirect(waUrl, { status: 302 });
}
