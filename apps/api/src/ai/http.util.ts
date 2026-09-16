/**
 * Small HTTP helpers shared by every AI driver.
 * Uses the global fetch that ships with Node 18+, so no vendor SDK is pulled
 * in - swapping AI providers stays a pure configuration concern.
 */
import type { AIUsage } from '@paperclip/shared';

export class AIHttpError extends Error {
  readonly retryable: boolean;

  constructor(
    message: string,
    readonly status: number,
    readonly provider: string,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'AIHttpError';
    // 408 (timeout), 429 (rate limit), 5xx and transport failures are retryable.
    this.retryable = status === 408 || status === 429 || status >= 500 || status === 0;
  }
}

interface FetchJsonOptions {
  url: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs: number;
  label: string;
}

async function fetchJson<T = any>(options: FetchJsonOptions): Promise<T> {
  const { url, method = 'POST', body, headers, timeoutMs, label } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json', ...headers } : headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const raw = await res.text();

    if (!res.ok) {
      throw new AIHttpError(
        `${label} responded ${res.status}: ${truncate(raw, 400)}`,
        res.status,
        label,
        raw,
      );
    }

    if (!raw) return {} as T;

    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new AIHttpError(`${label} returned a non-JSON body`, res.status, label, raw);
    }
  } catch (err: any) {
    if (err instanceof AIHttpError) throw err;
    if (err?.name === 'AbortError') {
      throw new AIHttpError(`${label} timed out after ${timeoutMs}ms`, 408, label);
    }
    throw new AIHttpError(`${label} network error: ${err?.message ?? 'unknown'}`, 0, label);
  } finally {
    clearTimeout(timer);
  }
}

export const postJson = <T = any>(
  url: string,
  body: unknown,
  headers: Record<string, string> | undefined,
  timeoutMs: number,
  label: string,
): Promise<T> => fetchJson<T>({ url, method: 'POST', body, headers, timeoutMs, label });

export const getJson = <T = any>(
  url: string,
  headers: Record<string, string> | undefined,
  timeoutMs: number,
  label: string,
): Promise<T> => fetchJson<T>({ url, method: 'GET', headers, timeoutMs, label });

export function joinUrl(base: string, path: string): string {
  const cleanBase = (base ?? '').replace(/\/+$/, '');
  const cleanPath = (path ?? '').replace(/^\/+/, '');
  if (!cleanPath) return cleanBase;
  return `${cleanBase}/${cleanPath}`;
}

/** Rough token estimate used when a vendor does not report usage. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function makeUsage(prompt: number, completion: number): AIUsage {
  const promptTokens = Math.max(0, Math.round(prompt || 0));
  const completionTokens = Math.max(0, Math.round(completion || 0));
  return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
}

export function truncate(text: string, max: number): string {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function maskApiKey(key?: string | null): string | undefined {
  if (!key) return undefined;
  if (key.length <= 8) return `${key.slice(0, 2)}…`;
  return `${key.slice(0, 5)}…${key.slice(-4)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * OpenAI reasoning models and the GPT-5 family reject `max_tokens`;
 * they expect `max_completion_tokens` instead.
 */
export function usesMaxCompletionTokens(model: string): boolean {
  const m = (model ?? '').toLowerCase();
  return /^(gpt-5|o1|o3|o4)/.test(m) || m.includes('gpt-5');
}
