# Deploy NutriMind ke Vercel dengan Neon

Konfigurasi di `vercel.json` membangun React/Vite menjadi aset statis dan menjalankan Flask melalui satu Python Function di `api/index.py`. Permintaan `/api/*` menuju Flask; URL lain menuju aplikasi React. Function berjalan di region `sin1` (Singapura), dekat dengan database Neon di `ap-southeast-1`.

## Siapkan proyek

1. Push repository ke GitHub, lalu impor repository tersebut di Vercel. **Root Directory** harus tetap di root repository, bukan `frontend`.
2. Hubungkan integrasi Neon ke proyek Vercel untuk environment Production. Integrasi menyediakan `DATABASE_URL` tanpa perlu menyimpan kredensial dalam Git.
3. Jika ingin membawa akun, rencana makan, catatan, dan foto dari MariaDB lokal, jalankan migrasi di bawah ini sebelum menerima traffic. Skrip ini membuat schema PostgreSQL dan memverifikasi semua baris serta foto. Untuk database kosong, jalankan isi `schema_postgres.sql` di **Neon SQL Editor**. Schema MariaDB di `schema.sql` hanya untuk database lokal lama.
4. Tambahkan variabel `FLASK_SECRET_KEY` dan `OPENAI_API_KEY` di **Project Settings → Environment Variables**. Isi `FLASK_SECRET_KEY` dengan nilai acak yang panjang dan berbeda dari versi lokal. Set `OPENAI_MODEL` jika ingin mengganti default dari `gpt-6-sol`. Jangan gunakan prefix `VITE_` untuk kunci rahasia karena variabel Vite akan masuk ke bundle browser.
5. Deploy branch `main` ke Production. Setelah deploy, cek `/`, `/app`, `/api/session`, lalu coba registrasi, rencana makan, dan pemindaian foto. Pastikan `/api/session` mengembalikan JSON dan bukan HTML dari React.

## Memperbarui database

Perubahan schema berikutnya perlu diterapkan ke Neon sebelum versi aplikasi yang bergantung padanya dipromosikan. Jalankan perintah SQL di Neon SQL Editor, atau gunakan klien PostgreSQL dengan koneksi yang disediakan Neon. Jangan jalankan `schema.sql` MariaDB pada Neon.

### Memindahkan data lokal

Jalankan dari PowerShell pada root repository ketika MariaDB lokal masih aktif. Simpan hasil `vercel env pull` di luar repository agar kredensial database tidak ikut ter-push.

```powershell
$vercelEnvFile = Join-Path $env:LOCALAPPDATA 'NutriMind\vercel.production.env'
New-Item -ItemType Directory -Force (Split-Path $vercelEnvFile) | Out-Null
vercel env pull $vercelEnvFile --environment production
.\.venv\Scripts\python.exe scripts\migrate_mysql_to_postgres.py --dry-run --env-file $vercelEnvFile
.\.venv\Scripts\python.exe scripts\migrate_mysql_to_postgres.py --env-file $vercelEnvFile
```

Perintah pertama menjalankan migrasi dalam transaksi yang dibatalkan; perintah kedua melakukan commit hanya bila seluruh data cocok. Setelah selesai, simpan file environment di lokasi privat atau hapus bila tidak diperlukan lagi.

## Menguji build secara lokal

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
.\.venv\Scripts\python.exe -m py_compile api\index.py app.py
```

`vercel.json` menetapkan batas Function 120 detik dan Python 3.12. Respons AI yang melewati batas itu akan gagal; lihat **Functions Logs** di Vercel jika permintaan AI tidak selesai. Batas ukuran body request dan response Function adalah 4,5 MB, termasuk foto yang dikirim sebagai JSON base64. Data foto makanan disimpan di Neon, bukan di filesystem Function yang bersifat sementara.

Referensi: [Flask pada Vercel](https://vercel.com/docs/frameworks/backend/flask), [Python Functions dalam `/api`](https://vercel.com/docs/functions/runtimes/python/api-directory), [aturan rewrite](https://vercel.com/docs/routing/rewrites), [region Functions](https://vercel.com/docs/functions/configuring-functions/region), [integrasi Neon](https://vercel.com/marketplace/neon/neon).
