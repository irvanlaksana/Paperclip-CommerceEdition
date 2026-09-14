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

const LOCALES = [
  { value: 'id-ID', label: 'Bahasa Indonesia' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'ms-MY', label: 'Bahasa Melayu' },
];

const TONE_LABELS: Record<string, string> = {
  casual: 'Santai',
  hype: 'Hype / FOMO',
  professional: 'Profesional',
  storytelling: 'Storytelling',
  humorous: 'Humoris',
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
      /* history is not critical */
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [metaData, productList] = await Promise.all([api.content.meta(), api.content.products()]);
        setMeta(metaData);
        setProducts(productList);
        setProductId(productList[0]?.id ?? '');
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
          if (current.status === 'COMPLETED' || current.status === 'PARTIAL' || current.status === 'FAILED') {
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
      setError('Pilih produk terlebih dahulu.');
      return;
    }
    if (platforms.length === 0) {
      setError('Pilih minimal satu platform.');
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
      setError(err?.message ?? 'Gagal menjalankan pipeline.');
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
      setError(err?.message ?? 'Gagal memuat run.');
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

  /* ---------------------------------- view ---------------------------------- */

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Content Studio</h1>
          <p className="text-slate-400 text-sm mt-1">
            Pipeline produksi konten: riset produk → caption multi-platform → SEO marketplace → arahan visual → jadwal
            posting.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Provider aktif:{' '}
          <span className="font-mono text-slate-300">{activeProvider || '—'}</span>
          {providerType && providerType !== activeProvider && (
            <span className="ml-2 text-amber-400">run ini memakai {providerType}</span>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* ------------------------------ config ------------------------------ */}
        <div className="space-y-4">
          <section className="card space-y-4">
            <h2 className="font-semibold">Konfigurasi</h2>

            <div className="space-y-2">
              <label className="label" htmlFor="product">
                Produk
              </label>
              <select
                id="product"
                className="input"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
              >
                {products.length === 0 && <option value="">(katalog kosong)</option>}
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              {selectedProduct && (
                <p className="text-xs text-slate-500 leading-relaxed">
                  {selectedProduct.category ? `${selectedProduct.category} · ` : ''}
                  {selectedProduct.price
                    ? `${(selectedProduct.currency ?? 'IDR')} ${Number(selectedProduct.price).toLocaleString('id-ID')}`
                    : 'harga belum diisi'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <span className="label">Platform</span>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_PLATFORMS.map((platform) => {
                  const active = platforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => toggle<ContentPlatform>(platforms, platform, setPlatforms)}
                      className={`p-2 text-xs rounded-md border transition-colors ${
                        active
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {meta?.platforms.find((p) => p.value === platform)?.label ?? platform}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <span className="label">Tahap pipeline</span>
              <div className="space-y-1.5">
                {PIPELINE_STAGES.map((stage) => {
                  const checked = stages.includes(stage);
                  return (
                    <label
                      key={stage}
                      className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer hover:text-slate-100"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-blue-600"
                        checked={checked}
                        onChange={() => toggle<PipelineStage>(stages, stage, setStages)}
                      />
                      <span>
                        <span className="font-medium">{stageMeta[stage].label}</span>
                        <span className="block text-slate-500">{stageMeta[stage].description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500">
                Tahap yang dibutuhkan sebagai dependensi ikut dijalankan otomatis.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="label" htmlFor="tone">
                  Tone
                </label>
                <select
                  id="tone"
                  className="input"
                  value={tone}
                  onChange={(event) => setTone(event.target.value as ContentTone)}
                >
                  {CONTENT_TONES.map((value) => (
                    <option key={value} value={value}>
                      {TONE_LABELS[value] ?? value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="label" htmlFor="locale">
                  Bahasa
                </label>
                <select id="locale" className="input" value={locale} onChange={(event) => setLocale(event.target.value)}>
                  {LOCALES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="label" htmlFor="provider">
                Provider AI untuk run ini
              </label>
              <select
                id="provider"
                className="input"
                value={providerType}
                onChange={(event) => setProviderType(event.target.value)}
              >
                <option value="">Default sistem ({activeProvider || '—'})</option>
                {providers
                  .filter((provider) => provider.enabled)
                  .map((provider) => (
                    <option key={provider.id} value={provider.type} disabled={!provider.ready}>
                      {provider.type} · {provider.model}
                      {provider.ready ? '' : ' (belum siap)'}
                      {provider.source === 'ENV' ? ' · dari .env' : provider.source === 'STORE' ? ' · tersimpan' : ''}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-500">
                Ganti provider tanpa mengubah kode —{' '}
                <a href="/settings" className="text-blue-400 hover:underline">
                  kelola di Settings
                </a>
                .
              </p>
            </div>

            <div className="space-y-2">
              <label className="label" htmlFor="brand">
                Nama brand <span className="normal-case text-slate-600">(opsional)</span>
              </label>
              <input
                id="brand"
                className="input"
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                placeholder="contoh: TokoAudio"
              />
            </div>

            <div className="space-y-2">
              <label className="label" htmlFor="cta">
                Link CTA <span className="normal-case text-slate-600">(opsional)</span>
              </label>
              <input
                id="cta"
                className="input"
                value={ctaUrl}
                onChange={(event) => setCtaUrl(event.target.value)}
                placeholder="https://shopee.co.id/..."
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={includeHashtags}
                onChange={(event) => setIncludeHashtags(event.target.checked)}
              />
              Sertakan hashtag
            </label>

            <button type="button" className="btn btn-primary w-full" onClick={startRun} disabled={busy}>
              {busy ? 'Memproses…' : 'Jalankan pipeline ✨'}
            </button>
          </section>

          {history.length > 0 && (
            <section className="card space-y-3">
              <h2 className="font-semibold text-sm">Riwayat run</h2>
              <ul className="space-y-1.5 max-h-72 overflow-auto pr-1">
                {history.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openRun(item.id)}
                      className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                        run?.id === item.id
                          ? 'border-blue-500/50 bg-blue-950/30'
                          : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">{item.productName}</span>
                        <span
                          className={`pill shrink-0 ${
                            item.status === 'COMPLETED'
                              ? 'bg-emerald-900/60 text-emerald-300'
                              : item.status === 'PARTIAL'
                                ? 'bg-amber-900/60 text-amber-300'
                                : item.status === 'FAILED'
                                  ? 'bg-red-900/60 text-red-300'
                                  : 'bg-blue-900/60 text-blue-300'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(item.createdAt).toLocaleString('id-ID')} ·{' '}
                        {item.workProducts.length} work product
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ------------------------------- output ------------------------------ */}
        <div className="space-y-4 min-w-0">
          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Progres pipeline</h2>
              {busy && <span className="text-xs text-blue-300 animate-pulse-soft">menghasilkan konten…</span>}
            </div>
            {run ? (
              <StageProgress stages={run.stages} meta={stageMeta} />
            ) : (
              <p className="text-sm text-slate-500">
                Belum ada run. Atur konfigurasi di kiri lalu tekan <span className="text-slate-300">Jalankan pipeline</span>.
              </p>
            )}
          </section>

          {run && <RunOutput run={run} onChanged={() => void openRun(run.id)} />}
        </div>
      </div>
    </div>
  );
}
