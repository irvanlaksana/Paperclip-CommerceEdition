/**
 * @paperclip/shared
 * Domain types shared by the NestJS API and the Next.js web app.
 *
 * Everything the UI needs to render the AI-provider switcher and the content
 * pipeline lives here, so adding a provider or a stage never requires changing
 * both sides of the wire.
 */

/* -------------------------------------------------------------------------- */
/*  Organization & workflow                                                    */
/* -------------------------------------------------------------------------- */

export enum Role {
  CEO = 'CEO',
  COO = 'COO',
  CTO = 'CTO',
  CMO = 'CMO',
  MARKETPLACE_MANAGER = 'MARKETPLACE_MANAGER',
  PRODUCT_RESEARCH_MANAGER = 'PRODUCT_RESEARCH_MANAGER',
  CONTENT_MANAGER = 'CONTENT_MANAGER',
  SEO_MANAGER = 'SEO_MANAGER',
  ADS_MANAGER = 'ADS_MANAGER',
  REPORTING_MANAGER = 'REPORTING_MANAGER',
  USER = 'USER',
}

export enum IssueStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE',
  BLOCKED = 'BLOCKED',
}

export interface CompanyGoal {
  id: string;
  title: string;
  description?: string;
  status: string;
}

export interface Agent {
  id: string;
  name: string;
  role: Role;
  systemPrompt: string;
  /** Optional. When omitted the system default provider is used. */
  providerId?: string;
  /** Optional explicit provider type, e.g. `GEMINI`. Overrides `providerId`. */
  providerType?: AIProviderType;
}

/* -------------------------------------------------------------------------- */
/*  AI providers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Every provider the platform knows how to talk to. `MOCK` is an offline
 * driver used for demos, CI and for graceful degradation when no key is set.
 */
export const AI_PROVIDER_TYPES = [
  'GEMINI',
  'OPENAI',
  'CLAUDE',
  'DEEPSEEK',
  'GROK',
  'OPENROUTER',
  'OLLAMA',
  'LM_STUDIO',
  'OPENCLAW',
  'CUSTOM',
  'MOCK',
] as const;

export type AIProviderType = (typeof AI_PROVIDER_TYPES)[number];

export function isAIProviderType(value: unknown): value is AIProviderType {
  return typeof value === 'string' && (AI_PROVIDER_TYPES as readonly string[]).includes(value);
}

/** Which low-level HTTP driver speaks for a provider type. */
export type AIDriverKind = 'openai-compatible' | 'gemini' | 'anthropic' | 'mock';

/** Static, code-defined knowledge about a provider type. */
export interface ProviderCatalogEntry {
  type: AIProviderType;
  label: string;
  driver: AIDriverKind;
  defaultEndpoint: string;
  defaultModel: string;
  suggestedModels: string[];
  /** Environment variables inspected (in order) when seeding the API key. */
  apiKeyEnv: string[];
  /** Environment variable used to override the endpoint, if any. */
  endpointEnv?: string[];
  modelEnv?: string[];
  requiresApiKey: boolean;
  /** Extra headers the driver must always send (e.g. anthropic-version). */
  defaultHeaders?: Record<string, string>;
  docsUrl?: string;
  notes?: string;
}

/** Where a resolved provider configuration came from. */
export type ProviderConfigSource = 'STORE' | 'ENV' | 'CATALOG' | 'INLINE' | 'MOCK_FALLBACK';

/** A fully resolved, ready-to-call provider configuration. */
export interface AIProviderConfig {
  id: string;
  type: AIProviderType;
  name: string;
  model: string;
  endpoint: string;
  apiKey?: string;
  enabled: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Lower number = tried first when building the fail-over chain. */
  priority?: number;
  isDefault?: boolean;
  source: ProviderConfigSource;
  driver: AIDriverKind;
  /** True when the config is usable (key present, or key not required). */
  ready: boolean;
  /** Human readable reason when `ready` is false. */
  missing?: string[];
}

/**
 * Serializable shape used by the Settings UI. Mirrors `AIProviderConfig` but
 * never carries a resolved API key back to the browser.
 */
export interface AIProviderDTO extends Omit<AIProviderConfig, 'apiKey' | 'driver' | 'ready'> {
  apiKeySet: boolean;
  /** e.g. `sk-abc…wxyz` - safe to display. */
  apiKeyPreview?: string;
  driver: AIDriverKind;
  ready: boolean;
  /** False for local/self-hosted providers that need no credential. */
  requiresApiKey: boolean;
  missing?: string[];
  lastTestAt?: string | null;
  lastTestStatus?: 'PASS' | 'FAIL' | null;
  lastTestMessage?: string | null;
  lastTestLatencyMs?: number | null;
}

export interface UpsertAIProviderInput {
  id?: string;
  type: AIProviderType;
  name?: string;
  model?: string;
  endpoint?: string;
  /** Omit or send null to keep the currently stored key. */
  apiKey?: string | null;
  enabled?: boolean;
  temperature?: number | null;
  maxTokens?: number | null;
  headers?: Record<string, string> | null;
  priority?: number;
  isDefault?: boolean;
}

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Ask the model for JSON. Drivers map this to their native JSON mode. */
  responseFormat?: 'text' | 'json';
  stop?: string[];
  /** Free-form metadata forwarded to drivers that support it (OpenRouter etc.). */
  extra?: Record<string, unknown>;
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIResponse {
  text: string;
  usage: AIUsage;
  providerType: AIProviderType;
  model: string;
  latencyMs: number;
  /** Set when the request was served by a fail-over provider. */
  viaFallback?: boolean;
  finishReason?: string;
}

export interface ProviderTestResult {
  ok: boolean;
  providerType: AIProviderType;
  model: string;
  latencyMs: number;
  sample?: string;
  usage?: AIUsage;
  error?: string;
}

/* -------------------------------------------------------------------------- */
/*  Commerce: products & channels                                              */
/* -------------------------------------------------------------------------- */

export interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  sku?: string;
  imageUrl?: string;
  sourceUrl?: string;
  category?: string;
  tags?: string[];
  /** Free-form extra facts (material, warranty, dimensions, ...). */
  attributes?: Record<string, string>;
}

export const CONTENT_PLATFORMS = [
  'INSTAGRAM',
  'TIKTOK',
  'FACEBOOK',
  'WHATSAPP',
  'X',
  'MARKETPLACE',
] as const;

export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

export const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  FACEBOOK: 'Facebook',
  WHATSAPP: 'WhatsApp',
  X: 'X / Twitter',
  MARKETPLACE: 'Marketplace',
};

/* -------------------------------------------------------------------------- */
/*  Content pipeline                                                           */
/* -------------------------------------------------------------------------- */

export const PIPELINE_STAGES = ['RESEARCH', 'CAPTIONS', 'SEO', 'VISUAL', 'SCHEDULE'] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_META: Record<PipelineStage, { label: string; description: string }> = {
  RESEARCH: {
    label: 'Riset Produk',
    description: 'Ekstrak USP, audiens, pain point, dan angle penjualan.',
  },
  CAPTIONS: {
    label: 'Caption Multi-Platform',
    description: 'Hook, body, CTA, dan hashtag per platform.',
  },
  SEO: {
    label: 'SEO & Marketplace',
    description: 'Judul marketplace, keyword, dan meta description.',
  },
  VISUAL: {
    label: 'Arahan Visual',
    description: 'Prompt gambar/video untuk tiap platform.',
  },
  SCHEDULE: {
    label: 'Jadwal Posting',
    description: 'Draft kalender konten 7 hari.',
  },
};

export type ContentTone = 'casual' | 'hype' | 'professional' | 'storytelling' | 'humorous';

export const CONTENT_TONES: ContentTone[] = [
  'casual',
  'hype',
  'professional',
  'storytelling',
  'humorous',
];

export interface CaptionOutput {
  platform: ContentPlatform;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  /** Full, ready-to-paste text. */
  fullText: string;
  characterCount: number;
  bestTimeToPost?: string;
}

export interface SeoOutput {
  marketplaceTitle: string;
  metaDescription: string;
  primaryKeyword: string;
  keywords: string[];
  longTailKeywords: string[];
  bulletPoints: string[];
}

export interface VisualOutput {
  platform: ContentPlatform;
  imagePrompt: string;
  videoScript?: string;
  styleNotes?: string;
}

export interface ScheduleItem {
  day: string;
  date: string;
  platform: ContentPlatform;
  time: string;
  contentRef: string;
  note?: string;
}

export interface ResearchOutput {
  targetAudience: string[];
  painPoints: string[];
  uniqueSellingPoints: string[];
  angles: string[];
  toneAdvice: string;
  competitorKeywords: string[];
}

export type WorkProductType =
  | 'RESEARCH'
  | 'CAPTION'
  | 'SEO'
  | 'IMAGE_PROMPT'
  | 'SCHEDULE';

export type WorkProductStatus = 'DRAFT' | 'APPROVED' | 'REJECTED';

export interface WorkProductDTO {
  id: string;
  runId: string;
  type: WorkProductType;
  stage: PipelineStage;
  platform?: ContentPlatform;
  title: string;
  content: string;
  payload?: unknown;
  status: WorkProductStatus;
  providerType?: AIProviderType;
  model?: string;
  createdAt: string;
  updatedAt: string;
}

export type StageStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'SKIPPED' | 'FAILED';

export interface StageResult {
  stage: PipelineStage;
  status: StageStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  providerType?: AIProviderType;
  model?: string;
  usage?: AIUsage;
  error?: string;
  /**
   * True when the stage was answered by a fail-over provider instead of the one
   * that was requested - including the offline MOCK driver. The UI surfaces this
   * so placeholder output is never mistaken for real model output.
   */
  viaFallback?: boolean;
  data?: ResearchOutput | CaptionOutput[] | SeoOutput | VisualOutput[] | ScheduleItem[];
}

export type ContentRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export interface ContentRunInput {
  product: Omit<Product, 'id'> & { id?: string };
  platforms: ContentPlatform[];
  locale?: string;
  tone?: ContentTone;
  stages?: PipelineStage[];
  /** Provider override for this run only. Omit to use the default. */
  providerType?: AIProviderType;
  ctaUrl?: string;
  brandName?: string;
  includeHashtags?: boolean;
}

export interface ContentRunDTO {
  id: string;
  status: ContentRunStatus;
  productName: string;
  platforms: ContentPlatform[];
  stages: StageResult[];
  input: ContentRunInput;
  workProducts: WorkProductDTO[];
  providerType?: AIProviderType;
  error?: string;
  totalUsage?: AIUsage;
  createdAt: string;
  updatedAt: string;
}
