import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Info, Search, SlidersHorizontal, XCircle } from 'lucide-react';
import { PaperTrade } from '../types';

interface SignalHistoryViewProps {
  paperTrades: PaperTrade[];
}

export const SignalHistoryView: React.FC<SignalHistoryViewProps> = ({ paperTrades }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'TP_HIT' | 'SL_HIT' | 'OTHER'>('ALL');

  const historicalSetups = useMemo(() => paperTrades
    .filter(trade => trade.status === 'CLOSED')
    .map(trade => ({
      id: trade.id,
      symbol: trade.symbol,
      strategy: trade.strategy === 'Support Bounce' ? 'Support Bounce' : 'Pullback',
      signalDate: trade.date,
      entryPrice: trade.entryPrice,
      sl: trade.sl,
      tp: trade.tp,
      status: trade.exitReason === 'Target Hit' ? 'TP_HIT' as const : trade.exitReason === 'Stop Loss Hit' ? 'SL_HIT' as const : 'OTHER' as const,
      paperResult: trade.pl,
      resultPercent: trade.plPercent,
      origin: trade.origin ?? 'MANUAL_IMPORT',
    })), [paperTrades]);

  const filteredHistory = historicalSetups.filter(item => {
    const matchesSearch = item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || item.strategy.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && (filterStatus === 'ALL' || item.status === filterStatus);
  });

  const tpHitCount = historicalSetups.filter(item => item.status === 'TP_HIT').length;
  const slHitCount = historicalSetups.filter(item => item.status === 'SL_HIT').length;
  const settledCount = tpHitCount + slHitCount;
  const winRate = settledCount > 0 ? ((tpHitCount / settledCount) * 100).toFixed(1) : '0.0';
  const otherCount = historicalSetups.length - settledCount;

  return (
    <div className="space-y-6" id="signal-history-module">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-white">Signal History & Archive</h2>
          <p className="text-slate-400 text-sm mt-0.5">Completed paper trades generated from Pullback and Support Bounce signals only.</p>
        </div>
        <div className="bg-[#151921] border border-slate-800 rounded-lg p-2 px-3 flex items-center gap-2 max-w-sm">
          <Info className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-[10px] text-slate-400 leading-snug">Paper-trading records only. No real capital or broker execution.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Stat label="Historical Win Rate" value={`${winRate}%`} />
        <Stat label="TP Targets Reached" value={`${tpHitCount} Trades`} icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />} />
        <Stat label="SL Targets Tripped" value={`${slHitCount} Trades`} icon={<XCircle className="h-5 w-5 text-rose-400" />} />
        <Stat label="Manual / Other Exit" value={`${otherCount} Trades`} icon={<Clock className="h-5 w-5 text-slate-400" />} />
      </div>

      <div className="bg-[#151921] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search symbol or strategy..." className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500" />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 hidden sm:inline" />
          <select value={filterStatus} onChange={event => setFilterStatus(event.target.value as typeof filterStatus)} className="bg-[#0B0E14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 w-full md:w-44">
            <option value="ALL">All Outcomes</option>
            <option value="TP_HIT">Take Profit Hit</option>
            <option value="SL_HIT">Stop Loss Hit</option>
            <option value="OTHER">Manual / Other</option>
          </select>
        </div>
      </div>

      <div className="bg-[#151921] border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead><tr className="bg-[#1C222D] text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <th className="px-5 py-3.5">Entry Date</th><th className="px-5 py-3.5">Symbol</th><th className="px-5 py-3.5">Strategy</th><th className="px-5 py-3.5 text-right">Entry</th><th className="px-5 py-3.5 text-right">SL / TP</th><th className="px-5 py-3.5 text-center">Outcome</th><th className="px-5 py-3.5 text-right">P/L</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredHistory.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-slate-500 italic">No completed paper trades match the selected filter.</td></tr> : filteredHistory.map(item => (
                <tr key={item.id} className="hover:bg-slate-950/20">
                  <td className="px-5 py-3.5 text-slate-400">{item.signalDate}</td>
                  <td className="px-5 py-3.5 font-bold text-white">{item.symbol}</td>
                  <td className="px-5 py-3.5 text-slate-300 font-sans">{item.strategy}<div className="text-[9px] text-slate-600">{item.origin}</div></td>
                  <td className="px-5 py-3.5 text-right text-slate-200">৳{item.entryPrice.toFixed(2)}</td>
                  <td className="px-5 py-3.5 text-right"><div className="text-emerald-400 text-[10px]">TP ৳{item.tp.toFixed(2)}</div><div className="text-rose-400 text-[10px]">SL ৳{item.sl.toFixed(2)}</div></td>
                  <td className="px-5 py-3.5 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === 'TP_HIT' ? 'bg-emerald-500/10 text-emerald-400' : item.status === 'SL_HIT' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>{item.status.replace('_', ' ')}</span></td>
                  <td className={`px-5 py-3.5 text-right font-bold ${item.paperResult > 0 ? 'text-emerald-400' : item.paperResult < 0 ? 'text-rose-400' : 'text-slate-500'}`}>৳{item.paperResult.toLocaleString('en-IN', { maximumFractionDigits: 2 })}<div className="text-[10px] font-normal">{item.resultPercent.toFixed(2)}%</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-[#151921] border border-slate-800 rounded-xl p-4 text-center">
    <span className="text-[10px] text-slate-500 font-mono uppercase block">{label}</span>
    <span className="text-2xl font-bold font-display text-white mt-1 flex items-center justify-center gap-1.5">{icon}{value}</span>
  </div>
);
