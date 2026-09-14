import { PIPELINE_STAGES, PLATFORM_LABELS, STAGE_META, type AIUsage, type AIProviderType, type CaptionOutput, type ContentPlatform, type ContentRunInput, type PipelineStage, type ResearchOutput, type ScheduleItem, type SeoOutput, type VisualOutput, type WorkProductType } from '@paperclip/shared';
import type { ProviderSelector } from '../../ai/ai-provider.service.js';
import type { AIProviderService } from '../../ai/ai-provider.service.js';
import { asArray, asString, asStringArray, normalizeHashtags } from '../../ai/json.util.js';
import {
  captionPrompt,
  PLATFORM_RULES,
  researchPrompt,
  schedulePrompt,
  seoPrompt,
  visualPrompt,
  type PromptContext,
} from './prompts.js';

/**
 * Pipeline stages are registered handlers, not a hard-coded sequence of method
 * calls. Add a stage (e.g. ADS_COPY or EMAIL) by pushing another handler into
 * PIPELINE_STAGES_REGISTRY - the orchestrator, the REST API and the UI all pick
 * it up automatically.
 */

export interface StageContext {
  input: ContentRunInput;
  research?: ResearchOutput;
  ai: AIProviderService;
  provider: ProviderSelector;
  log(message: string): void;
}

export interface NewWorkProduct {
  type: WorkProductType;
  stage: PipelineStage;
  platform?: ContentPlatform | null;
  title: string;
  content: string;
  payload?: unknown;
}

export interface StageOutcome {
  data: unknown;
  workProducts: NewWorkProduct[];
  providerType?: AIProviderType;
  model?: string;
  usage?: AIUsage;
  /** Set when the response came from a fail-over provider instead of the requested one. */
  viaFallback?: boolean;
}

export interface StageHandler {
  stage: PipelineStage;
  /** Stages that must succeed before this one runs. */
  dependsOn: PipelineStage[];
  run(ctx: StageContext): Promise<StageOutcome>;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

function accumulateUsage(total: AIUsage, add?: AIUsage): AIUsage {
  if (!add) return total;
  return {
    promptTokens: total.promptTokens + add.promptTokens,
    completionTokens: total.completionTokens + add.completionTokens,
    totalTokens: total.totalTokens + add.totalTokens,
  };
}

const emptyUsage: AIUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

/* --------------------------------- RESEARCH -------------------------------- */

const researchStage: StageHandler = {
  stage: 'RESEARCH',
  dependsOn: [],
  async run(ctx) {
    const promptContext: PromptContext = { input: ctx.input };
    const { data, response } = await ctx.ai.generateJson<any>(ctx.provider, {
      systemPrompt:
        'Anda adalah Product Research Manager e-commerce Indonesia. Analisis produk secara tajam dan berbasis data yang diberikan.',
      prompt: researchPrompt(promptContext),
      temperature: 0.5,
    });

    const research: ResearchOutput = {
      targetAudience: asStringArray(data?.targetAudience, 6),
      painPoints: asStringArray(data?.painPoints, 8),
      uniqueSellingPoints: asStringArray(data?.uniqueSellingPoints, 8),
      angles: asStringArray(data?.angles, 6),
      toneAdvice: asString(data?.toneAdvice, 'Gunakan bahasa santai dan fokus pada manfaat utama.'),
      competitorKeywords: asStringArray(data?.competitorKeywords, 12),
    };

    ctx.research = research;

    const content = [
      `TARGET AUDIENS\n${research.targetAudience.map((a) => `- ${a}`).join('\n')}`,
      `\nPAIN POINT\n${research.painPoints.map((a) => `- ${a}`).join('\n')}`,
      `\nUNIQUE SELLING POINTS\n${research.uniqueSellingPoints.map((a) => `- ${a}`).join('\n')}`,
      `\nANGLE KONTEN\n${research.angles.map((a) => `- ${a}`).join('\n')}`,
      `\nSARAN TONE\n${research.toneAdvice}`,
      `\nKEYWORD PASAR\n${research.competitorKeywords.join(', ')}`,
    ].join('\n');

    return {
      data: research,
      workProducts: [
        {
          type: 'RESEARCH',
          stage: 'RESEARCH',
          title: `Riset produk: ${ctx.input.product.name}`,
          content,
          payload: research,
        },
      ],
      providerType: response.providerType,
      model: response.model,
      usage: response.usage,
      viaFallback: response.viaFallback,
    };
  },
};

/* --------------------------------- CAPTIONS -------------------------------- */

const captionsStage: StageHandler = {
  stage: 'CAPTIONS',
  dependsOn: ['RESEARCH'],
  async run(ctx) {
    const platforms = ctx.input.platforms.length ? ctx.input.platforms : (['INSTAGRAM'] as ContentPlatform[]);
    let usage = { ...emptyUsage };
    let providerType: AIProviderType | undefined;
    let model: string | undefined;
    let viaFallback = false;

    const captions = await mapLimit(platforms, 3, async (platform) => {
      const { data, response } = await ctx.ai.generateJson<any>(ctx.provider, {
        systemPrompt:
          'Anda adalah Content Manager e-commerce yang menulis caption konversi tinggi untuk pasar Indonesia.',
        prompt: captionPrompt({ input: ctx.input, research: ctx.research }, platform),
        temperature: 0.85,
      });

      usage = accumulateUsage(usage, response.usage);
      providerType ??= response.providerType;
      model ??= response.model;
      viaFallback = viaFallback || Boolean(response.viaFallback);

      const rule = PLATFORM_RULES[platform];
      const hook = asString(data?.hook);
      const body = asString(data?.body).slice(0, rule.maxCharacters);
      const cta = asString(data?.cta);
      const hashtags = ctx.input.includeHashtags === false ? [] : normalizeHashtags(data?.hashtags, rule.hashtagRange[1]);

      const caption: CaptionOutput = {
        platform,
        hook,
        body,
        cta,
        hashtags,
        fullText: [hook, body, cta, hashtags.join(' ')].filter(Boolean).join('\n\n').trim(),
        characterCount: 0,
        bestTimeToPost: asString(data?.bestTimeToPost) || undefined,
      };
      caption.characterCount = caption.fullText.length;
      ctx.log(`${platform}: ${caption.characterCount} karakter, ${hashtags.length} hashtag`);
      return caption;
    });

    return {
      data: captions,
      workProducts: captions.map((caption) => ({
        type: 'CAPTION' as WorkProductType,
        stage: 'CAPTIONS' as PipelineStage,
        platform: caption.platform,
        title: `Caption ${PLATFORM_LABELS[caption.platform] ?? caption.platform}`,
        content: caption.fullText,
        payload: caption,
      })),
      providerType,
      model,
      usage,
      viaFallback,
    };
  },
};

/* ------------------------------------ SEO ---------------------------------- */

const seoStage: StageHandler = {
  stage: 'SEO',
  dependsOn: ['RESEARCH'],
  async run(ctx) {
    const { data, response } = await ctx.ai.generateJson<any>(ctx.provider, {
      systemPrompt:
        'Anda adalah SEO Manager marketplace Indonesia (Shopee, Tokopedia, TikTok Shop, Lazada).',
      prompt: seoPrompt({ input: ctx.input, research: ctx.research }),
      temperature: 0.4,
    });

    const seo: SeoOutput = {
      marketplaceTitle: asString(data?.marketplaceTitle).slice(0, 120),
      metaDescription: asString(data?.metaDescription).slice(0, 200),
      primaryKeyword: asString(data?.primaryKeyword),
      keywords: asStringArray(data?.keywords, 12),
      longTailKeywords: asStringArray(data?.longTailKeywords, 8),
      bulletPoints: asStringArray(data?.bulletPoints, 10),
    };

    const content = [
      `JUDUL MARKETPLACE\n${seo.marketplaceTitle}`,
      `\nMETA DESCRIPTION\n${seo.metaDescription}`,
      `\nKEYWORD UTAMA\n${seo.primaryKeyword}`,
      `\nKEYWORD\n${seo.keywords.join(', ')}`,
      `\nLONG TAIL\n${seo.longTailKeywords.join(', ')}`,
      `\nBULLET POINT\n${seo.bulletPoints.map((b) => `- ${b}`).join('\n')}`,
    ].join('\n');

    return {
      data: seo,
      workProducts: [
        {
          type: 'SEO',
          stage: 'SEO',
          platform: 'MARKETPLACE',
          title: `SEO listing: ${ctx.input.product.name}`,
          content,
          payload: seo,
        },
      ],
      providerType: response.providerType,
      model: response.model,
      usage: response.usage,
      viaFallback: response.viaFallback,
    };
  },
};

/* ---------------------------------- VISUAL --------------------------------- */

const visualStage: StageHandler = {
  stage: 'VISUAL',
  dependsOn: ['RESEARCH'],
  async run(ctx) {
    const platforms = ctx.input.platforms.length ? ctx.input.platforms : (['INSTAGRAM'] as ContentPlatform[]);
    let usage = { ...emptyUsage };
    let providerType: AIProviderType | undefined;
    let model: string | undefined;
    let viaFallback = false;

    const visuals = await mapLimit(platforms, 3, async (platform) => {
      const { data, response } = await ctx.ai.generateJson<any>(ctx.provider, {
        systemPrompt:
          'Anda adalah Art Director untuk konten e-commerce. Prompt gambar ditulis dalam bahasa Inggris, arahan lain mengikuti bahasa kampanye.',
        prompt: visualPrompt({ input: ctx.input, research: ctx.research }, platform),
        temperature: 0.9,
      });

      usage = accumulateUsage(usage, response.usage);
      providerType ??= response.providerType;
      model ??= response.model;
      viaFallback = viaFallback || Boolean(response.viaFallback);

      const visual: VisualOutput = {
        platform,
        imagePrompt: asString(data?.imagePrompt),
        videoScript: asString(data?.videoScript) || undefined,
        styleNotes: asString(data?.styleNotes) || undefined,
      };
      return visual;
    });

    return {
      data: visuals,
      workProducts: visuals.map((visual) => ({
        type: 'IMAGE_PROMPT' as WorkProductType,
        stage: 'VISUAL' as PipelineStage,
        platform: visual.platform,
        title: `Arahan visual ${visual.platform}`,
        content: [
          `IMAGE PROMPT\n${visual.imagePrompt}`,
          visual.videoScript ? `\nVIDEO SCRIPT\n${visual.videoScript}` : '',
          visual.styleNotes ? `\nSTYLE NOTES\n${visual.styleNotes}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        payload: visual,
      })),
      providerType,
      model,
      usage,
      viaFallback,
    };
  },
};

/* --------------------------------- SCHEDULE -------------------------------- */

const scheduleStage: StageHandler = {
  stage: 'SCHEDULE',
  dependsOn: ['CAPTIONS'],
  async run(ctx) {
    const { data, response } = await ctx.ai.generateJson<any>(ctx.provider, {
      systemPrompt: 'Anda adalah Social Media Strategist yang menyusun kalender konten e-commerce.',
      prompt: schedulePrompt({ input: ctx.input, research: ctx.research }),
      temperature: 0.5,
    });

    const allowed = new Set<string>(ctx.input.platforms);
    const startDate = new Date();

    const items: ScheduleItem[] = asArray<any>(data?.items ?? data)
      .slice(0, 14)
      .map((item, index) => {
        const platform = (asString(item?.platform).toUpperCase() || 'INSTAGRAM') as ContentPlatform;
        const day = asString(item?.day) || ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][
          new Date(startDate.getTime() + index * 86_400_000).getDay()
        ]!;
        const date =
          asString(item?.date) ||
          new Date(startDate.getTime() + index * 86_400_000).toISOString().slice(0, 10);
        return {
          day,
          date,
          platform: allowed.has(platform) ? platform : (ctx.input.platforms[index % ctx.input.platforms.length] ?? 'INSTAGRAM'),
          time: asString(item?.time) || '12:00',
          contentRef: asString(item?.contentRef) || `CAPTIONS:${platform}`,
          note: asString(item?.note) || undefined,
        };
      });

    const content = items
      .map(
        (item) =>
          `${item.date} (${item.day}) ${item.time} — ${item.platform} — ${item.contentRef}${item.note ? ` — ${item.note}` : ''}`,
      )
      .join('\n');

    return {
      data: items,
      workProducts: [
        {
          type: 'SCHEDULE',
          stage: 'SCHEDULE',
          title: `Kalender konten 7 hari: ${ctx.input.product.name}`,
          content: content || '(jadwal kosong)',
          payload: items,
        },
      ],
      providerType: response.providerType,
      model: response.model,
      usage: response.usage,
      viaFallback: response.viaFallback,
    };
  },
};

/* -------------------------------- registry -------------------------------- */

export const PIPELINE_STAGES_REGISTRY: StageHandler[] = [
  researchStage,
  captionsStage,
  seoStage,
  visualStage,
  scheduleStage,
];

export function getStageHandler(stage: PipelineStage): StageHandler | undefined {
  return PIPELINE_STAGES_REGISTRY.find((handler) => handler.stage === stage);
}

/** Stage list in execution order, filtered to what the caller asked for. */
export function resolveStageOrder(requested?: PipelineStage[]): PipelineStage[] {
  if (!requested?.length) return [...PIPELINE_STAGES];
  const wanted = new Set(requested);
  // Dependencies are pulled in automatically so a stage never runs blind.
  const expanded = new Set<PipelineStage>(requested);
  for (const stage of requested) {
    for (const dep of getStageHandler(stage)?.dependsOn ?? []) expanded.add(dep);
  }
  return PIPELINE_STAGES.filter((stage) => expanded.has(stage));
}

export function stageMeta(stage: PipelineStage) {
  return STAGE_META[stage];
}
