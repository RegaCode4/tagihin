import { cache } from "react";
import { createClient } from "./server-client";

export interface RoomRecord {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  total_amount: number;
  due_day: number;
  payment_instruction: string | null;
  status: "active" | "completed";
}

/**
 * Mengambil detail room berdasarkan ID dengan kolom spesifik.
 * Dibungkus dengan React cache() untuk mencegah double-fetch dalam satu request
 * (misalnya antara generateMetadata dan page component).
 */
export const getRoomById = cache(async (id: string): Promise<RoomRecord | null> => {
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("rooms")
    .select("id, owner_id, title, description, total_amount, due_day, payment_instruction, status")
    .eq("id", id)
    .maybeSingle();

  return (data as RoomRecord) ?? null;
});

export interface UserProfileRecord {
  id: string;
  name: string | null;
  phone: string | null;
}

/**
 * Mengambil profil user berdasarkan user id dengan cache per-request.
 */
export const getUserProfile = cache(async (userId: string): Promise<UserProfileRecord | null> => {
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, name, phone")
    .eq("id", userId)
    .maybeSingle();

  return (data as UserProfileRecord) ?? null;
});
