import type { AIProviderConfig, AIRequest, AIResponse } from '@paperclip/shared';
import { estimateTokens, joinUrl, makeUsage, postJson } from '../http.util.js';
import type { AIDriver } from './types.js';

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
  stop_reason?: string;
  error?: { type?: string; message?: string };
}

/**
 * Anthropic Claude native Messages driver (`/v1/messages`).
 * `max_tokens` is mandatory on this API, so a sane default is always supplied.
 */
export class AnthropicDriver implements AIDriver {
  readonly kind = 'anthropic' as const;

  async generate(config: AIProviderConfig, request: AIRequest): Promise<AIResponse> {
    const started = Date.now();
    const url = this.resolveUrl(config.endpoint);

    let prompt = request.prompt;
    // Claude has no native JSON mode: the contract is restated in the prompt.
    if (request.responseFormat === 'json' && !/json/i.test(prompt)) {
      prompt = `${prompt}\n\nPENTING: balas HANYA dengan satu objek JSON valid, tanpa teks lain dan tanpa markdown fence.`;
    }

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: request.maxTokens ?? config.maxTokens ?? 2048,
      messages: [{ role: 'user', content: prompt }],
      temperature: request.temperature ?? config.temperature ?? 0.7,
    };
    if (request.systemPrompt?.trim()) body.system = request.systemPrompt.trim();
    if (request.stop?.length) body.stop_sequences = request.stop;

    const data = await postJson<AnthropicResponse>(
      url,
      body,
      this.buildHeaders(config),
      config.timeoutMs ?? 60_000,
      `${config.type}/${config.model}`,
    );

    if (data.error?.message) {
      throw new Error(`Claude API error (${data.error.type ?? 'error'}): ${data.error.message}`);
    }

    const text = (data.content ?? [])
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text ?? '')
      .join('')
      .trim();

    return {
      text,
      usage: makeUsage(
        data.usage?.input_tokens ?? estimateTokens(`${request.systemPrompt ?? ''}\n${prompt}`),
        data.usage?.output_tokens ?? estimateTokens(text),
      ),
      providerType: config.type,
      model: data.model ?? config.model,
      latencyMs: Date.now() - started,
      finishReason: data.stop_reason,
    };
  }

  async ping(config: AIProviderConfig): Promise<{ ok: boolean; detail?: string }> {
    // Anthropic has no cheap GET endpoint, so send a 1-token message.
    try {
      await postJson<AnthropicResponse>(
        this.resolveUrl(config.endpoint),
        { model: config.model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] },
        this.buildHeaders(config),
        15_000,
        `${config.type}/ping`,
      );
      return { ok: true, detail: 'terhubung' };
    } catch (err: any) {
      return { ok: false, detail: err?.message ?? String(err) };
    }
  }

  private resolveUrl(endpoint: string): string {
    const trimmed = (endpoint ?? '').replace(/\/+$/, '');
    if (/\/v1\/messages$/.test(trimmed)) return trimmed;
    // Accept both https://api.anthropic.com and https://api.anthropic.com/v1
    return joinUrl(trimmed.replace(/\/v1$/, ''), 'v1/messages');
  }

  private buildHeaders(config: AIProviderConfig): Record<string, string> {
    return {
      'anthropic-version': '2023-06-01',
      ...config.headers,
      ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
    };
  }
}
