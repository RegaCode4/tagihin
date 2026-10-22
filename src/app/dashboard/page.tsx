import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "../../../lib/supabase/server-client";

export const metadata: Metadata = {
  title: "Beranda",
};

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export default async function DashboardPage() {
  const user = await getCachedUser();
  if (!user) redirect("/email-password");

  const supabase = await createClient();

  const [{ data: profile }, { data: rooms }, { count: memberCount }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    supabase
      .from("rooms")
      .select("id, title, total_amount, due_day, status")
      .order("created_at", { ascending: false }),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const month = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  const activeRoomList = rooms?.filter((r) => r.status === "active") ?? [];

  // Hitung anggota dan room yang belum lunas pada periode bulan berjalan
  const nowWib = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const currentMonthStr = `${nowWib}-01`;

  let unpaidMembersCount = 0;
  let roomsNeedingCollectionCount = 0;

  if (activeRoomList.length > 0) {
    const activeRoomIds = activeRoomList.map((r) => r.id);
    const { data: unpaidPayments } = await supabase
      .from("payments")
      .select("id, member_id, periods!inner(room_id, period_month)")
      .eq("status", "unpaid")
      .eq("periods.period_month", currentMonthStr)
      .in("periods.room_id", activeRoomIds);

    type UnpaidPaymentRecord = {
      id: string;
      member_id: string;
      periods: {
        room_id: string;
        period_month: string;
      };
    };

    if (unpaidPayments) {
      unpaidMembersCount = unpaidPayments.length;
      const records = unpaidPayments as unknown as UnpaidPaymentRecord[];
      const roomSet = new Set(records.map((p) => p.periods.room_id));
      roomsNeedingCollectionCount = roomSet.size;
    }
  }

  return (
    <>
      <header>
        <p className="tg-muted" style={{ margin: 0 }}>{month}</p>
        <h1 className="tg-h1">Halo, {profile?.name ?? "Penagih"}</h1>
      </header>

      <section className="tg-glass" style={{ marginTop: 20 }}>
        <p className="tg-muted" style={{ margin: 0 }}>Ringkasan</p>
        <p className="tg-big" style={{ fontSize: 22, lineHeight: 1.3 }}>
          Perlu ditagih bulan ini: {unpaidMembersCount} anggota di {roomsNeedingCollectionCount} room
        </p>
        <p className="tg-muted" style={{ margin: "6px 0 0" }}>
          {activeRoomList.length} room aktif · {memberCount ?? 0} anggota terdaftar
        </p>
      </section>

      <div className="tg-row" style={{ margin: "24px 0 12px" }}>
        <h2 className="tg-h2">Room aktif</h2>
        <Link href="/dashboard/rooms/new" className="tg-btn tg-btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          <span>Buat room</span>
        </Link>
      </div>

      <ul className="tg-stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {activeRoomList.slice(0, 3).map((r) => (
          <li key={r.id} className="tg-glass tg-row">
            <div>
              <Link href={`/dashboard/rooms/${r.id}`} className="tg-link" style={{ fontSize: 17 }}>
                {r.title}
              </Link>
              <p className="tg-muted" style={{ margin: "2px 0 0" }}>
                {rupiah(r.total_amount)} per bulan · jatuh tempo tgl {r.due_day}
              </p>
            </div>
            <span className="tg-chip">Aktif</span>
          </li>
        ))}
        {activeRoomList.length === 0 && (
          <li className="tg-glass tg-muted">Belum ada room aktif. Buat room iuran pertamamu.</li>
        )}
      </ul>

      {activeRoomList.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link href="/dashboard/rooms" className="tg-link" style={{ fontSize: 14, display: "inline-flex", alignItems: "center", gap: 3 }}>
            <span>Lihat semua room</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>
      )}
    </>
  );
}
