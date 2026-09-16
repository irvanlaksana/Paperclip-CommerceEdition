import { Body, Controller, Get, Put } from '@nestjs/common';
import { SystemConfigService } from './system-config.service.js';

@Controller('config')
export class ConfigController {
  constructor(private readonly config: SystemConfigService) {}

  @Get('infrastructure')
  async getInfrastructure() {
    const [current, options] = [await this.config.getInfrastructure(), this.config.options()];
    return { ...current, options };
  }

  @Put('infrastructure')
  saveInfrastructure(
    @Body() body: { database?: string; storage?: string; runtime?: string },
  ) {
    return this.config.saveInfrastructure(body ?? {});
  }
}
