"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
// sesuaikan dengan helper server client yang sudah ada di lib/supabase
import { createClient } from "../../../lib/supabase/server-client";
import { normalizePhone } from "../../../lib/phone";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/email-password");
  return { supabase, user };
}

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function parseRupiah(raw: string): number | null {
  const n = Number(raw.replace(/\D/g, ""));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function readRoom(fd: FormData, errPath: string) {
  const title = text(fd, "title");
  const total = parseRupiah(text(fd, "total_amount"));
  const dueDay = Number(text(fd, "due_day"));
  if (!title || title.length > 100) fail(errPath, "Judul wajib diisi (maksimal 100 karakter).");
  if (!total) fail(errPath, "Total nominal harus berupa angka lebih dari 0.");
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
    fail(errPath, "Tanggal jatuh tempo harus antara 1 dan 28.");
  }
  return {
    title,
    description: text(fd, "description") || null,
    total_amount: total,
    due_day: dueDay,
    payment_instruction: text(fd, "payment_instruction") || null,
  };
}

// ---------- Room ----------
export async function createRoom(fd: FormData) {
  const { supabase, user } = await requireUser();
  const values = readRoom(fd, "/dashboard/rooms/new");
  const { data, error } = await supabase
    .from("rooms")
    .insert({ ...values, owner_id: user.id })
    .select("id")
    .single();
  if (error || !data) fail("/dashboard/rooms/new", "Gagal menyimpan room. Coba lagi.");
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/rooms/${data.id}`);
}

export async function updateRoom(roomId: string, fd: FormData) {
  const path = `/dashboard/rooms/${roomId}`;
  const { supabase } = await requireUser();
  const values = readRoom(fd, path);
  const { error } = await supabase.from("rooms").update(values).eq("id", roomId);
  if (error) fail(path, "Gagal memperbarui room.");
  revalidatePath(path);
  revalidatePath("/dashboard", "layout");
  redirect(path);
}

export async function setRoomStatus(roomId: string, status: "active" | "completed") {
  const path = `/dashboard/rooms/${roomId}`;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("rooms").update({ status }).eq("id", roomId);
  if (error) fail(path, "Gagal mengubah status room.");
  revalidatePath(path);
  revalidatePath("/dashboard", "layout");
  redirect(path);
}

export async function deleteRoom(roomId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("rooms").delete().eq("id", roomId);
  if (error) fail(`/dashboard/rooms/${roomId}`, "Gagal menghapus room.");
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/rooms");
}

// ---------- Anggota ----------
function readMember(fd: FormData, errPath: string) {
  const name = text(fd, "name");
  const phone = normalizePhone(text(fd, "phone"));
  if (!name || name.length > 80) fail(errPath, "Nama wajib diisi (maksimal 80 karakter).");
  if (!phone) fail(errPath, "Nomor HP tidak valid. Contoh: 0812-3456-7890.");
  return { name, phone };
}

export async function addMember(roomId: string, fd: FormData) {
  const path = `/dashboard/rooms/${roomId}`;
  const { supabase } = await requireUser();
  const values = readMember(fd, path);
  const { data: last } = await supabase
    .from("members")
    .select("sort_order")
    .eq("room_id", roomId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("members")
    .insert({ ...values, room_id: roomId, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) {
    fail(path, error.code === "23505" ? "Nomor HP itu sudah terdaftar di room ini." : "Gagal menambah anggota.");
  }
  revalidatePath(path);
  revalidatePath("/dashboard", "layout");
  redirect(path);
}

export async function updateMember(roomId: string, memberId: string, fd: FormData) {
  const path = `/dashboard/rooms/${roomId}`;
  const { supabase } = await requireUser();
  const values = readMember(fd, path);
  const { error } = await supabase
    .from("members")
    .update(values)
    .eq("id", memberId)
    .eq("room_id", roomId);
  if (error) {
    fail(path, error.code === "23505" ? "Nomor HP itu sudah terdaftar di room ini." : "Gagal memperbarui anggota.");
  }
  revalidatePath(path);
  revalidatePath("/dashboard", "layout");
  redirect(path);
}

// Anggota dinonaktifkan, bukan dihapus, agar riwayat pembayaran tetap utuh
export async function deactivateMember(roomId: string, memberId: string) {
  const path = `/dashboard/rooms/${roomId}`;
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("members")
    .update({ is_active: false, deactivated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("room_id", roomId);
  if (error) fail(path, "Gagal menonaktifkan anggota.");
  revalidatePath(path);
  revalidatePath("/dashboard", "layout");
  redirect(path);
}

// ---------- Pembayaran ----------
export async function setPaymentPaid(roomId: string, paymentId: string, paid: boolean) {
  const path = `/dashboard/rooms/${roomId}`;
  const { supabase, user } = await requireUser();

  // Pastikan payment milik room tersebut dan room milik user
  const { data: payment, error: checkError } = await supabase
    .from("payments")
    .select("id, period_id, periods!inner(room_id, rooms!inner(owner_id))")
    .eq("id", paymentId)
    .eq("periods.room_id", roomId)
    .eq("periods.rooms.owner_id", user.id)
    .maybeSingle();

  if (checkError || !payment) {
    fail(path, "Data pembayaran tidak ditemukan.");
  }

  // Set status dan paid_at bersamaan (paid => now(), unpaid => null)
  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: paid ? "paid" : "unpaid",
      paid_at: paid ? new Date().toISOString() : null,
    })
    .eq("id", paymentId);

  if (updateError) {
    fail(path, "Gagal memperbarui status pembayaran.");
  }

  revalidatePath(path);
  revalidatePath("/dashboard", "layout");
}

// ---------- Akun & Profil ----------
export async function updateProfile(fd: FormData) {
  const { supabase, user } = await requireUser();
  const name = text(fd, "name");
  const rawPhone = text(fd, "phone");

  if (!name || name.length > 80) {
    redirect(`/dashboard/akun?error=${encodeURIComponent("Nama wajib diisi (maksimal 80 karakter).")}`);
  }

  let phone: string | null = null;
  if (rawPhone) {
    phone = normalizePhone(rawPhone);
    if (!phone) {
      redirect(`/dashboard/akun?error=${encodeURIComponent("Nomor HP tidak valid. Contoh: 0812-3456-7890.")}`);
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ name, phone })
    .eq("id", user.id);

  if (error) {
    redirect(`/dashboard/akun?error=${encodeURIComponent("Gagal menyimpan profil. Coba lagi.")}`);
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/akun?ok=${encodeURIComponent("Profil berhasil diperbarui.")}`);
}

export async function updatePassword(fd: FormData) {
  const { supabase } = await requireUser();
  const password = String(fd.get("password") ?? "");
  const confirmPassword = String(fd.get("confirmPassword") ?? "");

  if (password.length < 8) {
    redirect(`/dashboard/akun?error=${encodeURIComponent("Password baru minimal 8 karakter.")}`);
  }

  if (password !== confirmPassword) {
    redirect(`/dashboard/akun?error=${encodeURIComponent("Konfirmasi password baru tidak cocok.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    const isReauth =
      error.status === 401 ||
      error.code === "reauthentication_needed" ||
      msg.includes("reauth") ||
      msg.includes("recent");

    if (isReauth) {
      redirect(
        `/dashboard/akun?error=${encodeURIComponent(
          "Demi keamanan, silakan keluar lalu masuk lagi, kemudian coba ganti password."
        )}`
      );
    }

    redirect(`/dashboard/akun?error=${encodeURIComponent("Gagal mengubah password. Coba lagi.")}`);
  }

  redirect(`/dashboard/akun?ok=${encodeURIComponent("Password berhasil diubah.")}`);
}

// ---------- Sesi ----------
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/email-password");
}
