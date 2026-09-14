import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FileStore } from './file.store.js';
import { MemoryStore } from './memory.store.js';
import { PrismaStore } from './prisma.store.js';
import type { Collection, DataStore, Storable } from './data-store.js';

export type DataDriver = 'memory' | 'file' | 'prisma';

/**
 * Persistence facade. Picks a driver from `DATA_DRIVER` and exposes the same
 * document API to every service, so AI provider records, content runs and work
 * products all survive restarts without the app depending on PostgreSQL.
 */
@Injectable()
export class DataStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DataStoreService.name);
  private readonly store: DataStore;
  readonly kind: DataDriver;

  constructor() {
    const requested = (process.env.DATA_DRIVER ?? 'file').toLowerCase() as DataDriver;
    this.kind = requested;

    switch (requested) {
      case 'memory':
        this.store = new MemoryStore();
        break;
      case 'prisma':
        this.store = new PrismaStore();
        break;
      case 'file':
      default:
        if (requested !== 'file') {
          this.logger.warn(`DATA_DRIVER="${requested}" tidak dikenal, memakai "file".`);
        }
        this.store = new FileStore(process.env.DATA_DIR ?? '.data');
        break;
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.store.init();
      this.logger.log(`Data store aktif: ${this.kind}${this.describeLocation()}`);
    } catch (err: any) {
      this.logger.error(
        `Gagal menginisialisasi data store "${this.kind}": ${err?.message ?? err}`,
      );
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.store.close?.();
  }

  private describeLocation(): string {
    if (this.store instanceof FileStore) return ` → ${this.store.directory}`;
    if (this.kind === 'prisma') return ' → PostgreSQL';
    return ' → in-memory (data hilang saat restart)';
  }

  list<T extends Storable>(collection: Collection): Promise<T[]> {
    return this.store.list<T>(collection);
  }

  get<T extends Storable>(collection: Collection, id: string): Promise<T | null> {
    return this.store.get<T>(collection, id);
  }

  insert<T extends Storable>(collection: Collection, record: T): Promise<T> {
    return this.store.insert<T>(collection, record);
  }

  update<T extends Storable>(collection: Collection, id: string, patch: Partial<T>): Promise<T | null> {
    return this.store.update<T>(collection, id, patch);
  }

  remove(collection: Collection, id: string): Promise<boolean> {
    return this.store.remove(collection, id);
  }

  replaceAll<T extends Storable>(collection: Collection, records: T[]): Promise<void> {
    return this.store.replaceAll<T>(collection, records);
  }

  /** Exposed for /health so the UI can show where data lives. */
  describe(): { driver: DataDriver; location: string } {
    return {
      driver: this.kind,
      location:
        this.store instanceof FileStore ? this.store.directory : this.kind === 'prisma' ? 'postgresql' : 'memory',
    };
  }
}
