"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server-client";

type Mode = "masuk" | "daftar";

// hanya izinkan path internal agar tidak jadi open redirect
function safeNext(raw: string): string {
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
}

function back(mode: Mode, key: "error" | "info", message: string, next: string): never {
  const nextQs = next !== "/dashboard" ? `&next=${encodeURIComponent(next)}` : "";
  redirect(`/email-password?mode=${mode}&${key}=${encodeURIComponent(message)}${nextQs}`);
}

const field = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function signIn(fd: FormData) {
  const email = field(fd, "email");
  const password = String(fd.get("password") ?? "");
  const next = safeNext(field(fd, "next"));
  if (!email || !password) back("masuk", "error", "Email dan password wajib diisi.", next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    back(
      "masuk",
      "error",
      error.code === "email_not_confirmed"
        ? "Email belum dikonfirmasi. Cek kotak masukmu."
        : "Email atau password salah.",
      next,
    );
  }
  redirect(next);
}

export async function signUp(fd: FormData) {
  const name = field(fd, "name");
  const email = field(fd, "email");
  const password = String(fd.get("password") ?? "");
  const next = safeNext(field(fd, "next"));
  if (!email || password.length < 8) {
    back("daftar", "error", "Email wajib diisi dan password minimal 8 karakter.", next);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: name ? { name } : {} },
  });
  if (error) {
    back(
      "daftar",
      "error",
      error.code === "user_already_exists" ? "Email sudah terdaftar. Silakan masuk." : "Gagal mendaftar. Coba lagi.",
      next,
    );
  }
  // bila konfirmasi email aktif di Supabase, belum ada sesi sampai email dikonfirmasi
  if (!data.session) {
    back("masuk", "info", "Pendaftaran berhasil. Cek email untuk konfirmasi, lalu masuk.", next);
  }
  redirect(next);
}
