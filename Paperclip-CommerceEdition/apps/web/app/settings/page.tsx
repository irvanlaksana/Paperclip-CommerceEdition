'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AI_PROVIDER_TYPES, type AIProviderDTO, type AIProviderType } from '@paperclip/shared';
import { api, type AiStatus, type CatalogEntry } from '../../lib/api';

interface FormState {
  id?: string;
  type: AIProviderType;
  name: string;
  model: string;
  endpoint: string;
  apiKey: string;
  temperature: string;
  maxTokens: string;
  priority: string;
  enabled: boolean;
  isDefault: boolean;
}

const INFRA_DEFAULTS = { database: 'PostgreSQL', storage: 'Local Storage', runtime: 'Docker' };

function emptyForm(type: AIProviderType = 'GEMINI', catalog?: CatalogEntry[]): FormState {
  const entry = catalog?.find((item) => item.type === type);
  return {
    type,
    name: entry?.label ?? type,
    model: entry?.defaultModel ?? '',
    endpoint: entry?.defaultEndpoint ?? '',
    apiKey: '',
    temperature: '',
    maxTokens: '',
    priority: '100',
    enabled: true,
    isDefault: false,
  };
}

/**
 * Settings - AI provider control panel.
 *
 * The whole point of this screen is that moving to another AI vendor never
 * requires a code change: pick a type, paste a key, mark it default, test it.
 * Providers configured through `.env` show up here too (source = ENV) so you
 * can see the effective configuration in one place.
 */
export default function SettingsPage() {
  const [providers, setProviders] = useState<AIProviderDTO[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [infra, setInfra] = useState({ ...INFRA_DEFAULTS });
  const [infraOptions, setInfraOptions] = useState<Record<string, readonly string[]>>({});

  const catalogByType = useMemo(() => {
    const map = new Map<string, CatalogEntry>();
    for (const entry of catalog) map.set(entry.type, entry);
    return map;
  }, [catalog]);

  const refresh = useCallback(async () => {
    const [providerData, catalogData, statusData] = await Promise.all([
      api.ai.providers(),
      api.ai.catalog(),
      api.ai.status(),
    ]);
    setProviders(providerData.providers);
    setCatalog(catalogData.providers);
    setStatus(statusData);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
        const config: any = await api.config.infrastructure();
        setInfra({
          database: config.database ?? INFRA_DEFAULTS.database,
          storage: config.storage ?? INFRA_DEFAULTS.storage,
          runtime: config.runtime ?? INFRA_DEFAULTS.runtime,
        });
        if (config.options) setInfraOptions(config.options);
      } catch (err: any) {
        setError(err?.message ?? 'Gagal memuat pengaturan.');
      }
    })();
  }, [refresh]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  const saveProvider = async () => {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        type: form.type,
        name: form.name,
        model: form.model,
        endpoint: form.endpoint,
        // An empty key on an existing record means "keep what is stored".
        apiKey: form.apiKey.trim() ? form.apiKey.trim() : form.id ? undefined : null,
        temperature: form.temperature === '' ? null : Number(form.temperature),
        maxTokens: form.maxTokens === '' ? null : Number(form.maxTokens),
        priority: Number(form.priority || 100),
        enabled: form.enabled,
        isDefault: form.isDefault,
      };

      if (form.id) await api.ai.update(form.id, payload);
      else await api.ai.create(payload);

      setForm(null);
      await refresh();
      flash(`${form.type} tersimpan. Provider ${form.isDefault ? 'dijadikan default.' : 'diperbarui.'}`);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan provider.');
    } finally {
      setBusy(false);
    }
  };

  const testProvider = async (provider: AIProviderDTO) => {
    setTestingId(provider.id);
    setError(null);
    try {
      const result = await api.ai.test(provider.id);
      if (result.ok) {
        flash(`${provider.type} terhubung (${result.latencyMs} ms) — model ${result.model}`);
      } else {
        setError(`${provider.type} gagal dites: ${result.error ?? 'unknown error'}`);
      }
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menjalankan tes.');
    } finally {
      setTestingId(null);
    }
  };

  const removeProvider = async (provider: AIProviderDTO) => {
    if (!confirm(`Hapus konfigurasi ${provider.name}? Nilai dari .env tetap dipakai jika ada.`)) return;
    setBusy(true);
    try {
      await api.ai.remove(provider.id);
      await refresh();
      flash(`${provider.name} dihapus.`);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menghapus.');
    } finally {
      setBusy(false);
    }
  };

  const saveInfra = async () => {
    try {
      await api.config.saveInfrastructure(infra);
      flash('Pengaturan infrastruktur disimpan.');
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan infrastruktur.');
    }
  };

  const sourceBadge = (source: string) => {
    const styles: Record<string, string> = {
      STORE: 'bg-blue-900/60 text-blue-300',
      ENV: 'bg-violet-900/60 text-violet-300',
      CATALOG: 'bg-slate-800 text-slate-400',
      MOCK_FALLBACK: 'bg-amber-900/60 text-amber-300',
      INLINE: 'bg-slate-800 text-slate-300',
    };
    return <span className={`pill ${styles[source] ?? styles.CATALOG}`}>{source}</span>;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-slate-400 text-sm mt-1">
          Ganti provider AI, kunci default, dan atur infrastruktur tanpa mengubah kode.
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

      {/* ---------------------------- runtime status --------------------------- */}
      {status && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Status runtime</h2>
          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
              <div className="label">Provider default</div>
              <div className="font-mono mt-1">{status.default.type}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {status.default.model} · {sourceBadge(status.default.source)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
              <div className="label">Penyimpanan</div>
              <div className="font-mono mt-1">{status.storage.driver}</div>
              <div className="text-xs text-slate-500 mt-0.5 break-all">{status.storage.location}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
              <div className="label">Rantai fail-over</div>
              <div className="text-xs mt-1 space-y-0.5">
                {status.fallbackChain.slice(0, 4).map((item, index) => (
                  <div key={`${item.type}-${index}`} className="font-mono">
                    {index + 1}. {item.type}
                    <span className="text-slate-500">/{item.model}</span>
                    {!item.ready && <span className="text-amber-400"> (belum siap)</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {status.default.type === 'MOCK' && (
            <p className="text-xs text-amber-300/90 border border-amber-800/50 bg-amber-950/30 rounded-md px-3 py-2">
              Sistem berjalan dengan driver MOCK: konten tetap dihasilkan lengkap tetapi isinya contoh offline. Isi API
              key salah satu provider di bawah (atau set <code className="font-mono">AI_DEFAULT_PROVIDER</code> di .env)
              untuk hasil nyata.
            </p>
          )}
        </section>
      )}

      {/* ----------------------------- AI providers ---------------------------- */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="font-semibold">AI Providers</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Prioritas resolusi: <span className="text-slate-300">tersimpan di sini</span> →{' '}
              <span className="text-slate-300">.env</span> → <span className="text-slate-300">default katalog</span>.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setError(null);
              setForm(emptyForm('GEMINI', catalog));
            }}
          >
            + Tambah / ganti provider
          </button>
        </div>

        {form && (
          <div className="rounded-lg border border-blue-800/50 bg-blue-950/20 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">{form.id ? 'Ubah provider' : 'Provider baru'}</h3>
              <button type="button" className="text-xs text-slate-400 hover:text-slate-200" onClick={() => setForm(null)}>
                tutup ✕
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="label" htmlFor="p-type">
                  Tipe provider
                </label>
                <select
                  id="p-type"
                  className="input"
                  value={form.type}
                  onChange={(event) => {
                    const type = event.target.value as AIProviderType;
                    setForm({ ...emptyForm(type, catalog), id: form.id, isDefault: form.isDefault });
                  }}
                >
                  {AI_PROVIDER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {catalogByType.get(type)?.label ?? type} — {type}
                    </option>
                  ))}
                </select>
                {catalogByType.get(form.type)?.notes && (
                  <p className="text-[11px] text-slate-400">{catalogByType.get(form.type)!.notes}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="label" htmlFor="p-name">
                  Nama tampilan
                </label>
                <input
                  id="p-name"
                  className="input"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="label" htmlFor="p-model">
                  Model
                </label>
                <input
                  id="p-model"
                  className="input font-mono"
                  list={`models-${form.type}`}
                  value={form.model}
                  onChange={(event) => setForm({ ...form, model: event.target.value })}
                />
                <datalist id={`models-${form.type}`}>
                  {(catalogByType.get(form.type)?.suggestedModels ?? []).map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <label className="label" htmlFor="p-endpoint">
                  Endpoint
                </label>
                <input
                  id="p-endpoint"
                  className="input font-mono text-xs"
                  value={form.endpoint}
                  onChange={(event) => setForm({ ...form, endpoint: event.target.value })}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="label" htmlFor="p-key">
                  API key {form.id && <span className="normal-case text-slate-500">(kosongkan untuk tidak mengubah)</span>}
                </label>
                <input
                  id="p-key"
                  type="password"
                  autoComplete="off"
                  className="input font-mono"
                  placeholder={catalogByType.get(form.type)?.requiresApiKey ? 'tempel API key…' : 'opsional'}
                  value={form.apiKey}
                  onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
                />
                <p className="text-[11px] text-slate-500">
                  Alternatif lewat .env:{' '}
                  <code className="font-mono text-slate-400">
                    {(catalogByType.get(form.type)?.envKeyNames ?? [`${form.type}_API_KEY`]).join(' / ')}
                  </code>
                  {catalogByType.get(form.type)?.keyConfigured && (
                    <span className="text-emerald-400"> (terdeteksi terisi)</span>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <label className="label" htmlFor="p-temp">
                  Temperature
                </label>
                <input
                  id="p-temp"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  className="input"
                  placeholder="0.7"
                  value={form.temperature}
                  onChange={(event) => setForm({ ...form, temperature: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="label" htmlFor="p-max">
                  Max tokens
                </label>
                <input
                  id="p-max"
                  type="number"
                  step="128"
                  min="1"
                  className="input"
                  placeholder="1024"
                  value={form.maxTokens}
                  onChange={(event) => setForm({ ...form, maxTokens: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="label" htmlFor="p-prio">
                  Prioritas fail-over
                </label>
                <input
                  id="p-prio"
                  type="number"
                  className="input"
                  value={form.priority}
                  onChange={(event) => setForm({ ...form, priority: event.target.value })}
                />
                <p className="text-[11px] text-slate-500">Angka lebih kecil dicoba lebih dulu.</p>
              </div>

              <div className="space-y-3 pt-5">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={form.enabled}
                    onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
                  />
                  Aktif
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={form.isDefault}
                    onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}
                  />
                  Jadikan provider default
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>
                Batal
              </button>
              <button type="button" className="btn btn-primary" onClick={saveProvider} disabled={busy}>
                {busy ? 'Menyimpan…' : 'Simpan provider'}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800 text-xs">
                <th className="pb-3 font-medium">Provider</th>
                <th className="pb-3 font-medium">Model</th>
                <th className="pb-3 font-medium">Sumber</th>
                <th className="pb-3 font-medium">Key</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Tes terakhir</th>
                <th className="pb-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {providers.map((provider) => (
                <tr key={provider.id} className={provider.enabled ? '' : 'opacity-55'}>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{provider.name}</span>
                      {provider.isDefault && (
                        <span className="pill bg-emerald-900/60 text-emerald-300" title="Provider default">
                          default
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">{provider.type}</div>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-slate-300">{provider.model}</td>
                  <td className="py-3 pr-3">{sourceBadge(provider.source)}</td>
                  <td className="py-3 pr-3 text-xs font-mono text-slate-400">
                    {provider.apiKeySet ? provider.apiKeyPreview : provider.requiresApiKey === false ? 'tidak perlu' : '—'}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`pill ${
                          provider.enabled && provider.ready
                            ? 'bg-emerald-900/60 text-emerald-300'
                            : provider.enabled
                              ? 'bg-amber-900/60 text-amber-300'
                              : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {!provider.enabled ? 'nonaktif' : provider.ready ? 'siap' : 'belum siap'}
                      </span>
                      {!provider.ready && provider.missing?.length && (
                        <span className="text-[11px] text-amber-400/80">kurang: {provider.missing.join(', ')}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-xs">
                    {provider.lastTestAt ? (
                      <span className={provider.lastTestStatus === 'PASS' ? 'text-emerald-300' : 'text-red-300'}>
                        {provider.lastTestStatus} · {provider.lastTestLatencyMs ?? 0} ms
                        <span className="block text-slate-500">
                          {new Date(provider.lastTestAt).toLocaleString('id-ID')}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-600">belum dites</span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="btn-sm btn-ghost"
                        onClick={() => testProvider(provider)}
                        disabled={testingId === provider.id}
                      >
                        {testingId === provider.id ? 'Menguji…' : 'Tes'}
                      </button>
                      {provider.source === 'STORE' && (
                        <>
                          <button
                            type="button"
                            className="text-xs text-blue-400 hover:underline"
                            onClick={() =>
                              setForm({
                                id: provider.id,
                                type: provider.type,
                                name: provider.name,
                                model: provider.model,
                                endpoint: provider.endpoint,
                                apiKey: '',
                                temperature: provider.temperature != null ? String(provider.temperature) : '',
                                maxTokens: provider.maxTokens != null ? String(provider.maxTokens) : '',
                                priority: String(provider.priority ?? 100),
                                enabled: provider.enabled,
                                isDefault: Boolean(provider.isDefault),
                              })
                            }
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            className="text-xs text-red-400 hover:underline"
                            onClick={() => removeProvider(provider)}
                            disabled={busy}
                          >
                            Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ----------------------------- infrastructure -------------------------- */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="font-semibold">Infrastructure</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilihan deployment. Backend penyimpanan aktual ditentukan oleh <code className="font-mono">DATA_DRIVER</code>.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={saveInfra}>
            Simpan
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {(['database', 'storage', 'runtime'] as const).map((key) => (
            <div key={key} className="space-y-2">
              <label className="label" htmlFor={`infra-${key}`}>
                {key === 'database' ? 'Database' : key === 'storage' ? 'Storage' : 'Runtime'}
              </label>
              <select
                id={`infra-${key}`}
                className="input"
                value={infra[key]}
                onChange={(event) => setInfra({ ...infra, [key]: event.target.value })}
              >
                {(infraOptions[key] ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                {!(infraOptions[key] ?? []).includes(infra[key]) && <option value={infra[key]}>{infra[key]}</option>}
              </select>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
