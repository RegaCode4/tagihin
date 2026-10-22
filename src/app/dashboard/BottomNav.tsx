"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const svg = (children: ReactNode) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#15181d"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  prefetch?: boolean;
}

const ITEMS: NavItem[] = [
  { key: "home", label: "Beranda", href: "/dashboard", icon: svg(<path d="M3 11l9-8 9 8v10H3z" />) },
  { key: "room", label: "Room", href: "/dashboard/rooms", icon: svg(<path d="M4 6h16M4 12h16M4 18h10" />) },
  {
    key: "history",
    label: "Riwayat",
    href: "/dashboard/riwayat",
    prefetch: false,
    icon: svg(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    key: "account",
    label: "Akun",
    href: "/dashboard/akun",
    prefetch: false,
    icon: svg(
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </>
    ),
  },
];

function getActiveKey(pathname: string): string {
  if (pathname.startsWith("/dashboard/akun")) return "account";
  if (pathname.startsWith("/dashboard/riwayat")) return "history";
  if (pathname === "/dashboard/rooms" || pathname.startsWith("/dashboard/rooms/")) return "room";
  if (pathname === "/dashboard") return "home";
  return "home";
}

export default function BottomNav() {
  const pathname = usePathname();
  const active = getActiveKey(pathname);

  // Update tab title: TagihIn - (nama menu)
  useEffect(() => {
    const activeItem = ITEMS.find((it) => it.key === active);
    if (activeItem) {
      document.title = `TagihIn - ${activeItem.label}`;
    }
  }, [active]);

  if (pathname === "/dashboard/rooms/new") return null; // form tidak memakai bottom bar

  return (
    <nav className="tg-nav" aria-label="Navigasi utama">
      {ITEMS.map((it) => {
        const isActive = it.key === active;
        const cls = `tg-nav-btn ${isActive ? "tg-nav-active" : "tg-nav-item"}`;
        const content = (
          <>
            <span className="tg-nav-label">{it.label}</span>
            <span className="tg-nav-icon-box">{it.icon}</span>
          </>
        );

        return (
          <Link
            key={it.key}
            href={it.href}
            prefetch={it.prefetch}
            className={cls}
            aria-label={it.label}
            aria-current={isActive ? "page" : undefined}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
