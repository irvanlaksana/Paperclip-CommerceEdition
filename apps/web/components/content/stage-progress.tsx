'use client';

import type { PipelineStage, StageResult } from '@paperclip/shared';

const STATUS_STYLE: Record<string, { dot: string; text: string; label: string }> = {
  PENDING: { dot: 'bg-slate-600', text: 'text-slate-400', label: 'Menunggu' },
  RUNNING: { dot: 'bg-blue-500 animate-pulse-soft', text: 'text-blue-300', label: 'Berjalan' },
  DONE: { dot: 'bg-emerald-500', text: 'text-emerald-300', label: 'Selesai' },
  FAILED: { dot: 'bg-red-500', text: 'text-red-300', label: 'Gagal' },
  SKIPPED: { dot: 'bg-slate-700', text: 'text-slate-500', label: 'Dilewati' },
};

/**
 * Live progress of a content run. Each row is one pipeline stage; the run
 * record is polled while generating so this reflects real backend state.
 */
export function StageProgress({
  stages,
  meta,
}: {
  stages: StageResult[];
  meta: Record<PipelineStage, { label: string; description: string }>;
}) {
  return (
    <ol className="space-y-2">
      {stages.map((stage) => {
        const style = STATUS_STYLE[stage.status] ?? STATUS_STYLE.PENDING!;
        return (
          <li
            key={stage.stage}
            className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-3"
          >
            <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium text-sm">{meta[stage.stage]?.label ?? stage.stage}</span>
                <span className={`text-xs ${style.text}`}>{style.label}</span>
                {typeof stage.durationMs === 'number' && (
                  <span className="text-xs text-slate-500">{stage.durationMs} ms</span>
                )}
                {stage.model && <span className="text-xs text-slate-500 font-mono">{stage.model}</span>}
                {stage.viaFallback && (
                  <span
                    className="pill bg-amber-900/60 text-amber-300"
                    title="Provider yang diminta gagal, hasil ini datang dari provider cadangan."
                  >
                    fail-over → {stage.providerType}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {meta[stage.stage]?.description ?? ''}
              </p>
              {stage.error && (
                <p className="text-xs text-red-300/90 mt-1 break-words">{stage.error}</p>
              )}
              {stage.usage && stage.usage.totalTokens > 0 && (
                <p className="text-[11px] text-slate-500 mt-1">
                  {stage.usage.promptTokens} prompt + {stage.usage.completionTokens} completion ={' '}
                  {stage.usage.totalTokens} token
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
