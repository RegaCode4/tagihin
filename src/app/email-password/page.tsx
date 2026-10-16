import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server-client";
import { signIn, signUp } from "./actions";

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
      <div style={{ paddingTop: 72 }}>
        <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-1px", margin: 0 }}>TagihIn</h1>
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
        <label className="tg-field">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={signup ? 8 : undefined}
            autoComplete={signup ? "new-password" : "current-password"}
            className="tg-input"
            placeholder={signup ? "Minimal 8 karakter" : "Password"}
          />
        </label>
        <button type="submit" className="tg-btn" style={{ width: "100%" }}>
          {signup ? "Daftar" : "Masuk"}
        </button>
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