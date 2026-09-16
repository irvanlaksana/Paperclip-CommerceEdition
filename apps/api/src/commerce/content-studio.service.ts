import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CONTENT_PLATFORMS,
  CONTENT_TONES,
  PIPELINE_STAGES,
  STAGE_META,
  isAIProviderType,
  type ContentPlatform,
  type ContentRunDTO,
  type ContentRunInput,
  type ContentTone,
  type PipelineStage,
  type StageResult,
  type WorkProductStatus,
} from '@paperclip/shared';
import { AgentService } from '../agents/agent.service.js';
import { AIProviderService, type ProviderSelector } from '../ai/ai-provider.service.js';
import { AiConfigService } from '../ai/ai-config.service.js';
import { ContentStoreService } from './content-store.service.js';
import { ProductService } from './product.service.js';
import { getStageHandler, resolveStageOrder, type NewWorkProduct, type StageContext } from './content/stages.js';
import type { RunRecord } from './content/records.js';

/**
 * Content Studio orchestrator.
 *
 * A run walks the registered pipeline stages in dependency order
 * (RESEARCH -> CAPTIONS -> SEO -> VISUAL -> SCHEDULE), persists each result as
 * a WorkProduct in DRAFT status, and streams progress into the run record so
 * the UI can poll while generation is still happening.
 *
 * One stage failing never kills the run: it is marked FAILED, dependents are
 * SKIPPED, and the run finishes as PARTIAL.
 */
@Injectable()
export class ContentStudioService {
  private readonly logger = new Logger(ContentStudioService.name);
  /** Guards against two workers executing the same run at once. */
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly ai: AIProviderService,
    private readonly aiConfig: AiConfigService,
    private readonly store: ContentStoreService,
    private readonly products: ProductService,
    private readonly agentService: AgentService,
  ) {}

  /* ------------------------------ public API ------------------------------ */

  async startRun(input: ContentRunInput): Promise<ContentRunDTO> {
    const normalized = await this.normalizeInput(input);
    const stages = this.initialStages(normalized);
    const defaultProvider = await this.aiConfig.resolveDefault();

    const run = await this.store.createRun({
      productName: normalized.product.name,
      status: 'QUEUED',
      platforms: normalized.platforms,
      locale: normalized.locale ?? 'id-ID',
      tone: normalized.tone ?? 'casual',
      providerType: normalized.providerType ?? defaultProvider.type,
      input: normalized,
      stages,
      error: null,
      companyId: null,
    });

    this.logger.log(
      `Run ${run.id} dibuat: "${run.productName}" | ${run.platforms.join(', ')} | provider ${run.providerType}`,
    );

    // Fire and forget: the client polls GET /content/runs/:id for progress.
    void this.executeRun(run.id).catch((err) =>
      this.logger.error(`Run ${run.id} gagal: ${err?.message ?? err}`),
    );

    return this.store.toDTO(run);
  }

  async executeRun(runId: string): Promise<ContentRunDTO> {
    const run = await this.store.getRun(runId);
    if (!run) throw new NotFoundException(`Run "${runId}" tidak ditemukan.`);
    if (this.inFlight.has(runId)) {
      this.logger.warn(`Run ${runId} sedang berjalan, permintaan kedua diabaikan.`);
      return this.store.toDTO(run);
    }

    this.inFlight.add(runId);
    const startedAt = Date.now();

    try {
      await this.store.patchRun(runId, { status: 'RUNNING', error: null });

      const provider = await this.resolveProvider(run);
      const research = this.extractResearch(run);
      // `run.stages` is the snapshot taken before execution started, so stage
      // outcomes are tracked here to make dependency checks see fresh state.
      const stageStatus = new Map<PipelineStage, StageResult['status']>(
        run.stages.map((stage) => [stage.stage, stage.status]),
      );
      const context: StageContext = {
        input: run.input,
        research,
        ai: this.ai,
        provider,
        log: (message) => this.logger.debug(`[${runId}] ${message}`),
      };

      let succeeded = 0;
      let failed = 0;

      for (const stageResult of run.stages) {
        const stage = stageResult.stage;

        if (stageResult.status === 'SKIPPED') continue;

        // A dependency that failed means this stage cannot produce good output.
        const handler = getStageHandler(stage);
        const blockedBy = (handler?.dependsOn ?? []).filter(
          (dep) => stageStatus.get(dep) === 'FAILED',
        );

        if (blockedBy.length) {
          stageStatus.set(stage, 'SKIPPED');
          await this.markStage(runId, stage, {
            status: 'SKIPPED',
            error: `Dilewati karena tahap ${blockedBy.join(', ')} gagal.`,
          });
          continue;
        }

        stageStatus.set(stage, 'RUNNING');
        await this.markStage(runId, stage, { status: 'RUNNING', startedAt: new Date().toISOString() });
        const stageStarted = Date.now();

        try {
          const outcome = await handler!.run(context);

          const workProducts: NewWorkProduct[] = (outcome.workProducts ?? []).map((wp) => ({
            ...wp,
            status: 'DRAFT' as WorkProductStatus,
            providerType: outcome.providerType ?? null,
            model: outcome.model ?? null,
          })) as Array<NewWorkProduct & { status: WorkProductStatus }>;

          await this.store.addWorkProducts(
            runId,
            workProducts.map((wp) => ({
              type: wp.type,
              stage: wp.stage,
              platform: wp.platform ?? null,
              title: wp.title,
              content: wp.content,
              payload: wp.payload,
              status: 'DRAFT',
              providerType: outcome.providerType ?? null,
              model: outcome.model ?? null,
            })),
          );

          // Research output feeds every later stage.
          if (stage === 'RESEARCH') context.research = outcome.data as any;

          await this.markStage(runId, stage, {
            status: 'DONE',
            data: outcome.data as StageResult['data'],
            providerType: outcome.providerType,
            model: outcome.model,
            usage: outcome.usage,
            viaFallback: outcome.viaFallback,
            finishedAt: new Date().toISOString(),
            durationMs: Date.now() - stageStarted,
            error: undefined,
          });

          stageStatus.set(stage, 'DONE');
          succeeded++;
          this.logger.log(
            `Run ${runId} tahap ${stage} selesai (${Date.now() - stageStarted}ms, ${outcome.workProducts?.length ?? 0} work product).`,
          );
        } catch (err: any) {
          stageStatus.set(stage, 'FAILED');
          failed++;
          const message = err?.message ?? String(err);
          this.logger.error(`Run ${runId} tahap ${stage} gagal: ${message}`);
          await this.markStage(runId, stage, {
            status: 'FAILED',
            error: message,
            finishedAt: new Date().toISOString(),
            durationMs: Date.now() - stageStarted,
          });
        }
      }

      const status = failed === 0 ? 'COMPLETED' : succeeded > 0 ? 'PARTIAL' : 'FAILED';
      const finalRun = await this.store.patchRun(runId, {
        status,
        error: failed ? `${failed} tahap gagal; lihat detail per tahap.` : null,
      });

      this.logger.log(
        `Run ${runId} ${status} dalam ${Date.now() - startedAt}ms (${succeeded} sukses, ${failed} gagal).`,
      );

      return this.store.toDTO(finalRun ?? (await this.store.getRun(runId))!);
    } catch (err: any) {
      await this.store.patchRun(runId, {
        status: 'FAILED',
        error: err?.message ?? String(err),
      });
      throw err;
    } finally {
      this.inFlight.delete(runId);
    }
  }

  async getRun(id: string): Promise<ContentRunDTO> {
    const dto = await this.store.getRunDTO(id);
    if (!dto) throw new NotFoundException(`Run "${id}" tidak ditemukan.`);
    return dto;
  }

  async listRuns(limit = 25): Promise<ContentRunDTO[]> {
    const runs = await this.store.listRuns(limit);
    return Promise.all(runs.map((run) => this.store.toDTO(run)));
  }

  async deleteRun(id: string): Promise<{ deleted: boolean; id: string }> {
    const deleted = await this.store.deleteRun(id);
    return { deleted, id };
  }

  async setWorkProductStatus(id: string, status: WorkProductStatus) {
    const updated = await this.store.setWorkProductStatus(id, status);
    if (!updated) throw new NotFoundException(`Work product "${id}" tidak ditemukan.`);
    return updated;
  }

  /** Stage metadata for the UI (labels, descriptions, order). */
  describePipeline() {
    return PIPELINE_STAGES.map((stage) => ({
      stage,
      ...STAGE_META[stage],
      dependsOn: getStageHandler(stage)?.dependsOn ?? [],
    }));
  }

  /* --------------------------- legacy entry point --------------------------- */

  /**
   * Kept for backwards compatibility with the original single-platform API.
   * Now it runs the real pipeline (RESEARCH + CAPTIONS) for one platform.
   */
  async generateSocialContent(
    productId: string,
    platform: ContentPlatform = 'INSTAGRAM',
    provider?: ProviderSelector,
  ) {
    const product = await this.products.get(productId);
    const run = await this.startRun({
      product,
      platforms: [platform],
      stages: ['RESEARCH', 'CAPTIONS'],
      providerType: typeof provider === 'string' && isAIProviderType(provider) ? provider : undefined,
      locale: 'id-ID',
      tone: 'casual',
      includeHashtags: true,
    });

    const finished = await this.waitForRun(run.id);
    const caption = finished.workProducts.find((wp) => wp.type === 'CAPTION');

    return {
      runId: finished.id,
      platform,
      content: caption?.content ?? '',
      hashtags: ((caption?.payload as any)?.hashtags ?? []) as string[],
      status: finished.status,
    };
  }

  /** Convenience for callers that need the final state (tests, agents). */
  async waitForRun(runId: string, timeoutMs = 180_000): Promise<ContentRunDTO> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const dto = await this.getRun(runId);
      if (dto.status === 'COMPLETED' || dto.status === 'PARTIAL' || dto.status === 'FAILED') return dto;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Run ${runId} tidak selesai dalam ${timeoutMs}ms.`);
  }

  /* -------------------------------- helpers -------------------------------- */

  private async resolveProvider(run: RunRecord): Promise<ProviderSelector> {
    // Agent-bound providers win, then the run-level override, then the default.
    const agent = await this.agentService.defaultContentAgent();
    if (agent.providerType && isAIProviderType(agent.providerType)) return agent.providerType;
    if (run.providerType && isAIProviderType(run.providerType)) return run.providerType;
    return null;
  }

  private extractResearch(run: RunRecord): any | undefined {
    const research = run.stages.find((s) => s.stage === 'RESEARCH' && s.status === 'DONE');
    return research?.data;
  }

  private async markStage(runId: string, stage: PipelineStage, patch: Partial<StageResult>): Promise<void> {
    await this.store.updateStage(runId, stage, (current) => ({ ...current, ...patch }));
  }

  /**
   * Every stage the run will visit, in execution order. `resolveStageOrder`
   * pulls in dependencies, so requesting only CAPTIONS still schedules
   * RESEARCH; everything else is marked SKIPPED up front.
   */
  private initialStages(input: ContentRunInput): StageResult[] {
    const active = new Set(resolveStageOrder(input.stages));
    return PIPELINE_STAGES.map((stage) => ({
      stage,
      status: active.has(stage) ? ('PENDING' as const) : ('SKIPPED' as const),
    }));
  }

  private async normalizeInput(input: ContentRunInput): Promise<ContentRunInput> {
    if (!input || typeof input !== 'object') throw new BadRequestException('Body permintaan tidak valid.');

    let product = input.product;

    // Allow { product: { id } } or a bare productId string.
    const rawProduct: any = input.product;
    if (typeof rawProduct === 'string') {
      product = await this.products.get(rawProduct);
    } else if (rawProduct?.id && !rawProduct?.name) {
      product = await this.products.get(rawProduct.id);
    } else if (rawProduct?.id && rawProduct?.name) {
      // Enrich with stored data when the client only sent a partial product.
      const stored = await this.products.get(rawProduct.id).catch(() => null);
      if (stored) product = { ...stored, ...rawProduct };
    }

    if (!product?.name?.trim()) {
      throw new BadRequestException('Nama produk wajib diisi.');
    }

    const platforms = (input.platforms ?? ['INSTAGRAM']).filter((p): p is ContentPlatform =>
      (CONTENT_PLATFORMS as readonly string[]).includes(p),
    );
    if (platforms.length === 0) {
      throw new BadRequestException(`Platform tidak valid. Pilihan: ${CONTENT_PLATFORMS.join(', ')}`);
    }

    const tone = (CONTENT_TONES as readonly string[]).includes(input.tone ?? '')
      ? (input.tone as ContentTone)
      : 'casual';

    const stages = (input.stages ?? []).filter((s): s is PipelineStage =>
      (PIPELINE_STAGES as readonly string[]).includes(s),
    );

    if (input.providerType && !isAIProviderType(input.providerType)) {
      throw new BadRequestException(`Provider AI "${input.providerType}" tidak dikenal.`);
    }

    return {
      ...input,
      product,
      platforms,
      tone,
      stages: stages.length ? stages : undefined,
      locale: input.locale ?? 'id-ID',
      includeHashtags: input.includeHashtags ?? true,
    };
  }
}
