# Kuis Pasangan

Kuis real-time untuk pasangan LDR. Masing-masing main dari HP sendiri, menjawab 10 pertanyaan yang sama, dan setiap jawaban dibuka bersamaan begitu keduanya selesai memilih.

React + Vite + TypeScript · Tailwind CSS v4 · Firebase Realtime Database + Anonymous Auth · Vitest

## Menjalankan secara lokal

Butuh Node.js ≥ 22.12 dan Java 21 (untuk Firebase Emulator).

```bash
npm install
cp .env.example .env.local
npm run emulators   # terminal 1, UI: http://127.0.0.1:4000
npm run dev         # terminal 2, app: http://localhost:5173
```

Sebelum commit, pastikan `npm run check` lolos.

## Dokumentasi

1. [PRD](docs/01-PRD.md): tujuan, ruang lingkup, requirement
2. [System Design](docs/02-system-design.md): arsitektur, alur, model data, panduan UI/UX
3. [Setup](docs/03-setup.md): stack, struktur folder, konfigurasi, panduan Firebase
4. [Checklist QA](docs/04-qa-checklist.md): hasil uji otomatis, checklist uji manual di HP, edge case, audit Lighthouse
5. [Deployment & Maintenance](docs/05-deployment.md): push ke GitHub, Firebase produksi, Vercel + auto-deploy, pemeliharaan, ide v2.0
6. [Pratinjau visual](docs/design-preview.html): buka di browser
