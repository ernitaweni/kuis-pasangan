# Project & Environment Setup: Kuis Pasangan

| | |
|---|---|
| **Versi dokumen** | 1.0 |
| **Tanggal** | 22 November 2026 |
| **Acuan** | [01-PRD.md](01-PRD.md) v1.1, [02-system-design.md](02-system-design.md) |
| **Fase berikutnya** | Fase 4: Development |

---

## 1. Stack yang Terpasang

| Lapisan | Paket | Versi |
|---|---|---|
| UI | `react`, `react-dom` | 19.3 |
| Build | `vite`, `@vitejs/plugin-react` | 8.3, 6.1 |
| Bahasa | `typescript` | 6.0 |
| Styling | `tailwindcss`, `@tailwindcss/vite` | 4.3 |
| Ikon | `lucide-react` | 1.77 |
| Font | `@fontsource-variable/literata`, `@fontsource-variable/plus-jakarta-sans` | 5.3 |
| Back-end (BaaS) | `firebase` (JS SDK) | 13.4 |
| Lint | `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y-x` | 10.15, 8.73, 7.1, 0.2 |
| Format | `prettier`, `prettier-plugin-tailwindcss`, `eslint-config-prettier` | 3.10, 0.8, 10.1 |
| Test | `vitest`, `@vitest/coverage-v8` | 5.1 |
| Firebase CLI & Emulator | `firebase-tools` (devDependency) | 15.37 |
| Runtime | Node.js 24 (npm 11), Java 21 (khusus emulator) | — |

---

## 2. Perintah Inisialisasi

### 2.1 Membuat proyek dari nol (referensi)
Perintah inilah yang dipakai untuk membuat proyek ini:

```bash
# 1. Scaffold React + TypeScript (pakai ESLint, bukan Oxlint bawaan create-vite 9)
npm create vite@latest kuis-pasangan -- --template react-ts --eslint
cd kuis-pasangan
npm install

# 2. Dependensi aplikasi
npm install tailwindcss @tailwindcss/vite lucide-react firebase \
  @fontsource-variable/literata @fontsource-variable/plus-jakarta-sans

# 3. Dependensi pengembangan
npm install -D prettier prettier-plugin-tailwindcss eslint-config-prettier \
  eslint-plugin-jsx-a11y-x vitest @vitest/coverage-v8 firebase-tools
```

Setelah itu, file konfigurasi diubah seperti dijelaskan di §4.

### 2.2 Menjalankan proyek yang sudah ada (misalnya setelah *clone*)
```bash
npm install
cp .env.example .env.local      # Windows PowerShell: Copy-Item .env.example .env.local

# Terminal 1: database dan auth lokal (tanpa akun Firebase)
npm run emulators               # UI emulator: http://127.0.0.1:4000

# Terminal 2: aplikasi
npm run dev                     # http://localhost:5173
```

---

## 3. Struktur Folder

```text
kuis-pasangan/
├── docs/                     Dokumen proyek (PRD, desain, setup, pratinjau visual)
├── public/
│   └── favicon.svg           Ikon benang
├── src/
│   ├── components/
│   │   ├── ui/               Komponen dasar: Button, Panel, TextField, OptionButton, Dialog, …
│   │   └── thread/           Elemen khas: ThreadLink, ThreadProgress, ThreadKnot
│   ├── screens/              Satu file per layar: Home, CreateRoom, Join, Lobby, Quiz, Waiting, Result
│   ├── hooks/                useAuth, useRoom, usePresence, useConnection, useQuiz, useHistory, useShare
│   ├── services/             Lapisan Firebase & localStorage (satu-satunya yang menyentuh SDK)
│   ├── utils/                Fungsi murni: skor, fase room, validasi, kode room, teks soal (+ *.test.ts)
│   ├── types/                Tipe TypeScript (docs/02-system-design.md §5)
│   ├── data/                 questions.json (bank soal)
│   ├── styles/index.css      Tailwind + token desain
│   ├── env.d.ts              Tipe environment variable VITE_*
│   ├── App.tsx               (sementara) layar cek setup
│   └── main.tsx              Titik masuk: font, CSS, render
├── database.rules.json       Security Rules Realtime Database (sementara: tolak semua)
├── firebase.json             Konfigurasi Firebase CLI & port emulator
├── .firebaserc               Project default: demo-kuis-pasangan (khusus emulator)
├── .env.example              Contoh konfigurasi Firebase
├── eslint.config.js · .prettierrc.json · .prettierignore · .editorconfig
├── vite.config.ts            Vite + Tailwind + alias @/ + konfigurasi Vitest
└── tsconfig.json · tsconfig.app.json · tsconfig.node.json
```

**Aturan dependensi** (dari ADR di Fase 2): `screens → components/hooks → services/utils`. Folder `utils/` tidak boleh meng-*import* React atau Firebase, sehingga logikanya bisa diuji tanpa jaringan. Folder kosong diberi `.gitkeep` dan akan terisi di Fase 4.

---

## 4. Konfigurasi

### 4.1 TypeScript (`tsconfig.app.json`)
| Opsi | Alasan |
|---|---|
| `strict: true` | Default di TypeScript 6, tetapi ditulis eksplisit agar jelas bagi pembaca. |
| `noUncheckedIndexedAccess` | Akses `record[key]` bertipe `T \| undefined`. Penting karena data dari Firebase bisa kosong. |
| `noImplicitReturns` | Semua cabang fungsi harus mengembalikan nilai. |
| `paths: { "@/*": ["./src/*"] }` | Import rapi: `import { getTier } from '@/utils/scoring'`. Alias yang sama juga didaftarkan di `vite.config.ts`. |

### 4.2 ESLint (`eslint.config.js`)
| Lapisan | Fungsi |
|---|---|
| `@eslint/js` recommended | Aturan dasar JavaScript. |
| `typescript-eslint` **recommendedTypeChecked** | Aturan berbasis tipe, misalnya `no-floating-promises` yang menangkap penulisan ke Firebase yang lupa di-`await`. |
| `react-hooks`, `react-refresh` | Aturan Hooks dan Fast Refresh. |
| `jsx-a11y-x` recommended | Aksesibilitas JSX: `alt`, label, peran ARIA, dan sebagainya. |
| Aturan tambahan | `consistent-type-imports`, `eqeqeq`, `no-console` (kecuali `warn` dan `error`). |
| `eslint-config-prettier` (paling akhir) | Mematikan aturan gaya yang bentrok dengan Prettier. |

> Kedua aturan penting di atas sudah diverifikasi dengan file uji berisi pelanggaran yang disengaja. Promise yang lupa di-`await` dan `<img>` tanpa `alt` sama-sama tertangkap.

### 4.3 Prettier
`singleQuote`, `printWidth: 100`, dan selebihnya bawaan Prettier 3 (titik koma, *trailing comma*). Plugin Tailwind mengurutkan class otomatis. Folder `docs/` dikecualikan agar tabel dan diagram tidak diformat ulang.

### 4.4 Tailwind CSS v4 (`src/styles/index.css`)
- **Palet bawaan Tailwind dimatikan** (`--color-*: initial`). Hanya token desain yang bisa dipakai: `bg-kertas`, `text-tinta`, `text-tinta-pudar`, `bg-biru`, `bg-biru-tua`, `bg-kabut`, `border-benang`, `border-garis`, dan `text-bahaya`. Class seperti `bg-blue-600` tidak akan berfungsi, sehingga warna tidak bisa melenceng dari desain.
- **Font:** `font-serif` (Literata) dan `font-sans` (Plus Jakarta Sans).
- **Skala huruf:** `text-caption` 13, `text-label` 14, `text-body` 16, `text-question` 24, `text-title` 28, `text-display` 36, `text-score` 72.
- **Radius:** `rounded-option` (14px) dan `rounded-dialog` (24px). Untuk tombol berbentuk *pill* dipakai `rounded-full`.
- **Base:** *focus ring* biru 3px dan `prefers-reduced-motion` global.

### 4.5 Vitest
Lingkungan `node` (tanpa DOM), dengan file tes `src/**/*.test.ts`. *Coverage* diukur hanya untuk `src/utils/` dengan ambang 90% sesuai PRD. Script `test` sementara memakai `--passWithNoTests` karena belum ada tes.

### 4.6 Firebase
| File | Isi |
|---|---|
| `firebase.json` | Rules → `database.rules.json`. Emulator: Auth di port 9099, Database 9000, UI 4000. |
| `.firebaserc` | `default: demo-kuis-pasangan`. Project berawalan `demo-` membuat emulator berjalan **tanpa login dan tanpa project asli**. |
| `database.rules.json` | Sementara **menolak semua akses**. Rules final ditulis di Fase 4. |
| `.env.example` | `VITE_FIREBASE_*` dan `VITE_USE_EMULATORS`. Salin ke `.env.local`, yang tidak ikut di-*commit*. |

> ⚠️ **Catatan untuk Fase 4:** saat memakai emulator, Rules hanya berlaku pada *namespace* `demo-kuis-pasangan-default-rtdb`. Aplikasi harus terhubung ke `http://127.0.0.1:9000?ns=demo-kuis-pasangan-default-rtdb`. *Namespace* lain memakai aturan terbuka, sehingga uji keamanan akan memberi hasil yang menyesatkan.

---

## 5. Script npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan dengan *hot reload* (port 5173). |
| `npm run build` | Cek tipe, lalu build produksi ke `dist/`. |
| `npm run preview` | Menjalankan hasil build secara lokal (port 4173). |
| `npm run emulators` | Firebase Auth dan Database lokal, dengan UI di port 4000. |
| `npm run dev:lan` / `emulators:lan` | Sama seperti `dev` dan `emulators`, tetapi bisa dibuka dari HP di Wi-Fi yang sama (konfigurasi `firebase.lan.json`). Untuk uji di HP sungguhan sebelum *deploy*. Langkahnya di [04-qa-checklist.md §2.2](04-qa-checklist.md). |
| `npm run typecheck` | Cek tipe TypeScript saja. |
| `npm run lint` / `lint:fix` | ESLint, dengan opsi perbaikan otomatis. |
| `npm run format` / `format:check` | Prettier: tulis ulang format, atau hanya periksa. |
| `npm run test` / `test:watch` | Unit test Vitest: sekali jalan, atau mode pantau. |
| `npm run coverage` | Laporan *coverage* untuk `utils/` (ambang 90%). |
| `npm run test:integration` | Menyalakan emulator, menjalankan *integration test* (roomService + Security Rules), lalu mematikannya. |
| `npm run test:integration:attach` | Sama, tetapi memakai emulator yang **sudah berjalan** (`npm run emulators`). Data emulator akan dikosongkan. |
| `npm run audit:prod` | Audit keamanan khusus dependensi yang ikut ke pengguna. |
| `npm run check` | **Gerbang kualitas:** typecheck, lint, format:check, dan test. Wajib lolos sebelum *commit*. |

---

## 6. Panduan Membuat Project Firebase

> Langkah ini **belum wajib sekarang**. Fase 4 bisa sepenuhnya memakai emulator. Project asli baru dibutuhkan saat menguji di **dua HP sungguhan** dan saat *deploy* (Fase 6). Semua langkah gratis (paket Spark) dan tidak meminta kartu kredit.

1. **Buat project**
   1. Buka https://console.firebase.google.com, lalu klik **Create a project**.
   2. Nama: `kuis-pasangan` (ID project dibuat otomatis, misalnya `kuis-pasangan-a1b2c`).
   3. **Matikan Google Analytics**, karena tidak dibutuhkan dan sesuai prinsip privasi di PRD. Lalu klik **Create project**.
2. **Daftarkan aplikasi web**
   1. Di halaman *Project Overview*, klik ikon **`</>` (Web)**.
   2. Nickname: `kuis-pasangan-web`. **Jangan** centang Firebase Hosting, karena kita memakai Vercel.
   3. Klik **Register app**, lalu salin objek `firebaseConfig` yang muncul.
3. **Aktifkan login anonim**
   1. Buka **Build → Authentication → Get started → Sign-in method**.
   2. Pilih **Anonymous → Enable → Save**.
4. **Buat Realtime Database**
   1. Buka **Build → Realtime Database → Create Database**.
   2. Lokasi: **Singapore (asia-southeast1)**.
   3. Mode: **Start in locked mode**, lalu **Enable**.
   4. Salin URL database, misalnya `https://kuis-pasangan-a1b2c-default-rtdb.asia-southeast1.firebasedatabase.app`.
5. **Isi `.env.local`**
   ```env
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=kuis-pasangan-a1b2c.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://kuis-pasangan-a1b2c-default-rtdb.asia-southeast1.firebasedatabase.app
   VITE_FIREBASE_PROJECT_ID=kuis-pasangan-a1b2c
   VITE_FIREBASE_APP_ID=1:1234567890:web:abc123
   VITE_USE_EMULATORS=false
   ```
6. **Hubungkan Firebase CLI**
   ```bash
   npx firebase login                     # buka browser, login dengan akun Google
   npx firebase use --add                 # pilih project, beri alias: prod
   ```
   `default` tetap `demo-kuis-pasangan`, jadi perintah tanpa `--project prod` tidak akan pernah menyentuh database asli secara tidak sengaja. Rules di-*deploy* dengan `npx firebase deploy --only database --project prod`. Langkah lengkapnya ada di [05-deployment.md §2](05-deployment.md).

---

## 7. Hasil Verifikasi

| Pemeriksaan | Hasil |
|---|---|
| `npm run typecheck` | ✅ Lolos |
| `npm run lint` | ✅ Lolos. Aturan berbasis tipe dan a11y terbukti aktif. |
| `npm run format:check` | ✅ Semua file sesuai Prettier |
| `npm run test` | ✅ Berjalan (Vitest 5.1, belum ada file tes) |
| `npm run build` | ✅ JS **69 KB gzip** (target ≤ 200 KB), CSS 5,3 KB gzip |
| Render hasil build (Edge headless) | ✅ Token warna aktif, Literata dan Plus Jakarta Sans termuat dari file lokal |
| `npm run audit:prod` | ✅ **0 kerentanan** di dependensi produksi |
| `npm run emulators` | ✅ Auth (9099) dan Database (9000) siap. Rules sementara menolak baca dan tulis tanpa izin ("Permission denied"). |

---

## 8. Catatan Keputusan Teknis

| Topik | Keputusan | Alasan |
|---|---|---|
| Linter | ESLint (`--eslint`), bukan Oxlint bawaan create-vite 9 | Sesuai stack yang diminta, dan plugin a11y serta aturan berbasis tipe tersedia. |
| Plugin a11y | `eslint-plugin-jsx-a11y-x` (fork dari **es-tooling**) | `eslint-plugin-jsx-a11y` 6.10.2 belum mendukung ESLint 10. |
| `overrides` → `@grpc/grpc-js ^1.14.7` | Memaksa versi yang sudah diperbaiki | Kerentanan *high* berasal dari Firestore di dalam paket `firebase`. Kita tidak memakai Firestore, tetapi override ini membuat audit produksi bersih. `npm audit fix --force` malah menurunkan Firebase ke v9. |
| `overrides` → `minimatch ^11.0.9` untuk plugin a11y | Memaksa versi yang sudah diperbaiki | Lint sudah diverifikasi tetap berjalan setelah override. |
| `firebase-tools` sebagai devDependency | Dipasang lokal, tidak global | `npm install` langsung menyiapkan emulator, tanpa langkah global. Paket ini membawa 15 kerentanan *moderate* di dependensi internal CLI. Alat ini hanya berjalan di komputer pengembang dan tidak ikut ke *bundle* pengguna, jadi gerbang keamanannya adalah `npm run audit:prod`. |
| Literata `wght` (52 KB), bukan `opsz` (110 KB) | Lebih ringan | Demi target LCP di jaringan lambat. Perbedaan visualnya kecil. |
| Project `demo-kuis-pasangan` | Default untuk emulator | Pengembangan tanpa akun, dan tidak mungkin menyentuh data produksi secara tidak sengaja. |

---

## 9. Ekstensi VS Code yang Disarankan
Ekstensi berikut otomatis ditawarkan saat folder dibuka (`.vscode/extensions.json`): ESLint, Prettier, Tailwind CSS IntelliSense, Vitest Explorer, vsfire (sintaks Firebase Rules), Markdown Preview Mermaid, dan EditorConfig. Pengaturan proyek (`.vscode/settings.json`) memformat file saat disimpan dan menjalankan perbaikan ESLint otomatis.
