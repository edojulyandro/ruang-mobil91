# Ruang Mobil

Website katalog mobil bekas dengan halaman publik server-rendered, kontak WhatsApp dan dashboard inventaris. Ruang Mobil adalah nama sementara. Demo memakai stok ilustrasi.

## Jalankan lokal

Butuh Node.js 24. Dari folder proyek, jalankan `node local.mjs` dan buka <http://127.0.0.1:3000>. Tanpa konfigurasi Supabase, server lokal memakai data demo. Uji otomatis dengan `node --test`.

## Siapkan Supabase

1. Gunakan proyek Supabase baru atau tinjau konflik skema sebelum migrasi. Jalankan SQL di `supabase/migrations/202611230001_catalog.sql` melalui SQL Editor atau Supabase CLI.
2. Di Supabase Auth, nonaktifkan pendaftaran umum. Buat pengguna admin dengan email terkonfirmasi melalui dashboard, lalu tambahkan UUID pengguna melalui SQL Editor.

   ```sql
   insert into public.admin_users (user_id) values ('UUID-PENGGUNA-AUTH');
   ```

3. Salin `.env.example` ke `.env`. Isi URL Supabase dan publishable key, lalu set `DEMO_MODE=false`. Aplikasi tidak memerlukan service-role key.
4. Buka `/admin` dan masuk. Isi pengaturan showroom termasuk nomor WhatsApp bisnis. Tambahkan unit sebagai draf, unggah foto, lalu ubah Publikasi menjadi Terbit. Stok Tersedia dan Dipesan akan tampil publik. Terjual dan Arsip tersembunyi dari publik.
5. Uji dengan akun biasa bahwa dashboard dan operasi tulis ditolak. Uji dari jendela privat bahwa draf dan foto draf tidak dapat diakses. URL foto yang sudah diberikan berlaku hingga lima menit.

## GitHub dan Vercel

- Unggah folder ini sebagai root repo GitHub, lalu impor repo di Vercel. Pilih framework Other. Pengaturan folder publik dan rewrite berasal dari `vercel.json`.
- Untuk Production, isi `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SITE_URL` dengan domain final, dan `DEMO_MODE=false`. `GA_MEASUREMENT_ID` opsional. Gunakan proyek Supabase terpisah untuk Preview, atau aktifkan `DEMO_MODE=true` di Preview untuk meninjau katalog contoh.
- Sebelum go-live, verifikasi URL utama, detail langsung, aset, robots dan sitemap dari URL Vercel, kemudian uji admin, upload, penerbitan, perubahan harga dan arsip. Siapkan backup database serta backup objek Storage. Tinjau halaman privasi sebelum mengaktifkan analytics.

## Foto demo

Foto Unsplash dipakai sebagai ilustrasi. Ganti foto beranda di `lib/catalog.js` dengan aset showroom dan masukkan foto asli unit melalui dashboard. Foto contoh di-host eksternal dan memerlukan koneksi internet.
