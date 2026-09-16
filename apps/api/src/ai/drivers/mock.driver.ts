import type { AIProviderConfig, AIRequest, AIResponse } from '@paperclip/shared';
import { estimateTokens, makeUsage, sleep, truncate } from '../http.util.js';
import type { AIDriver } from './types.js';

/**
 * Offline driver. Never touches the network.
 *
 * Two jobs:
 *  1. `MOCK` as an explicit provider type for demos, CI and local development.
 *  2. Graceful degradation - when no API key is configured anywhere, the
 *     provider service can fall back to this instead of crashing the pipeline.
 *
 * It is JSON-mode aware, so the content pipeline still produces a complete,
 * correctly shaped result while you wait for real credentials.
 */
export class MockDriver implements AIDriver {
  readonly kind = 'mock' as const;

  async generate(config: AIProviderConfig, request: AIRequest): Promise<AIResponse> {
    const started = Date.now();
    await sleep(180);

    const text =
      request.responseFormat === 'json'
        ? this.buildJsonSample(request)
        : this.buildTextSample(config, request);

    return {
      text,
      usage: makeUsage(
        estimateTokens(`${request.systemPrompt ?? ''}\n${request.prompt}`),
        estimateTokens(text),
      ),
      providerType: config.type,
      model: config.model,
      latencyMs: Date.now() - started,
      finishReason: 'mock',
    };
  }

  async ping(): Promise<{ ok: boolean; detail?: string }> {
    return { ok: true, detail: 'Driver offline aktif (tidak ada panggilan jaringan)' };
  }

  private buildTextSample(config: AIProviderConfig, request: AIRequest): string {
    return [
      `[${config.type} • ${config.model} • MODE MOCK]`,
      `API key belum diisi, jadi jawaban ini dihasilkan secara offline.`,
      ``,
      `System: ${truncate(request.systemPrompt ?? '-', 160)}`,
      `Prompt: ${truncate(request.prompt, 320)}`,
    ].join('\n');
  }

  /**
   * Emits a payload that satisfies the pipeline's JSON schemas so the UI can be
   * exercised end to end without a key.
   */
  private buildJsonSample(request: AIRequest): string {
    const prompt = request.prompt;

    if (prompt.includes('"stage":"RESEARCH"') || prompt.includes('RESEARCH')) {
      return JSON.stringify({
        targetAudience: ['Gen Z 18-24', 'Milenial 25-34', 'Pekerja urban'],
        painPoints: ['Baterai cepat habis', 'Harga tidak sebanding kualitas', 'Suara bocor saat dipakai di luar'],
        uniqueSellingPoints: ['Baterai 40 jam', 'Active Noise Cancelling hybrid', 'Garansi resmi 12 bulan'],
        angles: ['Produktivitas harian', 'Gaya hidup aktif', 'Hemat biaya jangka panjang'],
        toneAdvice: 'Santai, percaya diri, gunakan emoji secukupnya dan satu CTA jelas.',
        competitorKeywords: ['earbuds murah', 'tws anc', 'headset bluetooth'],
      });
    }

    if (prompt.includes('CAPTIONS') || prompt.includes('platform')) {
      const platform = (prompt.match(/INSTAGRAM|TIKTOK|FACEBOOK|WHATSAPP|X|MARKETPLACE/) ?? ['INSTAGRAM'])[0];
      return JSON.stringify({
        platform,
        hook: '🔥 Stop scroll — ini yang bikin audio kamu naik level.',
        body:
          'Premium Wireless Earbuds Pro: ANC hybrid, baterai 40 jam, dan panggilan sejernih studio.\n\n' +
          'Cocok buat commute, kerja, sampai olahraga. Sekali charge, lupa colokan seharian.',
        cta: 'Checkout sekarang lewat link di bio 👇 stok terbatas!',
        hashtags: ['#EarbudsPro', '#GadgetMurah', '#TechIndonesia', '#ANC', '#RacunShopping'],
        bestTimeToPost: platform === 'TIKTOK' ? '19:00-21:00' : '12:00-13:00',
      });
    }

    if (prompt.includes('SEO')) {
      return JSON.stringify({
        marketplaceTitle: 'Premium Wireless Earbuds Pro ANC 40 Jam - Garansi Resmi',
        metaDescription:
          'Earbuds ANC hybrid dengan baterai 40 jam, panggilan jernih, dan garansi resmi 12 bulan. Gratis ongkir seluruh Indonesia.',
        primaryKeyword: 'earbuds anc',
        keywords: ['earbuds anc', 'tws bluetooth', 'earbuds baterai awet', 'headset wireless'],
        longTailKeywords: [
          'earbuds anc murah terbaik 2026',
          'tws baterai 40 jam garansi resmi',
          'earbuds untuk kerja dan olahraga',
        ],
        bulletPoints: [
          'Hybrid Active Noise Cancelling',
          'Baterai total 40 jam dengan case',
          'Bluetooth 5.3 low latency',
          'IPX5 tahan keringat',
          'Garansi resmi 12 bulan',
        ],
      });
    }

    if (prompt.includes('VISUAL')) {
      return JSON.stringify({
        imagePrompt:
          'Product photography of matte black wireless earbuds floating above a neon-lit desk, soft rim light, shallow depth of field, ultra sharp, 4k, e-commerce hero shot',
        videoScript:
          'SHOT 1 (0-2s): close-up tangan membuka case. SHOT 2 (2-5s): teks "40 JAM NONSTOP". SHOT 3 (5-8s): orang commute pakai earbuds, suasana kota. SHOT 4 (8-10s): logo + CTA.',
        styleNotes: 'Palet gelap dengan aksen biru elektrik, kontras tinggi, motion cepat untuk TikTok/Reels.',
      });
    }

    if (prompt.includes('SCHEDULE')) {
      return JSON.stringify({
        items: [
          { day: 'Senin', date: '', platform: 'INSTAGRAM', time: '12:00', contentRef: 'CAPTIONS:INSTAGRAM', note: 'Feed + carousel USP' },
          { day: 'Selasa', date: '', platform: 'TIKTOK', time: '19:30', contentRef: 'VISUAL:TIKTOK', note: 'Video pendek hook 3 detik' },
          { day: 'Rabu', date: '', platform: 'WHATSAPP', time: '10:00', contentRef: 'CAPTIONS:WHATSAPP', note: 'Broadcast promo' },
          { day: 'Kamis', date: '', platform: 'FACEBOOK', time: '18:00', contentRef: 'CAPTIONS:FACEBOOK', note: 'Testimonial pelanggan' },
          { day: 'Jumat', date: '', platform: 'X', time: '11:00', contentRef: 'CAPTIONS:X', note: 'Thread perbandingan fitur' },
          { day: 'Sabtu', date: '', platform: 'INSTAGRAM', time: '20:00', contentRef: 'VISUAL:INSTAGRAM', note: 'Story polling' },
          { day: 'Minggu', date: '', platform: 'MARKETPLACE', time: '09:00', contentRef: 'SEO:MARKETPLACE', note: 'Update judul & keyword listing' },
        ],
      });
    }

    return JSON.stringify({ result: 'mock-response', echo: truncate(prompt, 200) });
  }
}
