import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server-client";

// Beranda hanya mengarahkan: sudah login -> dashboard, belum -> halaman masuk
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/dashboard" : "/email-password");
}