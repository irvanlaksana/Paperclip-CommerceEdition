import type { AIProviderConfig, AIRequest, AIResponse } from '@paperclip/shared';
import {
  estimateTokens,
  getJson,
  joinUrl,
  makeUsage,
  postJson,
  usesMaxCompletionTokens,
} from '../http.util.js';
import type { AIDriver } from './types.js';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string | null; role?: string };
    finish_reason?: string;
    text?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
  error?: { message?: string };
}

/**
 * Covers every vendor that exposes the OpenAI `/chat/completions` contract:
 * OpenAI, OpenRouter, DeepSeek, xAI Grok, Ollama, LM Studio, OpenClaw and any
 * CUSTOM gateway (vLLM, LiteLLM, Groq, Together, ...).
 *
 * One driver -> eight provider types. That is why swapping vendors is config
 * only: they all differ just by endpoint + key + model name.
 */
export class OpenAICompatibleDriver implements AIDriver {
  readonly kind = 'openai-compatible' as const;

  async generate(config: AIProviderConfig, request: AIRequest): Promise<AIResponse> {
    const started = Date.now();
    const url = this.resolveUrl(config.endpoint);

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt?.trim()) {
      messages.push({ role: 'system', content: request.systemPrompt.trim() });
    }
    messages.push({ role: 'user', content: request.prompt });

    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      temperature: request.temperature ?? config.temperature ?? 0.7,
      stream: false,
      ...(request.extra ?? {}),
    };

    const maxTokens = request.maxTokens ?? config.maxTokens;
    if (maxTokens) {
      // Newer OpenAI models renamed the field; sending the wrong one is a 400.
      if (usesMaxCompletionTokens(config.model)) body.max_completion_tokens = maxTokens;
      else body.max_tokens = maxTokens;
    }

    if (request.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }
    if (request.stop?.length) {
      body.stop = request.stop;
    }

    const data = await postJson<ChatCompletionResponse>(
      url,
      body,
      this.buildHeaders(config),
      config.timeoutMs ?? 60_000,
      `${config.type}/${config.model}`,
    );

    if (data.error?.message) {
      throw new Error(`${config.type} API error: ${data.error.message}`);
    }

    const choice = data.choices?.[0];
    const text = (choice?.message?.content ?? choice?.text ?? '').trim();

    const promptTokens =
      data.usage?.prompt_tokens ??
      estimateTokens(`${request.systemPrompt ?? ''}\n${request.prompt}`);
    const completionTokens = data.usage?.completion_tokens ?? estimateTokens(text);

    return {
      text,
      usage: makeUsage(promptTokens, completionTokens),
      providerType: config.type,
      model: data.model ?? config.model,
      latencyMs: Date.now() - started,
      finishReason: choice?.finish_reason,
    };
  }

  async ping(config: AIProviderConfig): Promise<{ ok: boolean; detail?: string }> {
    // `/models` is the cheapest authenticated endpoint and is implemented by
    // OpenAI, OpenRouter, DeepSeek, Grok, Ollama, LM Studio and vLLM alike.
    try {
      const data = await getJson<{ data?: Array<{ id: string }> }>(
        joinUrl(config.endpoint, 'models'),
        this.buildHeaders(config),
        10_000,
        `${config.type}/models`,
      );
      const count = data.data?.length ?? 0;
      return { ok: true, detail: count ? `${count} model tersedia` : 'terhubung' };
    } catch (err: any) {
      return { ok: false, detail: err?.message ?? String(err) };
    }
  }

  private resolveUrl(endpoint: string): string {
    const trimmed = (endpoint ?? '').replace(/\/+$/, '');
    if (/\/chat\/completions$/.test(trimmed)) return trimmed;
    if (/\/completions$/.test(trimmed)) return trimmed;
    return joinUrl(trimmed, 'chat/completions');
  }

  private buildHeaders(config: AIProviderConfig): Record<string, string> {
    const headers: Record<string, string> = { ...config.headers };
    if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
    return headers;
  }
}
