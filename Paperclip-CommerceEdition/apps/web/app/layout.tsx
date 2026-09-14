import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Sidebar } from '../components/sidebar';

export const metadata: Metadata = {
  title: 'Paperclip Commerce Edition',
  description:
    'Agentic workflow platform for e-commerce: swappable AI providers and an automated content production pipeline.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body className="bg-slate-950 text-slate-50 min-h-screen flex">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-auto p-8">{children}</main>
      </body>
    </html>
  );
}
