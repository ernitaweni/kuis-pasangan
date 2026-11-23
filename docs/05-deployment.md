# Deployment & Maintenance: Kuis Pasangan

| | |
|---|---|
| **Versi dokumen** | 1.0 |
| **Tanggal** | 23 November 2026 |
| **Acuan** | [03-setup.md](03-setup.md) §6 (membuat project Firebase), [04-qa-checklist.md](04-qa-checklist.md) |
| **Biaya** | Rp0: GitHub Free, Vercel Hobby, Firebase Spark. Tidak perlu kartu kredit. |

## 0. Gambaran Alur

```text
Laptop ──git push──▶ GitHub ──otomatis──▶ Vercel ──▶ https://kuis-pasangan.vercel.app
                       │                    ├─ push ke main     → Production
                       │                    └─ branch lain / PR → Preview (URL sendiri)
                       └─ GitHub Actions: CI (check, coverage, build, integration test)

Laptop ──npx firebase deploy --only database──▶ Firebase (Security Rules)   ← manual, tidak ikut Vercel
```

Kode aplikasi di-*deploy* otomatis oleh Vercel. **Security Rules Firebase tidak ikut.** Setiap kali `database.rules.json` berubah, *deploy* ulang secara manual (§2.2).

### Yang sudah disiapkan di repo

| File | Fungsi |
|---|---|
| `vercel.json` | Header keamanan (`nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`) dan cache 1 tahun untuk `assets/` yang namanya ber-hash |
| `.github/workflows/ci.yml` | CI di setiap push ke `main` dan setiap pull request: `npm run check`, `coverage`, `build`, dan *integration test* Security Rules di emulator |
| `.github/dependabot.yml` | Pull request pembaruan dependensi, sebulan sekali |
| `public/og-image.png` + tag `og:*` di `index.html` | Pratinjau link saat dikirim di WhatsApp/Telegram. URL gambar otomatis menjadi URL lengkap saat build di Vercel (`vite.config.ts`) |
| `public/robots.txt` | Untuk mesin pencari (SEO 100 di Lighthouse) |
| `src/services/preconnect.ts` | Membuka koneksi ke server Firebase lebih awal saat link undangan dibuka (temuan QA T1) |

---

## 1. Push ke GitHub

### 1.1 Sekali saja di laptop
Jika belum pernah memakai Git di laptop ini:
```powershell
git config --global user.name "Nama Kamu"
git config --global user.email "email-github-kamu@contoh.com"
```

### 1.2 Buat repository lokal dan commit pertama
Di folder `kuis-pasangan`:
```powershell
npm run check                      # wajib lolos sebelum commit
git init -b main
git add .
git status                         # periksa daftar file (lihat di bawah)
git commit -m "Kuis Pasangan v1.0: MVP siap deploy"
```

Di `git status`, pastikan:
- **`.env.local` TIDAK ada di daftar.** File itu sudah dikecualikan oleh `.gitignore`. Jika ternyata muncul, hentikan dan jalankan `git rm --cached .env.local`.
- `node_modules/`, `dist/`, `coverage/`, dan file `*.log` juga tidak ada.

> Nilai `VITE_FIREBASE_*` memang publik (ikut ke browser). Keamanan dijaga oleh Security Rules dan pembatasan API key (§2.3). Tetap saja, `.env.local` tidak perlu ada di GitHub.

### 1.3 Buat repository di GitHub dan push
1. Buka https://github.com/new.
2. Repository name: `kuis-pasangan`. Visibility: **Private** atau **Public**, keduanya didukung Vercel Hobby. Pilih Public jika ingin memakai *branch protection* gratis (§4.2).
3. **Jangan** centang "Add a README", ".gitignore", atau "license". Repo harus kosong agar push pertama tidak bentrok.
4. Klik **Create repository**, lalu jalankan perintah yang ditampilkan GitHub:
   ```powershell
   git remote add origin https://github.com/USERNAME-KAMU/kuis-pasangan.git
   git push -u origin main
   ```
5. Pada push pertama, jendela login GitHub muncul (Git Credential Manager). Login sekali, dan push berikutnya tidak perlu login lagi.

Buka tab **Actions** di GitHub. Workflow **CI** langsung berjalan dan harus hijau (sekitar 2–4 menit).

---

## 2. Firebase Produksi

### 2.1 Buat project
Ikuti [03-setup.md §6](03-setup.md) langkah 1–6: buat project tanpa Analytics, daftarkan aplikasi web, aktifkan login **Anonymous**, buat Realtime Database di **Singapore** dalam *locked mode*, lalu hubungkan Firebase CLI dengan alias `prod`.

Simpan lima nilai konfigurasinya. Nilai-nilai itu dipakai di Vercel (§3):

| Variabel | Contoh |
|---|---|
| `VITE_FIREBASE_API_KEY` | `AIza...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `kuis-pasangan-a1b2c.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | `https://kuis-pasangan-a1b2c-default-rtdb.asia-southeast1.firebasedatabase.app` |
| `VITE_FIREBASE_PROJECT_ID` | `kuis-pasangan-a1b2c` |
| `VITE_FIREBASE_APP_ID` | `1:1234567890:web:abc123` |

### 2.2 Deploy Security Rules
Database baru dalam *locked mode* menolak semua akses. Aplikasi baru berfungsi setelah Rules di-*deploy*:
```powershell
npm run test:integration                                  # Rules harus lolos uji dulu
npx firebase deploy --only database --project prod
```
Cek di Firebase Console → **Realtime Database → Rules**: isinya harus sama dengan `database.rules.json`.

`npx firebase use --add` di langkah 2.1 menambahkan alias `prod` ke `.firebaserc`. Commit perubahan itu, karena ID project bukan rahasia.

### 2.3 Batasi API key
API key web Firebase memang publik, tapi sebaiknya hanya bisa dipakai dari domain kita:

1. Buka https://console.cloud.google.com → pilih project Firebase → **APIs & Services → Credentials**.
2. Klik **Browser key (auto created by Firebase)**.
3. **Application restrictions → Websites**, tambahkan:
   - `https://kuis-pasangan.vercel.app/*` (domain produksi dari §3, sesuaikan)
   - `http://localhost:5173/*` (jika ingin menguji project asli dari laptop)
4. **API restrictions → Restrict key**, centang **Identity Toolkit API** dan **Token Service API** saja.
5. **Save**. Perubahan berlaku dalam beberapa menit.

Jika nanti muncul error `auth/requests-from-referer-...-are-blocked`, berarti domain yang membuka aplikasi belum ada di daftar langkah 3. Contohnya URL *preview* Vercel: tambahkan domain itu jika ingin menguji preview dengan project produksi.

---

## 3. Deploy ke Vercel

1. Buka https://vercel.com/signup → **Continue with GitHub** (paket **Hobby**, gratis).
2. **Add New… → Project** → pilih repo `kuis-pasangan` → **Import**. Jika repo tidak muncul, klik "Adjust GitHub App Permissions" dan beri akses ke repo itu.
3. Pengaturan proyek. Vercel mendeteksinya otomatis, cukup dicek:

   | Pengaturan | Nilai |
   |---|---|
   | Framework Preset | **Vite** |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm install` (bawaan) |

4. **Environment Variables:** isi lima nilai `VITE_FIREBASE_*` dari §2.1, ditambah `VITE_USE_EMULATORS` = `false`. Biarkan berlaku untuk **Production** dan **Preview**.
5. Klik **Deploy**. Sekitar 1 menit kemudian muncul URL, misalnya `https://kuis-pasangan.vercel.app`.
6. Tambahkan domain itu ke pembatasan API key (§2.3 langkah 3).

Penting:
- **Variabel `VITE_*` ditanam saat build.** Setelah mengubah Environment Variables, buka **Deployments → ⋯ → Redeploy**.
- **Node.js:** proyek butuh Node ≥ 22.12 (`engines` di `package.json`). Jika build gagal karena versi Node, buka **Settings → Build and Deployment → Node.js Version** dan pilih 22.x atau yang lebih baru.

---

## 4. Auto-deploy dan Alur Kerja Sehari-hari

### 4.1 Yang terjadi otomatis
| Aksi | Hasil |
|---|---|
| Push ke `main` | Vercel membangun dan menayangkan versi baru di URL produksi. CI berjalan di GitHub. |
| Push ke branch lain | Vercel membuat **Preview** dengan URL sendiri, dan produksi tidak berubah |
| Membuka pull request | Komentar otomatis dari Vercel berisi link preview, ditambah status CI |

Tidak ada yang perlu diatur. Auto-deploy aktif sejak repo di-*import*. Branch produksi bisa diganti di **Settings → Git → Production Branch** (bawaan: `main`).

### 4.2 Alur yang disarankan
```powershell
git switch -c tambah-soal-deep-talk     # 1. branch baru
# ... ubah kode ...
npm run check                           # 2. cek di laptop
git add .
git commit -m "Tambah 5 soal Deep Talk"
git push -u origin tambah-soal-deep-talk
```
3. Buka pull request di GitHub. Tunggu **CI hijau**, lalu coba **link preview Vercel** di HP.
4. **Merge** ke `main`, dan produksi otomatis ter-update dalam 1–2 menit.

**Lindungi `main`** agar tidak ada yang masuk tanpa CI hijau: GitHub → **Settings → Branches → Add branch ruleset**, lalu aktifkan "Require status checks to pass" untuk job **Typecheck, lint, format, unit test, build** dan **Integration test**. Di GitHub Free, fitur ini hanya ada untuk repo **Public**. Untuk repo Private, merge hanya jika CI hijau.

### 4.3 Membatalkan versi yang bermasalah
Vercel → **Deployments** → pilih versi produksi sebelumnya yang sehat → **⋯ → Instant Rollback**. Produksi kembali dalam hitungan detik. Di paket Hobby, rollback hanya bisa ke versi produksi tepat sebelumnya. Untuk versi yang lebih lama, buka deployment itu dan pilih **Promote to Production**, atau `git revert` lalu push. Setelah itu, perbaiki di branch baru.

Untuk Rules Firebase: kembalikan `database.rules.json` ke versi sebelumnya (`git checkout <commit> -- database.rules.json`), lalu *deploy* ulang (§2.2).

---

## 5. Pemeriksaan Setelah Deploy Pertama

- [ ] Buka URL produksi di HP, buat room, lalu kirim link lewat WhatsApp ke HP lain. **Pratinjau link** menampilkan gambar benang dan judul. Jika WhatsApp masih menampilkan pratinjau lama, tambahkan `?v=2` di akhir link untuk tes.
- [ ] Mainkan satu ronde penuh dari dua HP. Skor sama di kedua HP.
- [ ] Firebase Console → **Realtime Database → Data**: ada node `rooms/<KODE>`.
- [ ] *Share sheet* terbuka saat menekan "Bagikan link" (sekarang lewat HTTPS).
- [ ] **Lighthouse di URL produksi** untuk Beranda dan link undangan (cara di [04-qa-checklist.md §7](04-qa-checklist.md)). Catat hasilnya di §7. Ini pengukuran yang menentukan **temuan T1**: jika link undangan masih di bawah 90, pertimbangkan opsi 1 (nama Host di link, §7 ide #1).
- [ ] Jalankan checklist manual [04-qa-checklist.md](04-qa-checklist.md) §3–§6 dengan URL produksi.

---

## 6. Pemeliharaan Ringan

| Kapan | Apa | Waktu |
|---|---|---|
| Setiap perubahan | Kerjakan di branch, lalu `npm run check` → pull request → CI hijau → coba preview → merge | — |
| Setiap mengubah Rules | `npm run test:integration`, lalu `npx firebase deploy --only database --project prod` | 5 menit |
| Bulanan | Merge pull request dari **Dependabot** yang CI-nya hijau. Untuk *major version* (misalnya React 20), baca catatan rilisnya dulu dan uji di preview | 15 menit |
| Bulanan | `npm run audit:prod` (target 0 kerentanan) | 1 menit |
| Bulanan | Firebase Console → **Realtime Database → Usage**. Batas Spark: **100 koneksi bersamaan** (= 50 pasangan main bersamaan), **1 GB** data, **10 GB/bulan** unduhan | 5 menit |
| Bulanan | Vercel → **Usage**. Batas Hobby: 100 GB bandwidth/bulan | 2 menit |
| Per 3–6 bulan | **Bersihkan room lama.** Room kedaluwarsa setelah 24 jam, tapi datanya tidak terhapus sendiri (perlu Cloud Functions, yang butuh paket Blaze). Satu room ±3–5 KB, jadi 1 GB baru penuh setelah ratusan ribu room. Caranya: Firebase Console → Data → node `rooms` → ⋮ **Export JSON** (cadangan), lalu hapus room lama. Lakukan di jam sepi, karena room dari 24 jam terakhir mungkin masih dipakai | 10 menit |
| Kapan saja | **Menambah soal:** edit `src/data/questions.json`, lalu `npm run test`. Format dan isinya divalidasi oleh `parseQuestionBank` dan unit test, jadi kesalahan ketahuan sebelum *deploy* | — |

Saat ada laporan bug dari pemain: pakai format laporan di [04-qa-checklist.md](04-qa-checklist.md). Ulangi di emulator, lalu tambahkan test yang menangkap bug itu sebelum memperbaikinya.

### Masalah yang sering terjadi
| Gejala | Penyebab | Solusi |
|---|---|---|
| "Belum bisa tersambung ke server" di semua HP | Environment Variables di Vercel belum diisi atau salah ketik | Cek §3 langkah 4, lalu **Redeploy** |
| Console browser: `Konfigurasi Firebase belum lengkap (...)` | Salah satu `VITE_FIREBASE_*` kosong | Isi variabel yang disebut, lalu Redeploy |
| `PERMISSION_DENIED` saat membuat room | Rules belum di-*deploy* (database masih *locked mode*) | §2.2 |
| `auth/admin-restricted-operation` atau `auth/operation-not-allowed` | Login Anonymous belum diaktifkan | Firebase → Authentication → Sign-in method → Anonymous → Enable |
| `auth/requests-from-referer-...-are-blocked` | Domain belum ada di pembatasan API key | §2.3 langkah 3 |
| Build Vercel gagal di `tsc -b` atau `vite build` | Kode tidak lolos typecheck | Jalankan `npm run build` di laptop, perbaiki, lalu push lagi |
| Pratinjau WhatsApp tanpa gambar | `og:image` belum URL lengkap, atau WhatsApp masih menyimpan cache | Buka `view-source:` URL produksi, `og:image` harus diawali `https://`. Coba link dengan `?v=2` |

---

## 7. Ide Pengembangan Versi 2.0

Diurutkan dari yang paling cepat memberi manfaat.

| # | Ide | Manfaat untuk pasangan LDR | Usaha | Catatan teknis |
|---|---|---|---|---|
| 1 | **Link undangan personal**: `?room=KODE&dari=Sari` dan pratinjau WhatsApp dinamis "Sari ngajak kamu main" | Undangan terasa personal. Judul tampil tanpa menunggu Firebase, sekaligus menyelesaikan **T1** | Kecil–sedang | Nama dibaca dari URL untuk tampilan awal, lalu diverifikasi dari database. Gambar dinamis memakai Vercel Function + `@vercel/og`. Konsekuensinya, nama Host terlihat di link |
| 2 | **Mode gelap** | Nyaman dimainkan malam hari sambil video call, waktu bermain paling umum | Kecil | Semua warna sudah berupa token (02-system-design §6.2), cukup set token kedua + `prefers-color-scheme` |
| 3 | **PWA**: bisa dipasang di layar utama HP | Terasa seperti aplikasi, dan bisa dibuka satu ketukan | Kecil | `manifest.webmanifest`, ikon, *service worker* untuk cangkang aplikasi (Workbox / `vite-plugin-pwa`) |
| 4 | **Soal buatan sendiri** | Pertanyaan yang hanya kalian berdua mengerti ("Lagu kita pertama apa?") | Sedang | Soal disimpan di room (bukan bank soal). Rules membatasi panjang teks dan hanya Host yang boleh menulis |
| 5 | **Satu soal per hari + streak** | Ritual kecil setiap hari walau tidak sempat video call | Sedang | Room permanen untuk pasangan, notifikasi lewat Web Push (butuh PWA #3) |
| 6 | **Mode grup 3–8 orang** (sahabat, keluarga, acara) | "Siapa paling kenal dia?" untuk ulang tahun atau acara keluarga | Besar | Model data `players/{uid}` menggantikan host/guest, Rules ditulis ulang, skor per pasangan pemain, lobby dan hasil baru. Batas 100 koneksi Spark jadi lebih cepat tercapai |
| 7 | **Riwayat lintas perangkat dan grafik kecocokan** | Melihat seberapa dekat kalian dari bulan ke bulan | Sedang | Akun opsional (Google) di atas akun anonim (`linkWithPopup`), riwayat dipindah dari `localStorage` ke database. Perlu menambahkan kembali `browserPopupRedirectResolver` di `services/firebase.ts`, yang sengaja dilepas di Fase 5 (temuan T3) |
| 8 | **Bahasa Inggris** | Untuk pasangan beda negara | Sedang | Teks antarmuka dipusatkan ke file terjemahan, bank soal per bahasa |
| 9 | **Firebase App Check** | Mencegah bot membuat akun anonim atau room secara massal | Kecil | reCAPTCHA v3/Enterprise, aktifkan *enforcement* setelah memantau metrik beberapa hari |
| 10 | **Pembersihan room otomatis** | Database tidak pernah penuh, tanpa kerja manual | Kecil | Cloud Functions terjadwal, butuh paket **Blaze** (bayar sesuai pemakaian; untuk skala ini kemungkinan tetap Rp0, tapi perlu kartu kredit) |

Saran urutan: **#1 dan #2** dulu (kecil, langsung terasa), lalu **#3 dan #9**, baru fitur besar seperti **#4–#6** setelah ada pemain sungguhan yang memberi masukan.
