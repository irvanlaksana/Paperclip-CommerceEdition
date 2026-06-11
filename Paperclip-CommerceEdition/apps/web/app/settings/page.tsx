// apps/web/app/settings/page.tsx
import React from 'react';

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-slate-400">Configure your environment, AI providers, and infrastructure.</p>
      </header>

      {/* Dynamic Infrastructure Selectors */}
      <section className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
        <h2 className="text-xl font-semibold border-b border-slate-800 pb-2">Infrastructure</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Database</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 outline-none focus:ring-2 ring-blue-500">
              <option>PostgreSQL</option>
              <option>MySQL</option>
              <option>MariaDB</option>
              <option>SQLite</option>
              <option>Supabase</option>
              <option>Neon</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Storage</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 outline-none focus:ring-2 ring-blue-500">
              <option>Local Storage</option>
              <option>AWS S3</option>
              <option>Cloudflare R2</option>
              <option>MinIO</option>
              <option>Supabase Storage</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Runtime</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 outline-none focus:ring-2 ring-blue-500">
              <option>Docker</option>
              <option>Kubernetes</option>
              <option>Railway</option>
              <option>Coolify</option>
              <option>VPS</option>
              <option>Render</option>
              <option>Fly.io</option>
              <option>Localhost</option>
            </select>
          </div>
        </div>
      </section>

      {/* AI Providers Management */}
      <section className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h2 className="text-xl font-semibold">AI Providers</h2>
          <button className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-md text-sm transition-colors">
            + Add Provider
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="pb-3 font-medium">Provider</th>
                <th className="pb-3 font-medium">Model</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr>
                <td className="py-3">Gemini Pro 2.5</td>
                <td className="py-3">gemini-2.5-pro</td>
                <td className="py-3"><span className="px-2 py-1 bg-green-900 text-green-300 rounded-full text-xs">Enabled</span></td>
                <td className="py-3"><button className="text-blue-400 hover:underline">Edit</button></td>
              </tr>
              <tr>
                <td className="py-3">GPT-5 Mini</td>
                <td className="py-3">gpt-5-mini</td>
                <td className="py-3"><span className="px-2 py-1 bg-green-900 text-green-300 rounded-full text-xs">Enabled</span></td>
                <td className="py-3"><button className="text-blue-400 hover:underline">Edit</button></td>
              </tr>
              <tr>
                <td className="py-3">Claude Sonnet</td>
                <td className="py-3">claude-3-5-sonnet</td>
                <td className="py-3"><span className="px-2 py-1 bg-slate-700 text-slate-300 rounded-full text-xs">Disabled</span></td>
                <td className="py-3"><button className="text-blue-400 hover:underline">Edit</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
