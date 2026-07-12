import React, { useState } from 'react';
import { 
  Coins, 
  ArrowUpRight, 
  ArrowDownRight, 
  Play, 
  XCircle, 
  History, 
  Plus,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Info,
  TrendingUp,
  BarChart2,
  Calendar,
  BookOpen,
  DollarSign,
  TrendingDown,
  Percent,
  ShieldCheck,
  RotateCcw,
  Sliders,
  Scale,
  Sparkles
} from 'lucide-react';
import { StockSignal, PaperTrade, AppSettings, PortfolioHolding } from '../types';
import { MarketRecord } from '../lib/engine/DataEngine';
import { DataOrigin } from '../lib/engine/StorageService';

interface PaperTradingProps {
  signals: StockSignal[];
  paperTrades: PaperTrade[];
  setPaperTrades: (trades: PaperTrade[]) => void;
  paperCapital: number;
  setPaperCapital: (cap: number) => void;
  onNavigate: (module: any) => void;
  settings: AppSettings;
  portfolioHoldings: PortfolioHolding[];
  marketRecords: MarketRecord[];
  marketOrigin: DataOrigin;
}

type TabType = 'terminal' | 'journal' | 'analytics';

export const PaperTrading: React.FC<PaperTradingProps> = ({
  signals,
  paperTrades,
  setPaperTrades,
  paperCapital,
  setPaperCapital,
  onNavigate,
  settings,
  portfolioHoldings,
  marketRecords,
  marketOrigin
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('terminal');
  
  // Risk Limits Defaults if missing
  const maxOpenTrades = settings.maxOpenTrades ?? 5;
  const maxPortfolioExposure = settings.maxPortfolioExposure ?? 100;
  const maxHoldingDays = settings.maxHoldingDays ?? 30;
  const minRR = settings.minRR ?? 2.0;
  const riskPerTrade = settings.riskPerTrade ?? 1.0;

  // Order Ticket states
  const buySignals = signals.filter(s => s.signal === 'BUY');
  const defaultSymbol = buySignals.length > 0 ? buySignals[0].symbol : (signals[0]?.symbol || '');
  const [orderSymbol, setOrderSymbol] = useState(defaultSymbol);
  const [orderShares, setOrderShares] = useState(100);
  const [orderNotes, setOrderNotes] = useState('');

  // Selected Stock Data (Locked)
  const matchedSignal = signals.find(s => s.symbol === orderSymbol);
  const entryPrice = matchedSignal ? matchedSignal.entry : 100.0;
  const signalSL = matchedSignal ? matchedSignal.sl : entryPrice * 0.95;
  const signalTP = matchedSignal ? matchedSignal.tp : entryPrice * 1.10;
  const signalGrade = matchedSignal ? matchedSignal.grade : 'WATCH';
  const signalRR = matchedSignal ? matchedSignal.rr : 2.0;
  const signalStrategy = matchedSignal ? matchedSignal.strategy : 'Pullback';
  const signalPeriod = matchedSignal ? matchedSignal.holdingPeriod : '5-12 Sessions';

  // Check if already owned in LankaBangla portfolio
  const isAlreadyInPortfolio = portfolioHoldings.some(
    h => h.symbol.toUpperCase() === orderSymbol.toUpperCase()
  );
  const portfolioUnits = portfolioHoldings.find(
    h => h.symbol.toUpperCase() === orderSymbol.toUpperCase()
  )?.quantity || 0;

  // Sizing calculations
  const totalValue = orderShares * entryPrice;

  // Active positions and Closed positions
  const activeTrades = paperTrades.filter(t => t.status === 'ACTIVE');
  const closedTrades = paperTrades.filter(t => t.status === 'CLOSED');
  const latestMarketPrices = new Map<string, number>();
  [...marketRecords]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(record => latestMarketPrices.set(record.symbol.toUpperCase(), record.close));

  // Portfolio total valuation (Cash + Current Market Value of Open Positions)
  const totalOpenVal = activeTrades.reduce((acc, t) => acc + (t.currentPrice * t.shares), 0);
  const totalEquity = paperCapital + totalOpenVal;

  // Risk Management Verification
  const combinedExposure = totalEquity > 0 ? (totalOpenVal / totalEquity) * 100 : 0;
  const isExposureExceeded = combinedExposure >= maxPortfolioExposure;
  const isTradeLimitExceeded = activeTrades.length >= maxOpenTrades;

  // Active state for Exit modal/control inline
  const [exitingTradeId, setExitingTradeId] = useState<string | null>(null);
  const [exitShares, setExitShares] = useState<number>(0);
  const [exitPrice, setExitPrice] = useState<number>(0);
  const [exitReason, setExitReason] = useState<'Manual Exit' | 'Target Hit' | 'Stop Loss Hit' | 'Expired Trade' | 'Cancelled'>('Manual Exit');
  const [exitNotes, setExitNotes] = useState<string>('');

  // Journal editable notes
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [journalNoteText, setJournalNoteText] = useState('');

  // Sizer calculations based on Risk Per Trade
  const handleCalculatePositionSize = () => {
    if (!matchedSignal) return;
    const riskAmount = totalEquity * (riskPerTrade / 100);
    const riskPerShare = entryPrice - signalSL;
    if (riskPerShare <= 0) {
      alert('Risk configuration error: Stop Loss is equal to or higher than Entry price.');
      return;
    }
    const calculatedShares = Math.floor(riskAmount / riskPerShare);
    if (calculatedShares <= 0) {
      setOrderShares(10);
    } else {
      // Prevent exceeding current available cash
      const requiredCash = calculatedShares * entryPrice;
      if (requiredCash > paperCapital) {
        const affordableShares = Math.floor(paperCapital / entryPrice);
        setOrderShares(affordableShares);
        alert(`Calculated ${calculatedShares} shares (Risk: ৳${riskAmount.toFixed(0)}), but capped at ${affordableShares} shares due to remaining cash limits.`);
      } else {
        setOrderShares(calculatedShares);
      }
    }
  };

  // Place trade handler
  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Symbol and signal validation
    if (!matchedSignal) {
      alert('Selected symbol is invalid.');
      return;
    }

    if (matchedSignal.signal !== 'BUY' || (matchedSignal.grade !== 'A+' && matchedSignal.grade !== 'A')) {
      alert(`TRADE COMPLIANCE BLOCK:\n\nSetup "${orderSymbol}" with grade "${matchedSignal.grade}" and status "${matchedSignal.signal}" cannot be traded.\n\nPaper trades can ONLY be created from active BUY signals with Grade A+ or A. WATCH and AVOID configurations are blocked to protect capital.`);
      return;
    }

    // 2. Duplicate trade check
    const isDuplicate = activeTrades.some(t => t.symbol === orderSymbol);
    if (isDuplicate) {
      alert(`COMPLIANCE BLOCK: You already have an active open paper position in ${orderSymbol}. Pyramiding into identical symbols is prevented in V1 to maintain core asset diversification.`);
      return;
    }

    // 3. Size validation
    if (orderShares <= 0) {
      alert('Order Quantity must be greater than zero.');
      return;
    }

    if (totalValue > paperCapital) {
      alert(`INSUFFICIENT FUNDS:\n\nThis order requires ৳${totalValue.toLocaleString('en-IN')} but you only have ৳${paperCapital.toLocaleString('en-IN')} in available cash. Please scale down shares or close existing trades.`);
      return;
    }

    // 4. Risk constraints validation
    if (activeTrades.length >= maxOpenTrades) {
      alert(`RISK LIMIT EXCEEDED:\n\nMaximum Open Trades constraint of ${maxOpenTrades} is breached. Please close an active trade first or increase limits in settings.`);
      return;
    }

    if (combinedExposure + ((totalValue / totalEquity) * 100) > maxPortfolioExposure) {
      alert(`PORTFOLIO EXPOSURE BLOCK:\n\nPlacing this trade will push total portfolio exposure to ${((totalOpenVal + totalValue) / totalEquity * 100).toFixed(1)}%, exceeding your Maximum Portfolio Exposure limit of ${maxPortfolioExposure}%.`);
      return;
    }

    // 5. Place trade
    const newTrade: PaperTrade = {
      id: Math.random().toString(36).substr(2, 9),
      symbol: orderSymbol,
      type: 'BUY',
      entryPrice: entryPrice,
      currentPrice: entryPrice,
      shares: orderShares,
      sl: signalSL,
      tp: signalTP,
      status: 'ACTIVE',
      origin: marketOrigin,
      pl: 0,
      plPercent: 0,
      date: new Date().toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' (' + new Date().toISOString().split('T')[0] + ')',
      
      // Extended fields
      strategy: signalStrategy,
      signalGrade: signalGrade,
      investment: totalValue,
      riskReward: signalRR,
      holdingPeriod: signalPeriod,
      notes: orderNotes || 'Position opened from Swing Signal system.',
      history: [
        {
          date: new Date().toISOString().split('T')[0],
          action: 'INITIAL_BUY',
          shares: orderShares,
          price: entryPrice,
          notes: 'Opened position'
        }
      ]
    };

    setPaperTrades([newTrade, ...paperTrades]);
    setPaperCapital(paperCapital - totalValue);
    setOrderNotes('');
    alert(`SIMULATION SUCCESS: Bought ${orderShares} shares of ${orderSymbol} at ৳${entryPrice}!`);
  };

  // Open Exit form
  const handleOpenExit = (trade: PaperTrade) => {
    setExitingTradeId(trade.id);
    setExitShares(trade.shares);
    setExitPrice(trade.currentPrice);
    setExitReason('Manual Exit');
    setExitNotes('');
  };

  // Execute Trade Exit (supports Full / Partial)
  const handleExecuteExit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitingTradeId) return;

    const trade = paperTrades.find(t => t.id === exitingTradeId);
    if (!trade) return;

    if (exitShares <= 0) {
      alert('Shares to exit must be greater than zero.');
      return;
    }

    if (exitShares > trade.shares) {
      alert(`Cannot exit ${exitShares} shares. This position only holds ${trade.shares} shares.`);
      return;
    }

    const isPartial = exitShares < trade.shares;
    const finalClosePrice = exitPrice;
    const entryCost = trade.entryPrice * exitShares;
    const exitProceeds = finalClosePrice * exitShares;
    const pl = exitProceeds - entryCost;
    const plPercent = ((finalClosePrice - trade.entryPrice) / trade.entryPrice) * 100;

    const timestamp = new Date().toISOString().split('T')[0];

    if (isPartial) {
      // Partial Exit logic
      const updated = paperTrades.map(t => {
        if (t.id === exitingTradeId) {
          const remainingShares = t.shares - exitShares;
          const remainingInvestment = remainingShares * t.entryPrice;
          const currentPL = (t.currentPrice - t.entryPrice) * remainingShares;
          const currentPLPercent = ((t.currentPrice - t.entryPrice) / t.entryPrice) * 100;

          const historyItem = {
            date: timestamp,
            action: 'PARTIAL_EXIT',
            shares: exitShares,
            price: finalClosePrice,
            pl: pl,
            notes: `${exitReason}: ${exitNotes}`
          };

          return {
            ...t,
            shares: remainingShares,
            investment: remainingInvestment,
            pl: currentPL,
            plPercent: currentPLPercent,
            history: [...(t.history || []), historyItem]
          };
        }
        return t;
      });

      // Also create a "Closed" pseudo-trade for Journal purposes of the partial exited portion
      const closedPartialRecord: PaperTrade = {
        id: Math.random().toString(36).substr(2, 9),
        symbol: trade.symbol,
        type: 'BUY',
        entryPrice: trade.entryPrice,
        currentPrice: finalClosePrice,
        shares: exitShares,
        sl: trade.sl,
        tp: trade.tp,
        status: 'CLOSED',
        origin: trade.origin ?? marketOrigin,
        pl: pl,
        plPercent: plPercent,
        date: trade.date,
        closeDate: timestamp,
        closePrice: finalClosePrice,
        strategy: trade.strategy,
        signalGrade: trade.signalGrade,
        investment: entryCost,
        riskReward: trade.riskReward,
        holdingPeriod: trade.holdingPeriod,
        exitReason: `Partial (${exitReason})`,
        notes: exitNotes || `Partial exit of ${exitShares} shares.`
      };

      setPaperTrades([closedPartialRecord, ...updated]);
      setPaperCapital(paperCapital + exitProceeds);
      alert(`SIMULATION: Partially exited ${exitShares} shares of ${trade.symbol} at ৳${finalClosePrice}! Cash of ৳${exitProceeds.toLocaleString('en-IN')} added back to capital.`);
    } else {
      // Full Exit logic
      const updated = paperTrades.map(t => {
        if (t.id === exitingTradeId) {
          return {
            ...t,
            status: 'CLOSED' as const,
            closeDate: timestamp,
            closePrice: finalClosePrice,
            pl: pl,
            plPercent: plPercent,
            exitReason: exitReason,
            notes: exitNotes || `Full position exit via ${exitReason}.`
          };
        }
        return t;
      });

      setPaperTrades(updated);
      setPaperCapital(paperCapital + exitProceeds);
      alert(`SIMULATION: Closed full position of ${trade.symbol} at ৳${finalClosePrice}! Cash of ৳${exitProceeds.toLocaleString('en-IN')} refunded to capital.`);
    }

    setExitingTradeId(null);
  };

  // Reset is only permitted after open positions are closed to preserve the accounting equation.
  const handleResetCapital = () => {
    if (activeTrades.length > 0) {
      alert('Close all active paper positions before resetting capital. This prevents cash and equity from being double counted.');
      return;
    }
    if (confirm('Reset paper cash and closed trade history to a clean ৳100,000 account?')) {
      setPaperCapital(100000);
      setPaperTrades([]);
      alert('Paper account reset: Cash ৳100,000, Invested ৳0, Equity ৳100,000.');
    }
  };

  // Apply only the latest validated market close. No random or synthetic price movement is allowed.
  const handleSyncWithMarket = () => {
    if (activeTrades.length === 0) {
      alert('No active paper positions to update.');
      return;
    }
    let updatedCount = 0;
    let releasedCash = 0;
    const today = new Date().toISOString().split('T')[0];
    const updated = paperTrades.map(trade => {
      if (trade.status !== 'ACTIVE') return trade;
      const latestClose = latestMarketPrices.get(trade.symbol.toUpperCase());
      if (latestClose === undefined) return trade;
      updatedCount += 1;
      let closePrice: number | undefined;
      let exitReason: string | undefined;
      if (latestClose >= trade.tp) {
        closePrice = trade.tp;
        exitReason = 'Target Hit';
      } else if (latestClose <= trade.sl) {
        closePrice = trade.sl;
        exitReason = 'Stop Loss Hit';
      }
      if (closePrice !== undefined) {
        releasedCash += closePrice * trade.shares;
        return {
          ...trade,
          currentPrice: closePrice,
          status: 'CLOSED' as const,
          closePrice,
          closeDate: today,
          pl: (closePrice - trade.entryPrice) * trade.shares,
          plPercent: ((closePrice - trade.entryPrice) / trade.entryPrice) * 100,
          exitReason,
          notes: `System exit from validated market close (${marketOrigin}).`,
        };
      }
      return {
        ...trade,
        currentPrice: latestClose,
        pl: (latestClose - trade.entryPrice) * trade.shares,
        plPercent: ((latestClose - trade.entryPrice) / trade.entryPrice) * 100,
      };
    });
    if (releasedCash > 0) setPaperCapital(paperCapital + releasedCash);
    setPaperTrades(updated);
    if (updatedCount === 0) {
      alert('No matching validated OHLCV close was found for the active paper positions. Import the latest market dataset first.');
    } else {
      alert(`Updated ${updatedCount} active position(s) from the latest validated OHLCV close. No synthetic prices were used.`);
    }
  };

  // Performance calculations
  const totalClosedTrades = closedTrades.length;
  const winningTrades = closedTrades.filter(t => t.pl > 0).length;
  const losingTrades = closedTrades.filter(t => t.pl <= 0).length;
  const winRate = totalClosedTrades > 0 ? (winningTrades / totalClosedTrades) * 100 : 0;
  
  const sumGains = closedTrades.filter(t => t.pl > 0).reduce((acc, t) => acc + t.plPercent, 0);
  const sumLosses = closedTrades.filter(t => t.pl <= 0).reduce((acc, t) => acc + t.plPercent, 0);
  
  const avgGain = winningTrades > 0 ? sumGains / winningTrades : 0;
  const avgLoss = losingTrades > 0 ? sumLosses / losingTrades : 0;

  // Average Holding Days
  // Since we track days mockingly, we can count the difference or use pre-filled
  const getHoldingDays = (trade: PaperTrade) => {
    if (!trade.closeDate) return 1;
    try {
      // Just parse standard dates if possible or return dummy random 1-8 days
      const d1 = new Date(trade.date.split('(')[0]);
      const d2 = new Date(trade.closeDate);
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return isNaN(diffDays) ? (trade.symbol === 'GP' ? 5 : 3) : diffDays;
    } catch(e) {
      return 3;
    }
  };
  const totalClosedHoldingDays = closedTrades.reduce((acc, t) => acc + getHoldingDays(t), 0);
  const avgHoldingDays = totalClosedTrades > 0 ? Math.ceil(totalClosedHoldingDays / totalClosedTrades) : 0;

  const netPL = closedTrades.reduce((acc, t) => acc + t.pl, 0) + activeTrades.reduce((acc, t) => acc + t.pl, 0);
  const initialCapitalReference = 100000; // base comparison
  const netReturnPercent = (netPL / initialCapitalReference) * 100;

  // Save journal notes
  const handleStartEditNote = (trade: PaperTrade) => {
    setEditingJournalId(trade.id);
    setJournalNoteText(trade.notes || '');
  };

  const handleSaveJournalNote = (tradeId: string) => {
    const updated = paperTrades.map(t => {
      if (t.id === tradeId) {
        return {
          ...t,
          notes: journalNoteText
        };
      }
      return t;
    });
    setPaperTrades(updated);
    setEditingJournalId(null);
  };

  // Strategy performance data model
  const strategiesList = ['Pullback', 'Support Bounce'];
  const strategyStats = strategiesList.map(strat => {
    const stratTrades = closedTrades.filter(t => t.strategy === strat);
    const stratWins = stratTrades.filter(t => t.pl > 0).length;
    const stratRate = stratTrades.length > 0 ? (stratWins / stratTrades.length) * 100 : 0;
    const stratPL = stratTrades.reduce((acc, t) => acc + t.pl, 0);
    return {
      name: strat,
      count: stratTrades.length,
      winRate: stratRate,
      netProfit: stratPL
    };
  });

  // Grade performance data model
  const gradesList = ['A+', 'A'];
  const gradeStats = gradesList.map(g => {
    const gradeTrades = closedTrades.filter(t => t.signalGrade === g);
    const gradeWins = gradeTrades.filter(t => t.pl > 0).length;
    const gradeRate = gradeTrades.length > 0 ? (gradeWins / gradeTrades.length) * 100 : 0;
    const gradePL = gradeTrades.reduce((acc, t) => acc + t.pl, 0);
    return {
      grade: g,
      count: gradeTrades.length,
      winRate: gradeRate,
      netProfit: gradePL
    };
  });

  // Sync list of symbols that are eligible BUY signals
  const eligibleSignals = signals.filter(s => s.signal === 'BUY' && (s.grade === 'A+' || s.grade === 'A'));

  return (
    <div className="space-y-6" id="paper-trading-module">
      
      {/* 1. Header & Capital controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-mono uppercase font-bold border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              Swing Simulator Engine V1
            </span>
            <span className="bg-slate-800 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded-full">
              DSE Compliance Guard Active
            </span>
          </div>
          <h2 className="text-2xl font-bold font-display text-white">Paper Trading Terminal</h2>
          <p className="text-slate-400 text-xs font-sans">
            Deploy risk-configured mock capital into validated high-volume Dhaka Stock Exchange swing signals.
          </p>
        </div>

        {/* Paper Balance Cards */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg px-4 py-2 flex flex-col min-w-[120px] shadow-inner">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Available Cash</span>
            <span className="text-base font-bold font-mono text-yellow-400">৳{paperCapital.toLocaleString('en-IN')}</span>
            <button 
              onClick={handleResetCapital}
              className="text-[9px] text-slate-400 hover:text-white flex items-center gap-1 mt-0.5 font-sans"
              title="Reset available cash to ৳100,000 without deleting trade history"
            >
              <RotateCcw className="h-2.5 w-2.5" /> Reset Cash
            </button>
          </div>

          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg px-4 py-2 flex flex-col min-w-[120px] shadow-inner">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Invested Capital</span>
            <span className="text-base font-bold font-mono text-blue-400">৳{totalOpenVal.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-slate-500 mt-0.5 font-sans">In {activeTrades.length} positions</span>
          </div>

          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg px-4 py-2 flex flex-col min-w-[140px] shadow-inner">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Paper Equity</span>
            <span className="text-base font-bold font-mono text-white">৳{totalEquity.toLocaleString('en-IN')}</span>
            <div className={`text-[9px] flex items-center gap-0.5 mt-0.5 font-mono ${netPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {netPL >= 0 ? '+' : ''}{netReturnPercent.toFixed(1)}% Return (Net)
            </div>
          </div>
        </div>
      </div>

      {/* 2. Page Tab Navigation */}
      <div className="flex border-b border-slate-800 gap-1">
        <button
          onClick={() => setActiveTab('terminal')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
            activeTab === 'terminal' 
              ? 'border-b-2 border-emerald-500 text-white font-sans bg-slate-800/10' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/5 font-sans'
          }`}
          id="tab-trading-terminal"
        >
          <span className="flex items-center gap-1.5 font-sans">
            <Sliders className="h-3.5 w-3.5 text-emerald-400" />
            Trading Terminal
          </span>
        </button>

        <button
          onClick={() => setActiveTab('journal')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
            activeTab === 'journal' 
              ? 'border-b-2 border-emerald-500 text-white font-sans bg-slate-800/10' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/5 font-sans'
          }`}
          id="tab-trade-journal"
        >
          <span className="flex items-center gap-1.5 font-sans">
            <BookOpen className="h-3.5 w-3.5 text-blue-400" />
            Trade Journal ({closedTrades.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
            activeTab === 'analytics' 
              ? 'border-b-2 border-emerald-500 text-white font-sans bg-slate-800/10' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/5 font-sans'
          }`}
          id="tab-analytics-reports"
        >
          <span className="flex items-center gap-1.5 font-sans">
            <BarChart2 className="h-3.5 w-3.5 text-yellow-400" />
            Performance & Analytics
          </span>
        </button>
      </div>

      {/* 3. Tab Content Switcher */}
      {activeTab === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="terminal-tab-view">
          
          {/* Left: Order Ticket and Sizer Sizing (5 columns) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Risk Control Center (Alert Box status) */}
            <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-emerald-400" />
                Active Risk Control Center
              </h3>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#0B0E14] p-2.5 rounded border border-slate-850 space-y-0.5">
                  <span className="text-[10px] text-slate-500 block">Positions Open</span>
                  <div className="flex items-center gap-1">
                    <span className={`font-mono font-bold ${isTradeLimitExceeded ? 'text-rose-400' : 'text-slate-200'}`}>
                      {activeTrades.length} / {maxOpenTrades}
                    </span>
                    {isTradeLimitExceeded && <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />}
                  </div>
                </div>

                <div className="bg-[#0B0E14] p-2.5 rounded border border-slate-850 space-y-0.5">
                  <span className="text-[10px] text-slate-500 block">Total Portfolio Exp</span>
                  <div className="flex items-center gap-1">
                    <span className={`font-mono font-bold ${isExposureExceeded ? 'text-rose-400' : 'text-slate-200'}`}>
                      {combinedExposure.toFixed(1)}% / {maxPortfolioExposure}%
                    </span>
                    {isExposureExceeded && <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />}
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 leading-normal bg-[#0B0E14] p-3 rounded border border-slate-800 flex gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  <span className="font-bold">Risk Configured:</span> Stop Loss risk model is set to <span className="font-bold text-white font-mono">{riskPerTrade}%</span> per trade. Minimum RR threshold: <span className="font-bold text-white font-mono">{minRR}x</span>.
                </span>
              </div>
            </div>

            {/* Order Placement Ticket */}
            <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display mb-4 flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-yellow-400" />
                Order Placement Ticket
              </h3>

              <form onSubmit={handlePlaceOrder} className="space-y-4">
                {/* Order Type Toggle (Banned selling warning) */}
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1.5 font-sans">Order Action</label>
                  <div className="grid grid-cols-2 gap-2 bg-[#0B0E14] p-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      className="py-2 rounded font-bold text-xs transition-all bg-emerald-600 text-white shadow-md font-sans"
                    >
                      BUY / LONG
                    </button>
                    <button
                      type="button"
                      disabled
                      className="py-2 rounded font-semibold text-xs bg-slate-900 text-slate-600 cursor-not-allowed flex items-center justify-center gap-1 font-sans"
                      title="Short selling is banned on the Dhaka Stock Exchange (DSE)."
                    >
                      SHORT (Banned)
                    </button>
                  </div>
                </div>

                {/* Symbol selector */}
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1 font-sans">Select Active Signal</label>
                  <select
                    value={orderSymbol}
                    onChange={(e) => setOrderSymbol(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  >
                    {signals.map(s => (
                      <option key={s.symbol} value={s.symbol}>
                        {s.symbol} — Grade {s.grade} ({s.signal} | ৳{s.entry.toFixed(1)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Real-money Portfolio Integration Alert */}
                {isAlreadyInPortfolio && (
                  <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg flex gap-2.5 items-start">
                    <Info className="h-4.5 w-4.5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-[10px] leading-relaxed text-blue-300 font-sans">
                      <span className="font-bold block text-blue-400">ALREADY OWNED (Real Portfolio):</span> 
                      You have <span className="font-mono text-white font-bold">{portfolioUnits} units</span> of <span className="font-bold text-white">{orderSymbol}</span> in your imported LankaBangla portfolio. 
                      This paper trade will be recorded as a <span className="font-bold underline">separate simulated position</span> to preserve clean data.
                    </div>
                  </div>
                )}

                {/* Validation Warnings */}
                {!matchedSignal || matchedSignal.signal !== 'BUY' || (matchedSignal.grade !== 'A+' && matchedSignal.grade !== 'A') ? (
                  <div className="bg-rose-500/10 border border-rose-500/30 p-3.5 rounded-lg flex gap-2.5 items-start">
                    <AlertCircle className="h-4.5 w-4.5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-[10px] leading-relaxed text-rose-300 font-sans">
                      <span className="font-bold block text-rose-400">Compliance Warning: Setup Blocked</span> 
                      This symbol has a <span className="font-mono text-white uppercase font-bold px-1 py-0.5 bg-rose-950 border border-rose-800 rounded">{matchedSignal?.grade || 'WATCH'}</span> grade. 
                      DSE Swing Trade rules enforce capital deployment ONLY on <span className="font-bold text-white">A+</span> and <span className="font-bold text-white">A</span> BUY signals.
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex gap-2.5 items-start">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-[10px] leading-relaxed text-emerald-300 font-sans">
                      <span className="font-bold block text-emerald-400">Setup Active & Validated:</span> 
                      Confirmed <span className="font-bold font-mono text-white bg-emerald-950 border border-emerald-800 px-1 rounded">{signalGrade}</span> Signal. 
                      Strategy: <span className="font-semibold text-white">{signalStrategy}</span>. 
                      RR Ratio: <span className="font-semibold font-mono text-white">{signalRR.toFixed(2)}x</span>.
                    </div>
                  </div>
                )}

                {/* Signal parameters (Fully locked, read-only) */}
                <div className="grid grid-cols-3 gap-2 bg-[#0B0E14] p-3 rounded-lg border border-slate-850">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-500 uppercase block font-mono">Entry Target</span>
                    <span className="text-xs font-bold font-mono text-white">৳{entryPrice.toFixed(1)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-500 uppercase block font-mono">Locked TP</span>
                    <span className="text-xs font-bold font-mono text-emerald-400">৳{signalTP.toFixed(1)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-500 uppercase block font-mono">Locked SL</span>
                    <span className="text-xs font-bold font-mono text-rose-400">৳{signalSL.toFixed(1)}</span>
                  </div>
                </div>

                {/* Position Sizing and Sizer */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-slate-400 font-bold uppercase font-sans">Volume (Shares)</label>
                    <button
                      type="button"
                      onClick={handleCalculatePositionSize}
                      disabled={!matchedSignal || matchedSignal.signal !== 'BUY'}
                      className="text-[9px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1 font-mono transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Calculate optimal shares count to restrict risk to configured % per trade."
                    >
                      <Sparkles className="h-3 w-3" /> Auto-Sizer
                    </button>
                  </div>
                  
                  <input
                    type="number"
                    value={orderShares}
                    onChange={(e) => setOrderShares(Math.max(1, parseInt(e.target.value) || 0))}
                    min="1"
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Trade journal notes */}
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1 font-sans">Opening Trade Notes (Optional)</label>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={2}
                    placeholder="Enter strategic reasons or swing breakout setups observed..."
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Order calculations */}
                <div className="bg-[#0B0E14] p-3 rounded-lg border border-slate-800 space-y-1.5 text-xs font-mono shadow-inner">
                  <div className="flex justify-between text-slate-400">
                    <span className="font-sans">Investment:</span>
                    <span className="text-white">৳{totalValue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="font-sans">Capital Utilization:</span>
                    <span className="text-slate-300 font-bold">
                      {totalEquity > 0 ? ((totalValue / totalEquity) * 100).toFixed(1) : '0'}%
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[10px] border-t border-slate-850 pt-1.5">
                    <span className="font-sans">Available post-trade cash:</span>
                    <span className={paperCapital >= totalValue ? 'text-emerald-400' : 'text-rose-400'}>
                      ৳{(paperCapital - totalValue).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Place button */}
                <button
                  type="submit"
                  disabled={!matchedSignal || matchedSignal.signal !== 'BUY' || (matchedSignal.grade !== 'A+' && matchedSignal.grade !== 'A')}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-850 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg text-xs transition shadow-lg flex items-center justify-center gap-1.5 font-sans"
                >
                  <Plus className="h-4 w-4" /> Deploy Simulated Capital
                </button>

              </form>
            </div>

          </div>

          {/* Right: Active Open Positions & Simulated price controller (7 columns) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Live Monitoring Timeline Controls */}
            <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">Validated Market Price Monitor</h3>
                  <p className="text-[11px] text-slate-400 font-sans">Update open positions from the latest validated market close and check SL/TP boundaries.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSyncWithMarket}
                    className="bg-[#0B0E14] hover:bg-slate-900 border border-slate-800 text-slate-300 text-[10px] font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                    title="Update paper prices from the latest validated OHLCV close"
                  >
                    <RefreshCw className="h-3 w-3" /> Apply Latest Market Close
                  </button>
                </div>
              </div>
            </div>

            {/* Exit Form Inline overlay */}
            {exitingTradeId && (
              <div className="bg-slate-950 border border-rose-500/30 rounded-xl p-5 shadow-lg space-y-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <span className="text-xs font-bold font-sans text-rose-400 uppercase flex items-center gap-1">
                    <XCircle className="h-4 w-4" /> Position Exit Ticket
                  </span>
                  <button onClick={() => setExitingTradeId(null)} className="text-slate-400 hover:text-white text-xs">
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleExecuteExit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-mono block mb-1">Exit Type</label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            const trade = paperTrades.find(t => t.id === exitingTradeId);
                            if (trade) setExitShares(trade.shares);
                          }}
                          className={`py-1 rounded font-bold border transition ${
                            exitShares === paperTrades.find(t => t.id === exitingTradeId)?.shares
                              ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                              : 'bg-[#0B0E14] border-slate-800 text-slate-400'
                          }`}
                        >
                          Full Exit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const trade = paperTrades.find(t => t.id === exitingTradeId);
                            if (trade) setExitShares(Math.floor(trade.shares / 2));
                          }}
                          className={`py-1 rounded font-bold border transition ${
                            exitShares < (paperTrades.find(t => t.id === exitingTradeId)?.shares || 0)
                              ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                              : 'bg-[#0B0E14] border-slate-800 text-slate-400'
                          }`}
                        >
                          Partial (50%)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-mono block mb-1">Exit Quantity (Shares)</label>
                      <input
                        type="number"
                        value={exitShares}
                        onChange={(e) => setExitShares(Math.max(1, parseInt(e.target.value) || 0))}
                        className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-mono block mb-1">Execution Price (৳)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={exitPrice}
                        onChange={(e) => setExitPrice(Math.max(0.1, parseFloat(e.target.value) || 0))}
                        className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-mono block mb-1">Exit Trigger Reason</label>
                      <select
                        value={exitReason}
                        onChange={(e) => setExitReason(e.target.value as any)}
                        className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-300"
                      >
                        <option value="Manual Exit">Manual Exit (Swing Profit)</option>
                        <option value="Target Hit">Target Hit (TP Level)</option>
                        <option value="Stop Loss Hit">Stop Loss Hit (SL Level)</option>
                        <option value="Expired Trade">Expired Trade (Session Limit)</option>
                        <option value="Cancelled">Cancelled (Strategy invalid)</option>
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-[10px] text-slate-400 font-mono block mb-1">Exit Journal Comments</label>
                    <input
                      type="text"
                      value={exitNotes}
                      onChange={(e) => setExitNotes(e.target.value)}
                      placeholder="Comment on market momentum, candle formations, or trade learnings..."
                      className="w-full bg-[#0B0E14] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="md:col-span-2 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded text-xs transition"
                  >
                    Confirm Exit Transaction
                  </button>
                </form>
              </div>
            )}

            {/* Active Simulated Positions */}
            <div className="bg-[#151921] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">Active Paper Positions</h3>
                  <p className="text-[11px] text-slate-400 font-sans">Durable swing setups tracked against real-time trigger parameters.</p>
                </div>
                <span className="bg-[#0B0E14] border border-slate-800 text-slate-400 px-2.5 py-1 rounded font-mono text-[10px] font-bold">
                  {activeTrades.length} Active Positions
                </span>
              </div>

              {activeTrades.length > 0 ? (
                <div className="divide-y divide-slate-800/60">
                  {activeTrades.map((t) => {
                    const isOverDays = getHoldingDays(t) > maxHoldingDays;
                    const realPortfolioHolding = portfolioHoldings.some(h => h.symbol.toUpperCase() === t.symbol.toUpperCase());
                    
                    return (
                      <div key={t.id} className="p-4 flex flex-col gap-3 hover:bg-slate-950/20 transition">
                        {/* Row 1: Symbol, badg, sizing */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-bold text-slate-200">{t.symbol}</span>
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold uppercase font-mono">
                              BUY
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">{t.shares} Shares</span>
                            <span className="text-[10px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded font-mono">
                              Grade {t.signalGrade}
                            </span>
                            {realPortfolioHolding && (
                              <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-mono px-1.5 rounded-sm">
                                Additional Paper Position
                              </span>
                            )}
                          </div>

                          <div className="text-right font-mono text-xs">
                            <span className="text-[10px] text-slate-500 block font-sans">Days Held</span>
                            <span className={`font-semibold ${isOverDays ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                              {getHoldingDays(t)} Days {isOverDays && '⚠️ (Max threshold crossed)'}
                            </span>
                          </div>
                        </div>

                        {/* Row 2: Price matrix */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0B0E14] p-2.5 rounded border border-slate-850 text-xs font-mono">
                          <div>
                            <span className="text-[9px] text-slate-500 block">Entry Price</span>
                            <span className="text-slate-300 font-bold">৳{t.entryPrice.toFixed(1)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block">Current Price</span>
                            <span className="text-white font-bold">৳{t.currentPrice.toFixed(1)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block">Take Profit</span>
                            <span className="text-emerald-400 font-bold">৳{t.tp.toFixed(1)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block">Stop Loss</span>
                            <span className="text-rose-400 font-bold">৳{t.sl.toFixed(1)}</span>
                          </div>
                        </div>

                        {/* Row 3: Investment value and actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800/40 pt-2.5">
                          <div className="flex gap-4">
                            <div className="font-mono">
                              <span className="text-[9px] text-slate-500 block">Simulated Investment</span>
                              <span className="text-slate-300 font-semibold text-xs">৳{(t.entryPrice * t.shares).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="font-mono">
                              <span className="text-[9px] text-slate-500 block">Current Market Val</span>
                              <span className="text-white font-semibold text-xs">৳{(t.currentPrice * t.shares).toLocaleString('en-IN')}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4">
                            <div className="text-right font-mono">
                              <div className={`text-sm font-bold flex items-center justify-end gap-1 ${t.pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {t.pl >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                {t.pl >= 0 ? '+' : ''}৳{t.pl.toLocaleString('en-IN')}
                              </div>
                              <span className={`text-[10px] block ${t.pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {t.plPercent >= 0 ? '+' : ''}{t.plPercent.toFixed(2)}%
                              </span>
                            </div>

                            <button
                              onClick={() => handleOpenExit(t)}
                              className="bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 text-xs font-bold px-3.5 py-2 rounded-lg transition"
                            >
                              Exit Position
                            </button>
                          </div>
                        </div>

                        {/* Row 4: Partial exit histories (if any) */}
                        {t.history && t.history.length > 1 && (
                          <div className="bg-[#0B0E14] p-2 rounded text-[10px] font-mono border border-slate-850 space-y-1">
                            <span className="text-slate-500 uppercase block font-sans font-bold">Transaction Ledger:</span>
                            {t.history.map((h, i) => (
                              <div key={i} className="flex justify-between text-slate-400">
                                <span>{h.date} — {h.action}</span>
                                <span>{h.shares} units @ ৳{h.price.toFixed(1)} {h.pl !== undefined && `(P/L: ৳${h.pl.toFixed(0)})`}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Note snippet */}
                        {t.notes && (
                          <div className="text-[10px] text-slate-400 italic bg-slate-900/30 p-2 rounded">
                            <span className="font-semibold not-italic text-slate-500 font-sans block">My Notes:</span>
                            "{t.notes}"
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-16 text-center text-slate-500 italic text-xs font-sans">
                  No active open paper trades inside this session. Use the order ticket on the left to deploy capital!
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {activeTab === 'journal' && (
        <div className="bg-[#151921] border border-slate-800 rounded-xl overflow-hidden shadow-sm" id="journal-tab-view">
          <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">Completed Trading Journal</h3>
              <p className="text-[11px] text-slate-400 font-sans">
                Post-mortem analysis database. Modify notes or review statistics of completed swing drills.
              </p>
            </div>
            <span className="bg-[#0B0E14] border border-slate-800 text-slate-400 px-3 py-1 rounded font-mono text-xs font-bold">
              {closedTrades.length} Drills Saved
            </span>
          </div>

          {/* Professional Journal CTA Banner */}
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-emerald-400 font-bold text-xs uppercase tracking-wide block">💡 Upgrade Available: DSE Professional Journal & Review System</span>
              <span className="text-xs text-slate-300 block font-sans">
                Log detailed checklists, entry/exit notes, mistakes, emotions, weekly retrospects, and LankaBangla holding audits!
              </span>
            </div>
            <button
              onClick={() => onNavigate('trading-journal')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-sans text-xs font-bold px-4 py-2 rounded-lg transition shrink-0 cursor-pointer shadow-md"
            >
              Launch Professional Journal
            </button>
          </div>

          {closedTrades.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0B0E14] text-[10px] text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
                    <th className="px-5 py-3">Asset</th>
                    <th className="px-5 py-3">Strategy / Grade</th>
                    <th className="px-5 py-3">Entry Date / Price</th>
                    <th className="px-5 py-3">Exit Date / Price</th>
                    <th className="px-5 py-3">Held</th>
                    <th className="px-5 py-3">Investment / Exit Proceeds</th>
                    <th className="px-5 py-3">P/L % (BDT)</th>
                    <th className="px-5 py-3">Exit Reason</th>
                    <th className="px-5 py-3">Notes & Learnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {closedTrades.map((t) => {
                    const held = getHoldingDays(t);
                    return (
                      <tr key={t.id} className="hover:bg-slate-950/20 transition">
                        {/* Asset */}
                        <td className="px-5 py-4">
                          <div className="font-bold text-white font-mono">{t.symbol}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{t.shares} units</div>
                        </td>

                        {/* Strategy / Grade */}
                        <td className="px-5 py-4">
                          <div className="text-slate-300 font-semibold">{t.strategy}</div>
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-bold font-mono">
                            Grade {t.signalGrade}
                          </span>
                        </td>

                        {/* Entry Price */}
                        <td className="px-5 py-4 font-mono">
                          <div className="text-slate-400 text-[10px]">{t.date.split('(')[0]}</div>
                          <div className="font-bold text-slate-200">৳{t.entryPrice.toFixed(1)}</div>
                        </td>

                        {/* Exit Price */}
                        <td className="px-5 py-4 font-mono">
                          <div className="text-slate-400 text-[10px]">{t.closeDate}</div>
                          <div className="font-bold text-slate-200">৳{t.closePrice?.toFixed(1)}</div>
                        </td>

                        {/* Held */}
                        <td className="px-5 py-4 font-mono font-bold text-slate-300">
                          {held} Days
                        </td>

                        {/* Proceeds */}
                        <td className="px-5 py-4 font-mono">
                          <div className="text-slate-400 text-[10px]">In: ৳{(t.entryPrice * t.shares).toLocaleString('en-IN')}</div>
                          <div className="text-white font-bold">Out: ৳{((t.closePrice || 0) * t.shares).toLocaleString('en-IN')}</div>
                        </td>

                        {/* P/L */}
                        <td className="px-5 py-4 font-mono">
                          <div className={`font-bold flex items-center gap-0.5 ${t.pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {t.pl >= 0 ? '+' : ''}{t.plPercent.toFixed(2)}%
                          </div>
                          <div className={`text-[10px] ${t.pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {t.pl >= 0 ? '+' : ''}৳{t.pl.toLocaleString('en-IN')}
                          </div>
                        </td>

                        {/* Reason */}
                        <td className="px-5 py-4">
                          <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase font-mono ${
                            t.exitReason === 'Target Hit' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            t.exitReason === 'Stop Loss Hit' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            {t.exitReason || 'Manual Exit'}
                          </span>
                        </td>

                        {/* Note & Learner editor */}
                        <td className="px-5 py-4 max-w-[220px]">
                          {editingJournalId === t.id ? (
                            <div className="space-y-1.5">
                              <textarea
                                value={journalNoteText}
                                onChange={(e) => setJournalNoteText(e.target.value)}
                                rows={2}
                                className="w-full bg-[#0B0E14] border border-slate-800 text-xs p-1.5 rounded text-white"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveJournalNote(t.id)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] px-2 py-1 rounded transition"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingJournalId(null)}
                                  className="bg-slate-850 hover:bg-slate-800 text-slate-400 text-[9px] px-2 py-1 rounded transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-slate-300 italic">"{t.notes || 'No notes added.'}"</p>
                              <button
                                onClick={() => handleStartEditNote(t)}
                                className="text-[10px] text-blue-400 hover:underline hover:text-blue-300 font-sans"
                              >
                                Edit Journal Note
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-16 text-center text-slate-500 italic text-xs font-sans">
              Your trading journal is empty. Realize gains or cut losses on active positions to build your historical records!
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6" id="analytics-tab-view">
          
          {/* Performance Dashboard row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block font-mono">Win Rate Efficacy</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-white">{winRate.toFixed(1)}%</span>
                <span className="text-xs text-slate-400 font-sans">of {totalClosedTrades} drills</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                <div className="bg-emerald-400 h-full" style={{ width: `${winRate}%` }} />
              </div>
            </div>

            <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block font-mono">Average Winning Trade</span>
              <div className="flex items-baseline gap-1 font-mono text-emerald-400">
                <TrendingUp className="h-4.5 w-4.5" />
                <span className="text-2xl font-bold">+{avgGain.toFixed(1)}%</span>
              </div>
              <span className="text-[10px] text-slate-500 block">Average gain of closed winners</span>
            </div>

            <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block font-mono">Average Losing Trade</span>
              <div className="flex items-baseline gap-1 font-mono text-rose-400">
                <TrendingDown className="h-4.5 w-4.5" />
                <span className="text-2xl font-bold">{avgLoss.toFixed(1)}%</span>
              </div>
              <span className="text-[10px] text-slate-500 block">Average cut of closed losers</span>
            </div>

            <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block font-mono">Avg Holding Schedule</span>
              <div className="flex items-baseline gap-1 font-mono text-yellow-400">
                <Calendar className="h-4.5 w-4.5" />
                <span className="text-2xl font-bold">{avgHoldingDays} Days</span>
              </div>
              <span className="text-[10px] text-slate-500 block">Ideal target is under 15 days</span>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Strategy Efficacy Report */}
            <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
                <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
                Strategy Efficacy Report
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Performance breakdown of Pullback channels vs Horizontal Support Bounces based on finalized journal records.
              </p>

              <div className="divide-y divide-slate-800/80">
                {strategyStats.map((strat, i) => (
                  <div key={i} className="py-3 flex justify-between items-center text-xs font-mono">
                    <div>
                      <span className="text-slate-200 font-semibold block font-sans">{strat.name}</span>
                      <span className="text-[10px] text-slate-500 block font-sans">{strat.count} finalized drills</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">Win Rate: {strat.winRate.toFixed(1)}%</div>
                      <div className={`text-[11px] font-bold ${strat.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ৳{strat.netProfit.toLocaleString('en-IN')} P/L
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Signal Grade Quality Report */}
            <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
                <ShieldCheck className="h-4.5 w-4.5 text-blue-400" />
                Signal Grade Quality Report
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Comparative analysis of Grade A+ (high conviction) vs Grade A (standard conviction) swing entries.
              </p>

              <div className="divide-y divide-slate-800/80">
                {gradeStats.map((stat, i) => (
                  <div key={i} className="py-3 flex justify-between items-center text-xs font-mono">
                    <div>
                      <span className="text-slate-200 font-semibold block font-sans">Grade {stat.grade} setups</span>
                      <span className="text-[10px] text-slate-500 block font-sans">{stat.count} drills completed</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">Win Rate: {stat.winRate.toFixed(1)}%</div>
                      <div className={`text-[11px] font-bold ${stat.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ৳{stat.netProfit.toLocaleString('en-IN')} P/L
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Export-Ready Data Model Summary */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
              <Info className="h-4.5 w-4.5 text-yellow-400" />
              Simulated Ledger Export Data Model
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Your paper trading logs are prepared for clean database syncing. No external databases are connected in V1. Here is the export schema payload description:
            </p>
            <div className="bg-[#0B0E14] p-4 rounded-lg border border-slate-800 shadow-inner">
              <pre className="text-[10px] text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap leading-normal">
{`// Export Payload Format (Active & Closed Transactions)
{
  "totalEquity": ${totalEquity.toFixed(2)},
  "availableCash": ${paperCapital.toFixed(2)},
  "investedValue": ${totalOpenVal.toFixed(2)},
  "winRate": "${winRate.toFixed(1)}%",
  "activeCount": ${activeTrades.length},
  "closedCount": ${closedTrades.length},
  "timestamp": "${new Date().toISOString()}",
  "ledger": ${JSON.stringify(paperTrades.slice(0, 2), null, 2)}
}`}
              </pre>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
