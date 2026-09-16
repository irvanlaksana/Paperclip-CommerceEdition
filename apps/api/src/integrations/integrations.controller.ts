import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service.js';

@Controller('integrations/google')
export class IntegrationsController {
  constructor(private readonly sheets: GoogleSheetsService) {}

  @Get('status')
  status() {
    return this.sheets.status();
  }

  @Post('connect')
  @HttpCode(200)
  connect(@Body() body: { code: string }) {
    return this.sheets.connectAccount(body.code);
  }

  @Post('sheets')
  @HttpCode(200)
  createSheet(@Body() body: { title?: string }) {
    return this.sheets.createProductSheet(body.title ?? 'Paperclip Product Catalog');
  }

  @Post('sheets/:spreadsheetId/sync')
  @HttpCode(200)
  sync(
    @Param('spreadsheetId') spreadsheetId: string,
    @Body() body: { sheetName?: string },
  ) {
    return this.sheets.syncProductsToSheet(spreadsheetId, body?.sheetName ?? 'Products');
  }
}
