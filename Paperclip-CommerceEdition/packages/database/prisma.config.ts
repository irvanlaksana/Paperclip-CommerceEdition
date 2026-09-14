import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 configuration.
 *
 * In Prisma 7 the connection URL moved out of `schema.prisma` into this file.
 * `prisma migrate` / `prisma db push` read it from here, while the application
 * runtime connects through the driver adapter in `src/client.ts`.
 *
 * `env("DATABASE_URL")` throws when the variable is missing, which breaks
 * commands that never touch a database (`generate`, `format`, `validate`).
 * We therefore fall back to an explicit local placeholder and warn, so codegen
 * works on a fresh clone before anyone has created a `.env`.
 */
const PLACEHOLDER_URL = 'postgresql://postgres:postgres@localhost:5432/paperclip?schema=public';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    '[prisma.config] DATABASE_URL belum di-set. Memakai placeholder lokal - ' +
      'perintah yang butuh koneksi (migrate/db push) akan gagal sampai .env diisi.',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl ?? PLACEHOLDER_URL,
  },
});
