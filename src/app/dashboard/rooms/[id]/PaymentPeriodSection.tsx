"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setPaymentPaid, updateMember, deactivateMember } from "../../actions";
import { formatDateId } from "../../../../../lib/reminder";
import { formatLocalPhone } from "../../../../../lib/phone";

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export interface MemberItem {
  memberId: string;
  name: string;
  phone: string;
  paymentId?: string;
  amountDue: number;
  status: "paid" | "unpaid";
  paidAt: string | null;
  isOverdue: boolean;
  nextMonthOnly?: boolean;
}

interface Props {
  roomId: string;
  periodId: string;
  periodMonthName: string;
  dueDate: string;
  totalAmount: number;
  initialItems: MemberItem[];
}

export default function PaymentPeriodSection({
  roomId,
  periodMonthName,
  dueDate,
  totalAmount,
  initialItems,
}: Props) {
  const [items, setItems] = useState<MemberItem[]>(initialItems);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync state if props change (e.g. after server revalidation)
  // We keep items initialized with initialItems
  // Only payments count toward collected
  const collected = items
    .filter((it) => it.status === "paid" && !it.nextMonthOnly)
    .reduce((sum, it) => sum + it.amountDue, 0);

  const progressPercent = totalAmount > 0 ? Math.min(100, Math.round((collected / totalAmount) * 100)) : 0;

  const handleTogglePaid = (paymentId: string, currentStatus: "paid" | "unpaid") => {
    const nextPaid = currentStatus !== "paid";
    const nowIso = new Date().toISOString();

    // Optimistic update
    setItems((prev) =>
      prev.map((it) => {
        if (it.paymentId === paymentId) {
          return {
            ...it,
            status: nextPaid ? "paid" : "unpaid",
            paidAt: nextPaid ? nowIso : null,
          };
        }
        return it;
      })
    );

    setActionError(null);

    startTransition(async () => {
      try {
        await setPaymentPaid(roomId, paymentId, nextPaid);
      } catch (err: unknown) {
        // Revert on error
        setItems((prev) =>
          prev.map((it) => {
            if (it.paymentId === paymentId) {
              return {
                ...it,
                status: currentStatus,
                paidAt: currentStatus === "paid" ? it.paidAt : null,
              };
            }
            return it;
          })
        );
        setActionError(err instanceof Error ? err.message : "Gagal memperbarui status pembayaran.");
      }
    });
  };

  return (
    <>
      {actionError && (
        <p role="alert" className="tg-alert" style={{ marginTop: 12 }}>
          {actionError}
        </p>
      )}

      {/* Ringkasan Periode Berjalan */}
      <section className="tg-glass" style={{ marginTop: 16 }}>
        <div className="tg-row">
          <div>
            <span className="tg-chip" style={{ fontSize: 12, padding: "4px 10px" }}>
              Periode {periodMonthName}
            </span>
            <p className="tg-muted" style={{ margin: "6px 0 0" }}>
              Jatuh tempo {formatDateId(dueDate)}
            </p>
          </div>
          <Link href={`/dashboard/rooms/${roomId}/riwayat`} prefetch={false} className="tg-link" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 3 }}>
            <span>Lihat riwayat</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="tg-row" style={{ alignItems: "baseline" }}>
            <span className="tg-muted" style={{ fontSize: 13, fontWeight: 600 }}>Terkumpul</span>
            <span className="tg-muted" style={{ fontSize: 13 }}>
              {progressPercent}%
            </span>
          </div>
          <p className="tg-big" style={{ fontSize: 22, margin: "2px 0 0", wordBreak: "break-word", lineHeight: 1.3 }}>
            {rupiah(collected)} dari {rupiah(totalAmount)}
          </p>
          <div className="tg-progress-bar" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
            <div className="tg-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </section>

      {/* Daftar Anggota & Status Pembayaran */}
      <section className="tg-glass" style={{ marginTop: 16, paddingTop: 8, paddingBottom: 8 }}>
        <h2 className="tg-h2" style={{ fontSize: 16, margin: "8px 0 12px" }}>
          Status pembayaran anggota
        </h2>

        {items.map((m) => {
          const isPaid = m.status === "paid";
          const formattedPaidDate = m.paidAt ? formatDateId(m.paidAt.slice(0, 10)) : null;

          return (
            <div key={m.memberId} className="tg-member">
              <div className="tg-row" style={{ alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</div>
                  <div className="tg-muted">{formatLocalPhone(m.phone)}</div>
                  {isPaid && formattedPaidDate && (
                    <div style={{ marginTop: 6 }}>
                      <span className="tg-chip tg-chip-success" style={{ fontSize: 11, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Lunas · {formattedPaidDate}</span>
                      </span>
                    </div>
                  )}
                  {m.isOverdue && !isPaid && !m.nextMonthOnly && (
                    <div style={{ marginTop: 6 }}>
                      <span
                        className="tg-chip tg-chip-danger"
                        style={{
                          fontSize: 11,
                          padding: "3px 10px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>Terlambat</span>
                      </span>
                    </div>
                  )}
                  {m.nextMonthOnly && (
                    <div style={{ marginTop: 6 }}>
                      <span className="tg-chip" style={{ fontSize: 11, padding: "3px 10px" }}>
                        Bulan depan
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="tg-chip" style={{ fontSize: 13, fontWeight: 600 }}>{rupiah(m.amountDue)}</span>
                </div>
              </div>

              {/* Actions row: Checkbox Lunas (target >= 44px) & Tombol Ingatkan */}
              {!m.nextMonthOnly && m.paymentId && (
                <div className="tg-row" style={{ marginTop: 16, justifyContent: "space-between" }}>
                  <label
                    className={`tg-checkbox-label ${isPaid ? "tg-paid" : ""}`}
                    aria-label={`Tandai lunas ${m.name}`}
                  >
                    <input
                      type="checkbox"
                      checked={isPaid}
                      disabled={isPending}
                      onChange={() => handleTogglePaid(m.paymentId!, m.status)}
                      className="tg-checkbox-input"
                    />
                    <span>{isPaid ? "Lunas" : "Tandai lunas"}</span>
                  </label>

                  {!isPaid && (
                    <a
                      href={`/dashboard/rooms/${roomId}/remind/${m.paymentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tg-btn tg-btn-sm tg-btn-ghost"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                      </svg>
                      <span>Ingatkan</span>
                    </a>
                  )}
                </div>
              )}

              {/* Form Ubah / Nonaktifkan Anggota */}
              <details style={{ marginTop: 6 }}>
                <summary style={{ fontSize: 12, minHeight: 36, color: "#3a3f47" }}>Ubah data anggota</summary>
                <form action={updateMember.bind(null, roomId, m.memberId)} className="tg-stack" style={{ marginTop: 8 }}>
                  <input name="name" defaultValue={m.name} required className="tg-input" aria-label="Nama" />
                  <input name="phone" defaultValue={formatLocalPhone(m.phone)} required className="tg-input" aria-label="Nomor HP" />
                  <button type="submit" className="tg-btn tg-btn-sm">
                    Simpan
                  </button>
                </form>
                <form action={deactivateMember.bind(null, roomId, m.memberId)} style={{ marginTop: 8 }}>
                  <button type="submit" className="tg-btn tg-btn-sm tg-btn-ghost">
                    Nonaktifkan
                  </button>
                </form>
              </details>
            </div>
          );
        })}

        {items.length === 0 && <p className="tg-muted">Belum ada anggota di room ini.</p>}

        <p className="tg-muted" style={{ fontSize: 12, marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.4)", paddingTop: 10, display: "flex", alignItems: "flex-start", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <span>Catatan: Anggota yang baru ditambahkan setelah ada yang membayar lunas tidak akan mengubah tagihan periode berjalan (anggota baru mulai ditagih bulan depan).</span>
        </p>
      </section>
    </>
  );
}
