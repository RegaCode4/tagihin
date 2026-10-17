import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server-client";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "Beranda",
};

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/email-password");

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
  const activeRooms = rooms?.filter((r) => r.status === "active").length ?? 0;



  return (
    <>
      <header className="tg-row">
        <div>
          <p className="tg-muted" style={{ margin: 0 }}>{month}</p>
          <h1 className="tg-h1">Halo, {profile?.name ?? "Penagih"}</h1>
        </div>
        <form action={signOut}>
          <button type="submit" className="tg-btn tg-btn-sm tg-btn-ghost">Keluar</button>
        </form>
      </header>

      <section className="tg-glass" style={{ marginTop: 20 }}>
        <p className="tg-muted" style={{ margin: 0 }}>Ringkasan</p>
        <p className="tg-big">{activeRooms} room aktif</p>
        <p className="tg-muted" style={{ margin: "4px 0 0" }}>{memberCount ?? 0} anggota terdaftar</p>
      </section>

      <div className="tg-row" id="room-list" style={{ margin: "24px 0 12px" }}>
        <h2 className="tg-h2">Room iuran</h2>
        <Link href="/dashboard/rooms/new" className="tg-btn tg-btn-sm">Buat room</Link>
      </div>

      <ul className="tg-stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {rooms?.map((r) => (
          <li key={r.id} className="tg-glass tg-row">
            <div>
              <Link href={`/dashboard/rooms/${r.id}`} className="tg-link" style={{ fontSize: 17 }}>
                {r.title}
              </Link>
              <p className="tg-muted" style={{ margin: "2px 0 0" }}>
                {rupiah(r.total_amount)} per bulan · jatuh tempo tgl {r.due_day}
              </p>
            </div>
            <span className="tg-chip">{r.status === "completed" ? "Selesai" : "Aktif"}</span>
          </li>
        ))}
        {rooms?.length === 0 && (
          <li className="tg-glass tg-muted">Belum ada room. Buat room iuran pertamamu.</li>
        )}
      </ul>
    </>
  );
}
