import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, getCachedUser } from "../../../../../lib/supabase/server-client";
import { getRoomById } from "../../../../../lib/supabase/queries";
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
  const room = await getRoomById(id);
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

  const nowWib = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const currentMonthStr = `${nowWib}-01`;

  // Eksekusi auth user, data room, daftar anggota, dan periode bulan berjalan secara paralel
  const [user, room, { data: members }, { data: p }] = await Promise.all([
    getCachedUser(),
    getRoomById(id),
    supabase
      .from("members")
      .select("id, name, phone, sort_order, is_active")
      .eq("room_id", id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
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
      .maybeSingle(),
  ]);

  if (!user) redirect("/email-password");
  if (!room || room.owner_id !== user.id) notFound();

  const memberList = members ?? [];

  // Data periode bulan berjalan
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

  const currentPeriod: PeriodData | null = p ? (p as unknown as PeriodData) : null;

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
            <Link href={`/dashboard/rooms/${room.id}/riwayat`} prefetch={false} className="tg-link" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 3 }}>
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
