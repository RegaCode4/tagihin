import type { Metadata } from "next";
import Link from "next/link";
import { createRoom } from "../../actions";

export const metadata: Metadata = {
  title: "Buat Room",
};

export default async function NewRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <>
      <Link href="/dashboard/rooms" className="tg-muted" style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
        <span>Batal</span>
      </Link>
      <h1 className="tg-h1">Buat room iuran</h1>

      <form action={createRoom} className="tg-glass tg-stack" style={{ marginTop: 16 }}>
        {error && <p role="alert" className="tg-alert">{error}</p>}
        <label className="tg-field">
          Judul iuran
          <input name="title" required maxLength={100} className="tg-input" placeholder="Wifi Kos Hijau" />
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <label className="tg-field" style={{ flex: 1 }}>
            Total per bulan (Rp)
            <input name="total_amount" required inputMode="numeric" className="tg-input" placeholder="140000" />
          </label>
          <label className="tg-field" style={{ flex: 1 }}>
            Jatuh tempo (tgl 1-28)
            <input name="due_day" type="number" min={1} max={28} required className="tg-input" placeholder="10" />
          </label>
        </div>
        <label className="tg-field">
          Info pembayaran
          <input name="payment_instruction" className="tg-input" placeholder="DANA 0812-xxxx a.n. [Nama]" />
        </label>
        <label className="tg-field">
          Deskripsi (opsional)
          <textarea name="description" rows={2} className="tg-input" />
        </label>
        <p className="tg-muted" style={{ margin: 0 }}>Anggota ditambahkan setelah room tersimpan.</p>
        <button type="submit" className="tg-btn" style={{ width: "100%" }}>Simpan room</button>
      </form>
    </>
  );
}
