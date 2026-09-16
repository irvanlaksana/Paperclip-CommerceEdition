'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Product } from '@paperclip/shared';
import { api } from '../../lib/api';

const EMPTY = { name: '', description: '', price: '', category: '', sku: '', tags: '' };

/** Product catalog - the source data for the content pipeline. */
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (!confirm('Hapus produk ini?')) return;
    await fetch(`/api/content/products/${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-slate-400 text-sm mt-1">
            Katalog produk yang menjadi bahan baku Content Studio dan Marketplace Hub.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen((v) => !v)}>
          {open ? 'Tutup form' : '+ Tambah produk'}
        </button>
      </header>

      {error && (
        <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      {open && (
        <section className="card space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="label" htmlFor="name">Nama</label>
              <input id="name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="label" htmlFor="price">Harga (IDR)</label>
              <input id="price" type="number" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="label" htmlFor="category">Kategori</label>
              <input id="category" className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="label" htmlFor="sku">SKU</label>
              <input id="sku" className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="label" htmlFor="tags">Tag (pisahkan dengan koma)</label>
              <input id="tags" className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="label" htmlFor="desc">Deskripsi / spesifikasi</label>
              <textarea
                id="desc"
                rows={4}
                className="input resize-none"
                placeholder="Semakin detail spesifikasinya, semakin tajam konten yang dihasilkan AI."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan produk'}
            </button>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {products.map((product) => (
          <article key={product.id} className="card space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold truncate">{product.name}</h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {product.sku ?? product.id} {product.category ? `· ${product.category}` : ''}
                </p>
              </div>
              <span className="text-sm font-semibold text-blue-300 shrink-0">
                {(product.currency ?? 'IDR')} {Number(product.price ?? 0).toLocaleString('id-ID')}
              </span>
            </div>
            {product.description && (
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{product.description}</p>
            )}
            {product.attributes && Object.keys(product.attributes).length > 0 && (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                {Object.entries(product.attributes).map(([key, value]) => (
                  <div key={key} className="flex gap-1 min-w-0">
                    <dt className="text-slate-500 shrink-0">{key}:</dt>
                    <dd className="truncate">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {product.tags.map((tag) => (
                  <span key={tag} className="text-[11px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <a href={`/content?product=${product.id}`} className="text-xs text-blue-400 hover:underline">
                Buat konten →
              </a>
              <button type="button" className="text-xs text-red-400 hover:underline" onClick={() => remove(product.id)}>
                Hapus
              </button>
            </div>
          </article>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-slate-500">Belum ada produk. Tambahkan manual atau import dari URL lewat Marketplace Hub.</p>
        )}
      </section>
    </div>
  );
}
