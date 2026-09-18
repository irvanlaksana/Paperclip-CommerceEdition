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
    <html lang="id" className="dark h-full">
      <body className="bg-[#090a0f] text-[#f3f4f6] min-h-screen flex antialiased selection:bg-[#5e6ad2]/30 selection:text-white">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-6 md:px-10 md:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
