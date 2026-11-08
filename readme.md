<!--
  PANDUAN MENUKAR DIAGRAM DENGAN GAMBAR
  Simpan 3 file gambar ini di folder docs/images/ pada repositori:
    - erd.png            -> bagian "Skema Database (ERD)"
    - alur-penagih.png   -> bagian "Alur Penagih"
    - infrastruktur.png  -> bagian "Arsitektur Infrastruktur"
  Format .svg juga bisa, cukup ubah ekstensi di tag <img> terkait.
  Diagram Mermaid di dalam <details> adalah cadangan dan boleh dihapus kalau gambar sudah terpasang.
-->

<div align="center">

# TagihIn

**Kelola iuran bersama tanpa ribet: bagi rata otomatis, catat siapa yang sudah bayar, ingatkan lewat WhatsApp.**

[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)
![Status](https://img.shields.io/badge/status-dalam%20pengembangan-orange)
![Tugas](https://img.shields.io/badge/tugas-Kewirausahaan%202026-blue)

[Situs](https://tagihin.my.id/) · [Alur Penagih](#alur-penagih) · [Infrastruktur](#arsitektur-infrastruktur) · [ERD](#skema-database-erd) · [Memulai](#memulai) · [Minggu 5 dan 6](docs/minggu-5-6/README.md)

</div>

---

## Tentang

Iuran bulanan di kos, kontrakan, kelas, atau lingkungan warga umumnya dikelola lewat chat grup dan catatan manual. TagihIn adalah aplikasi web untuk **penagih iuran**: buat room iuran, masukkan anggota (nama dan nomor HP), dan aplikasi membagi tanggungan secara rata setiap bulan.

Masalah yang ingin diselesaikan (masih berupa hipotesis dan akan diuji lewat pilot):

- Sulit melacak siapa yang sudah dan belum membayar tiap bulan.
- Pengingat harus diketik ulang ke setiap anggota.
- Riwayat pembayaran bulan lalu tidak terdokumentasi rapi.
- Pembagian nominal per orang dihitung manual.

> **Catatan:** uang tidak melewati sistem. Pembayaran dilakukan di luar aplikasi (transfer atau tunai), dan penagih menandai status lunas sendiri. Anggota tidak perlu membuat akun.

## Fitur

**Sudah diimplementasikan**

- [x] Setup Next.js dan deploy ke Vercel
- [x] Login email + password (Supabase Auth)

- [x] Skema database dan Row Level Security (RLS)
- [x] Room iuran dan manajemen anggota (nama + nomor HP)
- [x] Pembagian rata otomatis
- [x] Periode bulanan otomatis
- [x] Checklist status lunas dan riwayat per bulan
- [x] Draf pengingat WhatsApp (tautan `wa.me` yang dibuka oleh penagih)
- [x] Halaman kebijakan privasi

**Ditunda atau tahap lanjutan**

- [ ] Login dengan Google
- [ ] Pembayaran online (QRIS/Virtual Account)

## Alur Penagih

<div align="center">
  <img src="docs/images/alur-penagih.png" alt="Alur pengguna penagih TagihIn" width="80%">
</div>

<details>
<summary>Versi teks (Mermaid)</summary>

```mermaid
flowchart TD
    A["Buka tagihin.my.id"] --> B["Masuk atau daftar"]
    B --> C["Dasbor: daftar room"]
    C --> D["Buat room baru"]
    C --> E["Buka room"]
    D --> F["Tambah anggota: nama dan nomor HP"]
    F --> G["Bagi rata otomatis"]
    G --> H["Halaman room: status bayar bulan ini"]
    E --> H
    H --> I["Pengingat: buka wa.me"]
    H --> J["Centang lunas"]
    H --> K["Riwayat per bulan"]
    H --> L["Akhiri room: selesai atau hapus"]
    M["Cron: periode baru tiap bulan"] -.-> H
```

</details>

## Arsitektur Infrastruktur

Domain `tagihin.my.id` terdaftar di IDwebhost. DNS publik menggunakan Cloudflare Free dalam mode **DNS only**, dengan nameserver `decker.ns.cloudflare.com` dan `diva.ns.cloudflare.com` yang terverifikasi pada 8 November 2026. Browser terhubung langsung ke Vercel melalui HTTPS. Push atau merge ke `main` memicu deploy produksi di Vercel.

```mermaid
flowchart LR
    P["Penagih"] -. Resolusi DNS .-> CF["Cloudflare Free DNS only"]
    P -->|HTTPS| N
    GH["GitHub main"] -->|Deploy otomatis| N
    subgraph V["Vercel: tagihin.my.id"]
        N["Next.js App Router: UI dan Server Actions"]
        CR["Vercel Cron harian"] --> API["API sinkronisasi periode"]
    end
    subgraph S["Supabase (free tier)"]
        AU["Supabase Auth: email + password"]
        DB["PostgreSQL: tabel dan RLS"]
    end
    N --> AU
    N -->|Akses pengguna dengan RLS| DB
    API -->|RPC service role| DB
    N --> WA["Draf pengingat WhatsApp"]
```

Lihat [panduan konfigurasi infrastruktur](docs/minggu-5-6/infrastruktur.md) untuk pengaturan DNS, GitHub Actions, dan pemantauan uptime.

<details>
<summary>Diagram rancangan awal</summary>

<img src="docs/images/infrastruktur.png" alt="Diagram rancangan awal infrastruktur TagihIn" width="80%">

</details>

## Skema Database (ERD)

<div align="center">
  <img src="docs/images/erd.png" alt="ERD TagihIn" width="90%">
</div>

<details>
<summary>Versi teks (Mermaid)</summary>

```mermaid
erDiagram
    PROFILES ||--o{ ROOMS : "membuat"
    ROOMS ||--o{ MEMBERS : "memiliki"
    ROOMS ||--o{ PERIODS : "memiliki"
    PERIODS ||--o{ PAYMENTS : "berisi"
    MEMBERS ||--o{ PAYMENTS : "membayar"
    PAYMENTS ||--o{ REMINDER_LOGS : "diingatkan"

    PROFILES {
        uuid id PK "sama dengan auth.users.id"
        text name
        text phone
        timestamptz created_at
    }
    ROOMS {
        uuid id PK
        uuid owner_id FK
        text title
        text description
        bigint total_amount "rupiah per bulan"
        smallint due_day "hari 1 sampai 28"
        text payment_instruction "mis. nomor DANA"
        text status "active atau completed"
        date start_month
        timestamptz created_at
    }
    MEMBERS {
        uuid id PK
        uuid room_id FK
        text name
        text phone "format 628xx"
        int sort_order
        boolean is_active
        timestamptz deactivated_at
        timestamptz created_at
    }
    PERIODS {
        uuid id PK
        uuid room_id FK
        date period_month "tanggal 1 bulan periode"
        date due_date
        bigint total_amount "salinan nominal saat dibuat"
        timestamptz created_at
    }
    PAYMENTS {
        uuid id PK
        uuid period_id FK
        uuid member_id FK
        bigint amount_due
        text status "unpaid atau paid"
        timestamptz paid_at
        timestamptz created_at
    }
    REMINDER_LOGS {
        uuid id PK
        uuid payment_id FK
        text channel "wa_link"
        timestamptz sent_at
    }
```

</details>

**Aturan data penting:** satu periode per room per bulan, satu tagihan per anggota per periode, nominal berupa bilangan bulat rupiah, anggota dinonaktifkan (bukan dihapus) agar riwayat tetap utuh, dan RLS membatasi akses hanya untuk penagih pemilik room.

## Teknologi

| Lapisan | Teknologi |
|---|---|
| Frontend dan server | Next.js (App Router) |
| Autentikasi | Supabase Auth |
| Database | Supabase PostgreSQL (dengan RLS) |
| Hosting | Vercel (deploy otomatis dari GitHub) |
| DNS | Cloudflare Free (DNS only) |
| Pengingat | Tautan `wa.me` |

## Pengujian Minggu 5 dan 6

- **Tes lokal.** 20 tes otomatis lulus, mencakup isolasi RLS antarpenagih, akurasi pembagian rupiah, dan riwayat lintas periode. Jalankan ulang dengan `npm test`.
- **Supabase produksi.** Ketiga migrasi tercatat. Saat penagih menulis tagihan, policy RLS memastikan anggota dan periodenya berasal dari room yang sama. Pemeriksaan database mengonfirmasi bahwa semua tagihan yang sudah ada memenuhi aturan itu. [Migrasi RLS November](supabase/migrations/20261108000000_scope_payment_members.sql)
- **Uji aplikasi.** Pemilik proyek sudah menjalankan pengujian dengan dua akun setelah migrasi produksi.
- **CI dan uptime.** Workflow tersedia di repo. Pemantauan per jam mulai dijadwalkan saat workflow uptime masuk ke branch default GitHub.

Panduan dan formulir uji coba dengan kelompok iuran tersedia di [panduan pilot](docs/minggu-5-6/pilot.md).

## Memulai

**Prasyarat:** Node.js, akun Supabase, dan akun Vercel (opsional untuk deploy).

```bash
git clone https://github.com/RegaCode4/tagihin.git
cd tagihin
npm install
```

Buat berkas `.env.local` di root proyek:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

> Nama variabel mengikuti kode di repositori ini. Sesuaikan bila berbeda.

Di dashboard Supabase, pada pengaturan Authentication, tambahkan `http://localhost:3000` dan `https://tagihin.my.id` ke daftar URL redirect yang diizinkan. Lalu jalankan:

```bash
npm run dev
```

Buka `http://localhost:3000`.

Push atau merge ke `main` memicu build Vercel. Setelah build berhasil, versi baru tersedia di `tagihin.my.id`. Untuk perubahan database, cek daftar migrasi dengan `npx supabase db push --remote --dry-run`, lalu terapkan migrasi yang sesuai ke proyek Supabase yang terhubung.

## Keterbatasan

- Status lunas dicatat manual oleh penagih, bukan otomatis.
- Pengingat dikirim lewat WhatsApp milik penagih sendiri, bukan pengiriman otomatis.
- Ketentuan penyimpanan nama dan nomor HP anggota tersedia di [kebijakan privasi](https://tagihin.my.id/kebijakan-privasi).
- Berjalan di tier gratis Vercel dan Supabase, sehingga tunduk pada batas layanan masing-masing.

## Tim

- **Project Lead:** Adip Habibullah
- **Konteks:** tugas mata kuliah Kewirausahaan, 2026
