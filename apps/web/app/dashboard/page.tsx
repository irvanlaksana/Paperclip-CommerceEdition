'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ContentRunDTO, Product } from '@paperclip/shared';
import { api, type AiStatus } from '../../lib/api';
import {
  Sparkles,
  Cpu,
  HardDrive,
  Package,
  Layers,
  ArrowRight,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

const WORKFLOW = [
  'Company',
  'Goal',
  'Project',
  'Task',
  'Agent Assignment',
  'Execution',
  'Work Product',
  'Review & Approval',
];

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
      setError(err?.message ?? 'API belum siap atau offline.');
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            Dashboard
          </h1>
          <p className="text-xs text-white/50 mt-0.5">
            Ringkasan status orkestrasi agen, katalog produk, dan pipeline konten e-commerce.
          </p>
        </div>
        <Link href="/content" className="btn btn-primary text-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Buat Konten Baru</span>
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Cpu className="w-4 h-4 text-[#828fff]" />}
          label="Default Provider"
          value={status?.default.type ?? '—'}
          hint={status ? `${status.default.model}` : 'memuat…'}
          badge={status?.default.type === 'MOCK' ? 'MOCK' : 'READY'}
          badgeType={status?.default.type === 'MOCK' ? 'warn' : 'ok'}
        />
        <StatCard
          icon={<HardDrive className="w-4 h-4 text-white/60" />}
          label="Storage Driver"
          value={status?.storage.driver ?? '—'}
          hint={status?.storage.location ? String(status.storage.location).slice(-24) : 'local memory'}
        />
        <StatCard
          icon={<Package className="w-4 h-4 text-white/60" />}
          label="Katalog Produk"
          value={String(products.length)}
          hint="Siap diproses pipeline"
        />
        <StatCard
          icon={<Layers className="w-4 h-4 text-emerald-400" />}
          label="Work Products"
          value={String(approved)}
          hint={`${drafts} menunggu approval`}
          badge={`${runs.length} runs`}
        />
      </div>

      {/* Recent Runs List */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Run Konten Terakhir
            </h2>
            <span className="text-[11px] font-mono text-white/40">({runs.length})</span>
          </div>
          <Link
            href="/content"
            className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors"
          >
            Studio <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {runs.length === 0 ? (
          <div className="py-8 text-center text-xs text-white/40">
            Belum ada eksekusi pipeline. Buka <Link href="/content" className="text-[#828fff] hover:underline">Content Studio</Link> untuk memulai.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {runs.map((run) => {
              const doneStages = run.stages.filter((s) => s.status === 'DONE').length;
              return (
                <div
                  key={run.id}
                  className="py-2.5 flex flex-wrap items-center justify-between gap-3 hover:bg-white/[0.01] px-1 rounded transition-colors"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full shrink-0 bg-white/20" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-white/90 truncate">
                        {run.productName}
                      </div>
                      <div className="text-[11px] text-white/40 flex items-center gap-2 mt-0.5 font-mono">
                        <span>{new Date(run.createdAt).toLocaleDateString('id-ID')}</span>
                        <span>·</span>
                        <span>{run.platforms.join(', ')}</span>
                        <span>·</span>
                        <span className="text-white/60">{run.providerType}</span>
                        {run.totalUsage?.totalTokens ? (
                          <>
                            <span>·</span>
                            <span>{run.totalUsage.totalTokens} tokens</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-[11px] font-mono text-white/50">
                      {doneStages}/{run.stages.length} tahap
                    </span>
                    <StatusBadge status={run.status} />
                    <Link
                      href={`/content?runId=${run.id}`}
                      className="p-1 rounded text-white/40 hover:text-white transition-colors"
                      title="Buka run"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hierarchical Linear / Paperclip Architecture */}
      <div className="card space-y-3">
        <div className="pb-2 border-b border-white/[0.06]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/80">
            Arsitektur Paperclip AI
          </h2>
          <p className="text-[11px] text-white/45 mt-0.5">
            Struktur alur kerja hirarkis: Perusahaan → Sasaran → Task → Penugasan Agen AI → Hasil Kerja (Work Product).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs font-mono">
          {WORKFLOW.map((step, idx) => (
            <div key={step} className="flex items-center gap-1.5">
              <span className="px-2.5 py-1 rounded bg-white/[0.03] border border-white/[0.07] text-white/80 text-[11px]">
                {step}
              </span>
              {idx < WORKFLOW.length - 1 && (
                <span className="text-white/20">→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  badge,
  badgeType,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  badge?: string;
  badgeType?: 'ok' | 'warn';
}) {
  return (
    <div className="card space-y-1.5 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider font-medium text-white/45">{label}</span>
        {icon}
      </div>
      <div className="flex items-baseline justify-between gap-2 pt-0.5">
        <div className="text-lg font-semibold tracking-tight text-white font-mono truncate">
          {value}
        </div>
        {badge && (
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              badgeType === 'warn'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : badgeType === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/10 bg-white/5 text-white/60'
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="text-[11px] text-white/40 truncate font-mono">{hint}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'COMPLETED') {
    return (
      <span className="pill border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
        <CheckCircle2 className="w-3 h-3" />
        DONE
      </span>
    );
  }
  if (status === 'RUNNING' || status === 'QUEUED') {
    return (
      <span className="pill border border-[#828fff]/30 bg-[#5e6ad2]/15 text-[#828fff] animate-pulse-soft">
        <Clock className="w-3 h-3" />
        RUNNING
      </span>
    );
  }
  if (status === 'PARTIAL') {
    return (
      <span className="pill border border-amber-500/30 bg-amber-500/10 text-amber-300">
        PARTIAL
      </span>
    );
  }
  return (
    <span className="pill border border-red-500/30 bg-red-500/10 text-red-300">
      <XCircle className="w-3 h-3" />
      {status}
    </span>
  );
}
