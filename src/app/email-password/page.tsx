import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server-client";
import { signIn, signUp } from "./actions";
import PasswordField from "./PasswordField";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}): Promise<Metadata> {
  const { mode } = await searchParams;
  return {
    title: mode === "daftar" ? "Daftar" : "Masuk",
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; info?: string; next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const { mode, error, info, next } = await searchParams;
  const signup = mode === "daftar";
  const nextParam = next && next.startsWith("/") && !next.startsWith("//") ? next : "";

  return (
    <>
      <div style={{ paddingTop: 48 }}>
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 20px -2px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.04)",
            border: "2px solid #ffffff",
            marginBottom: 16,
          }}
        >
          <Image
            src="/tapin-logo.png"
            alt="Logo TagihIn"
            width={38}
            height={38}
            style={{ objectFit: "contain" }}
            priority
          />
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.8px", margin: 0 }}>TagihIn</h1>
        <p className="tg-muted" style={{ fontSize: 15, margin: "6px 0 0" }}>
          Iuran bersama, tercatat rapi.
        </p>
      </div>

      <form action={signup ? signUp : signIn} className="tg-glass tg-stack" style={{ marginTop: 36 }}>
        <h2 className="tg-h2">{signup ? "Buat akun" : "Masuk"}</h2>
        {error && (
          <p role="alert" className="tg-alert">
            {error}
          </p>
        )}
        {info && (
          <p
            role="status"
            style={{
              background: "rgba(220,252,231,.92)",
              color: "#14532d",
              borderRadius: 16,
              padding: "12px 14px",
              margin: 0,
            }}
          >
            {info}
          </p>
        )}
        <input type="hidden" name="next" value={nextParam} />
        {signup && (
          <label className="tg-field">
            Nama
            <input name="name" maxLength={80} autoComplete="name" className="tg-input" placeholder="Nama kamu" />
          </label>
        )}
        <label className="tg-field">
          Email
          <input name="email" type="email" required autoComplete="email" className="tg-input" placeholder="nama@email.com" />
        </label>
        <PasswordField signup={signup} />
        <button type="submit" className="tg-btn" style={{ width: "100%" }}>
          {signup ? "Daftar" : "Masuk"}
        </button>
        {signup && (
          <p className="tg-muted" style={{ textAlign: "center", fontSize: 12, margin: "2px 0 0" }}>
            Dengan mendaftar, kamu menyetujui{" "}
            <Link href="/kebijakan-privasi" className="tg-link" style={{ fontSize: 12 }}>
              Kebijakan Privasi
            </Link>
          </p>
        )}
        <p className="tg-muted" style={{ textAlign: "center", margin: 0 }}>
          {signup ? "Sudah punya akun? " : "Belum punya akun? "}
          <Link className="tg-link" href={signup ? "/email-password" : "/email-password?mode=daftar"}>
            {signup ? "Masuk" : "Daftar"}
          </Link>
        </p>
      </form>
    </>
  );
}