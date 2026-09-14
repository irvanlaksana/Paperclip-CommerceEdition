/**
 * Minimal document-store contract used by the whole API.
 *
 * Three interchangeable drivers sit behind it:
 *   memory -> nothing persisted, fastest, good for tests
 *   file   -> JSON under .data/, the zero-setup default (survives restarts)
 *   prisma -> PostgreSQL through Prisma, the production path
 *
 * Because AI provider records, content runs and work products all go through
 * this interface, switching the persistence backend is a single env variable.
 */

export type Collection = 'providers' | 'runs' | 'workProducts' | 'products' | 'config';

export const COLLECTIONS: Collection[] = ['providers', 'runs', 'workProducts', 'products', 'config'];

export interface Storable {
  id: string;
}

export interface DataStore {
  readonly kind: 'memory' | 'file' | 'prisma';
  /** Perform any connection / directory setup. Safe to call repeatedly. */
  init(): Promise<void>;
  list<T extends Storable>(collection: Collection): Promise<T[]>;
  get<T extends Storable>(collection: Collection, id: string): Promise<T | null>;
  insert<T extends Storable>(collection: Collection, record: T): Promise<T>;
  update<T extends Storable>(collection: Collection, id: string, patch: Partial<T>): Promise<T | null>;
  remove(collection: Collection, id: string): Promise<boolean>;
  replaceAll<T extends Storable>(collection: Collection, records: T[]): Promise<void>;
  close?(): Promise<void>;
}

export function newId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}
