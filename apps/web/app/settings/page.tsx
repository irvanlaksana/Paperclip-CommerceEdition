'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AI_PROVIDER_TYPES, type AIProviderDTO, type AIProviderType } from '@paperclip/shared';
import { api, type AiStatus, type CatalogEntry } from '../../lib/api';
import {
  Settings,
  Cpu,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Edit2,
  Server,
  Layers,
  Save,
  X,
} from 'lucide-react';

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
        flash(`${provider.type} berhasil terkoneksi (${result.latencyMs} ms) — Model ${result.model}`);
      } else {
        setError(`${provider.type} gagal: ${result.error ?? 'Unknown error'}`);
      }
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Gagal melakukan tes koneksi.');
    } finally {
      setTestingId(null);
    }
  };

  const removeProvider = async (provider: AIProviderDTO) => {
    if (!confirm(`Hapus konfigurasi provider ${provider.name}?`)) return;
    setBusy(true);
    try {
      await api.ai.remove(provider.id);
      await refresh();
      flash(`${provider.name} berhasil dihapus.`);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menghapus provider.');
    } finally {
      setBusy(false);
    }
  };

  const saveInfra = async () => {
    try {
      await api.config.saveInfrastructure(infra);
      flash('Konfigurasi infrastruktur tersimpan.');
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menyimpan konfigurasi.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            System Settings
          </h1>
          <p className="text-xs text-white/50 mt-0.5">
            Manajemen model LLM, konfigurasi kunci API provider AI, dan parameter arsitektur runtime.
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

      {/* Runtime Status Overview */}
      {status && (
        <div className="card space-y-3">
          <div className="pb-2 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/90 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#828fff]" />
              Status Runtime AI
            </span>
            <span className="text-[10px] font-mono text-white/40">Paperclip Engine</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 text-xs">
            <div className="p-3 rounded border border-white/[0.06] bg-white/[0.01]">
              <span className="label text-[10px] text-white/40">Default Provider</span>
              <div className="font-mono text-white text-sm font-semibold mt-1">
                {status.default.type}
              </div>
              <div className="text-[11px] font-mono text-white/40 mt-0.5">
                {status.default.model} · {status.default.source}
              </div>
            </div>

            <div className="p-3 rounded border border-white/[0.06] bg-white/[0.01]">
              <span className="label text-[10px] text-white/40">Storage Driver</span>
              <div className="font-mono text-white text-sm font-semibold mt-1">
                {status.storage.driver}
              </div>
              <div className="text-[11px] font-mono text-white/40 mt-0.5 truncate">
                {status.storage.location}
              </div>
            </div>

            <div className="p-3 rounded border border-white/[0.06] bg-white/[0.01]">
              <span className="label text-[10px] text-white/40">Fail-over Sequence</span>
              <div className="text-[11px] font-mono text-white/60 mt-1 space-y-0.5">
                {status.fallbackChain.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="truncate">
                    {idx + 1}. {item.type} <span className="text-white/40">({item.model})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {status.default.type === 'MOCK' && (
            <div className="text-xs border border-amber-500/30 bg-amber-500/10 text-amber-200/90 rounded p-2.5">
              Sistem saat ini berada di mode <span className="font-mono font-bold">MOCK</span>. Masukkan API key salah satu provider di bawah (misalnya Gemini, Anthropic, atau OpenAI) untuk menghubungkan agen AI secara langsung.
            </div>
          )}
        </div>
      )}

      {/* AI Providers Section */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/[0.06]">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/90">
              AI Providers & Models
            </h2>
            <p className="text-[11px] text-white/40 mt-0.5">
              Ganti model atau penyedia tanpa perlu mengubah baris kode apapun.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary text-xs"
            onClick={() => {
              setError(null);
              setForm(emptyForm('GEMINI', catalog));
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Provider</span>
          </button>
        </div>

        {/* Modal / Inline Edit Form */}
        {form && (
          <div className="p-4 rounded-md border border-[#828fff]/40 bg-white/[0.02] space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="font-semibold text-white">
                {form.id ? 'Edit Provider' : 'Konfigurasi Provider Baru'}
              </span>
              <button
                type="button"
                className="text-white/40 hover:text-white"
                onClick={() => setForm(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid gap-3.5 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="label" htmlFor="p-type">
                  Tipe Provider
                </label>
                <select
                  id="p-type"
                  className="input text-xs"
                  value={form.type}
                  onChange={(e) => {
                    const type = e.target.value as AIProviderType;
                    setForm({ ...emptyForm(type, catalog), id: form.id, isDefault: form.isDefault });
                  }}
                >
                  {AI_PROVIDER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {catalogByType.get(t)?.label ?? t} ({t})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="label" htmlFor="p-name">
                  Label Tampilan
                </label>
                <input
                  id="p-name"
                  className="input text-xs"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="label" htmlFor="p-model">
                  Model String
                </label>
                <input
                  id="p-model"
                  className="input font-mono text-xs"
                  list={`models-${form.type}`}
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
                <datalist id={`models-${form.type}`}>
                  {(catalogByType.get(form.type)?.suggestedModels ?? []).map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <label className="label" htmlFor="p-endpoint">
                  Endpoint URL
                </label>
                <input
                  id="p-endpoint"
                  className="input font-mono text-xs"
                  value={form.endpoint}
                  onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="label" htmlFor="p-key">
                  API Key {form.id && <span className="normal-case text-white/40">(kosongkan jika tidak diubah)</span>}
                </label>
                <input
                  id="p-key"
                  type="password"
                  autoComplete="off"
                  className="input font-mono text-xs"
                  placeholder="sk-..."
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-4 pt-1 md:col-span-2">
                <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded accent-[#5e6ad2]"
                    checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  />
                  <span>Aktifkan Provider</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded accent-[#5e6ad2]"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  />
                  <span>Jadikan Provider Default</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                className="btn btn-ghost text-xs"
                onClick={() => setForm(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary text-xs"
                onClick={saveProvider}
                disabled={busy}
              >
                {busy ? 'Menyimpan…' : 'Simpan Provider'}
              </button>
            </div>
          </div>
        )}

        {/* Providers Table */}
        <div className="border border-white/[0.06] rounded-md overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-white/40 border-b border-white/[0.06] font-mono text-[11px]">
              <tr>
                <th className="p-2.5 font-medium">Provider & Model</th>
                <th className="p-2.5 font-medium">Sumber</th>
                <th className="p-2.5 font-medium">API Key</th>
                <th className="p-2.5 font-medium">Status</th>
                <th className="p-2.5 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {providers.map((p) => {
                const isReady = p.enabled && p.ready;
                return (
                  <tr key={p.id} className="hover:bg-white/[0.01]">
                    <td className="p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white/90">{p.name}</span>
                        {p.isDefault && (
                          <span className="pill text-[9px] font-mono border border-[#828fff]/40 bg-[#5e6ad2]/20 text-[#828fff]">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-white/40 mt-0.5">
                        {p.type} · {p.model}
                      </div>
                    </td>

                    <td className="p-2.5 font-mono text-[11px] text-white/50">
                      {p.source}
                    </td>

                    <td className="p-2.5 font-mono text-[11px] text-white/50">
                      {p.apiKeySet ? p.apiKeyPreview : p.requiresApiKey === false ? 'None required' : 'Belum diisi'}
                    </td>

                    <td className="p-2.5">
                      <span
                        className={`pill text-[10px] font-mono border ${
                          isReady
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : p.enabled
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                              : 'border-white/10 bg-white/5 text-white/40'
                        }`}
                      >
                        {isReady ? 'READY' : p.enabled ? 'MISSING KEY' : 'DISABLED'}
                      </span>
                    </td>

                    <td className="p-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn-sm btn-ghost text-[11px]"
                          onClick={() => testProvider(p)}
                          disabled={testingId === p.id}
                        >
                          {testingId === p.id ? 'Menguji…' : 'Tes'}
                        </button>
                        {p.source === 'STORE' && (
                          <>
                            <button
                              type="button"
                              className="btn-sm btn-ghost text-[11px]"
                              onClick={() =>
                                setForm({
                                  id: p.id,
                                  type: p.type,
                                  name: p.name,
                                  model: p.model,
                                  endpoint: p.endpoint,
                                  apiKey: '',
                                  temperature: p.temperature != null ? String(p.temperature) : '',
                                  maxTokens: p.maxTokens != null ? String(p.maxTokens) : '',
                                  priority: String(p.priority ?? 100),
                                  enabled: p.enabled,
                                  isDefault: Boolean(p.isDefault),
                                })
                              }
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-sm btn-ghost text-[11px] text-red-400 hover:text-red-300"
                              onClick={() => removeProvider(p)}
                              disabled={busy}
                            >
                              Hapus
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Infrastructure Card */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/90">
              Infrastruktur & Penyimpanan
            </h2>
            <p className="text-[11px] text-white/40 mt-0.5">
              Backend layer untuk penyimpanan state agen dan database e-commerce.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={saveInfra}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan</span>
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(['database', 'storage', 'runtime'] as const).map((key) => (
            <div key={key} className="space-y-1.5">
              <label className="label" htmlFor={`infra-${key}`}>
                {key === 'database' ? 'Database Engine' : key === 'storage' ? 'File Storage' : 'Execution Runtime'}
              </label>
              <select
                id={`infra-${key}`}
                className="input text-xs"
                value={infra[key]}
                onChange={(e) => setInfra({ ...infra, [key]: e.target.value })}
              >
                {(infraOptions[key] ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                {!(infraOptions[key] ?? []).includes(infra[key]) && (
                  <option value={infra[key]}>{infra[key]}</option>
                )}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
