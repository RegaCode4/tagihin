import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/server-client";
import { splitEqual } from "../../../../../lib/split";
import {
  addMember,
  deleteRoom,
  setRoomStatus,
  updateRoom,
} from "../../actions";
import PaymentPeriodSection, { type MemberItem } from "./PaymentPeriodSection";

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: room } = await supabase.from("rooms").select("title").eq("id", id).maybeSingle();
  return {
    title: room?.title ? `Room - ${room.title}` : "Room",
  };
}

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/email-password");

  const { data: room } = await supabase.from("rooms").select("*").eq("id", id).maybeSingle();
  if (!room || room.owner_id !== user.id) notFound();

  // 1. Panggil refresh_current_period untuk sinkronisasi periode bulan berjalan
  const { data: periodId } = await supabase.rpc("refresh_current_period", {
    p_room: id,
  });

  // 2. Ambil seluruh anggota aktif di room ini
  const { data: members } = await supabase
    .from("members")
    .select("id, name, phone, sort_order, is_active")
    .eq("room_id", id)
    .eq("is_active", true)
    .order("sort_order");

  const memberList = members ?? [];

  // 3. Ambil data periode bulan berjalan
  interface PaymentRow {
    id: string;
    member_id: string;
    amount_due: number;
    status: "paid" | "unpaid";
    paid_at: string | null;
  }

  interface PeriodData {
    id: string;
    room_id: string;
    period_month: string;
    due_date: string;
    total_amount: number;
    payments: PaymentRow[];
  }

  let currentPeriod: PeriodData | null = null;

  if (periodId) {
    const { data: p } = await supabase
      .from("periods")
      .select(`
        id,
        room_id,
        period_month,
        due_date,
        total_amount,
        payments (
          id,
          member_id,
          amount_due,
          status,
          paid_at
        )
      `)
      .eq("id", periodId)
      .maybeSingle();

    if (p) {
      currentPeriod = p as unknown as PeriodData;
    }
  } else {
    // Bila periodId null (mis. room selesai atau tanpa anggota), cek apakah periode bulan berjalan sudah pernah dibuat
    const nowWib = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
    }).format(new Date());
    const currentMonthStr = `${nowWib}-01`;

    const { data: p } = await supabase
      .from("periods")
      .select(`
        id,
        room_id,
        period_month,
        due_date,
        total_amount,
        payments (
          id,
          member_id,
          amount_due,
          status,
          paid_at
        )
      `)
      .eq("room_id", id)
      .eq("period_month", currentMonthStr)
      .maybeSingle();

    if (p) {
      currentPeriod = p as unknown as PeriodData;
    }
  }

  // Siapkan data anggota dan porsi pembayaran
  let memberItems: MemberItem[] = [];
  let periodMonthName = "";
  let dueDate = "";
  let isOverdue = false;

  const activePeriod: PeriodData | null = currentPeriod;

  if (activePeriod) {
    const [y, m] = activePeriod.period_month.split("-").map(Number);
    periodMonthName = new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(new Date(Date.UTC(y, m - 1, 1)));

    dueDate = activePeriod.due_date;

    const todayWib = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    isOverdue = activePeriod.due_date < todayWib;

    const paymentList = activePeriod.payments ?? [];
    const paymentMap = new Map<string, PaymentRow>(paymentList.map((pay: PaymentRow) => [pay.member_id, pay]));

    memberItems = memberList.map((mem) => {
      const p = paymentMap.get(mem.id);
      if (p) {
        return {
          memberId: mem.id,
          name: mem.name,
          phone: mem.phone,
          paymentId: p.id,
          amountDue: Number(p.amount_due), // Diambil dari database payments.amount_due
          status: p.status,
          paidAt: p.paid_at,
          isOverdue: isOverdue && p.status === "unpaid",
          nextMonthOnly: false,
        };
      }
      return {
        memberId: mem.id,
        name: mem.name,
        phone: mem.phone,
        paymentId: undefined,
        amountDue: 0,
        status: "unpaid",
        paidAt: null,
        isOverdue: false,
        nextMonthOnly: true,
      };
    });
  }

  // Pratinjau bila belum ada periode
  const previewShares =
    !currentPeriod && memberList.length > 0 ? splitEqual(room.total_amount, memberList.length) : [];

  return (
    <>
      <Link href="/dashboard/rooms" className="tg-muted" style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
        <span>Room</span>
      </Link>
      <h1 className="tg-h1">{room.title}</h1>
      <p className="tg-muted" style={{ margin: 0 }}>
        Jatuh tempo setiap tgl {room.due_day}
        {room.status === "completed" ? " · Selesai" : ""}
      </p>
      {room.description && (
        <p className="tg-muted" style={{ margin: "4px 0 0" }}>{room.description}</p>
      )}
      {room.payment_instruction && (
        <p className="tg-muted" style={{ margin: "4px 0 0" }}>Bayar ke: {room.payment_instruction}</p>
      )}

      {error && <p role="alert" className="tg-alert" style={{ marginTop: 12 }}>{error}</p>}

      {activePeriod ? (
        <PaymentPeriodSection
          key={activePeriod.id}
          roomId={room.id}
          periodId={activePeriod.id}
          periodMonthName={periodMonthName}
          dueDate={dueDate}
          totalAmount={Number(activePeriod.total_amount)}
          initialItems={memberItems}
        />
      ) : (
        /* Keadaan kosong yang ramah jika belum ada periode (tanpa anggota atau sebelum periode berjalan) */
        <section className="tg-glass" style={{ marginTop: 16 }}>
          <div className="tg-row">
            <div>
              <span className="tg-chip" style={{ fontSize: 12, padding: "4px 10px" }}>Periode bulan ini</span>
              <p className="tg-muted" style={{ margin: "6px 0 0" }}>Jatuh tempo tgl {room.due_day}</p>
            </div>
            <Link href={`/dashboard/rooms/${room.id}/riwayat`} className="tg-link" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 3 }}>
              <span>Lihat riwayat</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          </div>
          <p className="tg-muted" style={{ marginTop: 14 }}>
            Belum ada periode tagihan aktif. Tambahkan anggota di bawah untuk memulai penagihan iuran bulan ini.
          </p>
          <p className="tg-big" style={{ fontSize: 26, margin: "12px 0 0" }}>
            {rupiah(room.total_amount)}
          </p>
          <p className="tg-muted" style={{ margin: "4px 0 0" }}>
            Total iuran per bulan · {memberList.length} anggota
            {previewShares.length > 0 && ` (pratinjau: ${rupiah(previewShares[0])} per orang)`}
          </p>
        </section>
      )}

      {/* Tambah Anggota */}
      <form action={addMember.bind(null, room.id)} className="tg-glass tg-stack" style={{ marginTop: 16 }}>
        <h2 className="tg-h2" style={{ fontSize: 16 }}>Tambah anggota</h2>
        <input name="name" required maxLength={80} placeholder="Nama" className="tg-input" aria-label="Nama" />
        <input name="phone" required placeholder="0812-3456-7890" className="tg-input" aria-label="Nomor HP" />
        <button type="submit" className="tg-btn" style={{ width: "100%" }}>Tambah anggota</button>
      </form>

      {/* Ubah Room */}
      <details className="tg-glass" style={{ marginTop: 16 }}>
        <summary>Ubah room</summary>
        <form action={updateRoom.bind(null, room.id)} className="tg-stack">
          <input name="title" defaultValue={room.title} required className="tg-input" aria-label="Judul" />
          <input name="total_amount" defaultValue={room.total_amount} required inputMode="numeric" className="tg-input" aria-label="Total per bulan" />
          <input name="due_day" type="number" min={1} max={28} defaultValue={room.due_day} required className="tg-input" aria-label="Jatuh tempo" />
          <input name="payment_instruction" defaultValue={room.payment_instruction ?? ""} className="tg-input" aria-label="Info pembayaran" />
          <textarea name="description" defaultValue={room.description ?? ""} rows={2} className="tg-input" aria-label="Deskripsi" />
          <button type="submit" className="tg-btn tg-btn-sm">Simpan perubahan</button>
        </form>
      </details>

      {/* Tindakan Status & Hapus Room */}
      <div className="tg-row" style={{ marginTop: 16, marginBottom: 36, justifyContent: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <form action={setRoomStatus.bind(null, room.id, room.status === "active" ? "completed" : "active")}>
          <button type="submit" className="tg-btn tg-btn-sm tg-btn-ghost">
            {room.status === "active" ? "Tandai selesai" : "Aktifkan lagi"}
          </button>
        </form>
        <details>
          <summary>Hapus room</summary>
          <form action={deleteRoom.bind(null, room.id)} style={{ paddingBottom: 16 }}>
            <p className="tg-muted">Seluruh anggota dan riwayat ikut terhapus. Tidak bisa dibatalkan.</p>
            <button type="submit" className="tg-btn tg-btn-sm tg-btn-danger">Ya, hapus room</button>
          </form>
        </details>
      </div>
    </>
  );
}
