'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';

type SheetStatus = Awaited<ReturnType<typeof api.sheets.status>>;

/** Google Sheets integration panel. */
export default function GoogleSheetsPage() {
  const [status, setStatus] = useState<SheetStatus | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await api.sheets.status());
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat status integrasi.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 5000);
  };

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/integrations/google/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: authCode.trim() }),
      });
      const data: any = await res.json();
      if (data?.status === 'CONNECTED') flash('Akun Google terhubung.');
      else setError(data?.error ?? 'Gagal menukar authorization code.');
      setAuthCode('');
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menghubungkan akun.');
    } finally {
      setBusy(false);
    }
  };

  const createSheet = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.sheets.createSheet('Paperclip Product Catalog');
      if (result.success) flash(`Spreadsheet dibuat: ${result.url ?? result.spreadsheetId}`);
      else setError(result.error ?? 'Gagal membuat spreadsheet.');
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Gagal membuat spreadsheet.');
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    if (!status?.spreadsheetId) {
      setError('Belum ada spreadsheet. Buat spreadsheet produk terlebih dahulu.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.sheets.sync(status.spreadsheetId);
      if (result.success) flash(`${result.rowsUpdated} baris produk disinkronkan.`);
      else setError(result.error ?? 'Sinkronisasi gagal.');
    } catch (err: any) {
      setError(err?.message ?? 'Sinkronisasi gagal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Google Sheets Integration</h1>
        <p className="text-slate-400 text-sm mt-1">
          Sinkronkan katalog produk dan laporan ke Google Workspace lewat OAuth.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center font-bold text-white">
              G
            </div>
            <div>
              <p className="font-medium">Google Account</p>
              <p className="text-xs text-slate-400">
                {status?.connected
                  ? `Terhubung${status.spreadsheetId ? ` · sheet ${status.spreadsheetId.slice(0, 12)}…` : ''}`
                  : status?.configured
                    ? 'Credential tersedia, akun belum terhubung'
                    : 'Belum dikonfigurasi'}
              </p>
            </div>
          </div>
          <span
            className={`pill ${
              status?.connected
                ? 'bg-emerald-900/60 text-emerald-300'
                : status?.configured
                  ? 'bg-amber-900/60 text-amber-300'
                  : 'bg-slate-700 text-slate-300'
            }`}
          >
            {status?.status ?? 'LOADING'}
          </span>
        </div>

        {status && !status.configured && (
          <p className="text-xs text-amber-300/90 border border-amber-800/50 bg-amber-950/30 rounded-md px-3 py-2">
            Isi <code className="font-mono">{status.missingEnv.join('</code> dan <code className="font-mono')}</code> di
            file <code className="font-mono">.env</code>, lalu restart API.
          </p>
        )}

        {status?.configured && !status.connected && (
          <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <div className="label">Langkah 1 — minta authorization code</div>
            {status.authorizeUrl && (
              <a
                href={status.authorizeUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary w-full sm:w-auto"
              >
                Buka halaman izin Google
              </a>
            )}
            <div className="label pt-2">Langkah 2 — tempel code di sini</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="input font-mono text-xs"
                placeholder="4/0AfJohXn…"
                value={authCode}
                onChange={(event) => setAuthCode(event.target.value)}
              />
              <button type="button" className="btn btn-primary shrink-0" onClick={connect} disabled={busy || !authCode.trim()}>
                Hubungkan
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 space-y-3">
            <p className="font-medium text-sm">Buat spreadsheet katalog</p>
            <p className="text-xs text-slate-400">
              Membuat spreadsheet baru berisi sheet “Products” dan menyimpan id-nya sebagai target sinkronisasi.
            </p>
            <button type="button" className="btn btn-ghost w-full" onClick={createSheet} disabled={busy || !status?.connected}>
              Buat spreadsheet
            </button>
          </div>
          <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 space-y-3">
            <p className="font-medium text-sm">Sinkronkan produk</p>
            <p className="text-xs text-slate-400">
              Menulis seluruh produk aktif (nama, SKU, harga, kategori, deskripsi, tag) ke spreadsheet.
            </p>
            <button type="button" className="btn btn-ghost w-full" onClick={sync} disabled={busy || !status?.connected}>
              Sinkronkan sekarang
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
