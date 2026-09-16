import type {
  ContentPlatform,
  ContentRunDTO,
  ContentRunStatus,
  ContentTone,
  PipelineStage,
  StageResult,
  WorkProductDTO,
  WorkProductStatus,
  WorkProductType,
} from '@paperclip/shared';
import type { AIProviderType, ContentRunInput } from '@paperclip/shared';
import type { Storable } from '../../storage/data-store.js';

/** Persisted content pipeline run. */
export interface RunRecord extends Storable {
  productName: string;
  status: ContentRunStatus;
  platforms: ContentPlatform[];
  locale: string;
  tone: ContentTone;
  providerType?: AIProviderType | null;
  input: ContentRunInput;
  stages: StageResult[];
  error?: string | null;
  companyId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Persisted output artefact produced by one pipeline stage. */
export interface WorkProductRecord extends Storable {
  runId: string;
  type: WorkProductType;
  stage: PipelineStage;
  platform?: ContentPlatform | null;
  title: string;
  content: string;
  payload?: unknown;
  status: WorkProductStatus;
  providerType?: AIProviderType | null;
  model?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toWorkProductDTO(record: WorkProductRecord): WorkProductDTO {
  return {
    id: record.id,
    runId: record.runId,
    type: record.type,
    stage: record.stage,
    platform: record.platform ?? undefined,
    title: record.title,
    content: record.content,
    payload: record.payload,
    status: record.status,
    providerType: record.providerType ?? undefined,
    model: record.model ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toRunDTO(run: RunRecord, workProducts: WorkProductRecord[]): ContentRunDTO {
  const usage = run.stages.reduce(
    (acc, stage) => ({
      promptTokens: acc.promptTokens + (stage.usage?.promptTokens ?? 0),
      completionTokens: acc.completionTokens + (stage.usage?.completionTokens ?? 0),
      totalTokens: acc.totalTokens + (stage.usage?.totalTokens ?? 0),
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  );

  return {
    id: run.id,
    status: run.status,
    productName: run.productName,
    platforms: run.platforms,
    stages: run.stages,
    input: run.input,
    workProducts: workProducts.filter((wp) => wp.runId === run.id).map(toWorkProductDTO),
    providerType: run.providerType ?? undefined,
    error: run.error ?? undefined,
    totalUsage: usage,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}
