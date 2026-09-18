'use client';

import { useMemo, useState } from 'react';
import type {
  CaptionOutput,
  ContentRunDTO,
  PipelineStage,
  ScheduleItem,
  SeoOutput,
  VisualOutput,
  WorkProductDTO,
} from '@paperclip/shared';
import { PLATFORM_LABELS } from '@paperclip/shared';
import { api, copyText } from '../../lib/api';
import {
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  Image,
  Calendar,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

type TabId = 'CAPTIONS' | 'SEO' | 'VISUAL' | 'SCHEDULE' | 'RESEARCH';

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'CAPTIONS', label: 'Social Captions', icon: FileText },
  { id: 'SEO', label: 'SEO & Listing', icon: Search },
  { id: 'VISUAL', label: 'Visual Directives', icon: Image },
  { id: 'SCHEDULE', label: 'Calendar Matrix', icon: Calendar },
  { id: 'RESEARCH', label: 'Market Intelligence', icon: Sparkles },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(text);
        setCopied(ok);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="btn-sm btn-ghost text-xs flex items-center gap-1 text-white/60 hover:text-white"
      title="Salin ke clipboard"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      <span>{copied ? 'Tersalin' : 'Salin'}</span>
    </button>
  );
}

function ApprovalRow({ wp, onChanged }: { wp: WorkProductDTO; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const setStatus = async (status: 'APPROVED' | 'REJECTED') => {
    setBusy(true);
    try {
      await api.content.setWorkProductStatus(wp.id, status);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const isApproved = wp.status === 'APPROVED';
  const isRejected = wp.status === 'REJECTED';

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`pill text-[10px] font-mono border ${
          isApproved
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            : isRejected
              ? 'border-red-500/40 bg-red-500/10 text-red-300'
              : 'border-white/10 bg-white/5 text-white/50'
        }`}
      >
        {wp.status}
      </span>
      <button
        type="button"
        disabled={busy || isApproved}
        onClick={() => setStatus('APPROVED')}
        className="btn-sm btn-ghost text-[11px] !px-2 !py-0.5 text-white/70 hover:text-emerald-300"
      >
        Setujui
      </button>
      <button
        type="button"
        disabled={busy || isRejected}
        onClick={() => setStatus('REJECTED')}
        className="btn-sm btn-ghost text-[11px] !px-2 !py-0.5 text-white/70 hover:text-red-300"
      >
        Tolak
      </button>
    </div>
  );
}

export function RunOutput({ run, onChanged }: { run: ContentRunDTO; onChanged: () => void }) {
  const [tab, setTab] = useState<TabId>('CAPTIONS');

  const stageData = useMemo(() => {
    const find = (stage: PipelineStage) => run.stages.find((s) => s.stage === stage)?.data;
    return {
      captions: (find('CAPTIONS') as CaptionOutput[] | undefined) ?? [],
      seo: find('SEO') as SeoOutput | undefined,
      visuals: (find('VISUAL') as VisualOutput[] | undefined) ?? [],
      schedule: (find('SCHEDULE') as ScheduleItem[] | undefined) ?? [],
      research: find('RESEARCH') as any,
    };
  }, [run]);

  const usedMockFallback = run.stages.some(
    (stage) => stage.viaFallback && stage.providerType === 'MOCK',
  );

  const availableTabs = TABS.filter((t) => {
    if (t.id === 'CAPTIONS') return stageData.captions.length > 0;
    if (t.id === 'SEO') return Boolean(stageData.seo);
    if (t.id === 'VISUAL') return stageData.visuals.length > 0;
    if (t.id === 'SCHEDULE') return stageData.schedule.length > 0;
    return Boolean(stageData.research);
  });

  const activeTab = availableTabs.find((t) => t.id === tab)?.id ?? availableTabs[0]?.id;
  const wpFor = (type: string, platform?: string) =>
    run.workProducts.find((wp) => wp.type === type && (!platform || wp.platform === platform));

  return (
    <div className="card space-y-4">
      {/* Output Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/90">
              Work Products (Hasil Agen)
            </h2>
            <span className="text-[11px] font-mono text-white/40">· {run.productName}</span>
          </div>
          <div className="text-[11px] font-mono text-white/40 mt-0.5">
            {run.platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(', ')} · {run.providerType}
            {run.totalUsage?.totalTokens ? ` · ${run.totalUsage.totalTokens} tokens` : ''}
          </div>
        </div>

        <span
          className={`pill border text-[10px] font-mono ${
            run.status === 'COMPLETED'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : run.status === 'PARTIAL'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-white/10 bg-white/5 text-white/60'
          }`}
        >
          {run.status}
        </span>
      </div>

      {usedMockFallback && (
        <div className="text-xs border border-amber-500/30 bg-amber-500/10 text-amber-200/90 rounded p-2.5">
          Output ini dibuat menggunakan fallback driver MOCK karena provider utama tidak merespons atau belum memiliki API key.
        </div>
      )}

      {availableTabs.length === 0 ? (
        <div className="py-8 text-center text-xs text-white/40">
          Belum ada data output yang dihasilkan.
        </div>
      ) : (
        <>
          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-white/[0.06] pb-2 overflow-x-auto">
            {availableTabs.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 ${
                    active
                      ? 'bg-white/[0.08] text-white font-semibold'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/[0.02]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* CAPTIONS TAB */}
          {activeTab === 'CAPTIONS' && (
            <div className="space-y-3">
              {stageData.captions.map((caption) => {
                const wp = wpFor('CAPTION', caption.platform);
                return (
                  <div
                    key={caption.platform}
                    className="p-3.5 rounded-md border border-white/[0.06] bg-white/[0.01] space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white">
                          {PLATFORM_LABELS[caption.platform] ?? caption.platform}
                        </span>
                        <span className="text-[11px] font-mono text-white/40">
                          {caption.characterCount} chars · {caption.hashtags.length} tags
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CopyButton text={caption.fullText} />
                        {wp && <ApprovalRow wp={wp} onChanged={onChanged} />}
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="label text-[10px] text-white/40">Hook Headline</span>
                        <p className="text-white/90 font-medium mt-0.5">{caption.hook || '—'}</p>
                      </div>
                      <div>
                        <span className="label text-[10px] text-white/40">Body Caption</span>
                        <p className="text-white/70 whitespace-pre-wrap leading-relaxed mt-0.5 font-sans">
                          {caption.body || '—'}
                        </p>
                      </div>
                      <div>
                        <span className="label text-[10px] text-white/40">Call To Action (CTA)</span>
                        <p className="text-[#828fff] font-mono text-[11px] mt-0.5">{caption.cta || '—'}</p>
                      </div>
                      {caption.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {caption.hashtags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.03] border border-white/[0.06] text-white/50"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* SEO TAB */}
          {activeTab === 'SEO' && stageData.seo && (
            <div className="space-y-3.5 p-3.5 rounded-md border border-white/[0.06] bg-white/[0.01] text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="label text-[10px] text-white/40">
                    Marketplace Title ({stageData.seo.marketplaceTitle.length} chars)
                  </span>
                  <p className="font-semibold text-white mt-1 text-sm">
                    {stageData.seo.marketplaceTitle}
                  </p>
                </div>
                <CopyButton text={stageData.seo.marketplaceTitle} />
              </div>

              <div>
                <span className="label text-[10px] text-white/40">Meta Description</span>
                <p className="text-white/70 mt-1 leading-relaxed">
                  {stageData.seo.metaDescription}
                </p>
              </div>

              <div>
                <span className="label text-[10px] text-white/40">Primary Keyword</span>
                <p className="text-[#828fff] font-mono mt-0.5">
                  {stageData.seo.primaryKeyword}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 pt-1 border-t border-white/[0.04]">
                <div>
                  <span className="label text-[10px] text-white/40">Target Keywords</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {stageData.seo.keywords.map((k) => (
                      <span
                        key={k}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] text-white/60"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="label text-[10px] text-white/40">Long-Tail Queries</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {stageData.seo.longTailKeywords.map((k) => (
                      <span
                        key={k}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] text-white/60"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <span className="label text-[10px] text-white/40">Listing Highlights / Bullets</span>
                <ul className="list-disc list-inside space-y-1 text-white/70 mt-1">
                  {stageData.seo.bulletPoints.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>

              {wpFor('SEO') && (
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <CopyButton text={wpFor('SEO')!.content} />
                  <ApprovalRow wp={wpFor('SEO')!} onChanged={onChanged} />
                </div>
              )}
            </div>
          )}

          {/* VISUAL TAB */}
          {activeTab === 'VISUAL' && (
            <div className="space-y-3">
              {stageData.visuals.map((visual) => {
                const wp = wpFor('IMAGE_PROMPT', visual.platform);
                return (
                  <div
                    key={visual.platform}
                    className="p-3.5 rounded-md border border-white/[0.06] bg-white/[0.01] space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                      <span className="font-semibold text-white">
                        {PLATFORM_LABELS[visual.platform] ?? visual.platform} Visual Prompt
                      </span>
                      <div className="flex items-center gap-2">
                        <CopyButton text={visual.imagePrompt} />
                        {wp && <ApprovalRow wp={wp} onChanged={onChanged} />}
                      </div>
                    </div>

                    <div>
                      <span className="label text-[10px] text-white/40">AI Image Prompt</span>
                      <p className="text-white/80 font-mono text-[11px] mt-1 bg-black/30 p-2.5 rounded border border-white/[0.04] whitespace-pre-wrap">
                        {visual.imagePrompt}
                      </p>
                    </div>

                    {visual.videoScript && (
                      <div>
                        <span className="label text-[10px] text-white/40">Reels / Shorts Script</span>
                        <p className="text-white/70 whitespace-pre-wrap mt-1 leading-relaxed">
                          {visual.videoScript}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* SCHEDULE TAB */}
          {activeTab === 'SCHEDULE' && (
            <div className="space-y-3">
              <div className="border border-white/[0.06] rounded-md overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.03] text-white/40 border-b border-white/[0.06] font-mono text-[11px]">
                    <tr>
                      <th className="p-2.5 font-medium">Hari / Jam</th>
                      <th className="p-2.5 font-medium">Platform</th>
                      <th className="p-2.5 font-medium">Referensi Aset</th>
                      <th className="p-2.5 font-medium">Catatan Distribusi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-white/70 font-mono">
                    {stageData.schedule.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.01]">
                        <td className="p-2.5">
                          {item.day} {item.time}
                        </td>
                        <td className="p-2.5 text-white/90 font-sans">
                          {PLATFORM_LABELS[item.platform] ?? item.platform}
                        </td>
                        <td className="p-2.5 text-[#828fff]">
                          {item.contentRef}
                        </td>
                        <td className="p-2.5 text-white/50 font-sans">
                          {item.note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {wpFor('SCHEDULE') && (
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <CopyButton text={wpFor('SCHEDULE')!.content} />
                  <ApprovalRow wp={wpFor('SCHEDULE')!} onChanged={onChanged} />
                </div>
              )}
            </div>
          )}

          {/* RESEARCH TAB */}
          {activeTab === 'RESEARCH' && stageData.research && (
            <div className="grid gap-3 md:grid-cols-2 text-xs">
              {(
                [
                  ['Target Audience', stageData.research.targetAudience],
                  ['Customer Pain Points', stageData.research.painPoints],
                  ['Unique Selling Proposition (USP)', stageData.research.uniqueSellingPoints],
                  ['Content Angles', stageData.research.angles],
                ] as Array<[string, string[]]>
              ).map(([label, items]) => (
                <div
                  key={label}
                  className="p-3 rounded-md border border-white/[0.06] bg-white/[0.01] space-y-1.5"
                >
                  <span className="label text-[10px] text-white/40">{label}</span>
                  <ul className="list-disc list-inside space-y-0.5 text-white/70">
                    {(items ?? []).map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}

              {stageData.research.toneAdvice && (
                <div className="md:col-span-2 p-3 rounded-md border border-white/[0.06] bg-white/[0.01]">
                  <span className="label text-[10px] text-white/40">Saran Tone & Gaya Bahasa</span>
                  <p className="text-white/80 mt-1 leading-relaxed">
                    {stageData.research.toneAdvice}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
