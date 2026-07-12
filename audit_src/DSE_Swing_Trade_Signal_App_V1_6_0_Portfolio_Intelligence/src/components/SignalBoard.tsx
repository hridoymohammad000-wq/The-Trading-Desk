import React, { useState } from 'react';
import { 
  TrendingUp, 
  Search, 
  SlidersHorizontal, 
  LineChart, 
  Coins, 
  Info,
  ChevronDown
} from 'lucide-react';
import { StockSignal, ActiveModule } from '../types';

interface SignalBoardProps {
  signals: StockSignal[];
  onSelectStock: (symbol: string) => void;
  onPaperTrade: (signal: StockSignal) => void;
}

export const SignalBoard: React.FC<SignalBoardProps> = ({
  signals,
  onSelectStock,
  onPaperTrade
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSignal, setFilterSignal] = useState<'ALL' | 'BUY' | 'WATCH' | 'AVOID'>('ALL');
  const [filterGrade, setFilterGrade] = useState<'ALL' | 'A+' | 'A' | 'WATCH' | 'AVOID'>('ALL');

  // Filter signals based on search & drop downs
  const filteredSignals = signals.filter(sig => {
    const matchesSearch = sig.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          sig.strategy.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSignal = filterSignal === 'ALL' ? true : sig.signal === filterSignal;
    const matchesGrade = filterGrade === 'ALL' ? true : sig.grade === filterGrade;
    return matchesSearch && matchesSignal && matchesGrade;
  });

  return (
    <div className="space-y-6" id="signal-board-module">
      
      {/* Page Title & Explanation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-white">Swing Signal Board</h2>
          <p className="text-slate-400 text-sm mt-0.5">V1 verified swing trades filtered by alpha grades and risk-reward limits</p>
        </div>
        
        {/* Quick Help Popover */}
        <div className="bg-[#151921] border border-slate-800 rounded-lg p-2.5 px-3.5 flex items-center gap-2 max-w-sm shadow-sm">
          <Info className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-[10px] text-slate-400 leading-snug font-sans">
            Signals update automatically when you import new EOD CSV datasets in the <span className="text-emerald-400 font-bold">Data Engine</span> tab.
          </span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-[#151921] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 justify-between items-center shadow-sm">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search stock symbol or strategy..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-sans"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 w-1/2 md:w-auto">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 hidden sm:inline" />
            <select
              value={filterSignal}
              onChange={(e) => setFilterSignal(e.target.value as any)}
              className="bg-[#0B0E14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 w-full md:w-32 font-sans font-semibold"
            >
              <option value="ALL">All Signals</option>
              <option value="BUY">BUY Setups</option>
              <option value="WATCH">WATCH List</option>
              <option value="AVOID">AVOID List</option>
            </select>
          </div>

          <div className="w-1/2 md:w-auto">
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value as any)}
              className="bg-[#0B0E14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 w-full md:w-32 font-sans font-semibold"
            >
              <option value="ALL">All Grades</option>
              <option value="A+">Grade A+</option>
              <option value="A">Grade A</option>
              <option value="WATCH">Grade WATCH</option>
              <option value="AVOID">Grade AVOID</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Signal Table */}
      <div className="bg-[#151921] border border-slate-800 rounded-xl overflow-hidden shadow-xl shadow-slate-950/20" id="signal-board-table">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1C222D] text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="px-5 py-3">Symbol</th>
                <th className="px-5 py-3">Strategy Type</th>
                <th className="px-5 py-3 text-center">Signal</th>
                <th className="px-5 py-3 text-center">Alpha Grade</th>
                <th className="px-5 py-3 text-right">Entry Point</th>
                <th className="px-5 py-3 text-right">Stop Loss (SL)</th>
                <th className="px-5 py-3 text-right">Take Profit (TP)</th>
                <th className="px-5 py-3 text-center">Risk Reward</th>
                <th className="px-5 py-3 text-center">Confidence</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {filteredSignals.length > 0 ? (
                filteredSignals.map((sig) => (
                  <tr key={sig.symbol} className="hover:bg-slate-950/20 transition group">
                    
                    {/* Symbol */}
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-200">
                      <button 
                        onClick={() => onSelectStock(sig.symbol)}
                        className="hover:text-emerald-400 transition text-left flex flex-col font-mono"
                      >
                        <span className="text-sm font-bold">{sig.symbol}</span>
                        <span className="text-[9px] text-slate-500 font-normal font-sans">Dhaka Stock Exchange</span>
                      </button>
                    </td>

                    {/* Strategy */}
                    <td className="px-5 py-3.5">
                      <div className="text-xs text-slate-300 font-bold font-sans flex items-center gap-2">
                        {sig.strategy}
                        <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-normal">
                          {sig.holdingPeriod || 'Swing'}
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-400/80 font-mono mt-0.5">
                        Support: <span className="font-bold">{sig.supportZone || 'Near Low'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 max-w-[280px] leading-relaxed font-sans">{sig.reason}</div>
                    </td>

                    {/* Signal Status */}
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold tracking-wider ${
                        sig.signal === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                        sig.signal === 'WATCH' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {sig.signal}
                      </span>
                    </td>

                    {/* Grade */}
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        sig.grade === 'A+' ? 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/15' : 
                        sig.grade === 'A' ? 'text-teal-400 bg-teal-500/5 border border-teal-500/15' : 
                        sig.grade === 'WATCH' ? 'text-amber-400 bg-amber-500/5 border border-amber-500/15' :
                        'text-rose-400 bg-rose-500/5 border border-rose-500/15'
                      }`}>
                        Grade {sig.grade}
                      </span>
                    </td>

                    {/* Entry Point */}
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-200">
                      ৳{sig.entry.toFixed(2)}
                    </td>

                    {/* SL */}
                    <td className="px-5 py-3.5 text-right font-mono text-rose-400 font-semibold text-xs">
                      ৳{sig.sl.toFixed(2)}
                    </td>

                    {/* TP */}
                    <td className="px-5 py-3.5 text-right font-mono text-emerald-400 font-semibold text-xs">
                      ৳{sig.tp.toFixed(2)}
                    </td>

                    {/* Risk Reward Ratio */}
                    <td className="px-5 py-3.5 text-center font-mono text-xs">
                      <span className={`font-bold px-1.5 py-0.5 rounded ${sig.rr >= 2.2 ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-300'}`}>
                        {sig.rr.toFixed(2)}x
                      </span>
                    </td>

                    {/* Confidence Meter */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col items-center gap-1 font-mono">
                        <span className="text-[10px] font-mono font-bold text-slate-300">{sig.confidence}%</span>
                        <div className="w-14 h-1 bg-[#0B0E14] rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              sig.confidence >= 80 ? 'bg-emerald-500' : 
                              sig.confidence >= 65 ? 'bg-blue-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${sig.confidence}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        {/* Open Chart */}
                        <button
                          onClick={() => onSelectStock(sig.symbol)}
                          className="bg-[#0B0E14] hover:bg-slate-800 border border-slate-800 p-2 rounded-lg text-slate-400 hover:text-white transition"
                          title="Open Chart Lab"
                        >
                          <LineChart className="h-4 w-4 text-blue-400" />
                        </button>

                        {/* Execute Trade */}
                        <button
                          onClick={() => onPaperTrade(sig)}
                          className={`
                            p-2 rounded-lg text-slate-400 transition
                            ${sig.signal === 'BUY' 
                              ? 'bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 text-emerald-400' 
                              : 'bg-[#0B0E14] border border-slate-800 opacity-40 cursor-not-allowed text-slate-600'
                            }
                          `}
                          disabled={sig.signal !== 'BUY'}
                          title={sig.signal === 'BUY' ? "Place Simulated Order" : "No buy trigger active"}
                        >
                          <Coins className="h-4 w-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-500 italic text-xs font-sans">
                    No swing signals matches your filtering guidelines. Try resetting parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Table Footnote */}
        <div className="bg-[#0F131A] p-4 border-t border-slate-800 flex justify-between items-center">
          <span className="text-[10px] text-slate-500 font-sans">
            Showing <span className="text-slate-300 font-semibold">{filteredSignals.length}</span> of <span className="text-slate-300 font-semibold">{signals.length}</span> available swing setups
          </span>
          <span className="text-[10px] text-amber-500 font-bold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/20 uppercase font-mono">
            Coming in next module: Real database signal filter triggers
          </span>
        </div>
      </div>

    </div>
  );
};
