import { Controller, Get } from '@nestjs/common';
import { AiConfigService } from './ai/ai-config.service.js';
import { DataStoreService } from './storage/data-store.service.js';

@Controller()
export class HealthController {
  constructor(
    private readonly aiConfig: AiConfigService,
    private readonly store: DataStoreService,
  ) {}

  @Get('health')
  async health() {
    const active = await this.aiConfig.resolveDefault();
    return {
      status: 'ok',
      service: 'paperclip-commerce-api',
      version: '1.1.0',
      time: new Date().toISOString(),
      ai: {
        defaultProvider: active.type,
        model: active.model,
        source: active.source,
        ready: active.ready,
        mockMode: active.type === 'MOCK',
      },
      storage: this.store.describe(),
    };
  }

  @Get()
  root() {
    return {
      name: 'Paperclip Commerce Edition API',
      docs: '/health, /ai/providers, /ai/providers/catalog, /ai/status, /content/meta, /content/runs',
    };
  }
}
