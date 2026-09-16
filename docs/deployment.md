# Panduan Deploy — Vercel

Dokumen ini dihasilkan oleh `scripts/apply-deploy-fix.sh`. Ringkasannya: repo
ini adalah monorepo pnpm; yang di-deploy ke Vercel hanyalah dashboard Next.js
(`@paperclip/web` di `apps/web`). API NestJS (`@paperclip/api`) **tidak**
di-deploy oleh project Vercel ini dan harus dihosting terpisah.

## 1. Pengaturan wajib di dashboard Vercel

| Pengaturan                | Nilai                                    |
| ------------------------- | ---------------------------------------- |
| Framework Preset          | Next.js (otomatis, dikunci di vercel.json) |
| Node.js Version           | 22.x (memenuhi `engines: >=20.19.0`)     |
| Root Directory            | `apps/web` **(disarankan)** atau root repo |

- **Root Directory = `apps/web` (disarankan).** Vercel memakai
  `apps/web/vercel.json` dan menemukan output `.next` secara otomatis. Ini pola
  resmi untuk monorepo Next.js (vercel.com/docs/monorepos). Perintah install/
  build tetap dijalankan dari root workspace via `cd ../..`, jadi lockfile
  tunggal `pnpm-lock.yaml` di root tetap dipakai.
- **Root Directory = root repo.** Vercel memakai `vercel.json` di root. Build
  berjalan, tetapi mode ini lebih rapuh pada monorepo; jika deployment gagal
  dengan `A "routes-manifest.json" couldn't be found`, pindah ke mode
  `apps/web`. Jangan mengembalikan `outputDirectory` — dok resmi Vercel untuk
  error tersebut justru meminta properti itu dihapus
  (github.com/vercel/vercel/blob/main/errors/now-next-routes-manifest.md).

## 2. Environment variables

| Variabel       | Wajib? | Keterangan |
| -------------- | ------ | ---------- |
| `API_URL`      | **Ya** | URL publik API NestJS (`https://…`). Tanpa ini, rewrite `/api/*` di `apps/web/next.config.mjs` mengarah ke `http://127.0.0.1:4000` — tidak ada server di sana pada environment serverless, jadi semua panggilan API gagal di runtime. |
| `DATABASE_URL` | Untuk API | Dipakai API/Prisma, bukan build web. Set di hosting API. |

Set di **Project Settings → Environment Variables** (Production + Preview).

## 3. Yang diperbaiki script ini

1. Menghapus `outputDirectory` dari `vercel.json` (penyebab error
   routes-manifest menurut dokumentasi resmi Vercel).
2. Bootstrap corepack sebelum memanggil pnpm — repo mem-pin `pnpm@11.27.0`
   lewat `packageManager`; corepack bawaan image lama gagal memverifikasinya
   (`Cannot find matching keyid`, lihat
   vercel.com/kb/guide/corepack-errors-github-actions).
3. Menyeragankan `vercel.json` root dan `apps/web/vercel.json`.
4. Build command memakai filter topologis `pnpm --filter @paperclip/web... build`
   (`@paperclip/shared` dibangun otomatis lebih dulu).

## 4. Verifikasi lokal

```bash
scripts/apply-deploy-fix.sh            # menerapkan fix + verifikasi build penuh
scripts/apply-deploy-fix.sh --no-verify
```
