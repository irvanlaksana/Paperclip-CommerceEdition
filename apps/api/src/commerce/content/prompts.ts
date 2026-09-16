import type { ContentPlatform, ContentRunInput, ContentTone, ResearchOutput } from '@paperclip/shared';

/**
 * Prompt engineering for the content pipeline lives in one file so the
 * behaviour of every stage can be tuned without touching orchestration code.
 */

export interface PlatformRule {
  platform: ContentPlatform;
  maxCharacters: number;
  hashtagRange: [number, number];
  emoji: 'heavy' | 'moderate' | 'light' | 'none';
  guidance: string;
}

export const PLATFORM_RULES: Record<ContentPlatform, PlatformRule> = {
  INSTAGRAM: {
    platform: 'INSTAGRAM',
    maxCharacters: 1800,
    hashtagRange: [5, 12],
    emoji: 'moderate',
    guidance:
      'Caption feed/reels: hook kuat di 125 karakter pertama (terpotong di preview), baris pendek dipisah enter, satu CTA ke link di bio.',
  },
  TIKTOK: {
    platform: 'TIKTOK',
    maxCharacters: 900,
    hashtagRange: [3, 6],
    emoji: 'heavy',
    guidance:
      'Gaya spoken-word, hook 3 detik pertama, kalimat sangat pendek, ikut tren, CTA lunak (keranjang kuning / komen).',
  },
  FACEBOOK: {
    platform: 'FACEBOOK',
    maxCharacters: 1500,
    hashtagRange: [2, 5],
    emoji: 'light',
    guidance:
      'Lebih naratif dan informatif, cocok untuk audiens 28+, boleh menyertakan testimoni, manfaat, dan CTA ke WhatsApp/marketplace.',
  },
  WHATSAPP: {
    platform: 'WHATSAPP',
    maxCharacters: 700,
    hashtagRange: [0, 2],
    emoji: 'moderate',
    guidance:
      'Format broadcast/status: sapaan personal, langsung ke promo dan harga, gunakan *bold* markdown WhatsApp, CTA balas chat atau klik link.',
  },
  X: {
    platform: 'X',
    maxCharacters: 270,
    hashtagRange: [1, 3],
    emoji: 'light',
    guidance: 'Satu post maksimal 270 karakter, padat dan tajam, tanpa clickbait berlebihan.',
  },
  MARKETPLACE: {
    platform: 'MARKETPLACE',
    maxCharacters: 1000,
    hashtagRange: [0, 0],
    emoji: 'none',
    guidance:
      'Deskripsi listing Shopee/Tokopedia: judul mengandung keyword utama, bullet spesifikasi, info garansi & pengiriman, tanpa hashtag.',
  },
};

export const TONE_GUIDANCE: Record<ContentTone, string> = {
  casual: 'Santai dan akrab, seperti teman yang merekomendasikan barang. Boleh pakai bahasa gaul yang wajar.',
  hype: 'Energetik dan mendesak, huruf kapital secukupnya pada kata kunci, banyak emoji, FOMO yang jujur.',
  professional: 'Rapi, informatif, fokus pada spesifikasi dan nilai bisnis. Minim emoji.',
  storytelling: 'Bercerita: mulai dari situasi/masalah, lalu produk hadir sebagai solusi, akhiri dengan CTA.',
  humorous: 'Humor ringan dan relevan, tidak menyinggung, tetap menyampaikan manfaat produk.',
};

export const LOCALE_LABELS: Record<string, string> = {
  'id-ID': 'Bahasa Indonesia',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'ms-MY': 'Bahasa Melayu',
};

function languageLabel(locale: string): string {
  return LOCALE_LABELS[locale] ?? locale;
}

function productBlock(input: ContentRunInput): string {
  const p = input.product;
  const lines = [
    `Nama produk : ${p.name}`,
    p.description ? `Deskripsi   : ${p.description}` : null,
    p.price !== undefined && p.price !== null
      ? `Harga       : ${p.currency ?? 'IDR'} ${Number(p.price).toLocaleString('id-ID')}`
      : null,
    p.category ? `Kategori    : ${p.category}` : null,
    p.tags?.length ? `Tag         : ${p.tags.join(', ')}` : null,
    p.attributes && Object.keys(p.attributes).length
      ? `Atribut     : ${Object.entries(p.attributes).map(([k, v]) => `${k}=${v}`).join('; ')}`
      : null,
    input.brandName ? `Brand       : ${input.brandName}` : null,
    input.ctaUrl ? `Link CTA    : ${input.ctaUrl}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

function researchBlock(research?: ResearchOutput): string {
  if (!research) return '(tahap riset dilewati - ambil kesimpulan sendiri dari data produk)';
  return [
    `Target audiens : ${research.targetAudience.join(', ')}`,
    `Pain point     : ${research.painPoints.join(', ')}`,
    `USP            : ${research.uniqueSellingPoints.join(', ')}`,
    `Angle          : ${research.angles.join(', ')}`,
    `Saran tone     : ${research.toneAdvice}`,
    research.competitorKeywords?.length
      ? `Keyword pasar  : ${research.competitorKeywords.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export interface PromptContext {
  input: ContentRunInput;
  research?: ResearchOutput;
}

const baseRules = (ctx: PromptContext) => `
Konteks kampanye:
${productBlock(ctx.input)}

Hasil riset:
${researchBlock(ctx.research)}

Aturan umum:
- Bahasa: ${languageLabel(ctx.input.locale ?? 'id-ID')}.
- Tone: ${TONE_GUIDANCE[ctx.input.tone ?? 'casual']}.
- Dilarang mengklaim hal yang tidak ada di data produk (misal diskon, garansi, atau stok) kecuali disebutkan.
- Jangan gunakan placeholder seperti [Nama Brand] atau Lorem ipsum.
- Balas HANYA dengan JSON valid sesuai skema, tanpa markdown fence dan tanpa penjelasan.`.trim();

/* --------------------------------- RESEARCH -------------------------------- */

export function researchPrompt(ctx: PromptContext): string {
  return `${baseRules(ctx)}

Tahap: RESEARCH
Tugas: analisis produk untuk kebutuhan konten e-commerce.

Skema JSON:
{
  "targetAudience": string[],        // 3-5 segmen spesifik
  "painPoints": string[],            // 3-6 masalah yang diselesaikan produk
  "uniqueSellingPoints": string[],   // 3-6 keunggulan, urut dari yang paling kuat
  "angles": string[],                // 3-5 angle konten
  "toneAdvice": string,              // 1-2 kalimat panduan gaya bahasa
  "competitorKeywords": string[]     // 5-10 kata kunci pencarian pasar
}`;
}

/* --------------------------------- CAPTIONS -------------------------------- */

export function captionPrompt(ctx: PromptContext, platform: ContentPlatform): string {
  const rule = PLATFORM_RULES[platform];
  return `${baseRules(ctx)}

Tahap: CAPTIONS untuk platform ${platform}
Panduan platform: ${rule.guidance}
Batas panjang: maksimal ${rule.maxCharacters} karakter untuk field "body".
Jumlah hashtag: ${rule.hashtagRange[0]}-${rule.hashtagRange[1]}.
Penggunaan emoji: ${rule.emoji}.

Skema JSON:
{
  "platform": "${platform}",
  "hook": string,          // kalimat pembuka penarik perhatian
  "body": string,          // isi caption, boleh multi-baris dengan \\n
  "cta": string,           // satu ajakan bertindak yang jelas
  "hashtags": string[],    // tanpa tanda pagar di awal, akan dinormalisasi
  "bestTimeToPost": string // contoh: "19:00-21:00"
}`;
}

/* ------------------------------------ SEO ---------------------------------- */

export function seoPrompt(ctx: PromptContext): string {
  return `${baseRules(ctx)}

Tahap: SEO
Tugas: siapkan teks untuk listing marketplace dan pencarian.

Skema JSON:
{
  "marketplaceTitle": string,     // 60-100 karakter, keyword utama di depan
  "metaDescription": string,      // maksimal 160 karakter
  "primaryKeyword": string,
  "keywords": string[],           // 5-10
  "longTailKeywords": string[],   // 3-6
  "bulletPoints": string[]        // 5-8 poin spesifikasi/manfaat untuk deskripsi listing
}`;
}

/* ---------------------------------- VISUAL --------------------------------- */

export function visualPrompt(ctx: PromptContext, platform: ContentPlatform): string {
  return `${baseRules(ctx)}

Tahap: VISUAL untuk platform ${platform}
Tugas: arahan produksi visual (untuk diteruskan ke image/video generator).

Skema JSON:
{
  "platform": "${platform}",
  "imagePrompt": string,   // prompt gambar dalam bahasa Inggris, detail lighting & komposisi
  "videoScript": string,   // shot list singkat dengan durasi (boleh kosong untuk platform non-video)
  "styleNotes": string     // palet warna, mood, tipografi
}`;
}

/* --------------------------------- SCHEDULE -------------------------------- */

export function schedulePrompt(ctx: PromptContext): string {
  const platforms = ctx.input.platforms.join(', ');
  return `${baseRules(ctx)}

Tahap: SCHEDULE
Tugas: susun kalender konten 7 hari memakai platform yang dipilih (${platforms}).

Skema JSON:
{
  "items": [
    {
      "day": string,                    // nama hari dalam bahasa kampanye
      "date": string,                   // kosongkan bila tidak tahu tanggal pasti
      "platform": "${ctx.input.platforms[0] ?? 'INSTAGRAM'}",  // salah satu dari: ${platforms}
      "time": string,                   // "HH:MM"
      "contentRef": string,             // rujukan aset, contoh "CAPTIONS:TIKTOK"
      "note": string
    }
  ]
}`;
}
