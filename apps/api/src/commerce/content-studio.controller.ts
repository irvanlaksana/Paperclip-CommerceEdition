import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CONTENT_PLATFORMS,
  CONTENT_TONES,
  PLATFORM_LABELS,
  type ContentRunInput,
  type WorkProductStatus,
} from '@paperclip/shared';
import { ContentStudioService } from './content-studio.service.js';
import { ContentStoreService } from './content-store.service.js';
import { ProductService } from './product.service.js';
import { AgentService } from '../agents/agent.service.js';

@Controller('content')
export class ContentStudioController {
  constructor(
    private readonly contentStudio: ContentStudioService,
    private readonly store: ContentStoreService,
    private readonly products: ProductService,
    private readonly agents: AgentService,
  ) {}

  /** Options for the Content Studio form. */
  @Get('meta')
  meta() {
    return {
      platforms: CONTENT_PLATFORMS.map((platform) => ({
        value: platform,
        label: PLATFORM_LABELS[platform],
      })),
      tones: CONTENT_TONES,
      stages: this.contentStudio.describePipeline(),
      agents: this.agents.listAgents().map(({ id, name, role, providerType }) => ({
        id,
        name,
        role,
        providerType,
      })),
    };
  }

  @Get('products')
  listProducts() {
    return this.products.list();
  }

  @Post('products')
  createProduct(@Body() body: any) {
    return this.products.create(body);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() body: any) {
    return this.products.update(id, body);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.products.remove(id);
  }

  /** Start a pipeline run. Returns immediately; poll GET /content/runs/:id. */
  @Post('runs')
  @HttpCode(202)
  startRun(@Body() body: ContentRunInput) {
    return this.contentStudio.startRun(body);
  }

  @Get('runs')
  listRuns(@Query('limit') limit?: string) {
    return this.contentStudio.listRuns(limit ? Number.parseInt(limit, 10) : 25);
  }

  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return this.contentStudio.getRun(id);
  }

  /** Re-run a failed/partial run with the same input. */
  @Post('runs/:id/retry')
  @HttpCode(202)
  async retryRun(@Param('id') id: string) {
    const existing = await this.contentStudio.getRun(id);
    return this.contentStudio.startRun({
      ...existing.input,
      stages: existing.stages
        .filter((stage) => stage.status === 'FAILED' || stage.status === 'SKIPPED')
        .map((stage) => stage.stage),
    });
  }

  @Delete('runs/:id')
  deleteRun(@Param('id') id: string) {
    return this.contentStudio.deleteRun(id);
  }

  @Patch('work-products/:id/status')
  @HttpCode(200)
  setWorkProductStatus(
    @Param('id') id: string,
    @Body() body: { status: WorkProductStatus },
  ) {
    return this.contentStudio.setWorkProductStatus(id, body?.status ?? 'DRAFT');
  }

  @Get('work-products')
  listWorkProducts(@Query('runId') runId?: string) {
    return this.store.listWorkProducts(runId);
  }
}
