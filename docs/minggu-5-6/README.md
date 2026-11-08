# Penyelesaian minggu 5 dan 6

Status per 8 November 2026 untuk periode tugas 27 Oktober sampai 9 November 2026.

| Pekerjaan | Bukti dan status |
| --- | --- |
| RLS antarpenagih | Migrasi dan tes PostgreSQL lokal memakai dua identitas penagih. Uji baca keenam tabel, update dan delete lintas pemilik, RPC asing, akses anonim, serta penautan pembayaran lintas room. |
| Pembagian | SQL dan TypeScript sama-sama menghasilkan Rp33.335, Rp33.333, Rp33.333 untuk Rp100.001 dan tiga anggota. Uji juga pembagian tepat, total kecil, satu anggota, dan input tidak valid. |
| Multi-periode | Data bulan lalu ditanam sebagai fixture. RPC membuat periode berjalan dalam WIB, menyimpan satu periode saat diulang, dan menjaga status serta nominal setelah ada yang lunas. |
| Perbaikan | Migrasi menambah pemeriksaan agar akun pengguna hanya bisa menulis pembayaran dengan periode dan anggota dalam room yang sama. Hak eksekusi RPC cron untuk `service_role` dibuat eksplisit. |
| CI dan uptime | Dua workflow tersedia di repo lokal. Pada pemeriksaan ulang, GET halaman awal dan kebijakan privasi merespons HTTP 200. Aktivasi jadwal mengikuti branch default GitHub. |
| Cloudflare dan diagram | Nameserver publik masih memakai Vercel. [Arsitektur target dan panduan aktivasi](infrastruktur.md) mencakup Cloudflare Free dalam mode DNS only. |
| Pilot nyata | Penggunaan kelompok nyata belum tercatat. [Panduan dan formulir pilot](pilot.md) siap dipakai dengan bendahara kos atau kelas. |

## Ulangi verifikasi teknis

Gunakan Node.js 24. Tes memakai fixture dan PostgreSQL lokal dalam proses Node. Docker dan kredensial Supabase produksi tidak diperlukan.

```sh
npm ci
npm run lint
npm test
npx next typegen
npx tsc --noEmit
```

Hasil pada 8 November 2026 adalah 20 tes lulus, terdiri dari 15 tes aplikasi dengan fixture dan lima tes database. ESLint dan pemeriksaan tipe lulus. Build produksi dengan `npm run build -- --webpack` lulus menggunakan konfigurasi demo lokal. Tes ini memeriksa migrasi di PostgreSQL dan alur aplikasi dengan fixture. Untuk bukti deployment, ulangi uji dua akun di lingkungan Supabase yang dipakai untuk pilot.
