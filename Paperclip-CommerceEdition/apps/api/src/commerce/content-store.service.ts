import { Injectable, Logger } from '@nestjs/common';
import { DataStoreService } from '../storage/data-store.service.js';
import { newId } from '../storage/data-store.js';
import type { ContentRunStatus, PipelineStage, WorkProductStatus } from '@paperclip/shared';
import { toRunDTO, type RunRecord, type WorkProductRecord } from './content/records.js';

/**
 * Persistence for content runs and their work products.
 * Writes through the DataStoreService, so the same code works on the JSON file
 * store in development and on PostgreSQL in production.
 */
@Injectable()
export class ContentStoreService {
  private readonly logger = new Logger(ContentStoreService.name);

  constructor(private readonly store: DataStoreService) {}

  /* --------------------------------- runs --------------------------------- */

  async createRun(init: Omit<RunRecord, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: ContentRunStatus }): Promise<RunRecord> {
    const now = new Date().toISOString();
    const record: RunRecord = {
      id: newId('run'),
      status: init.status ?? 'QUEUED',
      createdAt: now,
      updatedAt: now,
      ...init,
    } as RunRecord;
    return this.store.insert<RunRecord>('runs', record);
  }

  async getRun(id: string): Promise<RunRecord | null> {
    return this.store.get<RunRecord>('runs', id);
  }

  async listRuns(limit = 25): Promise<RunRecord[]> {
    const all = await this.store.list<RunRecord>('runs');
    return all
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, Math.max(1, limit));
  }

  async patchRun(id: string, patch: Partial<RunRecord>): Promise<RunRecord | null> {
    return this.store.update<RunRecord>('runs', id, { ...patch, updatedAt: new Date().toISOString() });
  }

  async updateStage(
    runId: string,
    stage: PipelineStage,
    patch: (current: any) => any,
  ): Promise<RunRecord | null> {
    const run = await this.getRun(runId);
    if (!run) return null;
    const stages = (run.stages ?? []).map((s) => (s.stage === stage ? { ...s, ...patch(s) } : s));
    return this.patchRun(runId, { stages });
  }

  async deleteRun(id: string): Promise<boolean> {
    const products = await this.listWorkProducts(id);
    for (const wp of products) await this.store.remove('workProducts', wp.id);
    return this.store.remove('runs', id);
  }

  /* ----------------------------- work products ---------------------------- */

  async addWorkProducts(runId: string, items: Array<Omit<WorkProductRecord, 'id' | 'runId' | 'createdAt' | 'updatedAt'>>): Promise<WorkProductRecord[]> {
    const now = new Date().toISOString();
    const created: WorkProductRecord[] = [];
    for (const item of items) {
      const record: WorkProductRecord = {
        id: newId('wp'),
        runId,
        createdAt: now,
        updatedAt: now,
        ...item,
      } as WorkProductRecord;
      created.push(await this.store.insert<WorkProductRecord>('workProducts', record));
    }
    return created;
  }

  async listWorkProducts(runId?: string): Promise<WorkProductRecord[]> {
    const all = await this.store.list<WorkProductRecord>('workProducts');
    return runId ? all.filter((wp) => wp.runId === runId) : all;
  }

  async setWorkProductStatus(id: string, status: WorkProductStatus): Promise<WorkProductRecord | null> {
    return this.store.update<WorkProductRecord>('workProducts', id, {
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  /* --------------------------------- views -------------------------------- */

  async toDTO(run: RunRecord) {
    const workProducts = await this.listWorkProducts(run.id);
    return toRunDTO(run, workProducts);
  }

  async getRunDTO(id: string) {
    const run = await this.getRun(id);
    return run ? this.toDTO(run) : null;
  }
}
