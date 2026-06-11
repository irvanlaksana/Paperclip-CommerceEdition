// apps/web/app/content/page.tsx
import React from 'react';

export default function ContentStudioPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Content Studio</h1>
        <p className="text-slate-400">Generate high-converting social media posts using AI.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Selector Panel */}
        <div className="space-y-6">
          <section className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
            <h2 className="font-semibold">Configuration</h2>
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Select Product</label>
              <select className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 outline-none">
                <option>Premium Wireless Earbuds Pro</option>
                <option>Mechanical Keyboard RGB</option>
                <option>Ergonomic Office Chair</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Platform</label>
              <div className="grid grid-cols-2 gap-2">
                <button className="p-2 text-xs bg-blue-600 rounded-md">Instagram</button>
                <button className="p-2 text-xs bg-slate-800 border border-slate-700 rounded-md">TikTok</button>
                <button className="p-2 text-xs bg-slate-800 border border-slate-700 rounded-md">Facebook</button>
                <button className="p-2 text-xs bg-slate-800 border border-slate-700 rounded-md">WhatsApp</button>
              </div>
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded-md font-medium transition-colors">
              Generate Content ✨
            </button>
          </section>
        </div>

        {/* Output Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">AI Generated Caption</h2>
              <button className="text-xs text-blue-400 hover:underline">Regenerate</button>
            </div>
            <textarea 
              className="w-full h-64 bg-slate-800 border border-slate-700 rounded-md p-4 outline-none resize-none"
              defaultValue={`🚀 LEVEL UP YOUR AUDIO GAME! 🎧\n\nSay goodbye to noise and hello to pure bliss with our Premium Wireless Earbuds Pro. Whether you're commuting, working out, or just zoning out, we've got you covered.\n\n✅ 40H Battery Life\n✅ Hybrid ANC\n✅ Crystal Clear Calls\n\nLimited Stock Available! Grab yours now at the link in bio. 👇\n\n#AudioPro #WirelessEarbuds #TechLife #MustHave #Gadget2026`}
            />
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700 transition-colors">Copy Text</button>
              <button className="px-4 py-2 text-sm bg-blue-600 rounded-md hover:bg-blue-500 transition-colors">Schedule Post</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
