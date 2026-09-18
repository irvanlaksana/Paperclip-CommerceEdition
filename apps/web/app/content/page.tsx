'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CONTENT_PLATFORMS,
  CONTENT_TONES,
  PIPELINE_STAGES,
  STAGE_META,
  type AIProviderDTO,
  type ContentPlatform,
  type ContentRunDTO,
  type ContentTone,
  type PipelineStage,
  type Product,
} from '@paperclip/shared';
import { api, type ContentMeta } from '../../lib/api';
import { RunOutput } from '../../components/content/run-output';
import { StageProgress } from '../../components/content/stage-progress';
import {
  Sparkles,
  Layers,
  Cpu,
  History,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';

const LOCALES = [
  { value: 'id-ID', label: 'Bahasa Indonesia' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'ms-MY', label: 'Bahasa Melayu' },
];

const TONE_LABELS: Record<string, string> = {
  casual: 'Santai / Conversational',
  hype: 'Hype / FOMO',
  professional: 'Profesional & Elegan',
  storytelling: 'Storytelling Emosional',
  humorous: 'Humoris & Relatable',
};

export default function ContentStudioPage() {
  const [meta, setMeta] = useState<ContentMeta | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [providers, setProviders] = useState<AIProviderDTO[]>([]);
  const [activeProvider, setActiveProvider] = useState<string>('');

  const [productId, setProductId] = useState<string>('');
  const [platforms, setPlatforms] = useState<ContentPlatform[]>(['INSTAGRAM', 'TIKTOK']);
  const [tone, setTone] = useState<ContentTone>('casual');
  const [locale, setLocale] = useState('id-ID');
  const [stages, setStages] = useState<PipelineStage[]>([...PIPELINE_STAGES]);
  const [providerType, setProviderType] = useState<string>('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [brandName, setBrandName] = useState('');
  const [includeHashtags, setIncludeHashtags] = useState(true);

  const [run, setRun] = useState<ContentRunDTO | null>(null);
  const [history, setHistory] = useState<ContentRunDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ------------------------------- data load ------------------------------- */

  const refreshProviders = useCallback(async () => {
    const data = await api.ai.providers();
    setProviders(data.providers);
    setActiveProvider(data.activeProviderType);
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await api.content.listRuns(10));
    } catch {
      /* history not critical */
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [metaData, productList] = await Promise.all([
          api.content.meta(),
          api.content.products(),
        ]);
        setMeta(metaData);
        setProducts(productList);
        if (productList.length > 0) {
          setProductId(productList[0].id);
        }
        await refreshProviders();
        await refreshHistory();
      } catch (err: any) {
        setError(err?.message ?? 'Gagal memuat data Content Studio.');
      }
    })();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshProviders, refreshHistory]);

  /* -------------------------------- polling -------------------------------- */

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollRun = useCallback(
    (runId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const current = await api.content.getRun(runId);
          setRun(current);
          if (
            current.status === 'COMPLETED' ||
            current.status === 'PARTIAL' ||
            current.status === 'FAILED'
          ) {
            stopPolling();
            setBusy(false);
            void refreshHistory();
          }
        } catch (err: any) {
          stopPolling();
          setBusy(false);
          setError(err?.message ?? 'Gagal mengambil status run.');
        }
      }, 900);
    },
    [refreshHistory],
  );

  /* -------------------------------- actions -------------------------------- */

  const selectedProduct = products.find((p) => p.id === productId);

  const startRun = async () => {
    if (!selectedProduct) {
      setError('Pilih produk dari katalog terlebih dahulu.');
      return;
    }
    if (platforms.length === 0) {
      setError('Pilih minimal satu platform target.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const created = await api.content.startRun({
        product: selectedProduct,
        platforms,
        tone,
        locale,
        stages,
        providerType: (providerType || undefined) as any,
        ctaUrl: ctaUrl || undefined,
        brandName: brandName || undefined,
        includeHashtags,
      });
      setRun(created);
      pollRun(created.id);
    } catch (err: any) {
      setBusy(false);
      setError(err?.message ?? 'Gagal memulai pipeline.');
    }
  };

  const openRun = async (id: string) => {
    setError(null);
    try {
      const loaded = await api.content.getRun(id);
      setRun(loaded);
      if (loaded.status === 'QUEUED' || loaded.status === 'RUNNING') {
        setBusy(true);
        pollRun(id);
      } else {
        setBusy(false);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat detail run.');
    }
  };

  const toggle = <T extends string>(list: T[], value: T, setter: (next: T[]) => void) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const stageMeta = (meta?.stages ?? []).reduce(
    (acc, stage) => {
      acc[stage.stage] = { label: stage.label, description: stage.description };
      return acc;
    },
    {} as Record<PipelineStage, { label: string; description: string }>,
  );
  for (const stage of PIPELINE_STAGES) {
    if (!stageMeta[stage]) stageMeta[stage] = { label: stage, description: STAGE_META[stage].description };
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            Content Studio
          </h1>
          <p className="text-xs text-white/50 mt-0.5">
            Pipeline produksi konten multi-tahap otonom: Riset → Copywriting → SEO Marketplace → Visual Script → Penjadwalan.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-white/[0.02] border border-white/[0.06] px-2.5 py-1.5 rounded-md">
          <Cpu className="w-3.5 h-3.5 text-[#828fff]" />
          <span className="text-white/40">Model:</span>
          <span className="text-white/80">{activeProvider || '—'}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr] items-start">
        {/* Left Column: Configuration & History */}
        <div className="space-y-4">
          <div className="card space-y-4">
            <div className="pb-2 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/90">
                Konfigurasi Pipeline
              </span>
              <span className="text-[10px] font-mono text-white/40">v1.1</span>
            </div>

            {/* Product Picker */}
            <div className="space-y-1.5">
              <label className="label" htmlFor="product">
                Pilih Produk
              </label>
              <select
                id="product"
                className="input"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.length === 0 && <option value="">(katalog kosong)</option>}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {selectedProduct && (
                <div className="text-[11px] font-mono text-white/40 flex items-center gap-1.5 pt-0.5">
                  <span className="text-white/60">{selectedProduct.category ?? 'Tanpa kategori'}</span>
                  <span>·</span>
                  <span>
                    {(selectedProduct.currency ?? 'IDR')}{' '}
                    {Number(selectedProduct.price ?? 0).toLocaleString('id-ID')}
                  </span>
                </div>
              )}
            </div>

            {/* Target Platforms */}
            <div className="space-y-1.5">
              <span className="label">Platform Target</span>
              <div className="grid grid-cols-2 gap-1.5">
                {CONTENT_PLATFORMS.map((platform) => {
                  const active = platforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => toggle<ContentPlatform>(platforms, platform, setPlatforms)}
                      className={`px-2.5 py-1.5 text-xs rounded-md border text-left transition-colors font-medium flex items-center justify-between ${
                        active
                          ? 'bg-[#5e6ad2]/20 border-[#828fff]/50 text-[#828fff]'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white/80 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="truncate">
                        {meta?.platforms.find((p) => p.value === platform)?.label ?? platform}
                      </span>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-[#828fff]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pipeline Stages checklist */}
            <div className="space-y-1.5">
              <span className="label">Tahap Eksekusi</span>
              <div className="space-y-1 bg-white/[0.01] p-2 rounded border border-white/[0.04]">
                {PIPELINE_STAGES.map((stage) => {
                  const checked = stages.includes(stage);
                  return (
                    <label
                      key={stage}
                      className="flex items-center gap-2 text-xs text-white/70 hover:text-white cursor-pointer select-none py-0.5"
                    >
                      <input
                        type="checkbox"
                        className="rounded accent-[#5e6ad2] bg-white/10"
                        checked={checked}
                        onChange={() => toggle<PipelineStage>(stages, stage, setStages)}
                      />
                      <span className="font-medium text-[12px]">{stageMeta[stage].label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Tone & Locale */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="label" htmlFor="tone">
                  Tone Voice
                </label>
                <select
                  id="tone"
                  className="input text-xs"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as ContentTone)}
                >
                  {CONTENT_TONES.map((val) => (
                    <option key={val} value={val}>
                      {TONE_LABELS[val] ?? val}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="label" htmlFor="locale">
                  Bahasa
                </label>
                <select
                  id="locale"
                  className="input text-xs"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                >
                  {LOCALES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* AI Provider override */}
            <div className="space-y-1.5">
              <label className="label" htmlFor="provider">
                Provider Override <span className="normal-case text-white/40">(opsional)</span>
              </label>
              <select
                id="provider"
                className="input text-xs"
                value={providerType}
                onChange={(e) => setProviderType(e.target.value)}
              >
                <option value="">Default Sistem ({activeProvider || '—'})</option>
                {providers
                  .filter((p) => p.enabled)
                  .map((p) => (
                    <option key={p.id} value={p.type} disabled={!p.ready}>
                      {p.type} — {p.model}
                      {!p.ready ? ' (kunci belum siap)' : ''}
                    </option>
                  ))}
              </select>
            </div>

            {/* Optional brand & CTA */}
            <div className="space-y-2 pt-1 border-t border-white/[0.04]">
              <div className="space-y-1">
                <label className="label" htmlFor="brand">
                  Nama Brand
                </label>
                <input
                  id="brand"
                  className="input text-xs"
                  placeholder="Contoh: AeroShop"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="label" htmlFor="cta">
                  Link CTA / Toko
                </label>
                <input
                  id="cta"
                  className="input text-xs font-mono"
                  placeholder="https://..."
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-white/70 hover:text-white cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  className="rounded accent-[#5e6ad2]"
                  checked={includeHashtags}
                  onChange={(e) => setIncludeHashtags(e.target.checked)}
                />
                <span>Generate Hashtag & Keywords</span>
              </label>
            </div>

            <button
              type="button"
              className="btn btn-primary w-full text-xs py-2 mt-2"
              onClick={startRun}
              disabled={busy}
            >
              {busy ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Pipeline Berjalan…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Jalankan Pipeline</span>
                </>
              )}
            </button>
          </div>

          {/* Execution History */}
          {history.length > 0 && (
            <div className="card space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                  <History className="w-3 h-3 text-white/40" />
                  Riwayat Run
                </span>
                <span className="text-[10px] font-mono text-white/40">{history.length}</span>
              </div>

              <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openRun(item.id)}
                    className={`w-full text-left p-2 rounded border text-xs transition-colors block ${
                      run?.id === item.id
                        ? 'border-[#828fff]/50 bg-[#5e6ad2]/10 text-white'
                        : 'border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.04] text-white/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium truncate max-w-[170px]">
                        {item.productName}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1 rounded ${
                          item.status === 'COMPLETED'
                            ? 'text-emerald-300 bg-emerald-500/10'
                            : item.status === 'PARTIAL'
                              ? 'text-amber-300 bg-amber-500/10'
                              : 'text-white/40 bg-white/5'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-white/40 mt-0.5">
                      {new Date(item.createdAt).toLocaleDateString('id-ID')} · {item.platforms.length} platform
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Execution Progress & Output Tabs */}
        <div className="space-y-4 min-w-0">
          <div className="card space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Status Eksekusi Agen
                </span>
                {run && (
                  <span className="text-[11px] font-mono text-white/40">
                    #{run.id.slice(0, 8)}
                  </span>
                )}
              </div>
              {busy && (
                <span className="text-[11px] font-mono text-[#828fff] flex items-center gap-1.5 animate-pulse-soft">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#828fff]" />
                  Agen sedang bekerja…
                </span>
              )}
            </div>

            {run ? (
              <StageProgress stages={run.stages} meta={stageMeta} />
            ) : (
              <div className="py-8 text-center text-xs text-white/40">
                Belum ada pipeline aktif. Pilih produk di sebelah kiri dan klik{' '}
                <span className="text-white/80 font-medium">Jalankan Pipeline</span>.
              </div>
            )}
          </div>

          {run && <RunOutput run={run} onChanged={() => void openRun(run.id)} />}
        </div>
      </div>
    </div>
  );
}
