// apps/web/app/dashboard/page.tsx
import React from 'react';

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Company Workflow</h1>
          <p className="text-slate-400">Managing Goal $\rightarrow$ Project $\rightarrow$ Issue</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-md font-medium transition-colors">
          + New Goal
        </button>
      </header>

      {/* Goals View */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
            <h2 className="font-bold">Goal: Dominate Wireless Audio Market Q3 2026</h2>
            <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-xs">ACTIVE</span>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Projects under Goal */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Projects</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Marketplace Expansion</span>
                    <span className="text-xs text-blue-400">In Progress</span>
                  </div>
                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full w-[65%]"></div>
                  </div>
                  <p className="text-xs text-slate-400">4/6 Issues completed</p>
                </div>
                <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Content Viral Campaign</span>
                    <span className="text-xs text-slate-400">Planning</span>
                  </div>
                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full w-[20%]"></div>
                  </div>
                  <p className="text-xs text-slate-400">1/5 Issues completed</p>
                </div>
              </div>
            </div>

            {/* Issues under current active Project */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Active Issues (Marketplace Expansion)</h3>
              <div className="space-y-2">
                {[
                  { title: 'Scrape competitors price for Earbuds', agent: 'Product Research', status: 'DONE' },
                  { title: 'Create SEO optimized description', agent: 'SEO Manager', status: 'IN_PROGRESS' },
                  { title: 'Push to Shopee and Tokopedia', agent: 'Marketplace Manager', status: 'TODO' },
                ].map((issue, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-md">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={issue.status === 'DONE'} className="rounded border-slate-600 bg-slate-700" readOnly />
                      <span className={`text-sm ${issue.status === 'DONE' ? 'line-through text-slate-500' : ''}`}>{issue.title}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">{issue.agent}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        issue.status === 'DONE' ? 'bg-green-900 text-green-300' : 
                        issue.status === 'IN_PROGRESS' ? 'bg-blue-900 text-blue-300' : 'bg-slate-700 text-slate-300'
                      }`}>{issue.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
