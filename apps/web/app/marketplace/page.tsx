'use client';

import { useEffect, useState } from 'react';
import type { AIProviderDTO } from '@paperclip/shared';
import { api } from '../../lib/api';

interface Channel {
  id: string;
  name: string;
  adapter: string;
  docs: string;
}

/** Marketplace Hub - import a product page and let the AI clean it up. */
export default function MarketplacePage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [providers, setProviders] = useState<AIProviderDTO[]>([]);
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [channelList, providerList] = await Promise.all([api.marketplace.channels(), api.ai.providers()]);
        setChannels(channelList);
        setProviders(providerList.providers);
      } catch (err: any) {
        setError(err?.message ?? 'Gagal memuat data marketplace.');
      }
    })();
  }, []);

  const runImport = async (save: boolean) => {
    if (!url.trim()) {
      setError('Masukkan URL produk terlebih dahulu.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = save
        ? await api.marketplace.importAndSave(url.trim(), provider || undefined)
        : await api.marketplace.importFromUrl(url.trim(), provider || undefined);
      setResult(data);
    } catch (err: any) {
      setError(err?.message ?? 'Import gagal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Marketplace Hub</h1>
        <p className="text-slate-400 text-sm mt-1">
          Ambil data produk dari URL, biarkan AI merapikan judul, deskripsi, dan atribut, lalu simpan ke katalog.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      <section className="card space-y-4">
        <h2 className="font-semibold">Import produk dari URL</h2>
        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <div className="space-y-2">
            <label className="label" htmlFor="url">URL halaman produk</label>
            <input
              id="url"
              className="input font-mono text-xs"
              placeholder="https://shopee.co.id/produk-contoh-i.123.456"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="import-provider">Provider AI</label>
            <select id="import-provider" className="input" value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option value="">Default sistem</option>
              {providers
                .filter((item) => item.enabled && item.ready)
                .map((item) => (
                  <option key={item.id} value={item.type}>
                    {item.type} · {item.model}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => runImport(false)} disabled={busy}>
            {busy ? 'Memproses…' : 'Ambil & rapikan'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => runImport(true)} disabled={busy}>
            Simpan langsung ke katalog
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          Scrape memakai Open Graph + tag judul; halaman yang butuh JavaScript memerlukan scraper tambahan.
        </p>
      </section>

      {result && (
        <section className="card space-y-4">
          <h2 className="font-semibold">Hasil</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-2">
              <div className="label">Data mentah (scrape)</div>
              <pre className="text-[11px] font-mono text-slate-400 whitespace-pre-wrap break-words">
                {JSON.stringify(result.scraped, null, 2)}
              </pre>
            </div>
            <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/10 p-4 space-y-2">
              <div className="label text-emerald-400">Sudah dirapikan AI</div>
              <pre className="text-[11px] font-mono text-emerald-100/80 whitespace-pre-wrap break-words">
                {JSON.stringify(result.enhanced, null, 2)}
              </pre>
            </div>
          </div>
          {result.savedProduct && (
            <p className="text-xs text-emerald-300">
              Tersimpan di katalog sebagai “{result.savedProduct.name}”.{' '}
              <a href="/products" className="underline">Lihat produk</a>
            </p>
          )}
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="font-semibold">Kanal marketplace</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel) => (
            <div key={channel.id} className="rounded-lg border border-slate-800 bg-slate-800/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{channel.name}</span>
                <span className="pill bg-slate-800 text-slate-400 border border-slate-700">{channel.adapter}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Adapter publish belum diaktifkan. Butuh OAuth + signing per kanal.
              </p>
              <a
                href={channel.docs}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-400 hover:underline"
              >
                Dokumentasi API →
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
