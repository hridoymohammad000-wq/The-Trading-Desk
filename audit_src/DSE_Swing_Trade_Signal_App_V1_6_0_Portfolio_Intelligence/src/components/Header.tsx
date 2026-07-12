import React from 'react';
import { AlertTriangle, TrendingUp, Cpu, Database } from 'lucide-react';
import { StorageStatus } from '../lib/engine/StorageService';

interface HeaderProps {
  onMobileMenuToggle: () => void;
  marketStatus: string;
  stocksCount: number;
  storageStatus: StorageStatus;
}

export const Header: React.FC<HeaderProps> = ({ onMobileMenuToggle, marketStatus, stocksCount, storageStatus }) => {
  return (
    <header className="border-b border-slate-800 bg-[#0F131A] sticky top-0 z-40 px-6 py-4" id="app-header">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Left Brand Area */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 shadow-lg shadow-emerald-950/10">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-display tracking-tight text-white flex items-center gap-2">
                DSE Swing Trade Signal
                <span className="text-[10px] bg-[#1C222D] text-slate-400 border border-slate-700/50 px-2 py-0.5 rounded-full font-mono">
                  v1.6.0
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Manual Data Engine + Portfolio + Paper Trading
              </p>
            </div>
          </div>
          
          {/* Mobile Menu Button */}
          <button 
            id="mobile-menu-toggle"
            onClick={onMobileMenuToggle}
            className="md:hidden text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg"
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>

        {/* Center: Live Status Badges */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#0B0E14] px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 glow-pulse-green" />
            <span className="text-xs font-mono text-slate-400">Market: <span className="text-slate-300">{marketStatus}</span></span>
          </div>
          <div className="flex items-center gap-2 bg-[#0B0E14] px-3 py-1.5 rounded-lg border border-slate-800">
            <Cpu className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-mono text-slate-400">Scanned: <span className="text-slate-300">{stocksCount} Stocks</span></span>
          </div>
          <div className="flex items-center gap-2 bg-[#0B0E14] px-3 py-1.5 rounded-lg border border-slate-800">
            <Database className={`h-3.5 w-3.5 ${storageStatus === 'Server Storage Connected' ? 'text-emerald-400' : storageStatus === 'Storage Error' ? 'text-rose-400' : 'text-amber-400'}`} />
            <span className="text-xs font-mono text-slate-400">Storage: <span className="text-slate-300">{storageStatus}</span></span>
          </div>
        </div>

        {/* Right Sandbox/Demo Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3.5 py-2 flex items-center gap-2.5 max-w-full md:max-w-md self-start md:self-auto" id="sandbox-banner">
          <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0" />
          <div className="text-[11px] leading-tight text-amber-400 uppercase tracking-wide font-bold">
            ⚠️ Demo decision-support app. No real trading. No broker connection.
          </div>
        </div>
      </div>
    </header>
  );
};
