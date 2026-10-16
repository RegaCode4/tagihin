"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const svg = (children: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15181d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const ITEMS = [
  { key: "home", label: "Beranda", href: "/dashboard", icon: svg(<path d="M3 11l9-8 9 8v10H3z" />) },
  { key: "room", label: "Room", href: "/dashboard#room-list", icon: svg(<path d="M4 6h16M4 12h16M4 18h10" />) },
  { key: "history", label: "Riwayat", href: null, icon: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>) },
  { key: "account", label: "Akun", href: null, icon: svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>) },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/dashboard/rooms/new") return null; // form tidak memakai bottom bar
  const active = pathname.startsWith("/dashboard/rooms") ? "room" : "home";

  return (
    <nav className="tg-nav" aria-label="Navigasi utama">
      {ITEMS.map((it) => {
        const isActive = it.key === active;
        const cls = isActive ? "tg-nav-active" : "tg-nav-item";
        const content = isActive ? (<>{it.label}<span>{it.icon}</span></>) : it.icon;
        if (!it.href) {
          return (
            <button key={it.key} type="button" className={cls} aria-label={`${it.label} (segera hadir)`} disabled>
              {content}
            </button>
          );
        }
        return (
          <Link key={it.key} href={it.href} className={cls} aria-label={it.label} aria-current={isActive ? "page" : undefined}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
