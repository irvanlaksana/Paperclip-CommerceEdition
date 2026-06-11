// apps/web/app/layout.tsx
import React from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-50 min-h-screen flex">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-4">
          <div className="text-xl font-bold px-2 py-4 border-b border-slate-800">
            Paperclip <span className="text-blue-500">Commerce</span>
          </div>
          <nav className="flex flex-col gap-1">
            <a href="/dashboard" className="px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">Dashboard</a>
            <a href="/marketplace" className="px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">Marketplace Hub</a>
            <a href="/products" className="px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">Products</a>
            <a href="/content" className="px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">Content Studio</a>
            <a href="/social" className="px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">Social Media</a>
            <a href="/sheets" className="px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">Google Sheets</a>
          </nav>
          <div className="mt-auto border-t border-slate-800 pt-4">
            <a href="/settings" className="px-3 py-2 rounded-md hover:bg-slate-800 transition-colors block">Settings</a>
          </div>
        </aside>
        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
