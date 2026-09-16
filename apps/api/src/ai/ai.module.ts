import { Global, Module } from '@nestjs/common';
import { AiController } from './ai.controller.js';
import { AiConfigService } from './ai-config.service.js';
import { AIProviderService } from './ai-provider.service.js';

@Global()
@Module({
  controllers: [AiController],
  providers: [AiConfigService, AIProviderService],
  exports: [AiConfigService, AIProviderService],
})
export class AiModule {}
