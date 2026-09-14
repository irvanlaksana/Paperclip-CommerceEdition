import { Module } from '@nestjs/common';
import { AgentModule } from '../agents/agent.module.js';
import { ContentStoreService } from './content-store.service.js';
import { ContentStudioController } from './content-studio.controller.js';
import { ContentStudioService } from './content-studio.service.js';
import { MarketplaceController } from './marketplace.controller.js';
import { MarketplaceHubService } from './marketplace-hub.service.js';
import { ProductService } from './product.service.js';

@Module({
  imports: [AgentModule],
  controllers: [ContentStudioController, MarketplaceController],
  providers: [ContentStudioService, ContentStoreService, ProductService, MarketplaceHubService],
  exports: [ContentStudioService, ContentStoreService, ProductService, MarketplaceHubService],
})
export class CommerceModule {}
