# PRD — Kuis Pasangan (Couple Quiz) · MVP v1.0

| | |
|---|---|
| **Versi dokumen** | 1.5 |
| **Tanggal** | 22 November 2026 |
| **Platform** | Browser (mobile-first), **2 pemain di perangkat masing-masing**, *real-time* |
| **Fase berikutnya** | Fase 2: System Design & Architecture |

### Riwayat perubahan
| Versi | Perubahan |
|---|---|
| 1.0 | Draft awal: *pass-and-play* di 1 perangkat. |
| 1.1 | **Diganti menjadi Room Real-time di 2 perangkat** (Firebase Realtime Database + Anonymous Auth). Mode 1 HP dan Mode Kirim Link dipindah ke backlog. Layar Transisi diganti dengan Lobby dan Layar Menunggu. Mode Tebak kini memakai peran (yang ditebak dan penebak). |
| 1.2 | **Jawaban dibuka per soal.** Setiap soal terbuka begitu keduanya menjawab, lalu keduanya menekan "Siap" dan soal berikutnya muncul bersamaan di dua HP. Jawaban terkunci sejak dikirim, sehingga tombol Kembali (FR-08) dihapus. Layar Menunggu terpisah diganti status tunggu di dalam layar soal. Ringkasan akhir tetap muncul setelah soal ke-10. |
| 1.3 | **Setiap layar muat tanpa scroll** (tinggi ≤ 640px). Semua teks selain judul memakai satu ukuran (14px). Pengaturan Lobby baru tampil setelah Tamu masuk, dan pilihan "Yang Ditebak" menjadi tombol "Tukar peran". Daftar 10 jawaban di layar Hasil serta riwayat dan cara main di Beranda bisa dibuka-tutup. |
| 1.4 | **Sistem gerak "benang yang hidup"**: benang terulur, berayun, menegang saat pasangan masuk, berdenyut saat ada jawaban, dan terikat menjadi simpul hati. Persentase hasil kini menghitung naik sesuai FR-14. |
| 1.5 | **Beranda baru**: panel "Cara main" dihapus (FR-05). Beranda kini satu komposisi layar penuh: benang bersimpul longgar dari "Kamu, di sini" ke "Dia, di sana", judul, satu kalimat pembuka, dan tombol di bawah. Catatan privasi menjadi satu baris di bagian bawah. |

---

## 1. Ringkasan Produk

**Kuis Pasangan** adalah game kuis *real-time* singkat (5–8 menit) untuk pasangan LDR. Masing-masing bermain dari perangkatnya sendiri. Satu pemain membuat **room** lalu membagikan **kode room** atau link, dan pasangannya bergabung. Keduanya menjawab 10 pertanyaan yang sama, **satu soal bersamaan**. Setiap soal **langsung terbuka** begitu keduanya menjawab, sehingga bisa dibahas saat itu juga, lalu soal berikutnya muncul serentak setelah keduanya siap. Setelah soal ke-10, muncul ringkasan akhir: persentase kecocokan, ringkasan karakter pasangan, perbandingan semua jawaban, dan tombol berbagi.

Game ini paling seru dimainkan sambil video call atau telepon. Pemain tidak perlu membuat akun atau menginstal apa pun.

---

## 2. Tujuan & Metrik Keberhasilan

### Tujuan produk
1. **Mendekatkan yang berjauhan.** Memberi pasangan LDR aktivitas bersama yang terasa "main bareng" walau beda kota.
2. **Memancing obrolan dan tawa.** Hasil kuis menjadi bahan ngobrol, bukan sekadar angka.
3. **Tanpa hambatan.** Dari membuka link sampai pasangan masuk lobby ≤ 1 menit, tanpa daftar akun.
4. **Biaya Rp0.** Hosting di Vercel dan Firebase paket gratis (Spark).

### Metrik keberhasilan (MVP)
| Metrik | Target |
|---|---|
| Durasi 1 sesi penuh (buat room sampai hasil) | ≤ 8 menit |
| Waktu sejak link dibuka sampai pasangan masuk lobby | ≤ 1 menit |
| Jeda update progres pasangan (jaringan 4G normal) | < 1 detik |
| Bug *blocker* pada checklist QA | 0 |
| Lighthouse (mobile): Performance / Accessibility / Best Practices / SEO | ≥ 90 / ≥ 95 / ≥ 95 / ≥ 90 |
| *Coverage* unit test untuk logika skor dan *state* (`utils/`) | ≥ 90% |
| Uji coba langsung | Minimal 2 pasangan, dari 2 perangkat berbeda, menyelesaikan sesi tanpa bantuan |

---

## 3. Target Pengguna & Konteks

- **Pengguna utama:** pasangan LDR (beda kota, pulau, atau negara), usia 18–35, terbiasa memakai HP dan WhatsApp.
- **Konteks bermain:** sambil video call atau telepon malam hari, atau sebagai "kencan virtual".
- **Perangkat:** mayoritas HP (layar 360–430px), sebagian laptop. Kedua pemain bisa memakai perangkat yang berbeda jenis.
- **Syarat:** kedua pemain online **pada waktu yang sama** dan terhubung ke internet.

---

## 4. Desain Game (Core Mechanics)

### 4.1 Istilah
| Istilah | Arti |
|---|---|
| **Room** | Sesi permainan untuk tepat 2 pemain, diidentifikasi dengan **kode room** 6 karakter (misalnya `K7M2QX`). |
| **Host** | Pemain yang membuat room dan mengatur kategori, mode, dan tombol Mulai. |
| **Tamu** | Pemain yang bergabung lewat link atau kode. |
| **Yang Ditebak / Penebak** | Peran dalam Mode Tebak (lihat §4.2). |

### 4.2 Mode permainan
Kedua pemain selalu menjawab **bersamaan**, sehingga tidak ada yang menunggu giliran.

| Mode | Pemain A | Pemain B | Arti "cocok" |
|---|---|---|---|
| **Tebak Aku** (default) | **Yang Ditebak**: menjawab tentang dirinya | **Penebak**: menebak jawaban A | Tebakan B = jawaban A |
| **Kita Mirip?** | Menjawab tentang dirinya | Menjawab tentang dirinya | Jawaban B = jawaban A |

- Di Mode Tebak, Host memilih siapa yang ditebak di lobby. Saat **Main Lagi**, peran otomatis **ditukar** supaya adil.

### 4.3 Alur inti (game loop)
```
HOST : Beranda → Buat Room (nama, kategori, mode) → Lobby (kode + bagikan link)
TAMU : Buka link / masukkan kode → isi nama → Lobby
LOBBY: kedua pemain online → Host tekan "Mulai" → hitung mundur 3-2-1 (serentak)
KUIS : untuk setiap soal (sama di kedua HP):
         pilih jawaban → "Kunci jawaban" → menunggu pasangan menjawab
         → keduanya menjawab: soal TERBUKA (pilihan masing-masing, Cocok/Beda, skor berjalan)
         → keduanya menekan "Siap" → soal berikutnya muncul bersamaan
HASIL: setelah soal ke-10 → simpul hati → ringkasan akhir
       → Main Lagi (room sama, peran ditukar) / Bagikan / Keluar
```

### 4.4 Aturan soal & skor
- Setiap soal berupa **pilihan ganda dengan 4 opsi**, sehingga pencocokan otomatis, adil, dan bisa diuji.
- Satu ronde berisi **10 soal** dari satu kategori. Urutan soal diacak **sekali** oleh Host saat menekan Mulai, lalu disimpan di room. **Kedua pemain mendapat urutan dan opsi yang identik.**
- Teks soal ditulis sebagai *template* yang bisa dirender sebagai "kamu" atau sebagai nama pasangan.
  Contoh: *"Kalau lagi bete, {subjek} biasanya…"* dirender menjadi *"…kamu biasanya…"* atau *"…{nama pasangan} biasanya…"*
- **Skor** = jumlah soal dengan id opsi kedua pemain sama.
- **Persentase** = `round(skor / total × 100)`. Jika `total = 0`, hasilnya 0%.
- Skor dihitung di masing-masing perangkat dengan fungsi yang sama dan deterministik, sehingga hasilnya identik di kedua layar.

### 4.5 Ringkasan karakter pasangan (4 tingkat)
| Rentang | Judul (Mode Tebak) | Judul (Mode Cocok) |
|---|---|---|
| 90–100% | Pembaca Pikiran | Belahan Jiwa |
| 70–89% | Partner Sejati | Satu Frekuensi |
| 40–69% | Masih Banyak Kejutan | Saling Melengkapi |
| 0–39% | Petualangan Baru Dimulai | Beda Itu Seru |

### 4.6 Prinsip desain
1. **Terasa bersama.** Soal tampil dan terbuka bersamaan di kedua HP, sehingga setiap jawaban bisa langsung dibahas saat video call.
2. **Tidak ada hasil yang "buruk".** Semua teks hasil bernada positif. Skor rendah dibingkai sebagai "banyak hal baru untuk dikenali".
3. **Anti-intip.** Jawaban pasangan untuk sebuah soal **tidak bisa dibaca sama sekali**, termasuk lewat DevTools, sampai kamu sendiri sudah menjawab soal itu. Jawaban juga tidak bisa diganti setelah dikirim. Keduanya ditegakkan oleh Firebase Security Rules, bukan hanya oleh UI.
4. **Cepat dan fokus.** Satu soal per layar, tanpa timer, dengan transisi ≤ 300ms.
5. **Soal yang aman dan inklusif.** Soal tidak berasumsi soal gender, agama, atau status ekonomi. Hindari topik yang rawan memicu pertengkaran (mantan, perbandingan fisik).
6. **Opsi jawaban yang jelas.** Keempat opsi saling eksklusif dan mudah dibedakan.

---

## 5. Ruang Lingkup MVP

### Tech stack (diperbarui)
| Lapisan | Teknologi |
|---|---|
| Core | React + Vite + TypeScript (`strict`) |
| Styling & ikon | Tailwind CSS, Lucide React |
| Real-time & data room | **Firebase Realtime Database** (region `asia-southeast1` / Singapura) |
| Identitas pemain | **Firebase Anonymous Auth** (tanpa daftar, ID tersimpan di perangkat) |
| Bank soal | JSON lokal (ikut di-*bundle*) |
| Penyimpanan lokal | `localStorage`: riwayat skor dan kode room aktif |
| Testing | Vitest (logika), Firebase Emulator (Security Rules), uji manual 2 perangkat |
| Deployment | Vercel (statis, *environment variable* untuk konfigurasi Firebase) |

### ✅ In-Scope
- 3 kategori (**Santai**, **Deep Talk**, **Kebiasaan Sehari-hari**), masing-masing 10 soal pilihan ganda 4 opsi.
- 2 mode: Tebak Aku (dengan peran yang bergantian) dan Kita Mirip?
- Room untuk 2 pemain: **buat room, gabung lewat link atau kode, Lobby**.
- Bermain serentak dengan indikator progres pasangan secara live.
- Layar: **Beranda**, **Gabung Room**, **Lobby**, **Kuis** (dengan status menunggu dan soal terbuka per soal), **Hasil**.
- Jawaban dibuka per soal secara serentak, lalu hasil akhir: persentase, perbandingan per soal, ringkasan karakter, bahan obrolan.
- Bagikan hasil dalam bentuk teks (Web Share API, dengan *fallback* clipboard).
- Main Lagi di room yang sama.
- Indikator online/terputus, *reconnect* otomatis, dan lanjut otomatis setelah *refresh*.
- Riwayat 5 skor terakhir di `localStorage` (per perangkat).
- Firebase Security Rules: anti-intip, maksimal 2 pemain, dan validasi data.
- Responsif 360px sampai desktop, aksesibilitas WCAG 2.1 AA.

### ❌ Out-of-Scope (MVP)
| Fitur | Rencana |
|---|---|
| Mode Kirim Link (asinkron, untuk pasangan beda zona waktu) | v1.1 |
| Kartu hasil berbentuk gambar (PNG) | v1.1 |
| Firebase App Check (perlindungan dari penyalahgunaan) | v1.1 |
| Mode 1 HP bergantian (*pass-and-play*) | Backlog |
| Mode "Saling Tebak" (setiap pemain menjawab dan menebak, menghasilkan 2 skor) | v2.0 |
| Akun permanen (login Google/email), riwayat lintas perangkat | v2.0 |
| Soal buatan sendiri (*custom questions*) | v2.0 |
| Pembersihan room otomatis (Cloud Functions, butuh paket Blaze) | v2.0 |
| Chat atau voice di dalam game | Tidak direncanakan (pakai WA/video call) |
| Lebih dari 2 pemain, jawaban isian bebas, timer | Tidak direncanakan |
| Musik, PWA/offline, multi-bahasa, leaderboard, analitik | Backlog |

---

## 6. Functional Requirements

Prioritas memakai metode **MoSCoW**: **M**ust, **S**hould, **C**ould.

### 6.1 Beranda, Room & Lobby
| ID | Prioritas | User Story | Acceptance Criteria |
|---|---|---|---|
| FR-01 | M | Sebagai Host, saya ingin membuat room agar bisa mengajak pasangan bermain. | • Form berisi nama, pilihan kategori (3 kartu), dan mode.<br>• Nama di-*trim*, spasi ganda diringkas, panjang 1–20 karakter. Jika kosong, error tampil inline dan fokus pindah ke field tersebut.<br>• Kategori wajib dipilih ("Pilih satu kategori dulu"). Status terpilih ditandai ikon centang, tidak hanya warna.<br>• Tombol "Buat Room" membuat room dengan **kode unik** 6 karakter dari alfabet tanpa karakter mirip (tanpa `0/O`, `1/I/L`), lalu membuka Lobby.<br>• Tap ganda hanya membuat **satu** room. |
| FR-02 | M | Sebagai Host, saya ingin mengundang pasangan dengan mudah. | • Lobby menampilkan kode room dalam ukuran besar, dengan tombol "Salin Kode" dan "Bagikan Link".<br>• Format link: `https://<domain>/?room=K7M2QX`.<br>• "Bagikan Link" membuka *share sheet* bawaan jika tersedia. Jika tidak, link disalin dan muncul *toast* "Link disalin!". |
| FR-03 | M | Sebagai Tamu, saya ingin bergabung lewat link atau kode. | • Membuka link langsung menampilkan form Gabung dengan kode yang sudah terisi.<br>• Kode yang diketik manual otomatis diubah ke huruf besar dan spasinya dibuang. Format harus valid.<br>• Nama wajib diisi (aturan sama dengan FR-01) dan **berbeda** dari nama Host (tidak peka huruf besar/kecil).<br>• Pesan error yang jelas untuk setiap kondisi: "Room tidak ditemukan", "Room sudah kedaluwarsa", "Room sudah penuh", "Permainan sudah dimulai". |
| FR-04 | M | Sebagai pasangan, kami ingin lobby yang menunjukkan bahwa kami berdua siap. | • Menampilkan kedua pemain dengan status ● online / ○ terputus, serta kategori dan mode yang dipilih.<br>• Selama menunggu Tamu, Lobby fokus ke undangan dan hanya menampilkan ringkasan pengaturan.<br>• Setelah Tamu masuk, Host bisa mengganti kategori, mode, dan peran ("Tukar peran" di Mode Tebak). Perubahan langsung terlihat di layar Tamu.<br>• Tombol **"Mulai"** hanya ada di layar Host dan baru aktif jika kedua pemain online. Tamu melihat pesan "Menunggu {Host} memulai…".<br>• Jika Host keluar dari lobby, Tamu diberi tahu "Room ditutup" dan diarahkan ke Beranda. |
| FR-05 | — | ~~Sebagai pemain baru, saya ingin melihat cara main secara singkat.~~ | **Dihapus di v1.5.** Kalimat pembuka Beranda sudah menjelaskan intinya ("Jawab soal yang sama dari HP masing-masing"), dan setiap layar berikutnya menjelaskan langkahnya sendiri. |

### 6.2 Permainan
| ID | Prioritas | User Story | Acceptance Criteria |
|---|---|---|---|
| FR-06 | M | Sebagai pasangan, kami ingin mulai bersamaan. | • Saat Host menekan "Mulai", urutan soal diacak dan disimpan di room, lalu status room berubah menjadi `playing`.<br>• Kedua perangkat menampilkan hitung mundur 3-2-1, lalu soal pertama.<br>• Pemain yang masuk ulang (setelah *refresh*) tidak melihat hitung mundur lagi dan langsung ke soalnya. |
| FR-07 | M | Sebagai pemain, saya ingin menjawab 10 soal satu per satu, bersamaan dengan pasangan. | • Soal yang tampil sama di kedua HP. Satu soal per layar, berisi 4 opsi jawaban berupa *radio group* yang bisa dioperasikan dengan keyboard.<br>• Benang progres dan teks "Soal X dari 10" diperbarui setiap pindah soal.<br>• "Kunci jawaban" baru aktif setelah ada opsi yang dipilih. Jawaban tersimpan saat tombol ini ditekan. |
| FR-08 | M | Sebagai pasangan, kami ingin jawaban tidak bisa diganti setelah melihat jawaban pasangan. | • Jawaban **terkunci sejak dikirim** dan tidak bisa diubah, termasuk lewat akses langsung ke database (Rules).<br>• Tidak ada tombol "Kembali" (diganti di v1.2). |
| FR-09 | M | Sebagai pemain, saya ingin teks soal sesuai peran saya. | • Mode Tebak: Yang Ditebak melihat versi "kamu". Penebak melihat versi nama, misalnya "…{nama pasangan} biasanya…", disertai petunjuk "Tebak jawaban {nama pasangan}".<br>• Mode Cocok: kedua pemain melihat versi "kamu". |
| FR-10 | M | Sebagai pemain, saya ingin tahu apakah pasangan sudah menjawab soal ini. | • Di bawah opsi tampil "{nama pasangan} sudah menjawab." atau "{nama pasangan} sedang memilih…", diperbarui dalam < 1 detik (4G normal).<br>• **Isi jawaban pasangan tidak pernah terlihat** sebelum kamu menjawab soal yang sama. |
| FR-11 | M | Sebagai pemain yang lebih cepat, saya ingin tahu sedang menunggu apa. | • Setelah mengunci jawaban: tombol berubah menjadi "Menunggu {nama pasangan} menjawab…".<br>• Setelah menekan Siap: "Menunggu {nama pasangan} siap…". Soal berikutnya muncul begitu keduanya siap. |
| FR-12 | S | Sebagai pemain, saya ingin bisa keluar di tengah permainan. | • Tombol "Keluar" memunculkan dialog konfirmasi.<br>• Jika dikonfirmasi, room ditandai berakhir dan pasangan melihat pesan "{Nama} keluar dari permainan" dengan tombol kembali ke Beranda. |

### 6.3 Hasil & berbagi
| ID | Prioritas | User Story | Acceptance Criteria |
|---|---|---|---|
| FR-13 | M | Sebagai pasangan, kami ingin setiap soal terbuka bersamaan, lalu melihat hasil akhir. | • Begitu kedua pemain menjawab sebuah soal, kedua HP menampilkan pilihan masing-masing (penanda inisial), status Cocok/Beda, dan skor berjalan "Cocok X dari Y".<br>• Tombol "Siap, soal berikutnya" (soal ke-10: "Lihat hasil akhir"). Soal berikutnya atau hasil akhir muncul setelah keduanya menekannya.<br>• Sebelum keduanya menjawab, jawaban pasangan **tidak bisa dibaca** dari database (lihat NFR Keamanan). |
| FR-14 | M | Sebagai pasangan, kami ingin tahu seberapa cocok kami. | • Skor dan persentase dihitung sesuai §4.4 oleh **fungsi murni** yang diuji unit test, dan hasilnya identik di kedua perangkat.<br>• Persentase tampil besar dengan animasi hitung naik (dimatikan jika `prefers-reduced-motion`), disertai teks seperti "8 dari 10 jawaban cocok". |
| FR-15 | M | Sebagai pasangan, kami ingin membandingkan jawaban dan melihat ringkasan karakter. | • Daftar 10 soal, masing-masing berisi teks soal, jawaban kedua pemain, dan status cocok (**ikon dan teks**, tidak hanya warna).<br>• Judul dan deskripsi karakter tampil sesuai rentang skor dan mode (§4.5), dan selalu bernada positif. |
| FR-16 | S | Sebagai pasangan, kami ingin bahan obrolan dari jawaban yang berbeda. | • Bagian "Ngobrolin ini, yuk" menampilkan maksimal 3 soal yang tidak cocok.<br>• Jika semua jawaban cocok, tampilkan pesan perayaan sebagai gantinya. |
| FR-17 | M | Sebagai pemain, saya ingin membagikan hasil. | • Teks yang dibagikan berisi nama, kategori, mode, persentase, judul karakter, dan link game. **Detail jawaban tidak ikut dibagikan.**<br>• Urutan cara berbagi: `navigator.share`, lalu clipboard dengan *toast* "Hasil disalin!", lalu modal berisi teks yang bisa disalin manual. |
| FR-18 | M | Sebagai pasangan, kami ingin main lagi tanpa membuat room baru. | • Tombol "Main Lagi" mengembalikan **kedua** pemain ke Lobby room yang sama. Host bisa memilih kategori baru.<br>• Di Mode Tebak, peran Yang Ditebak dan Penebak otomatis ditukar.<br>• Tersedia juga tombol "Ke Beranda" untuk keluar dari room. |

### 6.4 Koneksi, penyimpanan & ketahanan (*defensive*)
| ID | Prioritas | User Story | Acceptance Criteria |
|---|---|---|---|
| FR-19 | M | Sebagai pemain, saya ingin tahu jika pasangan terputus. | • Status pasangan berubah menjadi "terputus" saat server mendeteksi koneksinya hilang (memakai *presence* dan `onDisconnect`).<br>• Banner "{nama pasangan} terputus, menunggu tersambung kembali…" muncul, dan permainan berlanjut otomatis saat pasangan tersambung lagi. |
| FR-20 | M | Sebagai pemain, saya ingin jawaban tetap aman walau sinyal putus. | • Saat perangkat sendiri offline, muncul banner "Koneksi terputus. Jawabanmu akan tersimpan saat tersambung kembali."<br>• Jawaban yang dibuat selama offline dikirim otomatis begitu tersambung (antrean bawaan Firebase). |
| FR-21 | M | Sebagai pemain, saya tidak ingin progres hilang saat halaman ter-*refresh*. | • Kode room aktif disimpan di `localStorage`. Saat game dibuka ulang (≤ 24 jam) dan room masih aktif, pemain **otomatis masuk kembali** ke posisi terakhirnya (Lobby, soal ke-N, Menunggu, atau Hasil).<br>• Identitas pemain (Anonymous Auth) tetap sama di perangkat yang sama, jadi tidak dianggap pemain baru.<br>• Room yang tidak ditemukan atau kedaluwarsa dibersihkan dari `localStorage` tanpa *crash*. |
| FR-22 | M | Sebagai pemain, saya tidak ingin aksi terproses dua kali karena tap ganda. | • Tap cepat beruntun pada "Buat Room", "Gabung", "Mulai", "Lanjut", "Selesai", dan "Main Lagi" hanya diproses **satu kali**.<br>• Tombol menampilkan status *loading* selama permintaan ke server berjalan. |
| FR-23 | M | Sebagai pasangan, kami ingin melihat riwayat skor terakhir. | • Setiap ronde yang selesai disimpan **di perangkat masing-masing** dengan data tanggal, nama pasangan, kategori, mode, dan persentase.<br>• Hanya 5 riwayat terbaru yang disimpan. Riwayat tampil di Beranda, dengan tombol "Hapus riwayat" yang meminta konfirmasi. |
| FR-24 | M | Sebagai pemain di mode privat browser, saya tetap bisa bermain. | • Jika `localStorage` tidak tersedia, game tetap bisa dimainkan. Hanya riwayat dan fitur masuk kembali otomatis yang nonaktif, tanpa pesan error yang mengganggu. |

---

## 7. Non-Functional Requirements

| Kategori | Requirement | Target / Cara Ukur |
|---|---|---|
| **Performa** | *Bundle* ringan dan *loading* cepat | Total JS ≤ 200 KB (gzip). SDK Firebase di-*lazy-load* setelah Beranda tampil. LCP < 2,5 dtk (Slow 4G). Lighthouse Performance ≥ 90 (mobile). |
| | Real-time | Update progres dan status pasangan < 1 detik (4G normal). Respons tap lokal < 100ms. |
| | Animasi | Hanya memakai `transform`, `opacity`, dan goresan SVG benang (60fps), tanpa menggeser tata letak. Menghormati `prefers-reduced-motion`: semua elemen langsung di keadaan akhir. |
| **Responsivitas** | Mobile-first, 360px sampai desktop | Tanpa *scroll* horizontal di lebar 360–1920px. Konten maksimal 560px di tengah layar desktop. |
| | Muat satu layar | Setiap layar muat **tanpa scroll vertikal** pada tinggi 640px, yaitu laptop 1366×768 di zoom 100% dan kebanyakan HP. Isi sekunder yang panjang (daftar 10 jawaban dan riwayat) bisa dibuka-tutup. Diukur otomatis untuk setiap layar di lebar 390px dan 1366px. |
| | Ramah sentuhan | Target sentuh minimal 44×44px. Mendukung *safe-area* iOS, portrait, dan landscape. |
| **Aksesibilitas** | WCAG 2.1 AA | Kontras teks ≥ 4,5:1. Lighthouse Accessibility ≥ 95. |
| | Keyboard dan *screen reader* | Navigasi keyboard penuh dan *focus ring* selalu terlihat. HTML semantik, `lang="id"`. Perubahan soal, progres, dan status pasangan diumumkan lewat `aria-live`. Status tidak hanya ditandai warna. |
| **Keamanan** | Security Rules dengan prinsip *deny by default* | • Hanya pengguna terautentikasi (anonim) yang bisa membaca dan menulis.<br>• Maksimal 2 pemain per room.<br>• Pemain hanya bisa menulis datanya sendiri.<br>• Field khusus Host (status, kategori, urutan soal) hanya bisa ditulis Host.<br>• **Jawaban pasangan untuk sebuah soal baru bisa dibaca setelah keduanya menjawab soal itu, dan jawaban tidak bisa diganti setelah dikirim.**<br>• Validasi tipe dan panjang data (nama ≤ 20 karakter, format id jawaban).<br>• Room yang berumur > 24 jam ditolak untuk ditulis. |
| | Konfigurasi | Konfigurasi Firebase lewat *environment variable* (`VITE_FIREBASE_*`), file `.env.local` tidak di-*commit*. API key dibatasi per domain (HTTP referrer) di Google Cloud Console. |
| **Privasi** | Data minimal | Hanya nama panggilan dan jawaban yang dikirim ke server, tanpa email, lokasi, atau analitik. Data disimpan di server Singapura. Ada catatan privasi satu baris di bagian bawah Beranda. |
| **Keandalan** | Tahan putus-sambung | *Reconnect* otomatis. Sesudah *refresh*, *state* dipulihkan dari server sebagai sumber kebenaran. *Error boundary* mencegah layar putih. Semua akses `localStorage` memakai `try/catch` dan skema bernomor versi. |
| **Kuota** | Tetap di paket gratis Spark | Ukuran data per room ≤ 5 KB. Batas Spark: 100 koneksi simultan (≈50 pasangan bermain bersamaan), 1 GB penyimpanan, 10 GB unduhan per bulan. Pemakaian dipantau di Firebase Console. |
| **Kompatibilitas** | Browser modern | Chrome, Edge, dan Firefox (2 versi terakhir), Safari iOS 15+, Chrome Android. |
| **Maintainability** | Kode rapi dan teruji | TypeScript `strict`, ESLint + Prettier. Logika game (fungsi murni) dipisah dari UI dan dari lapisan Firebase (*service layer*), sehingga bisa diuji tanpa jaringan. *Coverage* `utils/` ≥ 90%. |
| **Deployability** | Hosting statis gratis | `npm run build` menghasilkan folder statis. Vercel *auto-deploy* dari branch `main`. Security Rules di-*deploy* lewat Firebase CLI. |

---

## 8. Batasan, Asumsi & Risiko

### Batasan
- Paket Spark **tidak memiliki Cloud Functions**, sehingga semua logika berjalan di klien dan dijaga oleh Security Rules.
- Tepat 2 pemain per room, dan keduanya harus online bersamaan.
- Bahasa Indonesia saja. Bank soal berupa JSON yang ikut di-*bundle*.

### Asumsi
- Pemain memiliki koneksi internet yang cukup stabil (3G/4G/Wi-Fi).
- Pemilik proyek memiliki akun Google untuk membuat project Firebase (gratis, tanpa kartu kredit).

### Risiko & mitigasi
| Risiko | Dampak | Mitigasi |
|---|---|---|
| Pasangan mengintip jawaban lewat DevTools atau Network tab | Game tidak adil | Security Rules mengunci baca jawaban per soal sampai keduanya menjawab, dan jawaban tidak bisa diganti (§7 Keamanan) |
| Sinyal putus atau tab tertutup di tengah permainan | Progres hilang, pasangan bingung | *Presence*, *reconnect* otomatis, *state* di server, masuk kembali otomatis (FR-19 s.d. FR-21) |
| Spam atau penyalahgunaan database (API key Firebase memang publik) | Kuota habis, data sampah | Security Rules ketat, validasi data, pembatasan API key per domain, App Check di v1.1 |
| Kuota gratis terlampaui | Game tidak bisa dimainkan | Data per room kecil dan pemakaian dipantau. Jika perlu, beralih ke paket Blaze (bayar sesuai pemakaian) |
| Room lama menumpuk di database | Penyimpanan membengkak | Room > 24 jam ditolak oleh Rules. Pembersihan manual berkala lewat skrip di Fase 6. Pembersihan otomatis (Cloud Functions) di v2.0 |
| Beda zona waktu sehingga sulit online bersamaan | Game jarang dimainkan | Mode Kirim Link (asinkron) di v1.1 |
| Skor rendah membuat pasangan baper | Pengalaman negatif | Teks hasil selalu positif dan ada bagian "bahan obrolan" (§4.6, FR-16) |
| `localStorage` diblokir (mode privat) | Fitur masuk kembali otomatis tidak berjalan | *Fallback* ke memori (FR-24) |
| Setup Firebase membingungkan bagi pemula | Proyek tertunda | Panduan setup langkah demi langkah di Fase 3 dan Firebase Emulator untuk pengembangan lokal |

---

## 9. Keputusan yang Perlu Dikonfirmasi

| # | Pertanyaan | Rekomendasi |
|---|---|---|
| 1 | Mode Tebak memakai **peran** (1 orang ditebak, 1 menebak) yang ditukar saat Main Lagi? | **Ya.** Sederhana dan adil. Mode "Saling Tebak" (2 skor) masuk v2.0. |
| 2 | Hanya **Host** yang bisa mengatur kategori, mode, dan tombol Mulai? | **Ya.** Menghindari konflik pengaturan. |
| 3 | Masa berlaku room **24 jam**? | **Ya** |
| 4 | Lokasi database **Singapura** (`asia-southeast1`)? | **Ya.** Paling dekat dengan Indonesia sehingga latensinya rendah. |
| 5 | Pemain yang terputus **ditunggu tanpa batas waktu** (tidak ada *timeout* otomatis)? | **Ya** untuk MVP. Pemain yang menunggu tetap bisa menekan "Keluar". |
| 6 | Kamu sudah punya **akun Google** untuk membuat project Firebase? | Diperlukan di Fase 3 |
