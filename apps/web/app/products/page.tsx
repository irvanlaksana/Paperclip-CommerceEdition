'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Product } from '@paperclip/shared';
import { api } from '../../lib/api';
import {
  Package,
  Plus,
  Trash2,
  Sparkles,
  Search,
  Filter,
  X,
  Tag,
  DollarSign,
  Layers,
} from 'lucide-react';
import Link from 'next/link';

const EMPTY = { name: '', description: '', price: '', category: '', sku: '', tags: '' };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setProducts(await api.content.products());
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat produk.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!form.name.trim()) {
      setError('Nama produk wajib diisi.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await fetch('/api/content/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          price: Number(form.price || 0),
          currency: 'IDR',
          category: form.category.trim() || undefined,
          sku: form.sku.trim() || undefined,
          tags: form.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      setForm(EMPTY);
      setOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan produk.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Hapus produk ini dari katalog?')) return;
    await fetch(`/api/content/products/${id}`, { method: 'DELETE' });
    await load();
  };

  const filtered = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            Products
          </h1>
          <p className="text-xs text-white/50 mt-0.5">
            Katalog aset produk e-commerce yang digunakan oleh agen AI di Content Studio.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary text-xs"
          onClick={() => {
            setError(null);
            setOpen((v) => !v);
          }}
        >
          {open ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{open ? 'Batal' : 'Tambah Produk'}</span>
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200">
          {error}
        </div>
      )}

      {/* Creation Form */}
      {open && (
        <div className="card space-y-4 border-[#828fff]/30 bg-white/[0.02]">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/90">
              Tambah Produk Baru
            </span>
            <span className="text-[11px] text-white/40">IDR</span>
          </div>

          <div className="grid gap-3.5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="label" htmlFor="name">
                Nama Produk *
              </label>
              <input
                id="name"
                className="input"
                placeholder="Contoh: Wireless Noise-Cancelling Headphones"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="label" htmlFor="price">
                Harga (IDR)
              </label>
              <input
                id="price"
                type="number"
                className="input font-mono"
                placeholder="750000"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="label" htmlFor="category">
                Kategori
              </label>
              <input
                id="category"
                className="input"
                placeholder="Audio & Wearables"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="label" htmlFor="sku">
                SKU / Kode Unik
              </label>
              <input
                id="sku"
                className="input font-mono"
                placeholder="PROD-001"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="label" htmlFor="tags">
                Tag / Kata Kunci (pisahkan koma)
              </label>
              <input
                id="tags"
                className="input"
                placeholder="bluetooth, audio, gaming, nfc"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="label" htmlFor="desc">
                Deskripsi & Spesifikasi
              </label>
              <textarea
                id="desc"
                rows={3}
                className="input resize-none"
                placeholder="Jelaskan fitur utama, material, keunggulan teknis produk..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={() => setOpen(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary text-xs"
              onClick={submit}
              disabled={busy}
            >
              {busy ? 'Menyimpan…' : 'Simpan ke Katalog'}
            </button>
          </div>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="input !pl-8 text-xs h-8"
            placeholder="Cari nama, SKU, kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-[11px] font-mono text-white/40">
          Total: {filtered.length} item
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((product) => (
          <div
            key={product.id}
            className="card space-y-3 relative group hover:border-white/[0.18] transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white/95 truncate">
                  {product.name}
                </h3>
                <div className="text-[11px] font-mono text-white/40 mt-0.5 flex items-center gap-2">
                  <span>{product.sku || 'NO-SKU'}</span>
                  {product.category && (
                    <>
                      <span>·</span>
                      <span className="text-white/60">{product.category}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-xs font-mono font-semibold text-[#828fff] shrink-0">
                {(product.currency ?? 'IDR')}{' '}
                {Number(product.price ?? 0).toLocaleString('id-ID')}
              </div>
            </div>

            {product.description && (
              <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">
                {product.description}
              </p>
            )}

            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {product.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-white/55"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
              <button
                type="button"
                className="text-white/35 hover:text-red-400 transition-colors flex items-center gap-1 text-[11px]"
                onClick={() => remove(product.id)}
              >
                <Trash2 className="w-3 h-3" />
                <span>Hapus</span>
              </button>

              <Link
                href={`/content?product=${product.id}`}
                className="text-xs text-[#828fff] hover:text-white flex items-center gap-1 transition-colors font-medium"
              >
                <Sparkles className="w-3 h-3" />
                <span>Buat Konten</span>
              </Link>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-xs text-white/40 card">
            {search ? 'Tidak ada produk yang cocok dengan pencarian.' : 'Katalog kosong. Tambahkan produk pertama.'}
          </div>
        )}
      </div>
    </div>
  );
}
