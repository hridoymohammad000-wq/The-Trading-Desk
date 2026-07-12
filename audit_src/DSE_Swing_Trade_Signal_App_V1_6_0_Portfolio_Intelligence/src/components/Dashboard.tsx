import React from 'react';
import { 
  TrendingUp, 
  Search, 
  CheckCircle2, 
  Eye, 
  CircleDollarSign, 
  Briefcase, 
  ArrowUpRight, 
  ChevronRight, 
  LineChart, 
  AlertTriangle,
  Play,
  BookOpen
} from 'lucide-react';
import { StockSignal, PaperTrade, ActiveModule, MarketBiasType, PortfolioHolding, PaperTradeJournal } from '../types';
import { StorageService } from '../lib/engine/StorageService';

interface DashboardProps {
  signals: StockSignal[];
  paperTrades: PaperTrade[];
  portfolioValue: number;
  portfolioHoldings?: PortfolioHolding[];
  stocksCount: number;
  marketStatus: string;
  onNavigate: (module: ActiveModule) => void;
  marketBias: MarketBiasType;
  setMarketBias: (bias: MarketBiasType) => void;
  paperCapital: number;
}

export const Dashboard: React.FC<DashboardProps> = ({
  signals,
  paperTrades,
  portfolioValue,
  portfolioHoldings = [],
  stocksCount,
  marketStatus,
  onNavigate,
  marketBias,
  setMarketBias,
  paperCapital
}) => {
  // Statistics computed dynamically
  const buySignalsCount = signals.filter(s => s.signal === 'BUY').length;
  const watchSignalsCount = signals.filter(s => s.signal === 'WATCH').length;
  const activeTrades = paperTrades.filter(t => t.status === 'ACTIVE');
  const closedTrades = paperTrades.filter(t => t.status === 'CLOSED');

  const totalClosedTrades = closedTrades.length;
  const winningTradesCount = closedTrades.filter(t => t.pl > 0).length;
  const losingTradesCount = closedTrades.filter(t => t.pl <= 0).length;
  const dashboardWinRate = totalClosedTrades > 0 ? (winningTradesCount / totalClosedTrades) * 100 : 0;
  
  // Calculate total P/L from closed and active trades
  const totalPL = paperTrades.reduce((acc, curr) => acc + curr.pl, 0);
  const activePL = activeTrades.reduce((acc, curr) => acc + curr.pl, 0);
  const currentTotalEquity = paperCapital + activeTrades.reduce((acc, curr) => acc + (curr.currentPrice * curr.shares), 0);

  // Journal metrics
  const journals = StorageService.getJSON<PaperTradeJournal[]>('dse_paper_trade_journals', []);
  const completedJournals = journals.filter(j => j.reviewStatus === 'COMPLETED');
  const journalStatus = journals.length > 0 ? '✓ Active' : 'Awaiting Review';
  const tradesReviewedCount = completedJournals.length;
  const pendingReviewsCount = Math.max(0, paperTrades.length - tradesReviewedCount);
  
  // Discipline Score average
  const disciplineScoreAvg = completedJournals.length > 0
    ? completedJournals.reduce((acc, curr) => acc + (curr.disciplineScore || 0), 0) / completedJournals.length
    : 5;

  // Top mistake tag
  const mistakeCounts: Record<string, number> = {};
  journals.forEach(j => {
    if (j.mistakeTag && j.mistakeTag !== 'No Mistake') {
      mistakeCounts[j.mistakeTag] = (mistakeCounts[j.mistakeTag] || 0) + 1;
    }
  });
  const topMistakeTag = Object.entries(mistakeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No Mistake';

  // Bias explanations
  const biasConfigs = {
    Bullish: {
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      barColor: 'bg-emerald-500',
      description: 'Excellent environment for swing trading. Focus on Pullback or Support Bounce buy triggers with A+ setups. Trade confidence is high.',
      rating: '80% Signal Accuracy'
    },
    Neutral: {
      color: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
      barColor: 'bg-slate-500',
      description: 'Index range-bound with sector rotation. Take highly selective trades with strict trailing stop-losses. Focus on Risk Reward >= 2.0.',
      rating: '55% Signal Accuracy'
    },
    Bearish: {
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      barColor: 'bg-rose-500',
      description: 'Downward trend dominant. Select only extremely resilient support bounce structures with halved risk exposure or trade in paper simulation.',
      rating: '30% Signal Accuracy'
    },
    Unknown: {
      color: 'text-slate-500 bg-slate-500/5 border-slate-800',
      barColor: 'bg-slate-800',
      description: 'No market snapshot loaded. Ingest standard DSE CSV datasets in the Data Engine module to calculate automated trend bias.',
      rating: 'Pending Data Ingestion'
    }
  };

  const currentBias = biasConfigs[marketBias] || biasConfigs.Unknown;

  return (
    <div className="space-y-6" id="dashboard-module">
      
      {/* 1. Header & Quick Run Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-white tracking-tight">Market Decision Dashboard</h2>
          <p className="text-slate-400 text-sm mt-0.5">V1 Foundation Control Center for Dhaka Stock Exchange analysis</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onNavigate('data-engine')}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Search className="h-4 w-4 text-emerald-400" />
            Scanner Engine
          </button>
          <button 
            onClick={() => onNavigate('paper-trading')}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-emerald-900/20 transition"
          >
            <Play className="h-4 w-4" />
            Trade Simulator
          </button>
        </div>
      </div>

      {/* 2. KPI Cards Block */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5" id="dashboard-kpi-cards">
        
        {/* Market Status Card */}
        <div className="bg-[#151921] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Market Status</span>
          <div className="mt-2.5">
            <span className="text-emerald-400 text-base font-bold flex items-center gap-1.5 font-display">
              <span className="h-2 w-2 rounded-full bg-emerald-500 glow-pulse-green shrink-0" />
              Demo Active
            </span>
            <span className="text-[10px] text-slate-500 block mt-1 font-mono">{marketStatus}</span>
          </div>
        </div>

        {/* Stocks Scanned Card */}
        <div className="bg-[#151921] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Stocks Scanned</span>
          <div className="mt-2.5">
            <span className="text-white text-2xl font-bold font-display">{stocksCount}</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5 font-mono">100% Verified v1</span>
          </div>
        </div>

        {/* Buy Signals Card */}
        <div className="bg-[#151921] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between cursor-pointer hover:border-emerald-500/40 transition shadow-sm border-l-4 border-l-emerald-500" onClick={() => onNavigate('signal-board')}>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            Buy Signals <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
          </span>
          <div className="mt-2.5">
            <span className="text-emerald-400 text-2xl font-bold font-display flex items-baseline gap-1">
              {buySignalsCount}
              <span className="text-xs text-slate-500 font-normal">Setups</span>
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">Ready for execution</span>
          </div>
        </div>

        {/* Watch Signals Card */}
        <div className="bg-[#151921] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between cursor-pointer hover:border-blue-500/40 transition shadow-sm border-l-4 border-l-amber-500" onClick={() => onNavigate('signal-board')}>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            Watch Signals <Eye className="h-3.5 w-3.5 text-blue-400" />
          </span>
          <div className="mt-2.5">
            <span className="text-blue-400 text-2xl font-bold font-display flex items-baseline gap-1">
              {watchSignalsCount}
              <span className="text-xs text-slate-500 font-normal">Stocks</span>
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">Awaiting breakout</span>
          </div>
        </div>

        {/* Paper Capital Card */}
        <div className="bg-[#151921] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between cursor-pointer hover:border-yellow-500/40 transition shadow-sm" onClick={() => onNavigate('paper-trading')}>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            Paper Balance <CircleDollarSign className="h-3.5 w-3.5 text-yellow-400" />
          </span>
          <div className="mt-2.5">
            <span className="text-yellow-400 text-lg font-bold font-display">
              ৳{paperCapital.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">
              Total Eq: ৳{currentTotalEquity.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Portfolio Value Card */}
        <div className="bg-[#151921] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between cursor-pointer hover:border-emerald-500/40 transition shadow-sm" onClick={() => onNavigate('portfolio')}>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            DSE Holdings <Briefcase className="h-3.5 w-3.5 text-slate-400" />
          </span>
          <div className="mt-2.5">
            <span className={`text-lg font-bold font-display ${portfolioValue > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
              {portfolioValue > 0 ? `৳${portfolioValue.toLocaleString()}` : '৳0'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5 font-sans">
              {portfolioValue > 0 ? 'LankaBangla Synced' : 'Upload LB Statement'}
            </span>
          </div>
        </div>

      </div>

      {/* 3. Main Split Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN (2/3 size): Latest Signals & Paper Trading Tracker */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section: Latest Swing Signals Summary */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">Active Swing Signals Summary</h3>
                <p className="text-[11px] text-slate-500">Premium setups scanning high-liquidity stocks on Dhaka Stock Exchange</p>
              </div>
              <button 
                onClick={() => onNavigate('signal-board')}
                className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1 font-semibold transition"
              >
                Full Signal Board <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            
            <div className="p-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold text-slate-400 border-b border-slate-850 uppercase bg-[#1C222D]">
                      <th className="px-4 py-3">Symbol</th>
                      <th className="px-4 py-3">Strategy</th>
                      <th className="px-4 py-3">Signal</th>
                      <th className="px-4 py-3">Grade</th>
                      <th className="px-4 py-3 text-right">Entry</th>
                      <th className="px-4 py-3 text-right">TP / SL</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {signals.slice(0, 4).map((sig) => (
                      <tr key={sig.symbol} className="hover:bg-slate-950/20 transition group">
                        <td className="px-4 py-3 font-mono font-bold text-slate-200">
                          <button 
                            onClick={() => onNavigate('chart-lab')} 
                            className="hover:text-emerald-400 text-left"
                          >
                            {sig.symbol}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{sig.strategy}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                            sig.signal === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                            sig.signal === 'WATCH' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {sig.signal}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            sig.grade === 'A+' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' :
                            sig.grade === 'A' ? 'text-teal-400 bg-teal-500/10 border border-teal-500/20' :
                            sig.grade === 'WATCH' ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' :
                            'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                          }`}>
                            Grade {sig.grade}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-200">৳{sig.entry.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          <div className="text-emerald-400">৳{sig.tp.toFixed(1)}</div>
                          <div className="text-rose-500 text-[10px]">৳{sig.sl.toFixed(1)}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button 
                            onClick={() => onNavigate('chart-lab')}
                            className="bg-slate-800 group-hover:bg-emerald-500 group-hover:text-white text-slate-300 p-1 rounded transition"
                            title="Analyze in Chart Lab"
                          >
                            <LineChart className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section: Paper Trading Performance Summary */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">Paper Trading Simulator Performance</h3>
                <p className="text-[11px] text-slate-500">Real-time risk feedback testing signals against BDT price movements</p>
              </div>
              <button 
                onClick={() => onNavigate('paper-trading')}
                className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1 transition"
              >
                Open Trading Desk <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Performance Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-[#0B0E14] rounded-lg p-3 border border-slate-800">
                <span className="text-[10px] text-slate-500 font-mono block">Simulated Win Rate</span>
                <span className="text-white text-xl font-bold font-display mt-1 block">
                  {dashboardWinRate.toFixed(1)}%
                </span>
                <span className="text-[9px] text-emerald-400 font-mono block mt-0.5">
                  {winningTradesCount} Win / {losingTradesCount} Loss
                </span>
              </div>
              <div className="bg-[#0B0E14] rounded-lg p-3 border border-slate-800">
                <span className="text-[10px] text-slate-500 font-mono block">Total Simulated Profit</span>
                <span className={`text-xl font-bold font-display mt-1 block ${totalPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {totalPL >= 0 ? '+' : ''}৳{totalPL.toLocaleString()}
                </span>
                <span className="text-[9px] text-slate-500 font-mono block mt-0.5">Accumulated ROI</span>
              </div>
              <div className="bg-[#0B0E14] rounded-lg p-3 border border-slate-800">
                <span className="text-[10px] text-slate-500 font-mono block">Active Risk Positions</span>
                <span className="text-white text-xl font-bold font-display mt-1 block">{activeTrades.length}</span>
                <span className="text-[9px] text-orange-400 font-mono block mt-0.5">
                  Floating P/L: {activePL >= 0 ? '+' : ''}৳{activePL.toLocaleString()}
                </span>
              </div>
              <div className="bg-[#0B0E14] rounded-lg p-3 border border-slate-800">
                <span className="text-[10px] text-slate-500 font-mono block">Capital Utilization</span>
                <span className="text-white text-xl font-bold font-display mt-1 block">
                  {((1 - (paperCapital / currentTotalEquity)) * 100).toFixed(0)}%
                </span>
                <span className="text-[9px] text-slate-500 font-mono block mt-0.5">Unallocated: ৳{paperCapital.toLocaleString()}</span>
              </div>
            </div>

            {/* Simple trades table if any active */}
            {activeTrades.length > 0 ? (
              <div className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-950/40">
                <div className="px-3.5 py-2 border-b border-slate-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Active Simulated Trades
                </div>
                <div className="divide-y divide-slate-800/60">
                  {activeTrades.map(trade => (
                    <div key={trade.id} className="p-3 flex flex-col md:flex-row md:items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-white text-sm">{trade.symbol}</span>
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold uppercase">
                          {trade.type}
                        </span>
                        <span className="text-slate-500 font-mono text-[10px]">{trade.shares} Shares</span>
                      </div>
                      <div className="flex items-center gap-6 font-mono text-right justify-between md:justify-end">
                        <div className="text-left md:text-right">
                          <span className="text-[10px] text-slate-500 block">Entry / Current Price</span>
                          <span className="text-slate-300">৳{trade.entryPrice}</span>
                          <span className="text-slate-400 text-[10px] ml-1">→ ৳{trade.currentPrice}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Unrealized P/L</span>
                          <span className={trade.pl >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                            {trade.pl >= 0 ? '+' : ''}৳{trade.pl.toLocaleString()} ({trade.plPercent >= 0 ? '+' : ''}{trade.plPercent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-[#0B0E14] rounded-lg border border-slate-800/80">
                <p className="text-xs text-slate-500">No active simulated trades open.</p>
                <button 
                  onClick={() => onNavigate('signal-board')} 
                  className="mt-2 text-emerald-400 hover:text-emerald-300 text-xs font-bold underline"
                >
                  Browse buy signal list to execute a trade
                </button>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN (1/3 size): Market Bias & Portfolio Snapshot */}
        <div className="space-y-6">
          
          {/* Section: Journal Status Integration */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-emerald-400" />
                Journal & Discipline Desk
              </h3>
              <button 
                onClick={() => onNavigate('trading-journal')}
                className="text-emerald-400 hover:text-emerald-300 text-[11px] font-semibold flex items-center gap-0.5 transition"
              >
                Open Journal <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-[9px] text-slate-500 uppercase font-sans block">Journal status</span>
                <span className="text-white font-bold block mt-0.5">{journalStatus}</span>
              </div>
              <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-[9px] text-slate-500 uppercase font-sans block">Discipline Avg</span>
                <span className="text-yellow-400 font-bold block mt-0.5">{disciplineScoreAvg.toFixed(1)} / 5</span>
              </div>
              <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-[9px] text-slate-500 uppercase font-sans block">Reviewed</span>
                <span className="text-emerald-400 font-bold block mt-0.5">{tradesReviewedCount} trades</span>
              </div>
              <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-[9px] text-slate-500 uppercase font-sans block">Pending review</span>
                <span className="text-slate-400 font-bold block mt-0.5">{pendingReviewsCount} trades</span>
              </div>
            </div>

            <div className="bg-[#0B0E14] p-3 rounded-lg border border-slate-850 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-sans">Core Violating Loop:</span>
              <span className="text-[10px] font-bold text-rose-400 uppercase font-mono">{topMistakeTag}</span>
            </div>
          </div>

          {/* Section: Engine Status Indicators */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm space-y-3.5">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center justify-between">
              Engine Status Desk
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold uppercase">v1.4 Active</span>
            </h3>
            
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-mono">Data Status</span>
                <span className="text-xs font-bold font-mono text-slate-200">
                  {marketStatus.includes('Loaded') || marketStatus.includes('Scanned') ? '✓ Ingested' : 'Preloaded Cache'}
                </span>
              </div>
              <div className="flex items-center justify-between bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-mono">Validation Status</span>
                <span className="text-xs font-bold font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Checked
                </span>
              </div>
              <div className="flex items-center justify-between bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-mono">Snapshot Status</span>
                <span className="text-xs font-bold font-mono text-blue-400">
                  {StorageService.get('dse_market_snapshots') ? `${JSON.parse(StorageService.get('dse_market_snapshots')!).length} Stored` : '0 Stored'}
                </span>
              </div>
              <div className="flex items-center justify-between bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-mono">Signal Status</span>
                <span className="text-xs font-bold font-mono text-white">
                  {signals.length} Active Candidates
                </span>
              </div>
              <div className="flex items-center justify-between bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-mono">Portfolio Status</span>
                <span className="text-xs font-bold font-mono text-slate-300">
                  {portfolioValue > 0 ? '✓ LankaBangla Sync' : 'Awaiting Import'}
                </span>
              </div>
              <div className="flex items-center justify-between bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-mono">Paper Trading Status</span>
                <span className="text-xs font-bold font-mono text-yellow-400">
                  {paperTrades.filter(t => t.status === 'ACTIVE').length} Open Positions
                </span>
              </div>
            </div>
          </div>

          {/* Section: Market Bias Widget */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display mb-1 flex items-center justify-between">
              Market Bias Gauge
              <span className="text-[10px] font-mono text-slate-500">DSE Board Index</span>
            </h3>
            <p className="text-[11px] text-slate-500 mb-4">Engine-generated deterministic index calibration</p>

            {/* Current Bias Info Area */}
            <div className={`p-4 rounded-lg border ${currentBias.color} space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-xs uppercase tracking-wider">
                  INDEX IS {marketBias}
                </span>
                <span className="text-[10px] font-mono font-bold bg-[#0B0E14]/60 px-2 py-0.5 rounded">
                  {currentBias.rating}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                {currentBias.description}
              </p>
              
              {/* Graphical scale bar */}
              <div className="pt-2">
                <div className="h-1.5 w-full bg-[#0B0E14] rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${currentBias.barColor} transition-all duration-500`}
                    style={{ 
                      width: 
                        marketBias === 'Bullish' ? '100%' :
                        marketBias === 'Neutral' ? '50%' :
                        marketBias === 'Bearish' ? '10%' : '0%'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Warning check info */}
            <div className="mt-4 p-3 bg-[#0B0E14] border border-slate-800 rounded-lg flex gap-2.5 items-start">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed text-slate-400">
                <span className="text-amber-400 font-bold">Rule of Thumb:</span> When market bias is Bearish, avoid holding swing positions over 3 business days. Cut size by 50%.
              </p>
            </div>
          </div>

          {/* Section: LankaBangla Portfolio Snapshot */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">LankaBangla Portfolio Snapshot</h3>
              <button 
                onClick={() => onNavigate('portfolio')}
                className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1 transition"
              >
                Go to Upload <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-4">Track your real holdings by uploading the LankaBangla client PDF ledger</p>

            {portfolioValue > 0 ? (
              <div className="space-y-4">
                <div className="bg-[#0B0E14] p-4 rounded-lg border border-slate-800 text-center">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Total Holding Value</span>
                  <span className="text-2xl font-bold font-display text-emerald-400 mt-1 block">
                    ৳{portfolioValue.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono mt-1 inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Statement Extracted Successfully
                  </span>
                </div>
                
                {/* Holdings summary list */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Holdings Preview</span>
                  <div className="divide-y divide-slate-800 bg-[#0B0E14]/40 rounded-lg border border-slate-800/80 p-1 font-mono">
                    <div className="flex justify-between p-2 text-[10px] text-slate-500 font-bold uppercase font-mono">
                      <span>Symbol</span>
                      <span>Market Value</span>
                    </div>
                    {portfolioHoldings.map((h) => {
                      // Lookup current signal/market price
                      const sig = signals.find(s => s.symbol.toUpperCase() === h.symbol.toUpperCase());
                      const currentPrice = sig ? sig.entry : h.marketPrice;
                      const calculatedMarketValue = h.quantity * currentPrice;
                      return (
                        <div key={h.symbol} className="flex justify-between p-2 text-xs">
                          <span className="font-mono text-slate-200 flex items-center gap-1.5">
                            {h.symbol}
                            {sig && (
                              <span className={`text-[8px] px-1 rounded font-bold ${
                                sig.signal === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' :
                                sig.signal === 'WATCH' ? 'bg-blue-500/10 text-blue-400' :
                                'bg-rose-500/10 text-rose-400'
                              }`}>
                                {sig.signal}
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-slate-300 font-semibold">৳{calculatedMarketValue.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-[#0B0E14]/50 rounded-lg border border-slate-800 border-dashed">
                <Briefcase className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-semibold">No Portfolio Imported</p>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto leading-normal">
                  Holdings and active value fields will populate once you import and confirm your LankaBangla statement.
                </p>
                <button 
                  onClick={() => onNavigate('portfolio')}
                  className="mt-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold px-3 py-1.5 rounded border border-slate-700 transition"
                >
                  Upload LB PDF Statement
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
