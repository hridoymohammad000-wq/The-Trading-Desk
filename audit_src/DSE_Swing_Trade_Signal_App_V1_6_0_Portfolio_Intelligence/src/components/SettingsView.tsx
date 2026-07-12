import React, { useState } from 'react';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  AlertTriangle, 
  ShieldCheck, 
  HelpCircle,
  Database
} from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onResetPaperTrading: () => void;
  onResetPortfolio: () => void;
  onResetJournal: () => void;
  onResetMarketData: () => void;
  onFullSandboxReset: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onResetPaperTrading,
  onResetPortfolio,
  onResetJournal,
  onResetMarketData,
  onFullSandboxReset
}) => {
  // Local state for forms
  const [paperCapital, setPaperCapital] = useState(settings.paperCapital);
  const [riskPerTrade, setRiskPerTrade] = useState(settings.riskPerTrade);
  const [minRR, setMinRR] = useState(settings.minRR);
  const [storageType, setStorageType] = useState(settings.storageType);
  const [demoMode, setDemoMode] = useState(settings.demoMode);

  // Custom Risk Limits
  const [maxOpenTrades, setMaxOpenTrades] = useState(settings.maxOpenTrades ?? 5);
  const [maxPortfolioExposure, setMaxPortfolioExposure] = useState(settings.maxPortfolioExposure ?? 100);
  const [maxHoldingDays, setMaxHoldingDays] = useState(settings.maxHoldingDays ?? 30);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      paperCapital,
      riskPerTrade,
      minRR,
      storageType,
      demoMode,
      maxOpenTrades,
      maxPortfolioExposure,
      maxHoldingDays
    });
    alert('SIMULATION: Settings successfully saved in active browser sandbox!');
  };

  return (
    <div className="space-y-6" id="settings-module">
      
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold font-display text-white">App Configuration Settings</h2>
        <p className="text-slate-400 text-sm mt-0.5">Adjust risk profiles, virtual paper balances, and persistent local storage presets</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: General & Risk Settings Form (7 columns) */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="bg-[#151921] border border-slate-800 rounded-xl p-6 space-y-5 shadow-sm">
            
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center gap-1.5 border-b border-slate-800 pb-3">
              <Settings className="h-4 w-4 text-emerald-400" />
              General Preferences & Risk Rules
            </h3>

            {/* Field 1: Virtual Starting Balance */}
            <div>
              <label className="text-[11px] text-slate-300 font-bold uppercase block mb-1 font-sans">
                Virtual Starting Capital (BDT)
              </label>
              <div className="flex items-center bg-[#0B0E14] border border-slate-800 rounded-lg p-1.5 focus-within:border-emerald-500 shadow-inner">
                <span className="text-slate-500 font-mono text-sm px-2">৳</span>
                <input
                  type="number"
                  value={paperCapital}
                  onChange={(e) => setPaperCapital(parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent border-none text-xs text-white focus:outline-none font-mono"
                  placeholder="100,000"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-sans">Starting available cash for testing signal performance.</p>
            </div>

            {/* Field 2: Risk per Trade */}
            <div>
              <label className="text-[11px] text-slate-300 font-bold uppercase block mb-1 font-sans">
                Maximum Risk Per Trade
              </label>
              <div className="flex items-center bg-[#0B0E14] border border-slate-800 rounded-lg p-1.5 focus-within:border-emerald-500 shadow-inner">
                <input
                  type="number"
                  step="0.1"
                  value={riskPerTrade}
                  onChange={(e) => setRiskPerTrade(parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent border-none text-xs text-white focus:outline-none font-mono px-2"
                  placeholder="1.0"
                />
                <span className="text-slate-500 font-mono text-sm px-2">%</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-sans">Maximum portion of total equity to risk as stop loss on a single setup.</p>
            </div>

            {/* Field 3: Minimum RR */}
            <div>
              <label className="text-[11px] text-slate-300 font-bold uppercase block mb-1 font-sans">
                Minimum Risk-to-Reward Ratio (RR)
              </label>
              <div className="flex items-center bg-[#0B0E14] border border-slate-800 rounded-lg p-1.5 focus-within:border-emerald-500 shadow-inner">
                <input
                  type="number"
                  step="0.1"
                  value={minRR}
                  onChange={(e) => setMinRR(parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent border-none text-xs text-white focus:outline-none font-mono px-2"
                  placeholder="2.0"
                />
                <span className="text-slate-500 font-mono text-xs px-2">x Ratio</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-sans">Automatic filter constraint. Signals with Risk Reward under this value are flagged as marginal.</p>
            </div>

            {/* Field 3.1: Max Open Trades */}
            <div>
              <label className="text-[11px] text-slate-300 font-bold uppercase block mb-1 font-sans">
                Maximum Open Trades
              </label>
              <div className="flex items-center bg-[#0B0E14] border border-slate-800 rounded-lg p-1.5 focus-within:border-emerald-500 shadow-inner">
                <input
                  type="number"
                  value={maxOpenTrades}
                  onChange={(e) => setMaxOpenTrades(parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent border-none text-xs text-white focus:outline-none font-mono px-2"
                  placeholder="5"
                />
                <span className="text-slate-500 font-sans text-xs px-2">Trades</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-sans">Prevent placing new paper trades if active positions count exceeds this limit.</p>
            </div>

            {/* Field 3.2: Max Portfolio Exposure */}
            <div>
              <label className="text-[11px] text-slate-300 font-bold uppercase block mb-1 font-sans">
                Maximum Portfolio Exposure
              </label>
              <div className="flex items-center bg-[#0B0E14] border border-slate-800 rounded-lg p-1.5 focus-within:border-emerald-500 shadow-inner">
                <input
                  type="number"
                  value={maxPortfolioExposure}
                  onChange={(e) => setMaxPortfolioExposure(parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent border-none text-xs text-white focus:outline-none font-mono px-2"
                  placeholder="100"
                />
                <span className="text-slate-500 font-mono text-xs px-2">%</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-sans">Maximum percentage of total equity that can be allocated to open positions combined.</p>
            </div>

            {/* Field 3.3: Max Holding Days */}
            <div>
              <label className="text-[11px] text-slate-300 font-bold uppercase block mb-1 font-sans">
                Maximum Holding Days
              </label>
              <div className="flex items-center bg-[#0B0E14] border border-slate-800 rounded-lg p-1.5 focus-within:border-emerald-500 shadow-inner">
                <input
                  type="number"
                  value={maxHoldingDays}
                  onChange={(e) => setMaxHoldingDays(parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent border-none text-xs text-white focus:outline-none font-mono px-2"
                  placeholder="30"
                />
                <span className="text-slate-500 font-sans text-xs px-2">Days</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-sans">Warning threshold for old swing trade positions exceeding target holding schedules.</p>
            </div>

            {/* Field 4: Storage Level */}
            <div>
              <label className="text-[11px] text-slate-300 font-bold uppercase block mb-1.5 font-sans">
                Local Sandbox Database Persistence
              </label>
              <div className="grid grid-cols-2 gap-2 bg-[#0B0E14] p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setStorageType('LOCAL')}
                  className={`py-2 rounded font-semibold text-xs transition ${
                    storageType === 'LOCAL' 
                      ? 'bg-[#151921] text-emerald-400 border border-slate-800 font-sans' 
                      : 'text-slate-500 hover:text-slate-300 font-sans'
                  }`}
                >
                  LocalStorage (Browser Saved)
                </button>
                <button
                  type="button"
                  onClick={() => setStorageType('SESSION')}
                  className={`py-2 rounded font-semibold text-xs transition ${
                    storageType === 'SESSION' 
                      ? 'bg-[#151921] text-emerald-400 border border-slate-800 font-sans' 
                      : 'text-slate-500 hover:text-slate-300 font-sans'
                  }`}
                >
                  SessionOnly (Wipes on Refresh)
                </button>
              </div>
            </div>

            {/* Field 5: Demo Mode Warning */}
            <div className="flex items-center justify-between bg-[#0B0E14] p-4 rounded-xl border border-slate-800 shadow-inner">
              <div className="space-y-0.5 font-sans">
                <span className="text-xs font-semibold text-white block font-sans">Full Demo Sandbox Lock</span>
                <span className="text-[10px] text-slate-500 block leading-normal font-sans">Bypasses broker login and disables network fees.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={demoMode} 
                  onChange={(e) => setDemoMode(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white peer-checked:after:border-emerald-500"></div>
              </label>
            </div>

            {/* Save Buttons */}
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-xs transition-colors shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-1.5"
            >
              <Save className="h-4 w-4" /> Save Sandbox Configuration
            </button>

          </form>
        </div>

        {/* Right Side: Resets & Hosting/Deployment details (5 columns) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Reset Box */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-rose-400" />
              Destructive Sandbox Actions
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Perform granular memory wipes or execute a full sandbox reset. Each action is immediate and irreversible.
            </p>
            
            <div className="space-y-2.5">
              {/* Reset 1: Paper Trading */}
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to reset the Paper Trading Sandbox? This will clear all virtual positions and restore capital to starting balance.')) {
                    onResetPaperTrading();
                    alert('SUCCESS: Paper trading virtual balance and open/closed positions have been cleared!');
                  }
                }}
                className="w-full bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 hover:border-transparent text-xs font-bold py-2 rounded-lg transition-colors font-sans text-left px-3 flex justify-between items-center"
              >
                <span>Reset Paper Trading</span>
                <span className="text-[10px] font-normal opacity-85">Wipe positions/capital</span>
              </button>

              {/* Reset 2: Portfolio */}
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to reset the Portfolio Engine? This will delete all imported LankaBangla portfolio balances, confirm history, and files.')) {
                    onResetPortfolio();
                    alert('SUCCESS: Imported portfolios and history records wiped completely!');
                  }
                }}
                className="w-full bg-orange-500/10 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-500/20 hover:border-transparent text-xs font-bold py-2 rounded-lg transition-colors font-sans text-left px-3 flex justify-between items-center"
              >
                <span>Reset Portfolio Engine</span>
                <span className="text-[10px] font-normal opacity-85">Wipe LankaBangla history</span>
              </button>

              {/* Reset 3: Journal */}
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to reset the Trading Journal? This will delete all trade reviews, emotions trackers, and weekly/monthly retrospect logs.')) {
                    onResetJournal();
                    alert('SUCCESS: Journal entries, retrospect logs, and metrics reset!');
                  }
                }}
                className="w-full bg-yellow-500/10 hover:bg-yellow-600 text-yellow-400 hover:text-white border border-yellow-500/20 hover:border-transparent text-xs font-bold py-2 rounded-lg transition-colors font-sans text-left px-3 flex justify-between items-center"
              >
                <span>Reset Trading Journal</span>
                <span className="text-[10px] font-normal opacity-85">Wipe reviews/emotions</span>
              </button>

              {/* Reset 4: Market Data */}
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to reset the Market Data cache? This will clear all imported custom market snapshots and reload the default session data.')) {
                    onResetMarketData();
                    alert('SUCCESS: Market snapshots deleted. Loaded pre-filled defaults!');
                  }
                }}
                className="w-full bg-blue-500/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 hover:border-transparent text-xs font-bold py-2 rounded-lg transition-colors font-sans text-left px-3 flex justify-between items-center"
              >
                <span>Reset Market Data</span>
                <span className="text-[10px] font-normal opacity-85">Wipe imported snapshots</span>
              </button>

              {/* Reset 5: Full Reset */}
              <button
                type="button"
                onClick={() => {
                  if (confirm('⚠️ CRITICAL SANDBOX RESET: Are you sure you want to wipe EVERYTHING? This will delete all custom settings, paper positions, imported portfolios, journal logs, and custom market data.')) {
                    onFullSandboxReset();
                    alert('CRITICAL SUCCESS: Full sandbox database reset successfully completed!');
                  }
                }}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2.5 rounded-lg transition-all font-sans flex justify-between items-center px-3 shadow-md shadow-rose-950/40"
              >
                <span>FULL SANDBOX RESET</span>
                <span className="text-[10px] font-mono font-bold bg-rose-800 text-white px-2 py-0.5 rounded">ALL DATA</span>
              </button>
            </div>
          </div>

          {/* Hosting Specs box */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 space-y-3 shadow-sm">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
              <Database className="h-4 w-4 text-blue-400" />
              Hosting & Architecture Specifications
            </h3>
            <p className="text-xs text-slate-400 leading-normal font-sans">
              This React-Vite v1 shell was constructed specifically with lightweight file footprints and zero database dependencies.
            </p>
            
            <div className="bg-[#0B0E14] p-3 rounded-lg border border-slate-800/60 space-y-2 text-[11px] font-mono shadow-inner">
              <div className="flex justify-between border-b border-slate-900 pb-1.5 text-slate-400 font-mono">
                <span className="font-sans">Deploy Engine:</span>
                <span className="text-emerald-400 font-bold font-mono">Pipra/cPanel Ready</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-1.5 text-slate-400 font-mono">
                <span className="font-sans">Static Footprint:</span>
                <span className="text-slate-200 font-mono">100% Client-Side Pure JS</span>
              </div>
              <div className="flex justify-between text-slate-400 font-mono">
                <span className="font-sans">V2 SQL Server:</span>
                <span className="text-slate-500 font-mono">SQLite / PHP Flat File</span>
              </div>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-[10px] leading-relaxed text-blue-400 rounded-lg flex gap-2 shadow-sm font-sans">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="font-sans">
                <span className="font-bold font-sans">Security Standard:</span> No broker API keys, cookies, or LankaBangla login tokens are transmitted. Data extraction remains strictly inside client memory threads.
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
