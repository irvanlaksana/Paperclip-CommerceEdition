/**
 * Browser-side API client.
 *
 * Every request uses a same-origin relative path (`/api/...`); Next.js rewrites
 * proxy it to the NestJS server. That keeps the UI working behind tunnelled or
 * reverse-proxied hosts where the browser cannot reach the API port directly.
 */
import type {
  AIProviderDTO,
  ContentPlatform,
  ContentRunDTO,
  ContentRunInput,
  PipelineStage,
  Product,
  ProviderCatalogEntry,
  ProviderTestResult,
  UpsertAIProviderInput,
  WorkProductStatus,
} from '@paperclip/shared';

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
  } catch (err: any) {
    throw new ApiError(
      `Tidak bisa menghubungi API (${err?.message ?? err}). Pastikan server API berjalan di port 4000.`,
      0,
    );
  }

  const text = await res.text();
  const data = text ? safeParse(text) : null;

  if (!res.ok) {
    const message =
      (data as any)?.message ??
      (Array.isArray((data as any)?.message) ? (data as any).message.join(', ') : null) ??
      (data as any)?.error ??
      `HTTP ${res.status}`;
    throw new ApiError(String(message), res.status, data);
  }

  return data as T;
}

function safeParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/* --------------------------------- types ---------------------------------- */

export interface AiStatus {
  default: AIProviderDTO;
  fallbackChain: Array<{ type: string; model: string; source: string; ready: boolean }>;
  storage: { driver: string; location: string };
  mockFallbackAllowed: boolean;
}

export interface CatalogEntry extends ProviderCatalogEntry {
  keyConfigured: boolean;
  envKeyNames: string[];
  currentModel: string;
  currentEndpoint: string;
}

export interface HealthResponse {
  status: string;
  ai: { defaultProvider: string; model: string; source: string; ready: boolean; mockMode: boolean };
  storage: { driver: string; location: string };
}

export interface ContentMeta {
  platforms: Array<{ value: ContentPlatform; label: string }>;
  tones: string[];
  stages: Array<{ stage: PipelineStage; label: string; description: string; dependsOn: PipelineStage[] }>;
  agents: Array<{ id: string; name: string; role: string; providerType?: string }>;
}

export interface InfrastructureConfig {
  database: string;
  storage: string;
  runtime: string;
  updatedAt?: string;
}

/* ---------------------------------- API ----------------------------------- */

export const api = {
  health: () => request<HealthResponse>('/health'),

  ai: {
    providers: () =>
      request<{ providers: AIProviderDTO[]; activeProviderType: string; activeProviderId: string }>(
        '/ai/providers',
      ),
    catalog: () => request<{ providers: CatalogEntry[] }>('/ai/providers/catalog'),
    status: () => request<AiStatus>('/ai/status'),
    create: (body: UpsertAIProviderInput) =>
      request<AIProviderDTO>('/ai/providers', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<UpsertAIProviderInput>) =>
      request<AIProviderDTO>(`/ai/providers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) =>
      request<{ removed: boolean }>(`/ai/providers/${id}`, { method: 'DELETE' }),
    test: (id: string) =>
      request<ProviderTestResult>(`/ai/providers/${id}/test`, { method: 'POST' }),
  },

  content: {
    meta: () => request<ContentMeta>('/content/meta'),
    products: () => request<Product[]>('/content/products'),
    startRun: (body: ContentRunInput) =>
      request<ContentRunDTO>('/content/runs', { method: 'POST', body: JSON.stringify(body) }),
    getRun: (id: string) => request<ContentRunDTO>(`/content/runs/${id}`),
    listRuns: (limit = 15) => request<ContentRunDTO[]>(`/content/runs?limit=${limit}`),
    deleteRun: (id: string) => request<{ deleted: boolean }>(`/content/runs/${id}`, { method: 'DELETE' }),
    retryRun: (id: string) =>
      request<ContentRunDTO>(`/content/runs/${id}/retry`, { method: 'POST' }),
    setWorkProductStatus: (id: string, status: WorkProductStatus) =>
      request(`/content/work-products/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },

  marketplace: {
    channels: () => request<Array<{ id: string; name: string; adapter: string; docs: string }>>('/marketplace/channels'),
    importFromUrl: (url: string, provider?: string) =>
      request<{ sourceUrl: string; scraped: any; enhanced: any }>('/marketplace/import', {
        method: 'POST',
        body: JSON.stringify({ url, provider }),
      }),
    importAndSave: (url: string, provider?: string) =>
      request<{ savedProduct: Product }>('/marketplace/import/save', {
        method: 'POST',
        body: JSON.stringify({ url, provider }),
      }),
  },

  sheets: {
    status: () =>
      request<{
        configured: boolean;
        connected: boolean;
        status: string;
        spreadsheetId: string | null;
        authorizeUrl: string | null;
        missingEnv: string[];
      }>('/integrations/google/status'),
    createSheet: (title?: string) =>
      request<{ success: boolean; spreadsheetId?: string; url?: string; error?: string }>(
        '/integrations/google/sheets',
        { method: 'POST', body: JSON.stringify({ title }) },
      ),
    sync: (spreadsheetId: string) =>
      request<{ success: boolean; rowsUpdated?: number; error?: string }>(
        `/integrations/google/sheets/${spreadsheetId}/sync`,
        { method: 'POST', body: JSON.stringify({}) },
      ),
  },

  config: {
    infrastructure: () => request<InfrastructureConfig>('/config/infrastructure'),
    saveInfrastructure: (body: Partial<InfrastructureConfig>) =>
      request<InfrastructureConfig>('/config/infrastructure', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
  },
};

/** Copy text with a clipboard API fallback for non-secure contexts. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea trick */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
