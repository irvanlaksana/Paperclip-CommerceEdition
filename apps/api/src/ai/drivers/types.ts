import type { AIProviderConfig, AIRequest, AIResponse, AIDriverKind } from '@paperclip/shared';

/**
 * A driver is the only place that knows the wire protocol of a vendor family.
 * Everything above it (agents, content pipeline, controllers) works with the
 * neutral AIRequest/AIResponse pair.
 */
export interface AIDriver {
  readonly kind: AIDriverKind;
  generate(config: AIProviderConfig, request: AIRequest): Promise<AIResponse>;
  /** Cheap connectivity check used by the "Test connection" button. */
  ping?(config: AIProviderConfig): Promise<{ ok: boolean; detail?: string }>;
}

export type DriverFactory = () => AIDriver;
