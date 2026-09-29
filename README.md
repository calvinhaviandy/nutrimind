# NutriMind — menjalankan di Windows

Untuk deployment Production dengan Vercel dan Neon, lihat [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md).

NutriMind memakai React, TypeScript, dan Vite untuk antarmuka; Flask menyediakan API. MariaDB/MySQL dipakai di laptop, sedangkan deployment Vercel memakai PostgreSQL dari Neon. Fitur tip harian, pemindaian makanan, dan pembuatan meal plan memakai OpenAI API.

## Menyiapkan proyek

Jalankan perintah berikut di PowerShell dari folder proyek:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm --prefix frontend install
npm --prefix frontend run build
```

Pastikan MariaDB/MySQL berjalan di `localhost:3306`. Buat database dan tabel (perintah ini aman dijalankan ulang):

```powershell
Get-Content -Raw .\schema.sql | & 'C:\Program Files\MariaDB 13.0\bin\mariadb.exe' --protocol=tcp --host=127.0.0.1 --port=3306 --user=root --password= --default-character-set=utf8mb4
```

Path klien MariaDB di atas sesuai dengan instalasi pada laptop ini. Jika memakai instalasi lain, sesuaikan path dan pengguna database.

Jika `.env` belum ada, salin template lalu isi konfigurasi database dan `FLASK_SECRET_KEY` dengan nilai acak. Isi `OPENAI_API_KEY` dengan kunci API milik Anda untuk mengaktifkan fitur AI. `OPENAI_MODEL` memakai `gpt-6-sol` secara default untuk tip harian, rencana makan, dan pemindaian foto; model API lain dapat dipilih lewat variabel ini. Halaman utama serta fitur akun bisa berjalan tanpa kunci tersebut. Untuk memakai Neon secara lokal, isi `DATABASE_URL` dengan URL koneksi PostgreSQL; jika kosong, aplikasi memakai MariaDB lokal.

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

## Menjalankan

```powershell
.\.venv\Scripts\python.exe app.py
```

Buka <http://127.0.0.1:5000> dan hentikan server dengan `Ctrl+C` di terminal.

Untuk mengembangkan antarmuka dengan pembaruan langsung, biarkan Flask berjalan dan buka terminal PowerShell kedua:

```powershell
npm --prefix frontend run dev
```

Buka <http://127.0.0.1:5173> saat mengembangkan frontend. Vite meneruskan permintaan `/api` dan `/static` ke Flask. Jalankan `npm --prefix frontend run build` lagi untuk memperbarui versi yang disajikan Flask di port 5000.

MariaDB di laptop ini belum terdaftar sebagai Windows service. Jika port 3306 tidak aktif setelah restart laptop, jalankan server database dulu:

```powershell
Start-Process -FilePath 'C:\Program Files\MariaDB 13.0\bin\mariadbd.exe' -ArgumentList '--defaults-file="C:\Program Files\MariaDB 13.0\data\my.ini"','--bind-address=127.0.0.1','--innodb-buffer-pool-size=128M' -WindowStyle Hidden
```

Setelah mengubah `.env`, mulai ulang aplikasi Flask agar konfigurasi baru dimuat.
