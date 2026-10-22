/** Normalisasi nomor HP Indonesia ke format 628xx. Mengembalikan null bila tidak valid. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("620")) d = "62" + d.slice(3); // "+62 0812..." salah ketik umum
  else if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return /^628\d{7,11}$/.test(d) ? d : null;
}

/** Mengubah format 628xx menjadi format tampilan lokal 08xx-xxxx-xxxx. */
export function formatLocalPhone(phone?: string | null): string {
  if (!phone) return "";
  const d = phone.startsWith("62") ? "0" + phone.slice(2) : phone;
  return d.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}
