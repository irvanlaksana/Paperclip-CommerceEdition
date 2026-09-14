import { Injectable, Logger } from '@nestjs/common';
import type {
  AIProviderConfig,
  AIProviderType,
  AIRequest,
  AIResponse,
  ProviderTestResult,
} from '@paperclip/shared';
import { isAIProviderType } from '@paperclip/shared';
import { AiConfigService } from './ai-config.service.js';
import { DriverRegistry } from './driver.registry.js';
import { AIHttpError, sleep } from './http.util.js';
import { extractJson } from './json.util.js';

/** Anything a caller may hand over when it wants a specific AI. */
export type ProviderSelector =
  | AIProviderConfig
  | AIProviderType
  | string
  | { type?: string; id?: string; model?: string; endpoint?: string; apiKey?: string }
  | null
  | undefined;

/**
 * The single entry point for talking to an LLM.
 *
 * Responsibilities:
 *   - turn any selector (type, id, object, nothing) into a resolved config
 *   - dispatch to the right protocol driver via the registry
 *   - retry transient failures, then fail over to the next provider
 *   - return a normalized response including usage + which model actually ran
 *
 * Nothing in the app imports a vendor SDK: swapping the AI is configuration.
 */
@Injectable()
export class AIProviderService {
  private readonly logger = new Logger(AIProviderService.name);
  private readonly registry: DriverRegistry;

  constructor(private readonly configService: AiConfigService) {
    this.registry = new DriverRegistry();
  }

  get drivers() {
    return this.registry;
  }

  /* ------------------------------ resolution ------------------------------ */

  private async toConfig(selector: ProviderSelector): Promise<AIProviderConfig> {
    if (!selector) return this.configService.resolveDefault();

    if (typeof selector === 'string') {
      if (isAIProviderType(selector)) return this.configService.resolve(selector);
      const resolved = await this.configService.resolveByIdOrType(selector);
      if (resolved) return resolved;
      this.logger.warn(`Provider "${selector}" tidak dikenal, memakai default.`);
      return this.configService.resolveDefault();
    }

    // Already a resolved config.
    if ('driver' in selector && 'ready' in selector) return selector as AIProviderConfig;

    // Legacy/partial object: { type, model?, endpoint?, apiKey? }
    const partial = selector as { type?: string; id?: string; model?: string; endpoint?: string; apiKey?: string };
    if (partial.id) {
      const byId = await this.configService.resolveByIdOrType(partial.id);
      if (byId) return { ...byId, ...this.pickOverrides(partial) };
    }
    if (partial.type && isAIProviderType(partial.type)) {
      const base = await this.configService.resolve(partial.type);
      return { ...base, ...this.pickOverrides(partial) };
    }

    return this.configService.resolveDefault();
  }

  private pickOverrides(partial: { model?: string; endpoint?: string; apiKey?: string }): Partial<AIProviderConfig> {
    const overrides: Partial<AIProviderConfig> = {};
    if (partial.model) overrides.model = partial.model;
    if (partial.endpoint) overrides.endpoint = partial.endpoint;
    if (partial.apiKey) overrides.apiKey = partial.apiKey;
    if (overrides.apiKey) {
      overrides.ready = true;
      overrides.missing = undefined;
    }
    return overrides;
  }

  /* ------------------------------ generation ------------------------------ */

  /**
   * Generate a completion. Signature kept compatible with the previous
   * implementation (`generateResponse(provider, request)`) so existing callers
   * such as AgentService keep working unchanged.
   */
  async generateResponse(selector: ProviderSelector, request: AIRequest): Promise<AIResponse> {
    const chain = await this.configService.resolveChain(await this.toConfig(selector));
    const maxRetries = this.maxRetries();
    const errors: string[] = [];

    for (const [index, config] of chain.entries()) {
      if (!config.enabled && index > 0) continue;
      if (!config.ready && config.type !== 'MOCK') {
        errors.push(`${config.type}: belum siap (${config.missing?.join(', ') ?? 'unknown'})`);
        continue;
      }

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await this.registry.get(config.driver).generate(config, request);
          if (index > 0) response.viaFallback = true;
          this.logSuccess(config, response, index, attempt);
          return response;
        } catch (err: any) {
          const retryable = err instanceof AIHttpError ? err.retryable : false;
          const message = err?.message ?? String(err);
          errors.push(`${config.type}(${config.model}) percobaan ${attempt + 1}: ${message}`);
          this.logger.warn(`AI call gagal [${config.type}/${config.model}]: ${message}`);

          if (retryable && attempt < maxRetries) {
            await sleep(this.backoffMs(attempt, err));
            continue;
          }
          break; // move on to the next provider in the chain
        }
      }
    }

    throw new Error(
      `Semua provider AI gagal. Detail:\n- ${errors.slice(0, 6).join('\n- ')}`,
    );
  }

  /** Convenience wrapper: generate and parse JSON, with one repair attempt. */
  async generateJson<T = any>(selector: ProviderSelector, request: AIRequest): Promise<{ data: T; response: AIResponse }> {
    const response = await this.generateResponse(selector, { ...request, responseFormat: 'json' });
    try {
      return { data: extractJson<T>(response.text), response };
    } catch (err: any) {
      this.logger.warn(`JSON pertama tidak valid (${err?.message}); mencoba perbaikan.`);
      const repair = await this.generateResponse(selector, {
        ...request,
        responseFormat: 'json',
        prompt: `${request.prompt}\n\nPerbaikan: output sebelumnya bukan JSON valid. Balas ulang HANYA dengan JSON valid sesuai skema, tanpa komentar dan tanpa markdown fence. Output sebelumnya:\n${response.text.slice(0, 1500)}`,
      });
      return { data: extractJson<T>(repair.text), response: repair };
    }
  }

  /* --------------------------------- health -------------------------------- */

  async testProvider(selector: ProviderSelector): Promise<ProviderTestResult> {
    const config = await this.toConfig(selector);
    const started = Date.now();
    const driver = this.registry.get(config.driver);

    if (!config.ready && config.type !== 'MOCK') {
      const result: ProviderTestResult = {
        ok: false,
        providerType: config.type,
        model: config.model,
        latencyMs: 0,
        error: `Konfigurasi belum lengkap: ${config.missing?.join(', ')}`,
      };
      await this.configService.recordTest(config.id, { ok: false, message: result.error, latencyMs: 0 });
      return result;
    }

    try {
      // Prefer a real 1-token completion: it validates auth, model name and
      // endpoint at once, unlike a models listing.
      const response = await driver.generate(config, {
        prompt: 'Balas dengan satu kata: ok',
        systemPrompt: 'You are a connectivity probe. Answer with a single word.',
        temperature: 0,
        maxTokens: 16,
      });
      const result: ProviderTestResult = {
        ok: Boolean(response.text),
        providerType: config.type,
        model: response.model,
        latencyMs: response.latencyMs || Date.now() - started,
        sample: response.text.slice(0, 120),
        usage: response.usage,
      };
      await this.configService.recordTest(config.id, {
        ok: result.ok,
        message: result.ok ? `latency ${result.latencyMs}ms` : 'respons kosong',
        latencyMs: result.latencyMs,
      });
      return result;
    } catch (err: any) {
      const message = err?.message ?? String(err);
      const result: ProviderTestResult = {
        ok: false,
        providerType: config.type,
        model: config.model,
        latencyMs: Date.now() - started,
        error: message,
      };
      await this.configService.recordTest(config.id, { ok: false, message, latencyMs: result.latencyMs });
      return result;
    }
  }

  /* -------------------------------- helpers -------------------------------- */

  private maxRetries(): number {
    const raw = Number.parseInt(process.env.AI_MAX_RETRIES ?? '2', 10);
    return Number.isFinite(raw) ? Math.max(0, Math.min(5, raw)) : 2;
  }

  private backoffMs(attempt: number, err: unknown): number {
    // Honour Retry-After style rate limits with a longer wait.
    const status = err instanceof AIHttpError ? err.status : 0;
    const base = status === 429 ? 1500 : 400;
    return base * 2 ** attempt;
  }

  private logSuccess(
    config: AIProviderConfig,
    response: AIResponse,
    providerIndex: number,
    attempt: number,
  ): void {
    const notes = [
      providerIndex > 0 ? 'via fail-over' : 'primary',
      attempt > 0 ? `setelah ${attempt + 1} percobaan` : null,
      config.source === 'MOCK_FALLBACK' ? 'MODE MOCK - isi API key untuk hasil nyata' : null,
    ]
      .filter(Boolean)
      .join(', ');
    this.logger.log(
      `${config.type}/${response.model} ok dalam ${response.latencyMs}ms ` +
        `(${response.usage.totalTokens} token; ${notes})`,
    );
  }
}
