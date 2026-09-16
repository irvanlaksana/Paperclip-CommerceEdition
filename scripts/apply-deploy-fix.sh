#!/usr/bin/env bash
#
# apply-deploy-fix.sh — Perbaikan konfigurasi deploy Vercel untuk monorepo
# pnpm + Next.js (Paperclip Commerce Edition).
#
# Yang diperbaiki:
#   1. Root vercel.json: menghapus `outputDirectory`. Dok resmi Vercel untuk
#      error "routes-manifest.json couldn't be found" menyatakan property ini
#      tidak boleh di-override untuk framework Next.js.
#      (github.com/vercel/vercel/blob/main/errors/now-next-routes-manifest.md)
#   2. Bootstrap corepack yang kuat: `npm install -g corepack@latest` sebelum
#      memanggil pnpm. Repo mem-pin pnpm@11.27.0 via `packageManager`; corepack
#      bawaan image lama gagal memverifikasi rilis pnpm baru
#      ("Cannot find matching keyid") — lihat KB Vercel:
#      vercel.com/kb/guide/corepack-errors-github-actions
#   3. Harmonisasi root vercel.json dan apps/web/vercel.json agar kedua mode
#      project Vercel (Root Directory = repo root ATAU apps/web) memakai
#      perintah yang sama dan benar.
#   4. Build command memakai filter topologis `--filter @paperclip/web...`
#      (membangun @paperclip/shared lebih dulu secara otomatis).
#
# Penggunaan:
#   scripts/apply-deploy-fix.sh [--no-verify]
#
#   --no-verify   Lewati langkah verifikasi (install + build lokal).
#
# Script ini idempoten: aman dijalankan berulang kali.

set -euo pipefail

VERIFY=1
for arg in "$@"; do
  case "$arg" in
    --no-verify) VERIFY=0 ;;
    -h|--help)
      sed -n '2,28p' "$0"
      exit 0
      ;;
    *)
      echo "[deploy-fix] Argumen tidak dikenal: $arg" >&2
      exit 2
      ;;
  esac
done

log()  { printf '\033[1;34m[deploy-fix]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[deploy-fix]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[deploy-fix]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Temukan root repo (folder yang memuat pnpm-workspace.yaml)
# ---------------------------------------------------------------------------
find_repo_root() {
  local dir="$1"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/pnpm-workspace.yaml" ] && [ -f "$dir/apps/web/package.json" ]; then
      printf '%s' "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-}"
if [ -z "$REPO_ROOT" ]; then
  REPO_ROOT="$(find_repo_root "$(pwd)")" \
    || REPO_ROOT="$(find_repo_root "$SCRIPT_DIR")" \
    || fail "Tidak menemukan root repo. Jalankan dari dalam repo, atau set REPO_ROOT=/path/ke/repo."
fi
cd "$REPO_ROOT"
log "Root repo: $REPO_ROOT"

# ---------------------------------------------------------------------------
# 2. Tulis konfigurasi Vercel yang sudah diperbaiki (idempoten)
# ---------------------------------------------------------------------------

# Bootstrap corepack yang aman:
#   - best-effort upgrade corepack (mengambil kunci penandatanganan npm terbaru)
#   - gagalnya bootstrap TIDAK fatal; corepack bawaan image tetap dipakai
#   - COREPACK_ENABLE_DOWNLOAD_PROMPT=0 mencegah prompt interaktif di lingkungan CI
COREPACK_BOOTSTRAP='(npm install -g corepack@latest && corepack enable) >/dev/null 2>&1 || true'
PNPM='COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm'

write_if_changed() {
  local path="$1" tmp
  tmp="$(mktemp)"
  cat > "$tmp"
  if [ -f "$path" ] && cmp -s "$tmp" "$path"; then
    log "  sudah up-to-date: $path"
    rm -f "$tmp"
  else
    mkdir -p "$(dirname "$path")"
    mv "$tmp" "$path"
    ok "  ditulis: $path"
  fi
}

# 2a. Root vercel.json — dipakai bila Root Directory project = root repo.
write_if_changed vercel.json <<EOF
{
  "\$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "${COREPACK_BOOTSTRAP}; ${PNPM} install --frozen-lockfile",
  "buildCommand": "${PNPM} --filter @paperclip/web... build"
}
EOF

# 2b. apps/web/vercel.json — dipakai bila Root Directory project = apps/web
#     (mode yang DISARANKAN untuk monorepo Next.js; vercel.com/docs/monorepos).
write_if_changed apps/web/vercel.json <<EOF
{
  "\$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "cd ../.. && ${COREPACK_BOOTSTRAP}; ${PNPM} install --frozen-lockfile",
  "buildCommand": "cd ../.. && ${PNPM} --filter @paperclip/web... build"
}
EOF

# 2c. Dokumentasi pengaturan deploy (setting dashboard tidak bisa diubah lewat repo).
write_if_changed docs/deployment.md <<'EOF'
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
EOF

# ---------------------------------------------------------------------------
# 3. Validasi JSON
# ---------------------------------------------------------------------------
log "Memvalidasi JSON…"
node -e "
  for (const f of ['vercel.json', 'apps/web/vercel.json']) {
    JSON.parse(require('node:fs').readFileSync(f, 'utf8'));
  }
" || fail "vercel.json tidak valid."
ok "  JSON valid."

# ---------------------------------------------------------------------------
# 4. Verifikasi: reproduksi persis langkah install + build Vercel
# ---------------------------------------------------------------------------
if [ "$VERIFY" -eq 1 ]; then
  log "Verifikasi install (frozen lockfile)…"
  COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm install --frozen-lockfile
  log "Verifikasi build (filter topologis, seperti di Vercel)…"
  COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm --filter @paperclip/web... build
  [ -f packages/shared/dist/index.js ]        || fail "Build @paperclip/shared tidak menghasilkan dist/index.js"
  [ -f apps/web/.next/routes-manifest.json ]  || fail "Build Next.js tidak menghasilkan routes-manifest.json"
  ok "  Build lokal berhasil — artefak lengkap."
else
  log "Verifikasi dilewati (--no-verify)."
fi

# ---------------------------------------------------------------------------
# 5. Checklist langkah manual (tidak bisa diotomasi dari repo)
# ---------------------------------------------------------------------------
cat <<'MSG'

────────────────────────────────────────────────────────────────────────────
Selesai. Checklist terakhir di dashboard Vercel (hanya bisa diubah di sana):

  1. Project Settings → General → Root Directory:
       set ke  apps/web            ← disarankan
       (jika dibiarkan root repo, vercel.json root tetap berlaku)
  2. Project Settings → General → Node.js Version:  22.x
  3. Project Settings → Environment Variables:
       API_URL = https://<url-api-nestjs-anda>   (Production + Preview)
  4. Redeploy (Redeploy → "Use existing Build Cache" boleh dimatikan
     untuk memastikan perubahan terbaca).
────────────────────────────────────────────────────────────────────────────
MSG
