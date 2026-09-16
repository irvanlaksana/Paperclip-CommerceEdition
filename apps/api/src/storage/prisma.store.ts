import type { Collection, DataStore, Storable } from './data-store.js';

/**
 * PostgreSQL store (`DATA_DRIVER=prisma`).
 *
 * Maps the neutral document interface onto the typed Prisma models so the rest
 * of the API never learns which backend is active. Records are plain objects;
 * JSON-valued columns (input, stages, headers, payload) are passed through.
 */

type AnyRecord = Record<string, any> & { id: string };

interface CollectionMapping {
  delegate: string;
  /** Fields written to Prisma on create/update. */
  fields: string[];
  /** Turns a Prisma row into a store record. */
  from?: (row: any) => AnyRecord;
  /** Extra create-only data (relations, defaults). */
  extra?: (record: AnyRecord) => Record<string, any>;
}

const iso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value ?? new Date().toISOString());

const MAPPINGS: Record<Collection, CollectionMapping> = {
  providers: {
    delegate: 'aIProvider',
    fields: [
      'name',
      'type',
      'model',
      'endpoint',
      'apiKey',
      'enabled',
      'priority',
      'isDefault',
      'temperature',
      'maxTokens',
      'headers',
      'source',
      'lastTestAt',
      'lastTestStatus',
      'lastTestMessage',
      'lastTestLatencyMs',
    ],
  },

  runs: {
    delegate: 'contentRun',
    fields: [
      'productName',
      'status',
      'platforms',
      'locale',
      'tone',
      'providerType',
      'input',
      'stages',
      'error',
      'companyId',
    ],
  },

  workProducts: {
    delegate: 'workProduct',
    fields: [
      'title',
      'content',
      'type',
      'stage',
      'platform',
      'payload',
      'status',
      'providerType',
      'model',
      'issueId',
      'runId',
    ],
  },

  products: {
    delegate: 'product',
    fields: [
      'name',
      'description',
      'price',
      'currency',
      'sku',
      'imageUrl',
      'sourceUrl',
      'category',
      'tags',
      'attributes',
      'companyId',
    ],
    extra: (record) => ({ price: Number(record.price ?? 0) }),
  },

  config: {
    delegate: 'systemConfig',
    fields: ['key', 'value', 'category'],
    from: (row) => ({ id: row.id, key: row.key, value: row.value, category: row.category, updatedAt: iso(row.updatedAt) }),
  },
};

export class PrismaStore implements DataStore {
  readonly kind = 'prisma' as const;
  private client: any = null;

  async init(): Promise<void> {
    if (this.client) return;
    const db = await import('@paperclip/database');
    this.client = await db.createPrismaClient();
    await this.client.$connect();
  }

  private delegateFor(collection: Collection): any {
    const mapping = MAPPINGS[collection];
    const delegate = this.client?.[mapping.delegate];
    if (!delegate) {
      throw new Error(
        `Prisma delegate "${mapping.delegate}" tidak ditemukan. Jalankan \`pnpm db:generate\` lalu \`pnpm db:push\`.`,
      );
    }
    return delegate;
  }

  private toWriteData(collection: Collection, record: AnyRecord): Record<string, any> {
    const mapping = MAPPINGS[collection];
    const data: Record<string, any> = {};
    for (const field of mapping.fields) {
      if (record[field] !== undefined) data[field] = record[field];
    }
    return { ...data, ...(mapping.extra?.(record) ?? {}) };
  }

  private toRecord(collection: Collection, row: any): AnyRecord {
    const mapping = MAPPINGS[collection];
    if (mapping.from) return mapping.from(row);
    const record: AnyRecord = { ...row, id: row.id };
    for (const key of ['createdAt', 'updatedAt', 'lastTestAt']) {
      if (record[key] !== undefined && record[key] !== null) record[key] = iso(record[key]);
    }
    return record;
  }

  async list<T extends Storable>(collection: Collection): Promise<T[]> {
    const rows = await this.delegateFor(collection).findMany({
      orderBy: { createdAt: collection === 'config' ? undefined : 'desc' },
    });
    return rows.map((row: any) => this.toRecord(collection, row)) as T[];
  }

  async get<T extends Storable>(collection: Collection, id: string): Promise<T | null> {
    const row = await this.delegateFor(collection).findUnique({ where: { id } });
    return row ? (this.toRecord(collection, row) as T) : null;
  }

  async insert<T extends Storable>(collection: Collection, record: T): Promise<T> {
    const row = await this.delegateFor(collection).create({
      data: { id: (record as AnyRecord).id, ...this.toWriteData(collection, record as AnyRecord) },
    });
    return this.toRecord(collection, row) as T;
  }

  async update<T extends Storable>(collection: Collection, id: string, patch: Partial<T>): Promise<T | null> {
    const existing = await this.get<T>(collection, id);
    if (!existing) return null;
    const row = await this.delegateFor(collection).update({
      where: { id },
      data: this.toWriteData(collection, { ...(existing as AnyRecord), ...(patch as AnyRecord) }),
    });
    return this.toRecord(collection, row) as T;
  }

  async remove(collection: Collection, id: string): Promise<boolean> {
    try {
      await this.delegateFor(collection).delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async replaceAll<T extends Storable>(collection: Collection, records: T[]): Promise<void> {
    const delegate = this.delegateFor(collection);
    await delegate.deleteMany({});
    for (const record of records) await this.insert(collection, record);
  }

  async close(): Promise<void> {
    if (!this.client) return;
    await this.client.$disconnect();
    this.client = null;
  }
}
