import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCachedUser } from "../../../../lib/supabase/server-client";
import { getUserProfile } from "../../../../lib/supabase/queries";
import { formatLocalPhone } from "../../../../lib/phone";
import { updateProfile, updatePassword, signOut } from "../actions";

export const metadata: Metadata = {
  title: "Akun",
};

export default async function AkunPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;

  const user = await getCachedUser();
  if (!user) redirect("/email-password");

  const profile = await getUserProfile(user.id);

  const displayPhone = formatLocalPhone(profile?.phone);

  return (
    <>
      <header>
        <h1 className="tg-h1">Akun Saya</h1>
        <p className="tg-muted" style={{ margin: 0 }}>
          Kelola informasi profil, keamanan, dan sesi
        </p>
      </header>

      {/* Umpan Balik Status & Error */}
      {error && (
        <p role="alert" className="tg-alert" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7f1d1d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
          </svg>
          <span>{error}</span>
        </p>
      )}

      {ok && (
        <p
          role="status"
          style={{
            background: "rgba(220, 252, 231, 0.92)",
            color: "#14532d",
            borderRadius: 16,
            padding: "12px 14px",
            margin: "16px 0 0",
            fontSize: 14,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14532d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span>{ok}</span>
        </p>
      )}

      <div className="tg-stack" style={{ marginTop: 20 }}>
        {/* Kartu Profil */}
        <section className="tg-glass">
          <h2 className="tg-h2" style={{ fontSize: 17, marginBottom: 12 }}>
            Profil Pengguna
          </h2>

          <div style={{ marginBottom: 12 }}>
            <label className="tg-field">
              Email
              <input
                value={user.email ?? ""}
                readOnly
                disabled
                className="tg-input"
                style={{ opacity: 0.65, cursor: "not-allowed" }}
              />
            </label>
          </div>

          <form action={updateProfile} className="tg-stack">
            <label className="tg-field">
              Nama lengkap <span style={{ color: "#b91c1c" }}>*</span>
              <input
                name="name"
                defaultValue={profile?.name ?? ""}
                required
                maxLength={80}
                placeholder="Nama lengkap kamu"
                className="tg-input"
                aria-label="Nama lengkap"
              />
            </label>

            <label className="tg-field">
              Nomor WhatsApp (opsional)
              <input
                name="phone"
                defaultValue={displayPhone}
                placeholder="0812-3456-7890"
                className="tg-input"
                aria-label="Nomor WhatsApp"
              />
            </label>

            <button type="submit" className="tg-btn tg-btn-sm" style={{ width: "100%", marginTop: 8 }}>
              Simpan profil
            </button>
          </form>
        </section>

        {/* Kartu Keamanan */}
        <section className="tg-glass">
          <h2 className="tg-h2" style={{ fontSize: 17, marginBottom: 6 }}>
            Keamanan
          </h2>
          <p className="tg-muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
            Perbarui password akun kamu (minimal 8 karakter).
          </p>

          <form action={updatePassword} className="tg-stack">
            <label className="tg-field">
              Password baru
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Minimal 8 karakter"
                className="tg-input"
                aria-label="Password baru"
              />
            </label>

            <label className="tg-field">
              Konfirmasi password baru
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                placeholder="Ketik ulang password baru"
                className="tg-input"
                aria-label="Konfirmasi password baru"
              />
            </label>

            <button type="submit" className="tg-btn tg-btn-sm" style={{ width: "100%", marginTop: 8 }}>
              Ganti password
            </button>
          </form>
        </section>

        {/* Kartu Sesi */}
        <section className="tg-glass">
          <h2 className="tg-h2" style={{ fontSize: 17, marginBottom: 4 }}>
            Sesi Akun
          </h2>
          <p className="tg-muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
            Keluar dari aplikasi di perangkat ini.
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="tg-btn tg-btn-sm tg-btn-ghost"
              style={{ width: "100%" }}
            >
              Keluar
            </button>
          </form>
        </section>

        {/* Kartu Tentang */}
        <section className="tg-glass">
          <h2 className="tg-h2" style={{ fontSize: 17, marginBottom: 4 }}>
            Tentang TagihIn
          </h2>
          <p className="tg-muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
            Aplikasi pencatatan dan penagihan iuran bersama transparan.
          </p>
          <div className="tg-row">
            <span className="tg-muted">Versi 1.0.0</span>
            <Link href="/kebijakan-privasi" className="tg-link" style={{ fontSize: 14, display: "inline-flex", alignItems: "center", gap: 3 }}>
              <span>Kebijakan Privasi</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          </div>
        </section>

        {/* Kartu Hapus Akun (Informasi Saja) */}
        <section className="tg-glass" style={{ border: "1px dashed rgba(220, 38, 38, 0.4)" }}>
          <h2 className="tg-h2" style={{ fontSize: 17, color: "#991b1b", marginBottom: 4 }}>
            Hapus Akun
          </h2>
          <p className="tg-muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
            Untuk saat ini, hubungi pengelola aplikasi untuk menghapus akun dan datamu.
          </p>
          <button
            type="button"
            disabled
            className="tg-btn tg-btn-sm"
            style={{
              width: "100%",
              opacity: 0.5,
              cursor: "not-allowed",
              background: "#6b7280",
            }}
          >
            Hapus akun (hubungi admin)
          </button>
        </section>
      </div>
    </>
  );
}
