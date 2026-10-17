"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, type ReactNode, type MouseEvent } from "react";

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
  href: string | null;
  icon: ReactNode;
  hint?: string;
}

const ITEMS: NavItem[] = [
  { key: "home", label: "Beranda", href: "/dashboard", icon: svg(<path d="M3 11l9-8 9 8v10H3z" />) },
  { key: "room", label: "Room", href: "/dashboard#room-list", icon: svg(<path d="M4 6h16M4 12h16M4 18h10" />) },
  {
    key: "history",
    label: "Riwayat",
    href: null,
    hint: "Fitur Riwayat segera hadir",
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
    href: null,
    hint: "Fitur Akun segera hadir",
    icon: svg(
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [active, setActive] = useState<string>(() =>
    pathname.startsWith("/dashboard/rooms") ? "room" : "home"
  );
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync active when pathname changes without cascading render
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (pathname.startsWith("/dashboard/rooms")) {
      setActive("room");
    } else if (pathname === "/dashboard") {
      if (typeof window !== "undefined" && window.location.hash === "#room-list") {
        setActive("room");
      } else {
        setActive("home");
      }
    }
  }

  // Update tab title: TagihIn - (nama menu)
  useEffect(() => {
    const activeItem = ITEMS.find((it) => it.key === active);
    if (activeItem) {
      document.title = `TagihIn - ${activeItem.label}`;
    }
  }, [active]);

  // Listen to hash changes and observe room-list section on dashboard
  useEffect(() => {
    if (pathname !== "/dashboard") return;

    const handleHash = () => {
      if (window.location.hash === "#room-list") {
        setActive("room");
      } else if (!window.location.hash) {
        setActive("home");
      }
    };

    window.addEventListener("hashchange", handleHash);

    const target = document.getElementById("room-list");
    let observer: IntersectionObserver | null = null;

    if (target && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && window.scrollY > 120) {
              setActive("room");
            } else if (window.scrollY < 100) {
              setActive("home");
            }
          });
        },
        { threshold: 0.1, rootMargin: "-20px 0px -40px 0px" }
      );
      observer.observe(target);
    }

    return () => {
      window.removeEventListener("hashchange", handleHash);
      if (observer && target) {
        observer.unobserve(target);
      }
    };
  }, [pathname]);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2800);
  };

  const handleItemClick = (it: NavItem, e: MouseEvent) => {
    if (it.hint) {
      showToast(it.hint);
      setActive(it.key);
      return;
    }

    if (pathname === "/dashboard") {
      if (it.key === "home") {
        e.preventDefault();
        setActive("home");
        window.history.pushState(null, "", "/dashboard");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (it.key === "room") {
        e.preventDefault();
        setActive("room");
        window.history.pushState(null, "", "/dashboard#room-list");
        const el = document.getElementById("room-list");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          el.classList.add("tg-room-list-highlight");
          setTimeout(() => el.classList.remove("tg-room-list-highlight"), 700);
        }
      }
    } else {
      setActive(it.key);
    }
  };

  if (pathname === "/dashboard/rooms/new") return null; // form tidak memakai bottom bar

  return (
    <>
      {toast && (
        <div className="tg-nav-toast" role="status" aria-live="polite">
          <span>{toast}</span>
        </div>
      )}
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

          if (!it.href) {
            return (
              <button
                key={it.key}
                type="button"
                className={cls}
                aria-label={`${it.label} (${it.hint ?? "segera hadir"})`}
                aria-current={isActive ? "page" : undefined}
                onClick={(e) => handleItemClick(it, e)}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={it.key}
              href={it.href}
              className={cls}
              aria-label={it.label}
              aria-current={isActive ? "page" : undefined}
              onClick={(e) => handleItemClick(it, e)}
            >
              {content}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
