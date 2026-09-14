import type { Collection, DataStore, Storable } from './data-store.js';

/** Volatile store. Used by unit tests and as the shape reference. */
export class MemoryStore implements DataStore {
  /** Widened so subclasses (FileStore) can narrow it. */
  readonly kind: DataStore['kind'] = 'memory';
  protected readonly data = new Map<Collection, Map<string, any>>();

  async init(): Promise<void> {
    /* nothing to do */
  }

  protected bucket(collection: Collection): Map<string, any> {
    let bucket = this.data.get(collection);
    if (!bucket) {
      bucket = new Map();
      this.data.set(collection, bucket);
    }
    return bucket;
  }

  async list<T extends Storable>(collection: Collection): Promise<T[]> {
    return [...this.bucket(collection).values()] as T[];
  }

  async get<T extends Storable>(collection: Collection, id: string): Promise<T | null> {
    return (this.bucket(collection).get(id) as T) ?? null;
  }

  async insert<T extends Storable>(collection: Collection, record: T): Promise<T> {
    this.bucket(collection).set(record.id, structuredClone(record));
    return record;
  }

  async update<T extends Storable>(collection: Collection, id: string, patch: Partial<T>): Promise<T | null> {
    const existing = this.bucket(collection).get(id);
    if (!existing) return null;
    const next = { ...existing, ...patch, id };
    this.bucket(collection).set(id, next);
    return next as T;
  }

  async remove(collection: Collection, id: string): Promise<boolean> {
    return this.bucket(collection).delete(id);
  }

  async replaceAll<T extends Storable>(collection: Collection, records: T[]): Promise<void> {
    const bucket = this.bucket(collection);
    bucket.clear();
    for (const record of records) bucket.set(record.id, structuredClone(record));
  }
}
