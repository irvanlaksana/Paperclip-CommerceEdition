import { Injectable, Logger } from '@nestjs/common';
import {
  AI_PROVIDER_TYPES,
  isAIProviderType,
  type AIProviderConfig,
  type AIProviderDTO,
  type AIProviderType,
  type ProviderConfigSource,
  type UpsertAIProviderInput,
} from '@paperclip/shared';
import { DataStoreService } from '../storage/data-store.service.js';
import { newId, type Storable } from '../storage/data-store.js';
import { maskApiKey } from './http.util.js';
import { getCatalogEntry, listCatalog, PROVIDER_CATALOG } from './provider-catalog.js';

/** Persisted shape of a provider row (the "DB override" layer). */
export interface ProviderRecord extends Storable {
  type: AIProviderType;
  name: string;
  model?: string | null;
  endpoint?: string | null;
  apiKey?: string | null;
  enabled: boolean;
  priority: number;
  isDefault: boolean;
  temperature?: number | null;
  maxTokens?: number | null;
  headers?: Record<string, string> | null;
  lastTestAt?: string | null;
  lastTestStatus?: 'PASS' | 'FAIL' | null;
  lastTestMessage?: string | null;
  lastTestLatencyMs?: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Resolves "which AI do we call, with what credentials".
 *
 * Precedence, highest first:
 *   1. STORE   - rows created through the Settings UI
 *   2. ENV     - <TYPE>_API_KEY / <TYPE>_MODEL / <TYPE>_ENDPOINT (+ aliases)
 *   3. CATALOG - built-in defaults per provider type
 *
 * A store row does not have to repeat everything: any field it leaves empty is
 * filled from env, then from the catalog. That is what makes moving from one
 * vendor to another a configuration change instead of a code change.
 */
@Injectable()
export class AiConfigService {
  private readonly logger = new Logger(AiConfigService.name);

  constructor(private readonly store: DataStoreService) {}

  /* ------------------------------ env helpers ----------------------------- */

  private env(...names: string[]): string | undefined {
    for (const name of names) {
      const value = process.env[name];
      if (value && value.trim() && value.trim().toLowerCase() !== 'null') return value.trim();
    }
    return undefined;
  }

  private envNumber(...names: string[]): number | undefined {
    const raw = this.env(...names);
    if (raw === undefined) return undefined;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private envBoolean(names: string[], fallback: boolean): boolean {
    const raw = this.env(...names);
    if (raw === undefined) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
  }

  private envKeyFor(type: AIProviderType): string | undefined {
    return this.env(`${type}_API_KEY`, ...getCatalogEntry(type).apiKeyEnv);
  }

  /* ------------------------------ resolution ------------------------------ */

  private buildConfig(record: ProviderRecord | undefined, type: AIProviderType): AIProviderConfig {
    const catalog = getCatalogEntry(type);

    const apiKey = record?.apiKey ?? this.envKeyFor(type);
    const model =
      record?.model ?? this.env(`${type}_MODEL`, ...(catalog.modelEnv ?? [])) ?? catalog.defaultModel;
    const endpoint =
      record?.endpoint ??
      this.env(`${type}_ENDPOINT`, ...(catalog.endpointEnv ?? [])) ??
      catalog.defaultEndpoint;

    const temperature =
      record?.temperature ??
      this.envNumber(`${type}_TEMPERATURE`) ??
      this.envNumber('AI_TEMPERATURE');

    const maxTokens =
      record?.maxTokens ?? this.envNumber(`${type}_MAX_TOKENS`) ?? this.envNumber('AI_MAX_TOKENS');

    // A provider type counts as "configured" only when there is a store row or
    // something in the environment for it. Without this, keyless local providers
    // (Ollama, LM Studio, CUSTOM) would look ready on a fresh clone, get picked
    // as the default, and then fail on every call because nothing is listening.
    const configuredViaEnv = Boolean(
      apiKey ||
        this.env(`${type}_MODEL`, ...(catalog.modelEnv ?? [])) ||
        this.env(`${type}_ENDPOINT`, ...(catalog.endpointEnv ?? [])),
    );

    const enabled = record
      ? record.enabled
      : configuredViaEnv
        ? this.envBoolean([`${type}_ENABLED`], true)
        : // MOCK stays available as the offline safety net; everything else has
          // to be explicitly configured before it can be selected.
          type === 'MOCK';

    const missing: string[] = [];
    if (catalog.requiresApiKey && !apiKey) missing.push('apiKey');
    if (!endpoint) missing.push('endpoint');
    if (!model) missing.push('model');

    const source: ProviderConfigSource = record ? 'STORE' : configuredViaEnv ? 'ENV' : 'CATALOG';

    return {
      id: record?.id ?? `env:${type}`,
      type,
      name: record?.name ?? catalog.label,
      model,
      endpoint,
      apiKey: apiKey ?? undefined,
      enabled,
      temperature,
      maxTokens,
      timeoutMs: this.envNumber(`${type}_TIMEOUT_MS`) ?? this.envNumber('AI_REQUEST_TIMEOUT_MS') ?? 60_000,
      headers: { ...(catalog.defaultHeaders ?? {}), ...(record?.headers ?? {}) },
      priority: record?.priority ?? 100,
      isDefault: record?.isDefault ?? false,
      source,
      driver: catalog.driver,
      ready: missing.length === 0,
      missing: missing.length ? missing : undefined,
    };
  }

  /** Every known provider type, resolved and annotated with test metadata. */
  async resolveAll(): Promise<Array<AIProviderConfig & { record?: ProviderRecord }>> {
    const records = await this.store.list<ProviderRecord>('providers');
    const out: Array<AIProviderConfig & { record?: ProviderRecord }> = [];

    for (const type of AI_PROVIDER_TYPES) {
      // A type can appear more than once when several store rows use it.
      const rows = records.filter((r) => r.type === type);
      if (rows.length === 0) {
        out.push(this.buildConfig(undefined, type));
        continue;
      }
      for (const row of rows) out.push({ ...this.buildConfig(row, type), record: row });
    }

    return out.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  async resolveByIdOrType(selector?: string | null): Promise<AIProviderConfig | null> {
    if (!selector) return null;
    const all = await this.resolveAll();
    const byId = all.find((p) => p.id === selector);
    if (byId) return byId;
    if (isAIProviderType(selector)) {
      const byType = all.find((p) => p.type === selector);
      return byType ?? this.buildConfig(undefined, selector);
    }
    return null;
  }

  async resolve(type: AIProviderType): Promise<AIProviderConfig> {
    const records = await this.store.list<ProviderRecord>('providers');
    const row = records
      .filter((r) => r.type === type)
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))[0];
    return this.buildConfig(row, type);
  }

  /** The provider used when a caller does not name one. */
  async resolveDefault(): Promise<AIProviderConfig> {
    const records = await this.store.list<ProviderRecord>('providers');
    const storeDefault = records
      .filter((r) => r.isDefault && r.enabled)
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))[0];

    if (storeDefault) return this.buildConfig(storeDefault, storeDefault.type);

    const envDefault = this.env('AI_DEFAULT_PROVIDER');
    if (envDefault && isAIProviderType(envDefault)) {
      const config = await this.resolve(envDefault);
      if (config.ready) return config;
      this.logger.warn(
        `AI_DEFAULT_PROVIDER=${envDefault} belum siap (missing: ${config.missing?.join(', ') ?? '-'}). Mencari provider lain.`,
      );
    }

    // Nothing configured explicitly: use the first enabled + ready provider.
    const all = await this.resolveAll();
    const firstReady = all.find((p) => p.enabled && p.ready && p.type !== 'MOCK');
    if (firstReady) return firstReady;

    return this.mockConfig('Tidak ada provider AI yang siap dipakai.');
  }

  private mockConfig(reason: string): AIProviderConfig {
    const catalog = PROVIDER_CATALOG.MOCK;
    return {
      id: 'mock:fallback',
      type: 'MOCK',
      name: `${catalog.label} (fallback)`,
      model: catalog.defaultModel,
      endpoint: catalog.defaultEndpoint,
      enabled: true,
      priority: 9999,
      isDefault: false,
      source: 'MOCK_FALLBACK',
      driver: 'mock',
      ready: true,
      missing: [reason],
    };
  }

  /** Ordered fail-over chain: the requested provider first, then the rest. */
  async resolveChain(primary?: AIProviderConfig | null): Promise<AIProviderConfig[]> {
    const all = await this.resolveAll();
    const chain: AIProviderConfig[] = [];
    const seen = new Set<string>();

    const push = (config: AIProviderConfig | undefined | null) => {
      if (!config || seen.has(config.id)) return;
      seen.add(config.id);
      chain.push(config);
    };

    push(primary ?? (await this.resolveDefault()));

    const configuredFallbacks = (this.env('AI_FALLBACK_PROVIDERS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(isAIProviderType);

    for (const type of configuredFallbacks) push(await this.resolve(type));

    for (const candidate of all) {
      if (candidate.enabled && candidate.ready && candidate.type !== 'MOCK') push(candidate);
    }

    if (this.envBoolean(['AI_ALLOW_MOCK_FALLBACK'], true)) {
      push(this.mockConfig('Fail-over terakhir'));
    }

    return chain;
  }

  /* ------------------------------- mutations ------------------------------ */

  async upsert(input: UpsertAIProviderInput): Promise<ProviderRecord> {
    if (!isAIProviderType(input.type)) {
      throw new Error(`Tipe provider tidak valid: ${String(input.type)}`);
    }
    const catalog = getCatalogEntry(input.type);
    const now = new Date().toISOString();
    const existing = input.id ? await this.store.get<ProviderRecord>('providers', input.id) : null;

    if (input.isDefault) {
      // Only one default at a time.
      const all = await this.store.list<ProviderRecord>('providers');
      for (const row of all) {
        if (row.isDefault && row.id !== input.id) {
          await this.store.update<ProviderRecord>('providers', row.id, { isDefault: false, updatedAt: now });
        }
      }
    }

    const record: ProviderRecord = {
      id: existing?.id ?? input.id ?? newId('prov'),
      type: input.type,
      name: input.name?.trim() || existing?.name || catalog.label,
      model: input.model?.trim() || existing?.model || catalog.defaultModel,
      endpoint: input.endpoint?.trim() || existing?.endpoint || catalog.defaultEndpoint,
      // `undefined` keeps the stored key, an explicit empty string clears it.
      apiKey: input.apiKey === undefined ? (existing?.apiKey ?? null) : (input.apiKey || null),
      enabled: input.enabled ?? existing?.enabled ?? true,
      priority: input.priority ?? existing?.priority ?? 100,
      isDefault: input.isDefault ?? existing?.isDefault ?? false,
      temperature: input.temperature === undefined ? (existing?.temperature ?? null) : input.temperature,
      maxTokens: input.maxTokens === undefined ? (existing?.maxTokens ?? null) : input.maxTokens,
      headers: input.headers === undefined ? (existing?.headers ?? null) : input.headers,
      lastTestAt: existing?.lastTestAt ?? null,
      lastTestStatus: existing?.lastTestStatus ?? null,
      lastTestMessage: existing?.lastTestMessage ?? null,
      lastTestLatencyMs: existing?.lastTestLatencyMs ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) return this.store.update<ProviderRecord>('providers', record.id, record) as Promise<ProviderRecord>;
    return this.store.insert<ProviderRecord>('providers', record);
  }

  async remove(id: string): Promise<boolean> {
    return this.store.remove('providers', id);
  }

  async recordTest(
    id: string,
    result: { ok: boolean; message?: string; latencyMs: number },
  ): Promise<void> {
    if (!id || id.startsWith('env:') || id.startsWith('mock:')) return;
    await this.store.update<ProviderRecord>('providers', id, {
      lastTestAt: new Date().toISOString(),
      lastTestStatus: result.ok ? 'PASS' : 'FAIL',
      lastTestMessage: result.message ?? null,
      lastTestLatencyMs: result.latencyMs,
    });
  }

  /* --------------------------------- views -------------------------------- */

  toDTO(config: AIProviderConfig & { record?: ProviderRecord }): AIProviderDTO {
    const { apiKey, record, ...rest } = config;
    return {
      ...rest,
      apiKeySet: Boolean(apiKey),
      apiKeyPreview: maskApiKey(apiKey),
      requiresApiKey: getCatalogEntry(config.type).requiresApiKey,
      lastTestAt: record?.lastTestAt ?? null,
      lastTestStatus: record?.lastTestStatus ?? null,
      lastTestMessage: record?.lastTestMessage ?? null,
      lastTestLatencyMs: record?.lastTestLatencyMs ?? null,
    };
  }

  async listDTOs(): Promise<AIProviderDTO[]> {
    const all = await this.resolveAll();
    const dtos = all.map((c) => this.toDTO(c));
    const defaultConfig = await this.resolveDefault();
    return dtos.map((dto) => ({ ...dto, isDefault: dto.id === defaultConfig.id ? true : dto.isDefault }));
  }

  /** Static catalog + which env vars are present, for the Settings UI hints. */
  describeCatalog() {
    return listCatalog().map((entry) => ({
      ...entry,
      keyConfigured: Boolean(this.envKeyFor(entry.type)),
      envKeyNames: [`${entry.type}_API_KEY`, ...entry.apiKeyEnv].filter(
        (name, index, list) => list.indexOf(name) === index,
      ),
      currentModel: this.env(`${entry.type}_MODEL`, ...(entry.modelEnv ?? [])) ?? entry.defaultModel,
      currentEndpoint:
        this.env(`${entry.type}_ENDPOINT`, ...(entry.endpointEnv ?? [])) ?? entry.defaultEndpoint,
    }));
  }
}
