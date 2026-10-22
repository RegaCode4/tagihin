import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, getCachedUser } from "../../../../../../lib/supabase/server-client";
import { getRoomById } from "../../../../../../lib/supabase/queries";
import { formatDateId } from "../../../../../../lib/reminder";
import { formatLocalPhone } from "../../../../../../lib/phone";

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const room = await getRoomById(id);
  return {
    title: room?.title ? `Riwayat - ${room.title}` : "Riwayat",
  };
}

export default async function RoomRiwayatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCachedUser();
  if (!user) redirect("/email-password");

  const room = await getRoomById(id);
  // Milik orang lain atau tidak ada => 404
  if (!room || room.owner_id !== user.id) notFound();

  const supabase = await createClient();

  // Ambil daftar periode terbaru dulu
  const { data: periods } = await supabase
    .from("periods")
    .select(`
      id,
      period_month,
      due_date,
      total_amount,
      payments (
        id,
        amount_due,
        status,
        paid_at,
        member:members (
          id,
          name,
          phone
        )
      )
    `)
    .eq("room_id", id)
    .order("period_month", { ascending: false });

  const list = periods ?? [];

  return (
    <>
      <Link href={`/dashboard/rooms/${room.id}`} className="tg-muted" style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
        <span>Kembali ke room</span>
      </Link>
      <h1 className="tg-h1">Riwayat Periode</h1>
      <p className="tg-muted" style={{ margin: 0 }}>
        {room.title}
      </p>

      <div className="tg-stack" style={{ marginTop: 20 }}>
        {list.map((period) => {
          const [y, m] = period.period_month.split("-").map(Number);
          const monthName = new Intl.DateTimeFormat("id-ID", {
            month: "long",
            year: "numeric",
            timeZone: "Asia/Jakarta",
          }).format(new Date(Date.UTC(y, m - 1, 1)));

          interface MemberInfo {
            id?: string;
            name?: string;
            phone?: string;
          }

          interface PeriodPaymentItem {
            id: string;
            amount_due: number;
            status: string;
            paid_at: string | null;
            member: MemberInfo | MemberInfo[] | null;
          }

          const payments = (period.payments ?? []) as unknown as PeriodPaymentItem[];

          const collected = payments
            .filter((p) => p.status === "paid")
            .reduce((sum, p) => sum + Number(p.amount_due), 0);

          const total = Number(period.total_amount);
          const percent = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;

          return (
            <section key={period.id} className="tg-glass">
              <div className="tg-row">
                <div>
                  <h2 className="tg-h2" style={{ fontSize: 18 }}>
                    {monthName}
                  </h2>
                  <p className="tg-muted" style={{ margin: "2px 0 0" }}>
                    Jatuh tempo {formatDateId(period.due_date)}
                  </p>
                </div>
                <span className="tg-chip">{percent}% terkumpul</span>
              </div>

              <div style={{ marginTop: 12 }}>
                <p className="tg-big" style={{ fontSize: 20, margin: 0 }}>
                  Terkumpul {rupiah(collected)} dari {rupiah(total)}
                </p>
                <div className="tg-progress-bar">
                  <div className="tg-progress-fill" style={{ width: `${percent}%` }} />
                </div>
              </div>

              {/* Status tiap anggota */}
              <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.4)", paddingTop: 10 }}>
                <p className="tg-muted" style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  Status anggota:
                </p>
                {payments.map((p) => {
                  const isPaid = p.status === "paid";
                  const paidDate = p.paid_at ? formatDateId(p.paid_at.slice(0, 10)) : null;
                  const memberData = Array.isArray(p.member) ? p.member[0] : p.member;

                  return (
                    <div key={p.id} className="tg-member" style={{ padding: "8px 0" }}>
                      <div className="tg-row">
                        <div>
                          <div style={{ fontWeight: 600 }}>{memberData?.name ?? "Anggota"}</div>
                          {memberData?.phone && (
                            <div className="tg-muted" style={{ fontSize: 12 }}>
                              {formatLocalPhone(memberData.phone)}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{rupiah(Number(p.amount_due))}</div>
                          <div style={{ marginTop: 4 }}>
                            {isPaid ? (
                              <span className="tg-chip tg-chip-success" style={{ fontSize: 11, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 3 }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>Lunas{paidDate ? ` · ${paidDate}` : ""}</span>
                              </span>
                            ) : (
                              <span className="tg-chip" style={{ fontSize: 11, padding: "2px 8px" }}>
                                Belum lunas
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {payments.length === 0 && (
                  <p className="tg-muted" style={{ fontSize: 13 }}>
                    Tidak ada data pembayaran untuk periode ini.
                  </p>
                )}
              </div>
            </section>
          );
        })}

        {list.length === 0 && (
          <div className="tg-glass tg-muted" style={{ textAlign: "center", padding: "32px 16px" }}>
            Belum ada riwayat periode untuk room ini.
          </div>
        )}
      </div>
    </>
  );
}
