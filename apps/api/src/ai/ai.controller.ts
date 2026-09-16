import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { UpsertAIProviderInput } from '@paperclip/shared';
import { AiConfigService } from './ai-config.service.js';
import { AIProviderService } from './ai-provider.service.js';
import { DataStoreService } from '../storage/data-store.service.js';

/**
 * REST surface for the AI provider switcher.
 * The Settings UI is a thin client over these endpoints.
 */
@Controller('ai')
export class AiController {
  constructor(
    private readonly configService: AiConfigService,
    private readonly providerService: AIProviderService,
    private readonly store: DataStoreService,
  ) {}

  /** All resolved providers (env-seeded + store overrides), keys masked. */
  @Get('providers')
  async listProviders() {
    const providers = await this.configService.listDTOs();
    const active = await this.configService.resolveDefault();
    return { providers, activeProviderType: active.type, activeProviderId: active.id };
  }

  /** Static catalog: endpoints, suggested models, which env vars are filled. */
  @Get('providers/catalog')
  catalog() {
    return { providers: this.configService.describeCatalog() };
  }

  @Get('status')
  async status() {
    const active = await this.configService.resolveDefault();
    const chain = await this.configService.resolveChain(active);
    return {
      default: this.configService.toDTO(active),
      fallbackChain: chain.map((c) => ({ type: c.type, model: c.model, source: c.source, ready: c.ready })),
      storage: this.store.describe(),
      mockFallbackAllowed: (process.env.AI_ALLOW_MOCK_FALLBACK ?? 'true') !== 'false',
    };
  }

  @Post('providers')
  async createProvider(@Body() body: UpsertAIProviderInput) {
    const record = await this.configService.upsert({ ...body, id: undefined });
    const resolved = await this.configService.resolveByIdOrType(record.id);
    return resolved ? this.configService.toDTO(resolved) : record;
  }

  @Patch('providers/:id')
  async updateProvider(@Param('id') id: string, @Body() body: Partial<UpsertAIProviderInput>) {
    const record = await this.configService.upsert({ ...body, id } as UpsertAIProviderInput);
    const resolved = await this.configService.resolveByIdOrType(record.id);
    return resolved ? this.configService.toDTO(resolved) : record;
  }

  @Delete('providers/:id')
  async deleteProvider(@Param('id') id: string) {
    const removed = await this.configService.remove(id);
    return { removed, id };
  }

  @Post('providers/:id/test')
  @HttpCode(200)
  async testProvider(@Param('id') id: string) {
    return this.providerService.testProvider(id);
  }

  /** Ad-hoc completion - handy for verifying a new key from the terminal. */
  @Post('generate')
  @HttpCode(200)
  async generate(
    @Body()
    body: {
      prompt: string;
      systemPrompt?: string;
      provider?: string;
      temperature?: number;
      maxTokens?: number;
      responseFormat?: 'text' | 'json';
    },
  ) {
    return this.providerService.generateResponse(body.provider ?? null, {
      prompt: body.prompt,
      systemPrompt: body.systemPrompt,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      responseFormat: body.responseFormat,
    });
  }
}
