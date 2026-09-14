import { Injectable, Logger } from '@nestjs/common';
import type { AIProviderType } from '@paperclip/shared';
import { AgentService } from '../agents/agent.service.js';
import { AIProviderService } from '../ai/ai-provider.service.js';
import { asString, asStringArray } from '../ai/json.util.js';
import { ProductService } from './product.service.js';

export interface ScrapedProduct {
  title: string;
  price?: number;
  description?: string;
  imageUrl?: string;
  attributes?: Record<string, string>;
}

export interface EnhancedProduct extends ScrapedProduct {
  name: string;
  marketplaceTitle: string;
  category?: string;
  tags: string[];
  bulletPoints: string[];
  providerType: AIProviderType;
  model: string;
}

/**
 * Marketplace Hub.
 *
 * Product enrichment now goes through the swappable AI layer with a JSON
 * contract, so the result can be written straight into the product catalog.
 * Marketplace push endpoints (Shopee/Tokopedia) remain adapter stubs: each
 * channel needs its own credentials and signing scheme.
 */
@Injectable()
export class MarketplaceHubService {
  private readonly logger = new Logger(MarketplaceHubService.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly ai: AIProviderService,
    private readonly products: ProductService,
  ) {}

  /**
   * Fetch a product page and let the AI turn raw HTML text into clean catalog
   * data. Scraping itself is intentionally simple (no headless browser) so it
   * stays dependency-free; swap in a scraper service if you need JS rendering.
   */
  async importProductFromUrl(url: string, provider?: string): Promise<{
    sourceUrl: string;
    scraped: ScrapedProduct;
    enhanced: EnhancedProduct;
  }> {
    this.logger.log(`Import produk dari: ${url}`);

    const html = await this.fetchPage(url);
    const scraped = this.extractBasicData(html, url);

    const { data, response } = await this.ai.generateJson<any>(provider ?? null, {
      systemPrompt:
        'Anda adalah Marketplace Manager. Rapikan data produk mentah menjadi data katalog yang siap dipublikasikan ke marketplace Indonesia.',
      prompt: `Data mentah hasil scrape:\n${JSON.stringify(scraped, null, 2)}\n\nBalas HANYA JSON dengan skema:\n{\n  "name": string,\n  "marketplaceTitle": string,   // 60-100 karakter, keyword di depan\n  "description": string,\n  "price": number,\n  "category": string,\n  "tags": string[],\n  "bulletPoints": string[],\n  "attributes": object\n}`,
      temperature: 0.3,
    });

    const enhanced: EnhancedProduct = {
      ...scraped,
      name: asString(data?.name) || scraped.title,
      marketplaceTitle: asString(data?.marketplaceTitle) || asString(data?.name) || scraped.title,
      description: asString(data?.description) || scraped.description,
      price: Number(data?.price ?? scraped.price ?? 0),
      category: asString(data?.category) || undefined,
      tags: asStringArray(data?.tags, 10),
      bulletPoints: asStringArray(data?.bulletPoints, 10),
      attributes: (data?.attributes ?? {}) as Record<string, string>,
      providerType: response.providerType,
      model: response.model,
    };

    return { sourceUrl: url, scraped, enhanced };
  }

  /** Save an enhanced product into the catalog. */
  async saveEnhancedProduct(enhanced: EnhancedProduct, sourceUrl?: string) {
    return this.products.create({
      name: enhanced.name,
      description: enhanced.description,
      price: enhanced.price || 0,
      currency: 'IDR',
      sourceUrl,
      imageUrl: enhanced.imageUrl,
      category: enhanced.category,
      tags: enhanced.tags,
      attributes: enhanced.attributes,
    });
  }

  async pushToMarketplace(product: { id: string; name: string }, channel: { id: string; name: string }) {
    this.logger.warn(
      `Push ke ${channel.name} masih stub. Implementasikan adapter kanal (OAuth + signing) di marketplace-hub.service.ts`,
    );
    return {
      success: false,
      marketplaceId: null,
      message: `Adapter ${channel.name} belum diimplementasikan. Produk ${product.id} (${product.name}) siap dikirim setelah credentials diisi.`,
    };
  }

  /** Channels the hub knows about; status comes from stored credentials. */
  listChannels() {
    return [
      { id: 'shopee', name: 'Shopee', adapter: 'stub', docs: 'https://open.shopee.com/' },
      { id: 'tokopedia', name: 'Tokopedia', adapter: 'stub', docs: 'https://developer.tokopedia.com/' },
      { id: 'tiktokshop', name: 'TikTok Shop', adapter: 'stub', docs: 'https://partner.tiktokshop.com/doc' },
      { id: 'lazada', name: 'Lazada', adapter: 'stub', docs: 'https://open.lazada.com/' },
      { id: 'blibli', name: 'Blibli', adapter: 'stub', docs: 'https://seller.blibli.com/' },
    ];
  }

  /* -------------------------------- helpers -------------------------------- */

  private async fetchPage(url: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; PaperclipCommerceBot/1.1)' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      return await res.text();
    } catch (err: any) {
      this.logger.warn(`Gagal mengambil ${url}: ${err?.message ?? err}`);
      return '';
    }
  }

  /**
   * Deliberately conservative extraction: Open Graph tags plus the page title.
   * Anything richer is left to the AI step.
   */
  private extractBasicData(html: string, url: string): ScrapedProduct {
    const meta = (property: string): string | undefined => {
      const patterns = [
        new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i'),
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return this.decodeEntities(match[1]);
      }
      return undefined;
    };

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = meta('og:title') ?? (titleMatch?.[1] ? this.decodeEntities(titleMatch[1].trim()) : url);

    const priceRaw = meta('product:price:amount') ?? meta('og:price:amount');
    const price = priceRaw ? Number.parseFloat(priceRaw) : undefined;

    return {
      title: (title ?? url).slice(0, 300),
      price: Number.isFinite(price) ? price : undefined,
      description: meta('og:description') ?? meta('description'),
      imageUrl: meta('og:image'),
    };
  }

  private decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }
}
