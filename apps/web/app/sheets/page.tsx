'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  TableProperties,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Plus,
} from 'lucide-react';

type SheetStatus = Awaited<ReturnType<typeof api.sheets.status>>;

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
      setError(err?.message ?? 'Gagal memuat status integrasi Google Sheets.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4500);
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
      if (data?.status === 'CONNECTED') flash('Akun Google OAuth berhasil terhubung.');
      else setError(data?.error ?? 'Gagal menukar authorization code.');
      setAuthCode('');
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menghubungkan akun Google.');
    } finally {
      setBusy(false);
    }
  };

  const createSheet = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.sheets.createSheet('Paperclip Product Catalog');
      if (result.success) flash(`Spreadsheet berhasil dibuat: ${result.url ?? result.spreadsheetId}`);
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
      setError('Belum ada spreadsheet. Buat spreadsheet katalog terlebih dahulu.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.sheets.sync(status.spreadsheetId);
      if (result.success) flash(`${result.rowsUpdated} baris data produk berhasil disinkronkan ke Google Sheets.`);
      else setError(result.error ?? 'Sinkronisasi gagal.');
    } catch (err: any) {
      setError(err?.message ?? 'Sinkronisasi gagal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            Google Sheets Integration
          </h1>
          <p className="text-xs text-white/50 mt-0.5">
            Sinkronkan inventaris produk dan laporan produksi konten secara langsung ke Google Workspace spreadsheet.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200">
          {notice}
        </div>
      )}

      {/* Account Status Card */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-md border border-white/[0.06] bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-white/[0.06] border border-white/[0.1] flex items-center justify-center font-bold text-xs text-emerald-400">
              G
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Google Workspace Account</div>
              <div className="text-[11px] font-mono text-white/40 mt-0.5">
                {status?.connected
                  ? `Terhubung · Spreadsheet ID: ${status.spreadsheetId ? status.spreadsheetId.slice(0, 16) + '…' : 'belum dipilih'}`
                  : status?.configured
                    ? 'Kredensial OAuth siap, akun belum diautorisasi'
                    : 'Belum ada kredensial OAuth di konfigurasi'}
              </div>
            </div>
          </div>

          <span
            className={`pill text-[10px] font-mono border ${
              status?.connected
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : status?.configured
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-white/10 bg-white/5 text-white/40'
            }`}
          >
            {status?.status ?? 'LOADING'}
          </span>
        </div>

        {status && !status.configured && (
          <div className="text-xs p-3 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200/90 leading-relaxed">
            Untuk mengaktifkan integrasi Google Sheets, sediakan environment variable berikut di <code className="font-mono text-white">.env</code>:
            <div className="font-mono text-[11px] mt-1 text-white/70">
              {status.missingEnv.join(', ')}
            </div>
          </div>
        )}

        {status?.configured && !status.connected && (
          <div className="p-3.5 rounded-md border border-white/[0.06] bg-white/[0.01] space-y-3 text-xs">
            <div>
              <span className="label text-[10px] text-white/40">1. Otorisasi Akun Google</span>
              {status.authorizeUrl && (
                <a
                  href={status.authorizeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary text-xs mt-1.5 inline-flex"
                >
                  <span>Buka Dialog Izin Google OAuth</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <div className="pt-2 border-t border-white/[0.04] space-y-1.5">
              <span className="label text-[10px] text-white/40">2. Tempel Authorization Code</span>
              <div className="flex gap-2">
                <input
                  className="input font-mono text-xs"
                  placeholder="4/0AfJohXn…"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-primary text-xs shrink-0"
                  onClick={connect}
                  disabled={busy || !authCode.trim()}
                >
                  Hubungkan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sync Actions */}
        <div className="grid gap-3 sm:grid-cols-2 pt-1">
          <div className="p-3.5 rounded-md border border-white/[0.06] bg-white/[0.01] space-y-2 text-xs">
            <span className="font-semibold text-white/90">Buat Spreadsheet Katalog</span>
            <p className="text-[11px] text-white/45 leading-relaxed">
              Membuat sheet Google Spreadsheet baru dengan format kolom siap sinkronisasi.
            </p>
            <button
              type="button"
              className="btn btn-ghost text-xs w-full mt-1 flex items-center justify-center gap-1.5"
              onClick={createSheet}
              disabled={busy || !status?.connected}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Spreadsheet Baru</span>
            </button>
          </div>

          <div className="p-3.5 rounded-md border border-white/[0.06] bg-white/[0.01] space-y-2 text-xs">
            <span className="font-semibold text-white/90">Sinkronkan Katalog Produk</span>
            <p className="text-[11px] text-white/45 leading-relaxed">
              Kirim seluruh data produk (nama, SKU, harga, kategori, tags) ke spreadsheet target.
            </p>
            <button
              type="button"
              className="btn btn-ghost text-xs w-full mt-1 flex items-center justify-center gap-1.5"
              onClick={sync}
              disabled={busy || !status?.connected}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sinkronkan Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
