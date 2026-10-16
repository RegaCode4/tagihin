/**
 * Bagi rata total (rupiah bulat) ke `count` anggota.
 * Aturan sisa: sisa pembagian dibebankan ke anggota urutan pertama,
 * sehingga jumlah semua bagian selalu sama dengan total.
 */
export function splitEqual(total: number, count: number): number[] {
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new RangeError("total harus bilangan bulat lebih dari 0");
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("jumlah anggota minimal 1");
  }
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + remainder : base));
}
