import type { AIDriverKind } from '@paperclip/shared';
import { AnthropicDriver } from './drivers/anthropic.driver.js';
import { GeminiDriver } from './drivers/gemini.driver.js';
import { MockDriver } from './drivers/mock.driver.js';
import { OpenAICompatibleDriver } from './drivers/openai-compatible.driver.js';
import type { AIDriver } from './drivers/types.js';

/**
 * Driver registry.
 *
 * Four drivers cover all eleven provider types, because most vendors speak the
 * OpenAI chat-completions dialect. To support a genuinely new protocol,
 * implement `AIDriver` and call `registerDriver()` - nothing else changes.
 */
export class DriverRegistry {
  private readonly drivers = new Map<AIDriverKind, AIDriver>();

  constructor() {
    this.register(new OpenAICompatibleDriver());
    this.register(new GeminiDriver());
    this.register(new AnthropicDriver());
    this.register(new MockDriver());
  }

  register(driver: AIDriver): this {
    this.drivers.set(driver.kind, driver);
    return this;
  }

  get(kind: AIDriverKind): AIDriver {
    const driver = this.drivers.get(kind);
    if (!driver) {
      throw new Error(
        `No AI driver registered for kind "${kind}". Panggil DriverRegistry.register() dengan implementasi AIDriver.`,
      );
    }
    return driver;
  }

  has(kind: AIDriverKind): boolean {
    return this.drivers.has(kind);
  }

  list(): AIDriverKind[] {
    return [...this.drivers.keys()];
  }
}

/** Process-wide default registry (Nest DI wraps this in AiProviderService). */
export const defaultDriverRegistry = new DriverRegistry();
