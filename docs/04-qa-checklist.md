# Checklist QA: Kuis Pasangan

| | |
|---|---|
| **Versi dokumen** | 1.0 |
| **Tanggal** | 23 November 2026 |
| **Acuan** | [01-PRD.md](01-PRD.md) v1.5, [02-system-design.md](02-system-design.md) v1.5 |
| **Fase berikutnya** | Fase 6: Deployment & Maintenance |

Dokumen ini dipakai sebelum setiap *deploy*. Bagian 1 berisi hasil uji otomatis yang terakhir dijalankan. Bagian 2–8 berisi hal yang harus dicek manusia, terutama di **HP sungguhan**, karena emulator browser tidak bisa meniru keyboard iOS, *notch*, perpindahan aplikasi, atau sinyal yang naik-turun.

**Tanda:**
- ✅ = sudah lolos uji otomatis (lihat Bagian 1), cukup dicek sekilas di HP.
- ⬜ = harus dicek manual. Centang `[x]` setelah lolos.

**Tingkat bug:**

| Tingkat | Arti | Contoh | Boleh *deploy*? |
|---|---|---|---|
| **Blocker** | Permainan tidak bisa diselesaikan, data salah, atau privasi bocor | Skor berbeda di dua HP, tombol Mulai tidak bisa ditekan, jawaban pasangan terlihat sebelum waktunya | Tidak. Target PRD: **0 blocker** |
| **Mayor** | Bisa diselesaikan, tapi pengalaman rusak | Layar perlu di-*scroll*, teks terpotong, banner tidak hilang setelah online | Sebaiknya diperbaiki dulu |
| **Minor** | Kosmetik | Jarak tidak rata, animasi patah sekali | Boleh, catat untuk versi berikutnya |

**Format laporan bug** (cukup tulis di chat atau catatan):
```text
Judul      : [Mayor] Keyboard iPhone menutupi kolom nama di layar Gabung
Perangkat  : iPhone 13, iOS 19, Safari
Langkah    : 1. Buka link undangan  2. Ketuk "Nama panggilanmu"
Hasil      : Kolom tertutup keyboard, tidak bisa melihat yang diketik
Harapan    : Kolom tetap terlihat di atas keyboard
Bukti      : screenshot / rekaman layar
```

---

## 1. Hasil Uji Otomatis

Terakhir dijalankan: **23 November 2026**, di laptop pengembang dengan Firebase Emulator.

| Uji | Perintah | Hasil | Target |
|---|---|---|---|
| Typecheck, lint, format, unit test | `npm run check` | ✅ 144 test lolos | Semua lolos |
| *Coverage* logika skor dan *state* | `npm run coverage` | ✅ 99,2% statement · 96,1% branch · 100% fungsi · 100% baris | ≥ 90% |
| Test properti skor dan pencocokan | bagian dari `npm run test` | ✅ 12 aturan × 300 ronde acak | Semua lolos |
| *Integration test* (Security Rules, real-time, presence) | `npm run test:integration` | ✅ 29 test lolos | Semua lolos |
| Uji tampilan otomatis (22 skenario, 2–4 browser) | lihat §1.3 | ✅ 22/22 lolos. Satu putaran 21/22 karena gangguan lingkungan uji (T5) | Semua lolos |
| Ukuran JavaScript | `npm run build` | ✅ 189 KB gzip total, 95 KB saat Beranda dibuka | ≤ 200 KB |
| Lighthouse mobile, Beranda | lihat §7 | ✅ 96 / 100 / 100 / 100 (lokal). Produksi: LCP 1,8 dtk, Accessibility, Best Practices, dan SEO 100 | 90 / 95 / 95 / 90 |
| Lighthouse mobile, link undangan | lihat §7 | ⚠️ **87** / 100 / 100 / 100 (lokal). Produksi: hingga 89, LCP 3,1 dtk (lihat temuan T1) | 90 / 95 / 95 / 90 |
| Uji fungsi di produksi | `kuis-pasangan.vercel.app`, dua browser | ✅ Buat room, gabung lewat link, mulai serentak, jawaban terbuka "Cocok", room ditutup. Tanpa error | Semua lolos |
| Audit keamanan dependensi produksi | `npm run audit:prod` | ✅ 0 kerentanan | 0 |

### 1.1 Unit test skor dan pencocokan jawaban
Ada dua jenis test untuk `src/utils/scoring.ts`:

- **Contoh spesifik** (`scoring.test.ts`): 8 dari 10 cocok → 80% dan "Partner sejati"; jawaban kosong tidak pernah dihitung cocok; batas setiap tingkat hasil (89% vs 90%); urutan pembanding Tebak Aku dan Kita Mirip?; tidak ada kata bernada negatif di ringkasan.
- **Aturan yang harus selalu benar** (`scoring.properties.test.ts`): 300 ronde acak dibuat dari bank soal sungguhan dengan *seed* tetap, jadi setiap kegagalan bisa diulang persis.
  - Hasil di HP Host dan HP Tamu **identik**.
  - "Cocok/Beda" per soal sama di kedua HP dan sama dengan daftar di layar Hasil.
  - Skor berjalan "Cocok X dari Y" tidak pernah turun, naik tepat saat soal cocok, dan berakhir sama dengan skor akhir.
  - Pencocokan simetris: menukar jawaban kedua pemain tidak mengubah hasil.
  - Menukar peran (Main lagi) tidak mengubah skor.
  - Persen selalu `round(cocok ÷ total × 100)` dan tingkat hasil tidak pernah turun saat persen naik.
  - Bahan obrolan = maksimal 3 soal beda pertama.

### 1.2 Bukti test benar-benar menangkap bug (uji mutasi)
Tiga bug disisipkan sementara ke `scoring.ts`, lalu test dijalankan. Semuanya tertangkap:

| Bug yang disisipkan | Test yang gagal |
|---|---|
| Soal yang belum dijawab kedua pemain dihitung "cocok" | 2 |
| Persen dibulatkan ke bawah (`floor`, bukan `round`) | 2 |
| Urutan pembanding mode Kita Mirip? terbalik | 1 |

### 1.3 Uji tampilan otomatis
Dua sampai empat browser terpisah (masing-masing akun anonim sendiri, layar HP 360–390px) memainkan skenario dan memeriksa teks yang benar-benar muncul di layar.

| Kode | Skenario | Hasil |
|---|---|---|
| V1–V5 | Nama kosong, nama > 20 karakter, kode salah format, kode tidak ada, nama sama dengan Host | ✅ |
| E1 | Pasangan menutup tab di tengah kuis, lalu kembali | ✅ |
| E2 | HP sendiri offline, menjawab, lalu online lagi | ✅ |
| E3 | *Refresh* setelah mengunci jawaban | ✅ |
| E4 | Tamu keluar di tengah kuis | ✅ |
| E5 / E5b | Host menutup room / Tamu keluar dari Lobby | ✅ |
| E6 | Room lewat 24 jam | ✅ |
| E7 | Orang ketiga membuka link | ✅ |
| E8 | Host membuka link undangannya sendiri | ✅ |
| A1–A7 | Ronde penuh: mulai serentak, tap ganda, Cocok/Beda, skor 80% di kedua HP, Main lagi (peran tertukar), riwayat | ✅ |
| P1 | Penyimpanan browser diblokir (mode privat) | ✅ |
| — | Tidak ada *scroll* horizontal di 360px (Buat room, Lobby, Soal, Hasil) | ✅ |

### 1.4 Temuan QA

| Kode | Tingkat | Temuan | Status |
|---|---|---|---|
| T1 | Mayor (performa) | **Link undangan:** Lighthouse Performance 87 dan LCP 3,5 dtk, di bawah target 90 dan 2,5 dtk. Elemen terbesarnya, judul "{nama Host} ngajak kamu main.", baru bisa tampil setelah Firebase diunduh, login anonim selesai, dan data room terbaca. Beranda tidak terkena karena tidak menunggu Firebase. | **Terbuka, membaik di produksi.** Di `kuis-pasangan.vercel.app` (dengan *preconnect*): LCP simulasi 3,1–3,2 dtk, Performance tertinggi 89. Di jaringan nyata (laptop pengembang), undangan tampil dalam **2,4 dtk**. Keputusan opsi di bawah tabel ini menunggu pemilik. |
| T2 | Minor (SEO) | `robots.txt` belum ada, sehingga server mengembalikan halaman HTML biasa dan SEO hanya 91. | ✅ Diperbaiki: `public/robots.txt`. SEO 100. |
| T3 | Minor (performa, privasi) | Firebase Auth memuat `api.js` dari Google untuk login *popup*, padahal game ini hanya memakai login anonim. | ✅ Diperbaiki: `initializeAuth` tanpa *popup resolver*, dengan penyimpanan sesi yang sama seperti sebelumnya. Uji E1 dan E3 membuktikan akun tetap sama setelah *refresh*. |
| T4 | Bukan bug aplikasi (dipantau) | Konsol sesekali menampilkan "Permissions policy violation: unload is not allowed", **hanya saat uji otomatis di dev server**. Muncul di 2 dari 4 putaran. | Kode aplikasi dan *bundle* produksi tidak memakai `unload`. Respons *long-polling* Firebase dan SDK Database juga sudah diperiksa, dan keduanya tidak memakainya. Lighthouse pada build produksi tidak mencatat error konsol. Sumber pastinya belum diketahui, kemungkinan dari lingkungan uji (emulator atau browser headless). Dampaknya nol: Chrome hanya menolak handler itu. Cek ulang di URL produksi (Fase 6). |
| T5 | Bukan bug aplikasi | E4 gagal sekali di putaran ketiga uji lengkap: halaman tamu berhenti menggambar frame sehingga tombol "Gabung" tidak pernah "stabil", dan screenshot pun gagal. Saat itu laptop sedang menjalankan proses lain. | Diulang khusus **5/5 lolos**, dan lolos di 2 dari 3 putaran lengkap. Dicatat sebagai gangguan lingkungan uji. Jika muncul lagi di HP sungguhan, jadikan Mayor. |

**Opsi untuk T1** (perlu keputusan):
1. **Nama Host ikut di link**, misalnya `?room=K7M2QX&dari=Sari`. Judul undangan langsung tampil tanpa menunggu Firebase, lalu datanya diverifikasi di latar belakang. Perkiraan LCP sama dengan Beranda (sekitar 2 dtk). Konsekuensinya: nama panggilan Host terlihat di URL yang dikirim lewat chat.
2. **Ukur dulu di produksi.** Uji ini memakai `localhost` dan emulator. Di Vercel ada CDN dan HTTP/2, dan bisa ditambahkan `preconnect` ke server Firebase. Hasilnya bisa lebih baik, tapi belum tentu sampai 90.
3. **Terima dengan catatan.** Layar "Menyambungkan…" sudah tampil di 2,4 dtk dengan benang dan indikator memuat, jadi pemain tidak melihat layar kosong.

---

## 2. Persiapan Uji Manual

### 2.1 Perangkat minimal
| Perangkat | Browser | Kenapa |
|---|---|---|
| HP Android layar kecil (lebar 360px) | Chrome | Layar tersempit yang didukung (PRD) |
| iPhone | Safari | Keyboard, *notch*, dan *home bar* berbeda dari Android |
| Laptop 1366×768, zoom 100% | Chrome atau Edge | Batas tinggi 640px ("muat satu layar") |
| (Opsional) HP Samsung | Samsung Internet | Browser bawaan yang banyak dipakai di Indonesia |

Satu sesi harus dimainkan oleh **dua perangkat berbeda**, misalnya HP + laptop, atau HP kamu + HP pasangan.

### 2.2 Membuka aplikasi dari HP lewat Wi-Fi (sebelum *deploy*)
HP dan laptop harus tersambung ke **Wi-Fi yang sama**. Aplikasi otomatis menghubungi emulator di IP laptop.

1. Hentikan `npm run emulators` dan `npm run dev` yang sedang berjalan (Ctrl+C).
2. Terminal 1: `npm run emulators:lan`
3. Terminal 2: `npm run dev:lan`. Vite menampilkan alamat seperti `Network: http://192.168.0.102:5173/`.
4. Jika muncul jendela **Windows Firewall** untuk Node.js atau Java, izinkan untuk jaringan **Private**.
5. Di HP, buka alamat `Network` tadi.

Catatan:
- Lewat `http://` (bukan `https://`), *share sheet* dan clipboard tidak tersedia. Tombol "Bagikan link" akan membuka dialog "Salin teks ini". Ini cadangan yang memang dirancang, bukan bug. Uji *share sheet* sungguhan setelah *deploy*.
- Jangan pakai mode ini di Wi-Fi publik: emulator bisa diakses siapa pun di jaringan yang sama.
- Setelah Fase 6, uji ulang lewat URL Vercel dengan Firebase asli.

---

## 3. Tampilan di HP

Cek di setiap layar, di HP 360px dan iPhone:

- [ ] ✅ Tidak ada *scroll* horizontal.
- [ ] ✅ Layar muat tanpa *scroll* vertikal di tinggi 640px (kecuali bagian yang dibuka-tutup sedang dibuka).
- [ ] ⬜ Teks tidak terpotong dan tidak bertumpuk, termasuk nama 20 karakter (misalnya "Bimasaktiwijayakusum").
- [ ] ⬜ Tombol mudah diketuk dengan jempol (≥ 44px) dan tidak ada ketukan yang "meleset" ke tombol lain.
- [ ] ⬜ Tombol di bawah tidak tertutup *home bar* iPhone, dan judul tidak tertutup *notch*.
- [ ] ⬜ Saat kolom isian diketuk, keyboard tidak menutupi kolom, dan layar **tidak** ikut membesar (zoom) di iPhone.
- [ ] ⬜ Ukuran huruf sistem diperbesar (Android: Setelan → Tampilan → Ukuran font, maksimal): tidak ada teks yang saling menimpa.
- [ ] ⬜ Mode gelap sistem aktif: tampilan tetap putih–navy–mawar dan terbaca.
- [ ] ⬜ HP diputar mendatar: tidak ada yang rusak (boleh perlu *scroll*).

Per layar:

| Layar | Yang dicek | |
|---|---|---|
| Beranda | Benang tergambar dari "Kamu" ke "Dia", lalu bernapas pelan. Tombol di zona jempol. Riwayat muncul setelah satu ronde | ⬜ |
| Buat room | Tiga kotak kategori sejajar, deskripsi berganti saat dipilih. Error nama muncul di bawah kolom | ✅ ⬜ |
| Gabung | Dari link: nama pengundang dan pengaturan tampil. Manual: kode diketik huruf kecil tetap diterima | ⬜ |
| Lobby menunggu | Kode room besar, lingkaran kosong memancar, "Bagikan link" berfungsi | ⬜ |
| Lobby lengkap | Benang menegang saat pasangan masuk. Ubah kategori/mode di HP Host langsung terlihat di HP Tamu. "Tukar peran" bekerja | ⬜ |
| Hitung mundur | 3-2-1 muncul serentak di kedua HP (selisih < 1 detik) | ⬜ |
| Soal | Opsi muncul berurutan, centang muncul saat dipilih, "Kunci jawaban" aktif setelah memilih | ✅ ⬜ |
| Soal terbuka | Penanda inisial bertemu di opsi yang cocok, hati berdetak sekali. "Cocok X dari Y" benar | ✅ ⬜ |
| Hasil | Simpul hati, angka menghitung naik sampai angka akhir, angka sama di kedua HP. "Lihat semua jawaban" bisa dibuka | ✅ ⬜ |
| Room berakhir | Pesan jelas dan tombol "Ke beranda" berfungsi | ✅ ⬜ |

---

## 4. Alur Utama (dua perangkat)

- [ ] ⬜ **Tebak Aku, satu ronde penuh.** Waktu dari buka link sampai pasangan masuk Lobby ≤ 1 menit. Satu sesi penuh ≤ 8 menit (target PRD).
- [ ] ⬜ **Kita Mirip?, satu ronde penuh.**
- [ ] ✅ Skor akhir dan judul hasil sama persis di kedua perangkat.
- [ ] ✅ **Main lagi**: kedua pemain kembali ke Lobby dan peran Tebak Aku tertukar.
- [ ] ⬜ **Bagikan hasil** (setelah *deploy*): *share sheet* terbuka di HP. Di laptop, teks tersalin dan muncul "Hasil disalin".
- [ ] ⬜ **Bagikan link** dari Lobby lewat WhatsApp: link membuka layar Gabung dengan nama pengundang.
- [ ] ✅ Riwayat tersimpan sekali per ronde di Beranda. "Hapus riwayat" meminta konfirmasi dan mengosongkannya.
- [ ] ⬜ Progres pasangan bergerak < 1 detik setelah dia menjawab (4G normal).

---

## 5. Edge Case

Kode E1–E8 mengikuti [02-system-design.md §2.4](02-system-design.md).

| Kode | Skenario | Harapan | Otomatis | Manual di HP |
|---|---|---|---|---|
| E1 | Pasangan menutup tab atau kehilangan sinyal di tengah kuis | Banner "{nama} terputus…". Saat dia kembali, lanjut di soal yang sama | ✅ | ⬜ |
| E2 | HP sendiri offline (mode pesawat), lalu menjawab | Banner "Koneksi terputus…". Jawaban terkirim otomatis saat online | ✅ | ⬜ |
| E3 | *Refresh* atau tutup-buka browser di tengah kuis | Kembali ke soal yang sama, jawaban yang sudah dikunci tetap terkunci | ✅ | ⬜ |
| E4 | Keluar di tengah kuis | Dialog konfirmasi, lalu pasangan melihat "{nama} keluar dari kuis." | ✅ | ⬜ |
| E5 | Host menutup room di Lobby | Tamu melihat "{nama Host} menutup room." | ✅ | ⬜ |
| E5b | Tamu keluar dari Lobby | Host kembali ke "Ajak pasanganmu masuk.", orang lain bisa masuk | ✅ | ⬜ |
| E6 | Room lewat 24 jam | "Room ini sudah lewat 24 jam." untuk anggota dan pendatang baru | ✅ | — |
| E7 | Orang ketiga membuka link | "Room ini sudah berisi dua orang." | ✅ | ⬜ |
| E8 | Host membuka link undangannya sendiri | Masuk lagi ke Lobby sebagai Host, bukan sebagai Tamu | ✅ | ⬜ |

Skenario tambahan yang hanya bisa diuji di HP sungguhan:

- [ ] ⬜ **Pindah ke WhatsApp** untuk mengirim link, lalu kembali ke browser: Lobby masih ada, tidak perlu masuk ulang.
- [ ] ⬜ **Layar HP terkunci** 1–2 menit di tengah kuis, lalu dibuka: kuis lanjut. Pasangan sempat melihat banner "terputus" lalu hilang sendiri.
- [ ] ⬜ **Telepon masuk** saat kuis berjalan (biasanya mereka bermain sambil video call): tidak ada yang rusak.
- [ ] ⬜ **Sinyal lemah**: Chrome laptop → DevTools → Network → "Slow 4G". Tombol menampilkan "Menunggu…" dan tidak bisa ditekan dua kali.
- [ ] ✅ **Tap ganda** pada "Kunci jawaban": jawaban tercatat sekali.
- [ ] ✅ **Mode privat / penyimpanan diblokir**: Beranda memberi tahu riwayat hilang saat tab ditutup, room tetap bisa dibuat.
- [ ] ⬜ **Dua tab** di perangkat yang sama membuka room yang sama: keduanya menampilkan keadaan yang sama, tidak menjadi pemain ketiga.

Validasi isian:

- [ ] ✅ Nama kosong → "Nama wajib diisi."
- [ ] ✅ Nama lebih dari 20 karakter tidak bisa diketik.
- [ ] ✅ Nama sama dengan Host (huruf besar/kecil diabaikan) → "{nama Host} sudah pakai nama ini. Pakai nama lain, ya."
- [ ] ✅ Kode salah format → "Kode terdiri dari 6 huruf dan angka."
- [ ] ✅ Kode tidak ada → "Kode ini tidak ditemukan. Cek lagi 6 karakternya."
- [ ] ⬜ Spasi berlebih dirapikan: "  Bima   Sakti " tampil sebagai "Bima Sakti" di HP pasangan.
- [ ] ⬜ Nama dengan emoji (misalnya "Bima 🌙") tampil utuh di Lobby, benang, dan Hasil, serta inisialnya tidak rusak.

---

## 6. Aksesibilitas

- [ ] ⬜ **Keyboard (laptop):** semua aksi bisa dilakukan dengan Tab, Enter, Spasi, dan panah. Pilihan jawaban dan kategori bisa dipindah dengan panah. Esc menutup dialog. Cincin fokus navy selalu terlihat.
- [ ] ⬜ **Pembaca layar:** TalkBack (Android) atau VoiceOver (iPhone). Judul setiap layar dibacakan saat layar berganti. Kode room dibacakan per karakter. Status "Cocok"/"Beda" dibacakan. Angka hasil dibacakan sebagai angka akhir, bukan angka yang sedang berjalan.
- [ ] ⬜ **Kurangi gerakan** (Android: Aksesibilitas → Hapus animasi; iPhone: Aksesibilitas → Gerakan → Kurangi gerakan): benang dan angka langsung tampil di keadaan akhir. ✅ di uji otomatis.
- [ ] ⬜ **Zoom browser 200%** di laptop: tidak ada teks yang terpotong (boleh perlu *scroll*).
- [ ] ✅ Kontras semua pasangan teks dan latar ≥ 4,5 : 1 (dihitung saat desain, lihat 02-system-design.md §6.2).

---

## 7. Audit Google Lighthouse

Target PRD (mobile): **Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.**

Langkah:
1. `npm run build`, lalu `npm run preview` (http://localhost:4173). Jangan audit `npm run dev`, karena versi pengembangan tidak dikecilkan dan hasilnya selalu lebih buruk.
2. Buka di Chrome **jendela Incognito** (ekstensi bisa menurunkan skor).
3. DevTools (F12) → tab **Lighthouse** → Mode **Navigation**, Device **Mobile**, centang keempat kategori → **Analyze page load**.
4. Catat keempat skor. Jika ada yang di bawah target, buka bagian **Opportunities** dan **Diagnostics** untuk melihat penyebabnya.
5. Ulangi setelah *deploy* di URL Vercel. Skor produksi lebih penting karena ada CDN dan HTTPS.

Halaman yang diaudit: **Beranda** (halaman pertama yang dibuka orang) dan **link undangan** (`/?room=KODE`), karena itulah yang dibuka pasangan dari WhatsApp.

Hasil terakhir (23 November 2026, Lighthouse 12.8, *mobile* dengan simulasi 4G lambat dan CPU 4× lebih lambat, build produksi di `localhost` + emulator):

| Halaman | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| Beranda | 96 | 100 | 100 | 100 | 1,9 dtk | 2,1 dtk | 140 ms | 0 |
| Link undangan | 87 ⚠️ | 100 | 100 | 100 | 2,4 dtk | 3,5 dtk ⚠️ | 80 ms | 0 |

Sebelum perbaikan T2 dan T3: Beranda 98 / 100 / 100 / 91, link undangan 85 / 100 / 100 / 91.

**Produksi** (`https://kuis-pasangan.vercel.app`, 23 November 2026, dua kali per halaman dari laptop pengembang):

| Halaman | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| Beranda | 72–90 | 100 | 100 | 100 | 1,7 dtk | **1,8 dtk** ✅ | 370–1.490 ms | 0 |
| Link undangan | 63–89 | 100 | 100 | 100 | 2,1–2,2 dtk | 3,1–3,2 dtk ⚠️ | 90–1.240 ms | 0 |

Rentang Performance yang lebar berasal dari **TBT**, yang dipengaruhi beban CPU laptop saat audit. FCP, LCP, dan CLS stabil di kedua putaran. Tidak ada error konsol di produksi (T4 tidak muncul). Untuk angka yang stabil, jalankan **https://pagespeed.web.dev** (server Google) untuk kedua URL, lalu catat hasilnya di sini.

Garis waktu link undangan di jaringan nyata (dua percobaan, hasil sama): layar "Menyambungkan…" 0,55 dtk → kode Firebase 0,6 dtk → login anonim 1,5 dtk → koneksi database Singapore 2,2 dtk → **undangan tampil 2,4 dtk**.

Skor Performance bisa naik-turun ±3 antarpengukuran. Jalankan 2–3 kali, lalu ambil nilai tengahnya. Jika laptop sedang sibuk, Lighthouse bisa gagal dengan `PROTOCOL_TIMEOUT` dan menampilkan skor 0 untuk Accessibility dan SEO. Itu kegagalan alat ukur, jadi ulangi audit tanpa program berat lain yang berjalan.

Yang juga dicek:
- [ ] ✅ Total JavaScript ≤ 200 KB gzip (target PRD).
- [ ] ✅ Firebase baru dimuat setelah Beranda tampil (*lazy load*).
- [ ] ⚠️ LCP < 2,5 detik dengan profil "Slow 4G": Beranda lolos (2,1 dtk), link undangan belum (3,5 dtk, temuan T1).
- [ ] ✅ `robots.txt` valid dan tidak ada permintaan ke `apis.google.com`.

---

## 8. Kriteria Siap *Deploy*

- [ ] `npm run check` lolos (typecheck, lint, format, unit test).
- [ ] `npm run coverage` lolos (≥ 90% untuk `utils/`).
- [ ] *Integration test* (Security Rules) lolos: `npm run test:integration`.
- [ ] Uji tampilan otomatis lolos semua (Bagian 1).
- [ ] Lighthouse memenuhi keempat target.
- [ ] **0 bug Blocker** dari checklist manual.
- [ ] Minimal satu sesi penuh dimainkan dari **dua perangkat sungguhan** tanpa bantuan. Target PRD untuk rilis: 2 pasangan.
