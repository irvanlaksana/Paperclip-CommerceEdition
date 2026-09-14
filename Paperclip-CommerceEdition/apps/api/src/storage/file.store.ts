import { existsSync, mkdirSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { MemoryStore } from './memory.store.js';
import type { Collection, DataStore, Storable } from './data-store.js';

/**
 * JSON-file backed store - the zero-setup default (`DATA_DRIVER=file`).
 *
 * Loads everything into memory on init and writes through on every mutation
 * using a temp-file + rename so a crash mid-write cannot corrupt the data.
 */
export class FileStore extends MemoryStore {
  override readonly kind: DataStore['kind'] = 'file';
  private readonly dir: string;
  private readonly writeQueue = new Map<Collection, Promise<void>>();

  constructor(dataDir = '.data', private readonly cwd = process.cwd()) {
    super();
    this.dir = isAbsolute(dataDir) ? dataDir : resolve(cwd, dataDir);
  }

  get directory(): string {
    return this.dir;
  }

  override async init(): Promise<void> {
    mkdirSync(this.dir, { recursive: true });
    for (const collection of ['providers', 'runs', 'workProducts', 'products', 'config'] as Collection[]) {
      const file = this.fileFor(collection);
      if (!existsSync(file)) continue;
      try {
        const raw = await readFile(file, 'utf8');
        const parsed = JSON.parse(raw);
        const records: Storable[] = Array.isArray(parsed) ? parsed : [];
        const bucket = this.bucket(collection);
        bucket.clear();
        for (const record of records) {
          if (record?.id) bucket.set(record.id, record);
        }
      } catch (err: any) {
        // A corrupt file must not stop the API from booting.
        console.warn(`[FileStore] ${file} tidak bisa dibaca (${err?.message}); mulai dari kosong.`);
      }
    }
  }

  private fileFor(collection: Collection): string {
    return join(this.dir, `${collection}.json`);
  }

  private persist(collection: Collection): void {
    const file = this.fileFor(collection);
    const records = [...this.bucket(collection).values()];
    // Serialize writes per collection to avoid interleaved rename storms.
    const previous = this.writeQueue.get(collection) ?? Promise.resolve();
    const next = previous
      .then(async () => {
        mkdirSync(dirname(file), { recursive: true });
        const tmp = `${file}.${process.pid}.tmp`;
        await writeFile(tmp, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
        await rename(tmp, file);
      })
      .catch((err) => {
        console.error(`[FileStore] gagal menulis ${file}:`, err?.message ?? err);
      });
    this.writeQueue.set(collection, next);
  }

  override async insert<T extends Storable>(collection: Collection, record: T): Promise<T> {
    const result = await super.insert(collection, record);
    this.persist(collection);
    return result;
  }

  override async update<T extends Storable>(collection: Collection, id: string, patch: Partial<T>): Promise<T | null> {
    const result = await super.update(collection, id, patch);
    if (result) this.persist(collection);
    return result;
  }

  override async remove(collection: Collection, id: string): Promise<boolean> {
    const removed = await super.remove(collection, id);
    if (removed) this.persist(collection);
    return removed;
  }

  override async replaceAll<T extends Storable>(collection: Collection, records: T[]): Promise<void> {
    await super.replaceAll(collection, records);
    this.persist(collection);
  }

  /** Wait until all queued writes hit disk (used before process exit). */
  async flush(): Promise<void> {
    await Promise.all([...this.writeQueue.values()]);
  }
}
