'use client';

import type { PipelineStage, StageResult } from '@paperclip/shared';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  SkipForward,
  Cpu,
} from 'lucide-react';

export function StageProgress({
  stages,
  meta,
}: {
  stages: StageResult[];
  meta: Record<PipelineStage, { label: string; description: string }>;
}) {
  return (
    <div className="space-y-1.5">
      {stages.map((stage) => {
        const isDone = stage.status === 'DONE';
        const isRunning = stage.status === 'RUNNING';
        const isFailed = stage.status === 'FAILED';
        const isPending = stage.status === 'PENDING';

        return (
          <div
            key={stage.stage}
            className={`flex items-start gap-2.5 p-2.5 rounded-md border text-xs transition-colors ${
              isRunning
                ? 'border-[#828fff]/40 bg-[#5e6ad2]/10'
                : isDone
                  ? 'border-white/[0.06] bg-white/[0.01]'
                  : isFailed
                    ? 'border-red-500/30 bg-red-500/10'
                    : 'border-white/[0.03] bg-transparent opacity-60'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              {isRunning && <Clock className="w-3.5 h-3.5 text-[#828fff] animate-spin" />}
              {isFailed && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
              {isPending && <div className="w-3.5 h-3.5 rounded-full border border-white/20" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white/90">
                    {meta[stage.stage]?.label ?? stage.stage}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      isDone
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : isRunning
                          ? 'text-[#828fff] bg-[#5e6ad2]/20'
                          : isFailed
                            ? 'text-red-400 bg-red-500/10'
                            : 'text-white/40'
                    }`}
                  >
                    {stage.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-mono text-white/40">
                  {typeof stage.durationMs === 'number' && (
                    <span>{stage.durationMs}ms</span>
                  )}
                  {stage.model && (
                    <span className="text-white/50">{stage.model}</span>
                  )}
                </div>
              </div>

              {meta[stage.stage]?.description && (
                <p className="text-[11px] text-white/45 mt-0.5">
                  {meta[stage.stage].description}
                </p>
              )}

              {stage.error && (
                <p className="text-[11px] text-red-300 mt-1 font-mono">
                  {stage.error}
                </p>
              )}

              {stage.usage && stage.usage.totalTokens > 0 && (
                <div className="text-[10px] font-mono text-white/35 mt-1">
                  {stage.usage.totalTokens} tokens ({stage.usage.promptTokens} in / {stage.usage.completionTokens} out)
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
