import type { AIProviderConfig, AIRequest, AIResponse } from '@paperclip/shared';
import { estimateTokens, getJson, joinUrl, makeUsage, postJson } from '../http.util.js';
import type { AIDriver } from './types.js';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }>; role?: string };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  modelVersion?: string;
  error?: { message?: string };
}

/**
 * Google Gemini native REST driver (`:generateContent`).
 * Auth uses the `x-goog-api-key` header so the key never appears in the URL
 * and therefore never lands in access logs.
 */
export class GeminiDriver implements AIDriver {
  readonly kind = 'gemini' as const;

  async generate(config: AIProviderConfig, request: AIRequest): Promise<AIResponse> {
    const started = Date.now();
    const url = this.resolveUrl(config.endpoint, config.model);

    const generationConfig: Record<string, unknown> = {
      temperature: request.temperature ?? config.temperature ?? 0.7,
    };
    const maxTokens = request.maxTokens ?? config.maxTokens;
    if (maxTokens) generationConfig.maxOutputTokens = maxTokens;
    if (request.responseFormat === 'json') {
      generationConfig.responseMimeType = 'application/json';
    }
    if (request.stop?.length) generationConfig.stopSequences = request.stop;

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
      generationConfig,
    };
    if (request.systemPrompt?.trim()) {
      body.systemInstruction = { parts: [{ text: request.systemPrompt.trim() }] };
    }

    const data = await postJson<GeminiResponse>(
      url,
      body,
      this.buildHeaders(config),
      config.timeoutMs ?? 60_000,
      `${config.type}/${config.model}`,
    );

    if (data.error?.message) {
      throw new Error(`Gemini API error: ${data.error.message}`);
    }

    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!text && !candidate) {
      throw new Error('Gemini returned no candidates (the prompt may have been blocked).');
    }

    const promptTokens = data.usageMetadata?.promptTokenCount ?? estimateTokens(request.prompt);
    const completionTokens = data.usageMetadata?.candidatesTokenCount ?? estimateTokens(text);

    return {
      text,
      usage: makeUsage(promptTokens, completionTokens),
      providerType: config.type,
      model: data.modelVersion ?? config.model,
      latencyMs: Date.now() - started,
      finishReason: candidate?.finishReason,
    };
  }

  async ping(config: AIProviderConfig): Promise<{ ok: boolean; detail?: string }> {
    try {
      const data = await getJson<{ models?: Array<{ name: string }> }>(
        joinUrl(config.endpoint, 'models'),
        this.buildHeaders(config),
        10_000,
        `${config.type}/models`,
      );
      const count = data.models?.length ?? 0;
      return { ok: true, detail: count ? `${count} model tersedia` : 'terhubung' };
    } catch (err: any) {
      return { ok: false, detail: err?.message ?? String(err) };
    }
  }

  private resolveUrl(endpoint: string, model: string): string {
    const trimmed = (endpoint ?? '').replace(/\/+$/, '');
    if (trimmed.includes(':generateContent')) return trimmed;
    return joinUrl(trimmed, `models/${model}:generateContent`);
  }

  private buildHeaders(config: AIProviderConfig): Record<string, string> {
    const headers: Record<string, string> = { ...config.headers };
    if (config.apiKey) headers['x-goog-api-key'] = config.apiKey;
    return headers;
  }
}
