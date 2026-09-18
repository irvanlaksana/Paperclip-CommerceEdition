'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Sparkles,
  ShoppingBag,
  Package,
  TableProperties,
  Settings,
  Cpu,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/content', label: 'Content Studio', icon: Sparkles },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/marketplace', label: 'Marketplace Hub', icon: ShoppingBag },
  { href: '/sheets', label: 'Google Sheets', icon: TableProperties },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [ai, setAi] = useState<{ provider: string; mock: boolean; model?: string } | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setAi({
            provider: data.ai?.defaultProvider ?? '-',
            mock: Boolean(data.ai?.mockMode),
            model: data.ai?.model,
          });
        }
      } catch {
        /* API not up yet; silent */
      }
    };
    void load();
    const timer = setInterval(load, 25_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <aside className="w-60 shrink-0 bg-[#0d0e12] border-r border-white/[0.08] flex flex-col h-screen sticky top-0 select-none z-20">
      {/* Workspace / Brand Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.06]">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-md bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white/90 group-hover:bg-white/[0.1] transition-colors">
            {/* Paperclip mark icon */}
            <svg
              className="w-4 h-4 text-[#828fff]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold tracking-tight text-white flex items-center gap-1.5">
              Paperclip
              <span className="text-[10px] font-normal text-white/40 uppercase tracking-widest px-1 py-0.2 rounded bg-white/[0.04] border border-white/[0.06]">
                AI
              </span>
            </span>
            <span className="text-[11px] text-white/40 font-mono -mt-0.5">Commerce</span>
          </div>
        </Link>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold text-white/35 uppercase tracking-wider">
          Workspace
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(`${item.href}`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-white/[0.08] text-white font-semibold'
                  : 'text-white/60 hover:text-white/90 hover:bg-white/[0.04]'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  active ? 'text-[#828fff]' : 'text-white/45 group-hover:text-white/70'
                }`}
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span className="truncate">{item.label}</span>
              {active && <span className="ml-auto w-1 h-3 rounded-full bg-[#828fff]" />}
            </Link>
          );
        })}
      </div>

      {/* Footer / AI Provider status */}
      <div className="p-2 border-t border-white/[0.06] bg-black/20 space-y-2">
        {ai ? (
          <Link
            href="/settings"
            className="block px-2.5 py-2 rounded-md border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all group"
          >
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-white/50 flex items-center gap-1.5">
                <Cpu className="w-3 h-3 text-white/40" />
                Active Model
              </span>
              <span className="flex items-center gap-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    ai.mock ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse-soft'
                  }`}
                />
                <span
                  className={`text-[10px] font-mono ${
                    ai.mock ? 'text-amber-400/90' : 'text-emerald-400/90'
                  }`}
                >
                  {ai.mock ? 'MOCK' : 'ONLINE'}
                </span>
              </span>
            </div>
            <div className="text-xs font-mono font-medium text-white/85 truncate group-hover:text-white">
              {ai.provider}
            </div>
          </Link>
        ) : (
          <div className="px-2.5 py-2 rounded-md border border-white/[0.04] bg-white/[0.01]">
            <div className="text-[11px] text-white/40 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
              Checking status…
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-white/35 font-mono">
          <span>paperclip-v1.1</span>
          <span className="text-[10px] hover:text-white/60 transition-colors">commerce</span>
        </div>
      </div>
    </aside>
  );
}
