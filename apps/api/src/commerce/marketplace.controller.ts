import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { MarketplaceHubService } from './marketplace-hub.service.js';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly hub: MarketplaceHubService) {}

  @Get('channels')
  channels() {
    return this.hub.listChannels();
  }

  @Post('import')
  @HttpCode(200)
  async importFromUrl(@Body() body: { url: string; provider?: string }) {
    return this.hub.importProductFromUrl(body.url, body.provider);
  }

  @Post('import/save')
  @HttpCode(200)
  async importAndSave(@Body() body: { url: string; provider?: string }) {
    const result = await this.hub.importProductFromUrl(body.url, body.provider);
    const product = await this.hub.saveEnhancedProduct(result.enhanced, body.url);
    return { ...result, savedProduct: product };
  }
}
