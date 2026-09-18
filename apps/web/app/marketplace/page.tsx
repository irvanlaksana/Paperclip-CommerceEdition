'use client';

import { useEffect, useState } from 'react';
import type { AIProviderDTO } from '@paperclip/shared';
import { api } from '../../lib/api';
import {
  ShoppingBag,
  ArrowRight,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Globe,
  Store,
} from 'lucide-react';
import Link from 'next/link';

interface Channel {
  id: string;
  name: string;
  adapter: string;
  docs: string;
}

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
        const [channelList, providerList] = await Promise.all([
          api.marketplace.channels(),
          api.ai.providers(),
        ]);
        setChannels(channelList);
        setProviders(providerList.providers);
      } catch (err: any) {
        setError(err?.message ?? 'Gagal memuat data marketplace.');
      }
    })();
  }, []);

  const runImport = async (save: boolean) => {
    if (!url.trim()) {
      setError('Masukkan URL produk e-commerce terlebih dahulu.');
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
      setError(err?.message ?? 'Import produk gagal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            Marketplace Hub
          </h1>
          <p className="text-xs text-white/50 mt-0.5">
            Ekstraksi data produk dari URL e-commerce (Shopee, Tokopedia, dll) dan pembersihan otomatis menggunakan AI.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200">
          {error}
        </div>
      )}

      {/* URL Ingestion Card */}
      <div className="card space-y-4">
        <div className="pb-2 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/90 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#828fff]" />
            Import Produk dari URL
          </span>
          <span className="text-[10px] font-mono text-white/40">Scraper + AI Parser</span>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
          <div className="space-y-1.5">
            <label className="label" htmlFor="url">
              URL Halaman Produk
            </label>
            <input
              id="url"
              className="input font-mono text-xs"
              placeholder="https://shopee.co.id/product-name-i.12345.67890"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="label" htmlFor="import-provider">
              AI Provider Parser
            </label>
            <select
              id="import-provider"
              className="input text-xs"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="">Default Sistem</option>
              {providers
                .filter((p) => p.enabled && p.ready)
                .map((p) => (
                  <option key={p.id} value={p.type}>
                    {p.type} · {p.model}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            className="btn btn-primary text-xs"
            onClick={() => runImport(false)}
            disabled={busy}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{busy ? 'Mengekstrak…' : 'Ekstrak & Rapikan AI'}</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => runImport(true)}
            disabled={busy}
          >
            <span>Simpan Langsung ke Katalog</span>
          </button>
        </div>
      </div>

      {/* Extraction Results */}
      {result && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/90">
              Hasil Ekstraksi & Restrukturisasi AI
            </span>
            {result.savedProduct && (
              <span className="text-xs text-emerald-300 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan di Katalog
              </span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 text-xs">
            <div className="p-3 rounded border border-white/[0.06] bg-black/20 space-y-1.5">
              <span className="label text-[10px] text-white/40">Raw OpenGraph Scrape</span>
              <pre className="text-[11px] font-mono text-white/60 whitespace-pre-wrap overflow-x-auto max-h-60">
                {JSON.stringify(result.scraped, null, 2)}
              </pre>
            </div>

            <div className="p-3 rounded border border-emerald-500/20 bg-emerald-500/[0.03] space-y-1.5">
              <span className="label text-[10px] text-emerald-400">Restrukturisasi AI</span>
              <pre className="text-[11px] font-mono text-emerald-200/90 whitespace-pre-wrap overflow-x-auto max-h-60">
                {JSON.stringify(result.enhanced, null, 2)}
              </pre>
            </div>
          </div>

          {result.savedProduct && (
            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-white/60">
                Produk baru: <strong className="text-white">{result.savedProduct.name}</strong>
              </span>
              <Link href="/products" className="text-[#828fff] hover:underline flex items-center gap-1">
                Buka Katalog Produk <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Integrated Channels */}
      <div className="card space-y-3">
        <div className="pb-2 border-b border-white/[0.06]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/90">
            Konektor Kanal Marketplace
          </h2>
          <p className="text-[11px] text-white/45 mt-0.5">
            Daftar kanal e-commerce yang didukung untuk listing otomatis & sinkronisasi multi-toko.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className="p-3 rounded-md border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] transition-colors space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white/95">{ch.name}</span>
                <span className="pill text-[10px] font-mono border border-white/10 bg-white/5 text-white/50">
                  {ch.adapter}
                </span>
              </div>
              <p className="text-[11px] text-white/45 leading-relaxed">
                Konektor API standar untuk katalog dan manajemen stok e-commerce.
              </p>
              <a
                href={ch.docs}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#828fff] hover:underline inline-flex items-center gap-1 font-mono pt-1"
              >
                <span>Dokumentasi API</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
