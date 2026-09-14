import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module.js';
import { IntegrationsController } from './integrations.controller.js';
import { GoogleSheetsService } from './google-sheets.service.js';

@Module({
  imports: [CommerceModule],
  controllers: [IntegrationsController],
  providers: [GoogleSheetsService],
  exports: [GoogleSheetsService],
})
export class IntegrationsModule {}
