/**
 * Model output is rarely clean JSON on the first try: providers wrap it in
 * markdown fences, add a preamble, or trailing commentary. These helpers make
 * the content pipeline resilient to that without per-provider special casing.
 */

export function extractJson<T = any>(raw: string): T {
  if (!raw) throw new Error('Model mengembalikan teks kosong.');

  const candidates: string[] = [];
  let text = raw.trim();

  // 1. Strip markdown fences ```json ... ```
  const fence = text.match(/```(?:json|javascript)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1].trim());

  // 2. The raw text itself
  candidates.push(text);

  // 3. First balanced {...} block
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  // 4. First balanced [...] block
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(text.slice(firstBracket, lastBracket + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      /* try the next shape */
    }
    // Retry after removing trailing commas, a very common model mistake.
    try {
      return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1')) as T;
    } catch {
      /* keep going */
    }
  }

  throw new Error(`Gagal mem-parse JSON dari model. Awal respons: ${text.slice(0, 160)}…`);
}

export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value === undefined || value === null) return [];
  return [value as T];
}

export function asStringArray(value: unknown, limit = 12): string[] {
  return asArray<unknown>(value)
    .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
    .filter(Boolean)
    .slice(0, limit);
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

export function asNumber(value: unknown, fallback?: number): number | undefined {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

/** Normalize whatever the model returned into #hashtags. */
export function normalizeHashtags(value: unknown, limit = 15): string[] {
  const raw = asStringArray(value, limit * 2);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of raw) {
    for (const tag of item.split(/[\s,]+/)) {
      const clean = tag.replace(/^#*/, '').replace(/[^\p{L}\p{N}_]/gu, '');
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(`#${clean}`);
      if (out.length >= limit) return out;
    }
  }

  return out;
}
