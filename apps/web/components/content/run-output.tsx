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

type TabId = 'CAPTIONS' | 'SEO' | 'VISUAL' | 'SCHEDULE' | 'RESEARCH';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'CAPTIONS', label: 'Caption' },
  { id: 'SEO', label: 'SEO & Marketplace' },
  { id: 'VISUAL', label: 'Visual' },
  { id: 'SCHEDULE', label: 'Jadwal' },
  { id: 'RESEARCH', label: 'Riset' },
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
      className="btn-sm btn-ghost"
    >
      {copied ? '✓ Tersalin' : 'Salin'}
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

  const badge =
    wp.status === 'APPROVED'
      ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50'
      : wp.status === 'REJECTED'
        ? 'bg-red-900/50 text-red-300 border-red-700/50'
        : 'bg-slate-800 text-slate-300 border-slate-700';

  return (
    <div className="flex items-center gap-2">
      <span className={`pill border ${badge}`}>{wp.status}</span>
      <button
        type="button"
        disabled={busy || wp.status === 'APPROVED'}
        onClick={() => setStatus('APPROVED')}
        className="btn-sm btn-ghost disabled:opacity-40"
      >
        Setujui
      </button>
      <button
        type="button"
        disabled={busy || wp.status === 'REJECTED'}
        onClick={() => setStatus('REJECTED')}
        className="btn-sm btn-ghost disabled:opacity-40"
      >
        Tolak
      </button>
    </div>
  );
}

/** Renders the artefacts produced by a finished (or partially finished) run. */
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="font-semibold">Hasil produksi</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {run.productName} · {run.platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(', ')} ·{' '}
            <span className="font-mono">{run.providerType}</span>
            {run.totalUsage && run.totalUsage.totalTokens > 0 && ` · ${run.totalUsage.totalTokens} token`}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {usedMockFallback && (
        <p className="text-xs text-amber-300/90 border border-amber-800/50 bg-amber-950/30 rounded-md px-3 py-2">
          Hasil ini diproduksi oleh driver <span className="font-mono">MOCK</span> karena provider yang diminta gagal
          dipanggil (API key salah, endpoint tidak terjangkau, atau kuota habis). Isi kontennya contoh offline — isi
          kredensial yang benar di Settings lalu jalankan ulang.
        </p>
      )}

      {availableTabs.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada hasil. Jalankan pipeline untuk menghasilkan konten.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {availableTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === t.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'CAPTIONS' && (
            <div className="space-y-4">
              {stageData.captions.map((caption) => {
                const wp = wpFor('CAPTION', caption.platform);
                return (
                  <div key={caption.platform} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {PLATFORM_LABELS[caption.platform] ?? caption.platform}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {caption.characterCount} karakter · {caption.hashtags.length} hashtag
                          {caption.bestTimeToPost ? ` · posting ${caption.bestTimeToPost}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CopyButton text={caption.fullText} />
                        {wp && <ApprovalRow wp={wp} onChanged={onChanged} />}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <div className="label mb-1">Hook</div>
                        <p className="text-slate-200">{caption.hook || '—'}</p>
                      </div>
                      <div>
                        <div className="label mb-1">Caption</div>
                        <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{caption.body || '—'}</p>
                      </div>
                      <div>
                        <div className="label mb-1">CTA</div>
                        <p className="text-slate-200">{caption.cta || '—'}</p>
                      </div>
                      {caption.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {caption.hashtags.map((tag) => (
                            <span key={tag} className="text-[11px] text-blue-300 bg-blue-950/60 border border-blue-900/50 px-2 py-0.5 rounded">
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

          {activeTab === 'SEO' && stageData.seo && (
            <div className="space-y-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="label mb-1">Judul marketplace ({stageData.seo.marketplaceTitle.length} karakter)</div>
                  <p className="font-medium text-slate-100">{stageData.seo.marketplaceTitle}</p>
                </div>
                <CopyButton text={stageData.seo.marketplaceTitle} />
              </div>

              <div>
                <div className="label mb-1">Meta description</div>
                <p className="text-slate-300">{stageData.seo.metaDescription}</p>
              </div>

              <div>
                <div className="label mb-1">Keyword utama</div>
                <p className="text-slate-200">{stageData.seo.primaryKeyword}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="label mb-2">Keyword</div>
                  <div className="flex flex-wrap gap-1.5">
                    {stageData.seo.keywords.map((k) => (
                      <span key={k} className="text-[11px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label mb-2">Long tail</div>
                  <div className="flex flex-wrap gap-1.5">
                    {stageData.seo.longTailKeywords.map((k) => (
                      <span key={k} className="text-[11px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="label mb-2">Bullet point listing</div>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {stageData.seo.bulletPoints.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>

              {wpFor('SEO') && (
                <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                  <CopyButton text={wpFor('SEO')!.content} />
                  <ApprovalRow wp={wpFor('SEO')!} onChanged={onChanged} />
                </div>
              )}
            </div>
          )}

          {activeTab === 'VISUAL' && (
            <div className="space-y-4">
              {stageData.visuals.map((visual) => {
                const wp = wpFor('IMAGE_PROMPT', visual.platform);
                return (
                  <div key={visual.platform} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-sm">
                        {PLATFORM_LABELS[visual.platform] ?? visual.platform}
                      </span>
                      <div className="flex items-center gap-2">
                        <CopyButton text={visual.imagePrompt} />
                        {wp && <ApprovalRow wp={wp} onChanged={onChanged} />}
                      </div>
                    </div>
                    <div>
                      <div className="label mb-1">Image prompt</div>
                      <p className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {visual.imagePrompt}
                      </p>
                    </div>
                    {visual.videoScript && (
                      <div>
                        <div className="label mb-1">Video script</div>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{visual.videoScript}</p>
                      </div>
                    )}
                    {visual.styleNotes && (
                      <div>
                        <div className="label mb-1">Style notes</div>
                        <p className="text-sm text-slate-400">{visual.styleNotes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'SCHEDULE' && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/60 text-slate-400 text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Tanggal</th>
                      <th className="text-left px-3 py-2 font-medium">Hari</th>
                      <th className="text-left px-3 py-2 font-medium">Jam</th>
                      <th className="text-left px-3 py-2 font-medium">Platform</th>
                      <th className="text-left px-3 py-2 font-medium">Aset</th>
                      <th className="text-left px-3 py-2 font-medium">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {stageData.schedule.map((item, index) => (
                      <tr key={`${item.date}-${index}`}>
                        <td className="px-3 py-2 font-mono text-xs text-slate-400">{item.date || '—'}</td>
                        <td className="px-3 py-2">{item.day}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.time}</td>
                        <td className="px-3 py-2">{PLATFORM_LABELS[item.platform] ?? item.platform}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-400">{item.contentRef}</td>
                        <td className="px-3 py-2 text-xs text-slate-400">{item.note ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {wpFor('SCHEDULE') && (
                <div className="flex items-center justify-between gap-3">
                  <CopyButton text={wpFor('SCHEDULE')!.content} />
                  <ApprovalRow wp={wpFor('SCHEDULE')!} onChanged={onChanged} />
                </div>
              )}
            </div>
          )}

          {activeTab === 'RESEARCH' && stageData.research && (
            <div className="grid gap-4 md:grid-cols-2 text-sm">
              {(
                [
                  ['Target audiens', stageData.research.targetAudience],
                  ['Pain point', stageData.research.painPoints],
                  ['Unique selling points', stageData.research.uniqueSellingPoints],
                  ['Angle konten', stageData.research.angles],
                  ['Keyword pasar', stageData.research.competitorKeywords],
                ] as Array<[string, string[]]>
              ).map(([label, items]) => (
                <div key={label}>
                  <div className="label mb-2">{label}</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    {(items ?? []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="md:col-span-2">
                <div className="label mb-1">Saran tone</div>
                <p className="text-slate-300">{stageData.research.toneAdvice}</p>
              </div>
              {wpFor('RESEARCH') && (
                <div className="md:col-span-2 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                  <CopyButton text={wpFor('RESEARCH')!.content} />
                  <ApprovalRow wp={wpFor('RESEARCH')!} onChanged={onChanged} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
