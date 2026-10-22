import type { Metadata } from "next";
import Link from "next/link";
import { Figtree } from "next/font/google";
import "../dashboard/dashboard.css";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
};

export default function KebijakanPrivasiPage() {
  return (
    <div className={`tg-bg gradient-untitled ${figtree.className}`}>
      <div className="tg-shell" style={{ paddingBottom: 64 }}>
        <Link href="/email-password" className="tg-muted" style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>Kembali</span>
        </Link>
        <h1 className="tg-h1" style={{ marginTop: 12 }}>
          Kebijakan Privasi
        </h1>
        <p className="tg-muted" style={{ margin: "2px 0 20px" }}>
          TagihIn · Privasi & Keamanan Data
        </p>

        <section className="tg-glass">
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: 15 }}>
            Draf kebijakan privasi sedang disusun.
          </p>
        </section>
      </div>
    </div>
  );
}
