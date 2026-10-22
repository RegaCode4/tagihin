import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "../../../../lib/supabase/server-client";
import { formatDateId } from "../../../../lib/reminder";

export const metadata: Metadata = {
  title: "Riwayat",
};

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

interface PeriodItem {
  id: string;
  room_id: string;
  period_month: string;
  due_date: string;
  total_amount: number;
  room: { id: string; title: string } | { id: string; title: string }[];
  payments: Array<{
    id: string;
    amount_due: number;
    status: string;
  }>;
}

export default async function AllRiwayatPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const { room: roomFilter } = await searchParams;

  const user = await getCachedUser();
  if (!user) redirect("/email-password");

  const supabase = await createClient();

  // Ambil daftar room milik pengguna untuk tombol filter opsional
  const { data: userRooms } = await supabase
    .from("rooms")
    .select("id, title")
    .order("created_at", { ascending: false });

  // Ambil semua periode milik pengguna (RLS aktif membatasi ke room milik user)
  let query = supabase
    .from("periods")
    .select(`
      id,
      room_id,
      period_month,
      due_date,
      total_amount,
      room:rooms!inner(id, title),
      payments(id, amount_due, status)
    `)
    .order("period_month", { ascending: false })
    .limit(36);

  if (roomFilter) {
    query = query.eq("room_id", roomFilter);
  }

  const { data: rawPeriods } = await query;
  const periods = (rawPeriods ?? []) as unknown as PeriodItem[];

  // Tanggal hari ini di WIB (Asia/Jakarta) format YYYY-MM-DD
  const todayWib = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Kelompokkan periode per bulan
  const groups = new Map<string, PeriodItem[]>();
  for (const p of periods) {
    const list = groups.get(p.period_month) ?? [];
    list.push(p);
    groups.set(p.period_month, list);
  }

  return (
    <>
      <header>
        <h1 className="tg-h1">Riwayat Iuran</h1>
        <p className="tg-muted" style={{ margin: 0 }}>
          Semua tagihan dan catatan pembayaran lintas room
        </p>
      </header>

      {/* Filter per room jika ada lebih dari 1 room */}
      {userRooms && userRooms.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            padding: "4px 0",
            marginTop: 16,
            scrollbarWidth: "none",
          }}
        >
          <Link
            href="/dashboard/riwayat"
            className={`tg-pill ${!roomFilter ? "tg-pill-active" : ""}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>
            <span>Semua room</span>
          </Link>
          {userRooms.map((r) => {
            const isSelected = roomFilter === r.id;
            return (
              <Link
                key={r.id}
                href={`/dashboard/riwayat?room=${r.id}`}
                className={`tg-pill ${isSelected ? "tg-pill-active" : ""}`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>{r.title}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Daftar Periode Dikelompokkan per Bulan */}
      <div style={{ marginTop: 20 }}>
        {Array.from(groups.entries()).map(([monthKey, list]) => {
          const [y, m] = monthKey.split("-").map(Number);
          const monthTitle = new Intl.DateTimeFormat("id-ID", {
            month: "long",
            year: "numeric",
            timeZone: "Asia/Jakarta",
          }).format(new Date(Date.UTC(y, m - 1, 1)));

          return (
            <section key={monthKey} style={{ marginBottom: 24 }}>
              <h2
                className="tg-h2"
                style={{
                  fontSize: 16,
                  color: "#3a3f47",
                  marginBottom: 10,
                  textTransform: "capitalize",
                }}
              >
                {monthTitle}
              </h2>

              <div className="tg-stack">
                {list.map((period) => {
                  const r = Array.isArray(period.room) ? period.room[0] : period.room;
                  const roomTitle = r?.title ?? "Room";
                  const roomHistoryUrl = `/dashboard/rooms/${r?.id ?? period.room_id}/riwayat`;

                  const payments = period.payments ?? [];
                  const total = Number(period.total_amount);
                  const collected = payments
                    .filter((pay) => pay.status === "paid")
                    .reduce((sum, pay) => sum + Number(pay.amount_due), 0);

                  const unpaidCount = payments.filter((pay) => pay.status === "unpaid").length;
                  const isAllPaid = payments.length > 0 && unpaidCount === 0;
                  const isOverdue = period.due_date < todayWib && unpaidCount > 0;
                  const percent = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;

                  return (
                    <div key={period.id} className="tg-glass">
                      <div className="tg-row" style={{ alignItems: "flex-start" }}>
                        <div>
                          <Link href={roomHistoryUrl} className="tg-link" style={{ fontSize: 16 }}>
                            {roomTitle}
                          </Link>
                          <p className="tg-muted" style={{ margin: "2px 0 0" }}>
                            Jatuh tempo {formatDateId(period.due_date)}
                          </p>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          {isAllPaid ? (
                            <span className="tg-chip tg-chip-success" style={{ fontSize: 12, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span>Lunas semua</span>
                            </span>
                          ) : (
                            <span className="tg-chip" style={{ fontSize: 12, padding: "3px 10px" }}>
                              {unpaidCount} belum lunas
                            </span>
                          )}
                          {isOverdue && (
                            <span className="tg-chip tg-chip-danger" style={{ fontSize: 11, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              <span>Terlambat</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div className="tg-row" style={{ alignItems: "baseline" }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>Terkumpul</span>
                          <span style={{ fontSize: 12 }} className="tg-muted">
                            {percent}%
                          </span>
                        </div>
                        <p className="tg-big" style={{ fontSize: 18, margin: "2px 0 0" }}>
                          {rupiah(collected)} <span style={{ fontSize: 14, fontWeight: 400 }} className="tg-muted">dari</span> {rupiah(total)}
                        </p>
                        <div className="tg-progress-bar">
                          <div className="tg-progress-fill" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {periods.length === 0 && (
          <div className="tg-glass tg-muted" style={{ textAlign: "center", padding: "36px 16px" }}>
            Belum ada riwayat. Riwayat muncul setelah room punya anggota.
          </div>
        )}
      </div>
    </>
  );
}
