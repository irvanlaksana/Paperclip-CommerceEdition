// apps/web/app/marketplace/page.tsx
import React from 'react';

export default function MarketplacePage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Marketplace Hub</h1>
          <p className="text-slate-400">Import products from any URL and optimize them with AI.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-md font-medium transition-colors">
          + Import Product
        </button>
      </header>

      {/* Import Section */}
      <section className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-lg font-semibold">Quick Import</h2>
        <div className="flex gap-3">
          <input 
            type="text" 
            placeholder="Paste product URL (Shopee, Tokopedia, etc...)" 
            className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-4 py-2 outline-none focus:ring-2 ring-blue-500"
          />
          <button className="bg-slate-700 hover:bg-slate-600 px-6 py-2 rounded-md font-medium transition-colors">
            Fetch Data
          </button>
        </div>
      </section>

      {/* Product List */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex">
            <div className="w-40 bg-slate-800 h-40 flex items-center justify-center text-slate-500">
              Image Preview
            </div>
            <div className="p-4 flex-1 space-y-3">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-lg">Premium Wireless Earbuds Pro</h3>
                <span className="text-blue-400 font-mono">Rp 1.200.000</span>
              </div>
              <p className="text-sm text-slate-400 line-clamp-2">
                AI Enhanced: Experience unparalleled sound quality with active noise cancellation and 40h battery life...
              </p>
              <div className="flex gap-2 pt-2">
                <button className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1 rounded">Edit</button>
                <button className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded">Push to Shopee</button>
                <button className="text-xs bg-green-600 hover:bg-green-500 px-2 py-1 rounded">Push to Tokopedia</button>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
