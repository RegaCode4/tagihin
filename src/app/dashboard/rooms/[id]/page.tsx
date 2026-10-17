import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/server-client";
import { splitEqual } from "../../../../../lib/split";
import {
  addMember,
  deactivateMember,
  deleteRoom,
  setRoomStatus,
  updateMember,
  updateRoom,
} from "../../actions";

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
// 6281234567890 -> 0812-3456-7890
const localPhone = (p: string) => ("0" + p.slice(2)).replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");

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

  const { data: members } = await supabase
    .from("members")
    .select("id, name, phone, sort_order")
    .eq("room_id", id)
    .eq("is_active", true)
    .order("sort_order");

  const list = members ?? [];
  const shares = list.length ? splitEqual(room.total_amount, list.length) : [];
  const perPerson =
    shares.length === 0
      ? null
      : shares[0] === shares[shares.length - 1]
        ? `${rupiah(shares[0])} per orang`
        : `${rupiah(shares[0])} (anggota pertama), ${rupiah(shares[shares.length - 1])} lainnya`;

  return (
    <>
      <Link href="/dashboard" className="tg-muted">← Dasbor</Link>
      <h1 className="tg-h1">{room.title}</h1>
      <p className="tg-muted" style={{ margin: 0 }}>
        Jatuh tempo tgl {room.due_day}
        {room.status === "completed" ? " · Selesai" : ""}
      </p>

      {error && <p role="alert" className="tg-alert" style={{ marginTop: 12 }}>{error}</p>}

      <section className="tg-glass" style={{ marginTop: 16 }}>
        <p className="tg-big" style={{ fontSize: 30 }}>{rupiah(room.total_amount)}</p>
        <p className="tg-muted" style={{ margin: "4px 0 0" }}>
          per bulan · {list.length} anggota{perPerson ? ` · ${perPerson}` : ""}
        </p>
        {room.payment_instruction && (
          <p className="tg-muted" style={{ margin: "8px 0 0" }}>Bayar ke: {room.payment_instruction}</p>
        )}
      </section>

      <section className="tg-glass" style={{ marginTop: 16, paddingTop: 8, paddingBottom: 8 }}>
        {list.map((m, i) => (
          <div key={m.id} className="tg-member">
            <div className="tg-row">
              <div>
                <div style={{ fontWeight: 600 }}>{m.name}</div>
                <div className="tg-muted">{localPhone(m.phone)}</div>
              </div>
              <span className="tg-chip">{rupiah(shares[i])}</span>
            </div>
            <details>
              <summary>Ubah</summary>
              <form action={updateMember.bind(null, room.id, m.id)} className="tg-stack">
                <input name="name" defaultValue={m.name} required className="tg-input" aria-label="Nama" />
                <input name="phone" defaultValue={localPhone(m.phone)} required className="tg-input" aria-label="Nomor HP" />
                <button type="submit" className="tg-btn tg-btn-sm">Simpan</button>
              </form>
              <form action={deactivateMember.bind(null, room.id, m.id)} style={{ marginTop: 8 }}>
                <button type="submit" className="tg-btn tg-btn-sm tg-btn-ghost">Nonaktifkan</button>
              </form>
            </details>
          </div>
        ))}
        {list.length === 0 && <p className="tg-muted">Belum ada anggota.</p>}
      </section>

      <form action={addMember.bind(null, room.id)} className="tg-glass tg-stack" style={{ marginTop: 16 }}>
        <h2 className="tg-h2" style={{ fontSize: 16 }}>Tambah anggota</h2>
        <input name="name" required maxLength={80} placeholder="Nama" className="tg-input" aria-label="Nama" />
        <input name="phone" required placeholder="0812-3456-7890" className="tg-input" aria-label="Nomor HP" />
        <button type="submit" className="tg-btn" style={{ width: "100%" }}>Tambah anggota</button>
      </form>

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

      <div className="tg-row" style={{ marginTop: 16, justifyContent: "flex-start", flexWrap: "wrap" }}>
        <form action={setRoomStatus.bind(null, room.id, room.status === "active" ? "completed" : "active")}>
          <button type="submit" className="tg-btn tg-btn-sm tg-btn-ghost">
            {room.status === "active" ? "Tandai selesai" : "Aktifkan lagi"}
          </button>
        </form>
        <details>
          <summary>Hapus room</summary>
          <form action={deleteRoom.bind(null, room.id)}>
            <p className="tg-muted">Seluruh anggota dan riwayat ikut terhapus. Tidak bisa dibatalkan.</p>
            <button type="submit" className="tg-btn tg-btn-sm tg-btn-danger">Ya, hapus room</button>
          </form>
        </details>
      </div>
    </>
  );
}
