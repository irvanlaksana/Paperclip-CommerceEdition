import 'dotenv/config';

/**
 * Runtime connection factory for Prisma 7.
 *
 * Prisma 7 no longer reads the connection URL from the schema, so the client is
 * constructed with an explicit driver adapter. The generated client is imported
 * through a computed specifier on purpose: that keeps this package compiling
 * even before `pnpm db:generate` has been run, which matters because the API
 * only touches Prisma when DATA_DRIVER=prisma.
 */

export type PrismaClientLike = {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  [model: string]: any;
};

const GENERATED_CLIENT = '../generated/prisma/client.js';

let cached: PrismaClientLike | null = null;

export function isPrismaConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function createPrismaClient(connectionString?: string): Promise<PrismaClientLike> {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL belum di-set. Prisma driver butuh connection string PostgreSQL, ' +
        'atau gunakan DATA_DRIVER=file untuk mode tanpa database.',
    );
  }

  if (cached) return cached;

  const [{ PrismaPg }, clientModule] = await Promise.all([
    import('@prisma/adapter-pg'),
    import(GENERATED_CLIENT),
  ]);

  if (!clientModule?.PrismaClient) {
    throw new Error(
      'Prisma client belum di-generate. Jalankan `pnpm db:generate` di packages/database.',
    );
  }

  const adapter = new PrismaPg({ connectionString: url });
  cached = new clientModule.PrismaClient({ adapter }) as PrismaClientLike;
  return cached;
}

export async function disconnectPrisma(): Promise<void> {
  if (!cached) return;
  await cached.$disconnect();
  cached = null;
}

export { GENERATED_CLIENT as PRISMA_CLIENT_PATH };
