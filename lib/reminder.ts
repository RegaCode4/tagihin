export type ReminderInput = {
  memberName: string;
  roomTitle: string;
  /** tanggal jatuh tempo format YYYY-MM-DD */
  dueDate: string;
  /** total iuran per bulan (rupiah) */
  totalAmount: number;
  /** bagian anggota ini (rupiah) */
  amountDue: number;
  /** info pembayaran dari room, mis. "DANA 0812-xxxx a.n. Nama" */
  paymentInstruction?: string | null;
};

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export function formatDateId(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-").map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return isoDate;
  const [y, m, d] = parts;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function buildReminderMessage(i: ReminderInput): string {
  const pay = i.paymentInstruction?.trim()
    ? `Kirim ke ${i.paymentInstruction.trim()} atau bayarkan langsung ke saya.`
    : "Bayarkan langsung ke saya ya.";
  return [
    `Halo ${i.memberName},`,
    `Kita punya tagihan iuran *${i.roomTitle}* yang harus segera dibayar sebelum tanggal ${formatDateId(i.dueDate)}.`,
    `Total iuran: ${rupiah(i.totalAmount)}`,
    `Bagian kamu: ${rupiah(i.amountDue)}`,
    pay,
    "Tolong segera dilunasi ya. Terima kasih.",
  ].join("\n");
}

/** phone harus format 628xxxxxxxxxx (tanpa tanda +) */
export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
