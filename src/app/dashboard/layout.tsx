import type { ReactNode } from "react";
import { Figtree } from "next/font/google";
import BottomNav from "./BottomNav";
import "./dashboard.css";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "600", "700"] });

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`tg-bg gradient-untitled ${figtree.className}`}>
      <div className="tg-shell">{children}</div>
      <BottomNav />
    </div>
  );
}
