// apps/web/app/sheets/page.tsx
import React from 'react';

export default function GoogleSheetsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Google Sheets Integration</h1>
        <p className="text-slate-400">Sync your product catalog and reporting to Google Workspace.</p>
      </header>

      <section className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
        <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center font-bold text-white">G</div>
            <div>
              <p className="font-medium">Google Account</p>
              <p className="text-xs text-slate-400">Not connected</p>
            </div>
          </div>
          <button className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Connect Account
          </button>
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold">Synchronization Tasks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg space-y-3">
              <p className="font-medium">Product Catalog Sync</p>
              <p className="text-xs text-slate-400">Push all active products to a Google Sheet for easy inventory management.</p>
              <button className="w-full py-2 text-xs bg-slate-700 hover:bg-slate-600 rounded-md transition-colors">Sync Now</button>
            </div>
            <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg space-y-3">
              <p className="font-medium">Sales Reporting</p>
              <p className="text-xs text-slate-400">Export daily marketplace sales and AI performance metrics to Sheet.</p>
              <button className="w-full py-2 text-xs bg-slate-700 hover:bg-slate-600 rounded-md transition-colors">Export Report</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
