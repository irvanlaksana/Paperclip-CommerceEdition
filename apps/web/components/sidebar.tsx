'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '▤' },
  { href: '/marketplace', label: 'Marketplace Hub', icon: '🛒' },
  { href: '/products', label: 'Products', icon: '📦' },
  { href: '/content', label: 'Content Studio', icon: '✨' },
  { href: '/sheets', label: 'Google Sheets', icon: '▦' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

/**
 * Sidebar with active-route highlighting plus a live indicator showing which
 * AI provider the backend is currently using - so a mis-set API key is visible
 * from every screen, not only in Settings.
 */
export function Sidebar() {
  const pathname = usePathname();
  const [ai, setAi] = useState<{ provider: string; mock: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setAi({ provider: data.ai?.defaultProvider ?? '-', mock: Boolean(data.ai?.mockMode) });
      } catch {
        /* API not up yet; the badge simply stays hidden */
      }
    };
    void load();
    const timer = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <aside className="w-64 shrink-0 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-4 sticky top-0 h-screen">
      <div className="text-xl font-bold px-2 py-4 border-b border-slate-800">
        Paperclip <span className="text-blue-500">Commerce</span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-3 ${
                active
                  ? 'bg-blue-600/15 text-blue-300 border border-blue-500/30'
                  : 'hover:bg-slate-800 text-slate-300 border border-transparent'
              }`}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        {ai && (
          <Link
            href="/settings"
            className={`block text-xs rounded-lg border p-3 transition-colors ${
              ai.mock
                ? 'border-amber-700/50 bg-amber-900/20 text-amber-200 hover:bg-amber-900/30'
                : 'border-emerald-700/50 bg-emerald-900/20 text-emerald-200 hover:bg-emerald-900/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="opacity-70">AI aktif</span>
              <span
                className={`w-2 h-2 rounded-full ${ai.mock ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse-soft`}
              />
            </div>
            <div className="font-semibold mt-1 truncate">{ai.provider}</div>
            {ai.mock && <div className="mt-1 opacity-80">Mode mock — isi API key di Settings</div>}
          </Link>
        )}
        <div className="border-t border-slate-800 pt-3 text-[11px] text-slate-500 px-1">
          Commerce Edition v1.1
        </div>
      </div>
    </aside>
  );
}
