'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ContentRunDTO, Product } from '@paperclip/shared';
import { api, type AiStatus } from '../../lib/api';

const WORKFLOW = [
  'Company',
  'Goal',
  'Project',
  'Issue',
  'Agent Assignment',
  'Approval',
  'Execution',
  'Work Product',
  'Review',
  'Close',
];

/** Overview: live system state on top, documented workflow hierarchy below. */
export default function DashboardPage() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [runs, setRuns] = useState<ContentRunDTO[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [aiStatus, runList, productList] = await Promise.all([
        api.ai.status(),
        api.content.listRuns(6),
        api.content.products(),
      ]);
      setStatus(aiStatus);
      setRuns(runList);
      setProducts(productList);
    } catch (err: any) {
      setError(err?.message ?? 'API belum siap.');
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [load]);

  const approved = runs.flatMap((run) => run.workProducts).filter((wp) => wp.status === 'APPROVED').length;
  const drafts = runs.flatMap((run) => run.workProducts).filter((wp) => wp.status === 'DRAFT').length;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Ringkasan sistem dan produksi konten.</p>
        </div>
        <a href="/content" className="btn btn-primary">
          ✨ Buat konten
        </a>
      </header>

      {error && (
        <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Provider AI"
          value={status?.default.type ?? '—'}
          hint={status ? `${status.default.model} · ${status.default.source}` : 'memuat…'}
          tone={status?.default.type === 'MOCK' ? 'warn' : 'ok'}
        />
        <Stat
          label="Penyimpanan"
          value={status?.storage.driver ?? '—'}
          hint={status?.storage.location ?? ''}
        />
        <Stat label="Produk katalog" value={String(products.length)} hint="siap dipakai Content Studio" />
        <Stat
          label="Work product"
          value={`${approved} disetujui`}
          hint={`${drafts} menunggu review dari ${runs.length} run terakhir`}
        />
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="font-semibold">Run konten terakhir</h2>
          <a href="/content" className="text-xs text-blue-400 hover:underline">
            Buka Content Studio →
          </a>
        </div>
        {runs.length === 0 ? (
          <p className="text-sm text-slate-500">
            Belum ada run. Jalankan pipeline pertama dari Content Studio untuk melihat hasilnya di sini.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {runs.map((run) => (
              <li key={run.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{run.productName}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {new Date(run.createdAt).toLocaleString('id-ID')} ·{' '}
                    {run.platforms.length} platform · <span className="font-mono">{run.providerType}</span> ·{' '}
                    {run.totalUsage?.totalTokens ?? 0} token
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">
                    {run.stages.filter((stage) => stage.status === 'DONE').length}/{run.stages.length} tahap
                  </span>
                  <span
                    className={`pill ${
                      run.status === 'COMPLETED'
                        ? 'bg-emerald-900/60 text-emerald-300'
                        : run.status === 'PARTIAL'
                          ? 'bg-amber-900/60 text-amber-300'
                          : run.status === 'FAILED'
                            ? 'bg-red-900/60 text-red-300'
                            : 'bg-blue-900/60 text-blue-300'
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <h2 className="font-semibold">Alur kerja hierarkis</h2>
          <p className="text-xs text-slate-500 mt-1">
            Model eksekusi yang didokumentasikan di README. Tahap Content Studio sudah berjalan di atasnya
            (Issue → Agent → Work Product → Review).
          </p>
        </div>
        <ol className="flex flex-wrap items-center gap-2 text-xs">
          {WORKFLOW.map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700">{step}</span>
              {index < WORKFLOW.length - 1 && <span className="text-slate-600">→</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'warn';
}) {
  return (
    <div className="card !p-4 space-y-1">
      <div className="label">{label}</div>
      <div
        className={`text-lg font-semibold font-mono truncate ${
          tone === 'warn' ? 'text-amber-300' : tone === 'ok' ? 'text-emerald-300' : 'text-slate-100'
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-slate-500 truncate">{hint}</div>}
    </div>
  );
}
