import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'DockFlow AI — Warehouse Receiving Operating System',
  description:
    'Intelligent, event-driven arrival-to-receipt automation converting Amazon Ring camera events into actionable logistics workflows.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Providers>
          <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                    DockFlow <span className="text-xs px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">AI</span>
                  </span>
                  <p className="text-[10px] text-slate-400 font-medium">Arrival-to-Receipt Operating System</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="hidden md:flex items-center space-x-2 text-xs text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Ring Partner API Live</span>
                  <span className="text-slate-600">|</span>
                  <span>Chicago Hub (ORD-01)</span>
                </div>

                <div className="flex items-center space-x-2 border-l border-slate-800 pl-4">
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-300 border border-slate-700">
                    DJ
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-medium text-slate-200">Dave Jenkins</p>
                    <p className="text-[10px] text-slate-400">Receiving Lead</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>

          <footer className="border-t border-slate-800/80 bg-slate-950/80 text-xs text-slate-500 py-4 text-center">
            <p>DockFlow AI &copy; 2026 &bull; Production Arrival-to-Receipt Automation with Amazon Ring Cameras</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
