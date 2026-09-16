import { Injectable, Logger } from '@nestjs/common';
import { DataStoreService } from '../storage/data-store.service.js';
import { ProductService } from '../commerce/product.service.js';

interface SheetConnectionRecord {
  id: string;
  key: string;
  category: string;
  value: string;
  updatedAt: string;
}

const CONNECTION_KEY = 'google-sheets:connection';

/**
 * Google Workspace integration.
 *
 * OAuth credentials come from the environment (GOOGLE_CLIENT_ID /
 * GOOGLE_CLIENT_SECRET); the resulting connection state is persisted through
 * the data store so it survives restarts. The Sheets API calls are implemented
 * against the public REST endpoints with a Bearer token - no Google SDK, which
 * keeps this file consistent with the dependency-free approach used for AI.
 */
@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private readonly scope = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

  constructor(
    private readonly store: DataStoreService,
    private readonly products: ProductService,
  ) {}

  get isConfigured(): boolean {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  /** URL the browser should be sent to for the OAuth consent screen. */
  authorizationUrl(state = 'paperclip'): string | null {
    if (!this.isConfigured) return null;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:4000/integrations/google/callback',
      response_type: 'code',
      scope: this.scope,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async status() {
    const connection = await this.getConnection();
    return {
      configured: this.isConfigured,
      connected: connection?.status === 'CONNECTED',
      status: connection?.status ?? 'NOT_CONFIGURED',
      email: connection?.email ?? null,
      spreadsheetId: connection?.spreadsheetId ?? null,
      connectedAt: connection?.connectedAt ?? null,
      authorizeUrl: this.isConfigured ? this.authorizationUrl() : null,
      missingEnv: this.isConfigured ? [] : ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    };
  }

  /** Exchange an authorization code for tokens (real OAuth call). */
  async connectAccount(authCode: string) {
    if (!this.isConfigured) {
      return {
        status: 'NOT_CONFIGURED',
        error: 'GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum diisi di .env',
      };
    }

    const started = Date.now();
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: authCode,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:4000/integrations/google/callback',
          grant_type: 'authorization_code',
        }),
      });

      const data: any = await res.json();
      if (!res.ok) {
        return { status: 'FAILED', error: data?.error_description ?? data?.error ?? `HTTP ${res.status}` };
      }

      const connection = {
        status: 'CONNECTED',
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
        connectedAt: new Date().toISOString(),
        email: null as string | null,
        spreadsheetId: null as string | null,
      };

      await this.saveConnection(connection);
      this.logger.log(`Google account terhubung dalam ${Date.now() - started}ms.`);
      return { status: connection.status, connectedAt: connection.connectedAt };
    } catch (err: any) {
      this.logger.error(`OAuth exchange gagal: ${err?.message ?? err}`);
      return { status: 'FAILED', error: err?.message ?? String(err) };
    }
  }

  async syncProductsToSheet(spreadsheetId: string, sheetName = 'Products') {
    const connection = await this.getConnection();
    if (!connection?.accessToken) {
      return { success: false, error: 'Google account belum terhubung.' };
    }

    const products = await this.products.list();
    const header = ['Nama', 'SKU', 'Harga', 'Kategori', 'Deskripsi', 'Tag'];
    const rows = products.map((p) => [
      p.name,
      p.sku ?? '',
      String(p.price ?? ''),
      p.category ?? '',
      p.description ?? '',
      (p.tags ?? []).join(', '),
    ]);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}/values/${encodeURIComponent(`${sheetName}!A1`)}?valueInputOption=RAW`;

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${await this.validAccessToken(connection)}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ range: `${sheetName}!A1`, values: [header, ...rows] }),
      });
      const data: any = await res.json();
      if (!res.ok) return { success: false, error: data?.error?.message ?? `HTTP ${res.status}` };
      return { success: true, rowsUpdated: products.length, response: data };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  }

  async createProductSheet(title: string) {
    const connection = await this.getConnection();
    if (!connection?.accessToken) {
      return { success: false, error: 'Google account belum terhubung.' };
    }

    try {
      const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await this.validAccessToken(connection)}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title },
          sheets: [{ properties: { title: 'Products', gridProperties: { rowCount: 500, columnCount: 8 } } }],
        }),
      });
      const data: any = await res.json();
      if (!res.ok) return { success: false, error: data?.error?.message ?? `HTTP ${res.status}` };

      await this.saveConnection({ ...connection, spreadsheetId: data.spreadsheetId });
      return { success: true, spreadsheetId: data.spreadsheetId, url: data.spreadsheetUrl };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  }

  /* -------------------------------- helpers -------------------------------- */

  private async getConnection(): Promise<any | null> {
    const record = await this.store.get<SheetConnectionRecord>('config', CONNECTION_KEY);
    if (!record?.value) return null;
    try {
      return JSON.parse(record.value);
    } catch {
      return null;
    }
  }

  private async saveConnection(connection: any): Promise<void> {
    const record: SheetConnectionRecord = {
      id: CONNECTION_KEY,
      key: CONNECTION_KEY,
      category: 'INTEGRATION',
      value: JSON.stringify(connection),
      updatedAt: new Date().toISOString(),
    };
    const existing = await this.store.get<SheetConnectionRecord>('config', CONNECTION_KEY);
    if (existing) await this.store.update<SheetConnectionRecord>('config', CONNECTION_KEY, record);
    else await this.store.insert<SheetConnectionRecord>('config', record);
  }

  /** Refresh the access token when it is close to expiry. */
  private async validAccessToken(connection: any): Promise<string> {
    if (!connection.refreshToken) return connection.accessToken;
    if (connection.expiresAt && Date.now() < connection.expiresAt - 60_000) return connection.accessToken;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        refresh_token: connection.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const data: any = await res.json();
    if (!res.ok) return connection.accessToken;

    const next = {
      ...connection,
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    await this.saveConnection(next);
    return next.accessToken;
  }
}
