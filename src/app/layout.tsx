import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tagihin.my.id"),
  title: {
    default: "Tagihin - Aplikasi Manajemen Tagihan Kost",
    template: "Tagihin - %s",
  },
  description:
    "Aplikasi manajemen dan pencatatan tagihan iuran kost, kontrakan, atau sewa kamar secara praktis, otomatis, dan transparan.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Tagihin - Aplikasi Manajemen Tagihan Kost",
    description:
      "Aplikasi manajemen dan pencatatan tagihan iuran kost, kontrakan, atau sewa kamar secara praktis, otomatis, dan transparan.",
    url: "https://tagihin.my.id",
    siteName: "Tagihin",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "/tapin-logo.png",
        width: 1200,
        height: 630,
        alt: "Tagihin - Aplikasi Manajemen Tagihan Kost",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tagihin - Aplikasi Manajemen Tagihan Kost",
    description:
      "Aplikasi manajemen dan pencatatan tagihan iuran kost, kontrakan, atau sewa kamar secara praktis, otomatis, dan transparan.",
    images: ["/tapin-logo.png"],
  },
  icons: {
    icon: "/tapin-logo.png",
    shortcut: "/tapin-logo.png",
    apple: "/tapin-logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
