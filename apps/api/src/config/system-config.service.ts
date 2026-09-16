import { Injectable } from '@nestjs/common';
import { DataStoreService } from '../storage/data-store.service.js';

export interface ConfigRecord {
  id: string;
  key: string;
  category: string;
  value: string;
  updatedAt: string;
}

export const INFRASTRUCTURE_OPTIONS = {
  database: ['PostgreSQL', 'MySQL', 'MariaDB', 'SQLite', 'Supabase', 'Neon'],
  storage: ['Local Storage', 'AWS S3', 'Cloudflare R2', 'MinIO', 'Supabase Storage'],
  runtime: ['Docker', 'Kubernetes', 'Railway', 'Coolify', 'VPS', 'Render', 'Fly.io', 'Localhost'],
} as const;

const DEFAULTS = {
  database: 'PostgreSQL',
  storage: 'Local Storage',
  runtime: 'Docker',
};

/**
 * Key/value application settings (the "Dynamic Selectors" from the docs).
 * Persisted through the data store so a choice made in the Settings UI survives
 * restarts, in both the JSON-file and the Prisma backend.
 */
@Injectable()
export class SystemConfigService {
  private readonly prefix = 'infra:';

  constructor(private readonly store: DataStoreService) {}

  async getInfrastructure(): Promise<{ database: string; storage: string; runtime: string; updatedAt?: string }> {
    const record = await this.store.get<ConfigRecord>('config', `${this.prefix}structure`);
    if (!record?.value) return { ...DEFAULTS };
    try {
      return { ...DEFAULTS, ...JSON.parse(record.value), updatedAt: record.updatedAt };
    } catch {
      return { ...DEFAULTS };
    }
  }

  async saveInfrastructure(patch: Partial<{ database: string; storage: string; runtime: string }>) {
    const current = await this.getInfrastructure();
    const next = { ...current, ...patch };
    delete (next as any).updatedAt;

    const record: ConfigRecord = {
      id: `${this.prefix}structure`,
      key: `${this.prefix}structure`,
      category: 'INFRASTRUCTURE',
      value: JSON.stringify(next),
      updatedAt: new Date().toISOString(),
    };

    const existing = await this.store.get<ConfigRecord>('config', record.id);
    if (existing) await this.store.update<ConfigRecord>('config', record.id, record);
    else await this.store.insert<ConfigRecord>('config', record);

    return { ...next, updatedAt: record.updatedAt };
  }

  options() {
    return INFRASTRUCTURE_OPTIONS;
  }
}
