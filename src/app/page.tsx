import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Figtree } from "next/font/google";
import { createClient } from "../../lib/supabase/server-client";
import "./dashboard/dashboard.css";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className={`tg-welcome-page ${figtree.className}`}>
      <main className="tg-welcome-shell">
        {/* Top Dark Curved Header */}
        <section className="tg-welcome-top">
          {/* Subtle concentric decorative rings behind badge */}
          <div className="tg-welcome-ring tg-welcome-ring-1" aria-hidden="true" />
          <div className="tg-welcome-ring tg-welcome-ring-2" aria-hidden="true" />

          {/* Overlapping Central Circular Logo Badge */}
          <div className="tg-welcome-badge" aria-label="Logo TagihIn">
            <Image
              src="/tapin-logo.png"
              alt="Logo TagihIn"
              width={56}
              height={56}
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
        </section>

        {/* Bottom Content Area */}
        <section className="tg-welcome-bottom">
          <div className="tg-welcome-text">
            <h1 className="tg-welcome-title">TagihIn</h1>
            <p className="tg-welcome-subtitle">Iuran bersama, tercatat rapi.</p>
            <p className="tg-welcome-desc">
              Kelola kas kelompok, kontrakan, wifi, & patungan tanpa ribet rekap manual.
            </p>
          </div>

          <div className="tg-welcome-actions">
            <Link href="/email-password?mode=daftar" className="tg-welcome-cta">
              <span>Mulai Sekarang</span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>

            <p className="tg-welcome-login-hint">
              Sudah punya akun?{" "}
              <Link href="/email-password" className="tg-welcome-login-link">
                Masuk
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}