import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module.js';
import { CommerceModule } from './commerce/commerce.module.js';
import { ConfigModule } from './config/config.module.js';
import { HealthController } from './health.controller.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { StorageModule } from './storage/storage.module.js';

/**
 * StorageModule and AiModule are @Global so every feature module can inject
 * the data store and the AI provider service without re-importing them.
 */
@Module({
  imports: [StorageModule, AiModule, ConfigModule, CommerceModule, IntegrationsModule],
  controllers: [HealthController],
})
export class AppModule {}
