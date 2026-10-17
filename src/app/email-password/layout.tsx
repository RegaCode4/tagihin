import type { ReactNode } from "react";
import { Figtree } from "next/font/google";
import "../dashboard/dashboard.css";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "600", "700"] });

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`tg-bg gradient-untitled ${figtree.className}`}>
      <div className="tg-shell" style={{ paddingBottom: 48 }}>
        {children}
      </div>
    </div>
  );
}
