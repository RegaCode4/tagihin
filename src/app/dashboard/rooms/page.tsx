import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "../../../../lib/supabase/server-client";

export const metadata: Metadata = {
  title: "Room",
};

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

interface PaymentItem {
  id: string;
  status: string;
}

interface PeriodPaymentInfo {
  paidCount: number;
  totalCount: number;
}

export default async function RoomsPage() {
  const user = await getCachedUser();
  if (!user) redirect("/email-password");

  const supabase = await createClient();

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, title, total_amount, due_day, status, created_at")
    .order("created_at", { ascending: false });

  const roomList = rooms ?? [];
  const activeRooms = roomList.filter((r) => r.status === "active");
  const completedRooms = roomList.filter((r) => r.status === "completed");

  // Hitung status pembayaran bulan berjalan (Asia/Jakarta)
  const nowWib = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const currentMonthStr = `${nowWib}-01`;

  const periodMap = new Map<string, PeriodPaymentInfo>();

  if (activeRooms.length > 0) {
    const activeIds = activeRooms.map((r) => r.id);
    const { data: periods } = await supabase
      .from("periods")
      .select("room_id, payments(id, status)")
      .eq("period_month", currentMonthStr)
      .in("room_id", activeIds);

    if (periods) {
      for (const p of periods) {
        const payments = (p.payments as unknown as PaymentItem[]) ?? [];
        const totalCount = payments.length;
        const paidCount = payments.filter((pay) => pay.status === "paid").length;
        periodMap.set(p.room_id, { paidCount, totalCount });
      }
    }
  }

  return (
    <>
      <header className="tg-row" style={{ alignItems: "center", marginBottom: 20 }}>
        <h1 className="tg-h1" style={{ margin: 0 }}>Room</h1>
        <Link href="/dashboard/rooms/new" className="tg-btn tg-btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          <span>Buat room</span>
        </Link>
      </header>

      {/* Daftar Room Aktif */}
      <ul className="tg-stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {activeRooms.map((r) => {
          const periodInfo = periodMap.get(r.id);
          const hasMembers = periodInfo && periodInfo.totalCount > 0;
          const chipText = hasMembers
            ? `${periodInfo.paidCount}/${periodInfo.totalCount} lunas`
            : "Belum ada anggota";
          const isAllPaid = Boolean(hasMembers && periodInfo.paidCount === periodInfo.totalCount);

          return (
            <li key={r.id} className="tg-glass tg-row">
              <div>
                <Link href={`/dashboard/rooms/${r.id}`} className="tg-link" style={{ fontSize: 17 }}>
                  {r.title}
                </Link>
                <p className="tg-muted" style={{ margin: "2px 0 0" }}>
                  {rupiah(r.total_amount)} per bulan · jatuh tempo tgl {r.due_day}
                </p>
              </div>
              <span className={`tg-chip ${isAllPaid ? "tg-chip-success" : ""}`} style={isAllPaid ? { display: "inline-flex", alignItems: "center", gap: 4 } : undefined}>
                {isAllPaid && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                <span>{chipText}</span>
              </span>
            </li>
          );
        })}

        {roomList.length === 0 && (
          <li className="tg-glass tg-muted" style={{ textAlign: "center", padding: "32px 16px" }}>
            Belum ada room. Buat room iuran pertamamu.
          </li>
        )}

        {roomList.length > 0 && activeRooms.length === 0 && (
          <li className="tg-glass tg-muted" style={{ textAlign: "center", padding: "24px 16px" }}>
            Tidak ada room aktif.
          </li>
        )}
      </ul>

      {/* Room Selesai dalam Bagian Lipat <details> */}
      {completedRooms.length > 0 && (
        <details className="tg-glass" style={{ marginTop: 24 }}>
          <summary style={{ fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            Selesai ({completedRooms.length})
          </summary>
          <ul className="tg-stack" style={{ listStyle: "none", padding: 0, margin: "14px 0 0" }}>
            {completedRooms.map((r) => (
              <li
                key={r.id}
                className="tg-row"
                style={{
                  padding: "10px 0",
                  borderTop: "1px solid rgba(255, 255, 255, 0.4)",
                }}
              >
                <div>
                  <Link href={`/dashboard/rooms/${r.id}`} className="tg-link" style={{ fontSize: 16 }}>
                    {r.title}
                  </Link>
                  <p className="tg-muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                    {rupiah(r.total_amount)} per bulan · jatuh tempo tgl {r.due_day}
                  </p>
                </div>
                <span className="tg-chip">Selesai</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
