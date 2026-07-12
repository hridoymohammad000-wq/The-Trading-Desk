import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  TrendingUp, 
  Calendar, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  Award, 
  Smile, 
  Clock, 
  Info, 
  Save, 
  FileJson, 
  Activity, 
  BookMarked,
  ShieldAlert,
  ChevronRight,
  Filter
} from 'lucide-react';
import { 
  PaperTrade, 
  PaperTradeJournal, 
  PortfolioReview, 
  WeeklyReview, 
  MonthlyReview,
  PortfolioHolding,
  StockSignal
} from '../types';
import { StorageService } from '../lib/engine/StorageService';

interface TradingJournalProps {
  paperTrades: PaperTrade[];
  portfolioHoldings: PortfolioHolding[];
  signals: StockSignal[];
  onNavigate: (module: any) => void;
}

type JournalTab = 'diary' | 'portfolio' | 'mistakes' | 'weekly' | 'monthly' | 'lessons';

export const TradingJournal: React.FC<TradingJournalProps> = ({
  paperTrades,
  portfolioHoldings = [],
  signals = [],
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState<JournalTab>('diary');

  // Persistence States
  const [journals, setJournals] = useState<PaperTradeJournal[]>(() => 
    StorageService.getJSON<PaperTradeJournal[]>('dse_paper_trade_journals', [])
  );
  const [portfolioReviews, setPortfolioReviews] = useState<PortfolioReview[]>(() => 
    StorageService.getJSON<PortfolioReview[]>('dse_portfolio_reviews', [])
  );
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>(() => 
    StorageService.getJSON<WeeklyReview[]>('dse_weekly_reviews', [])
  );
  const [monthlyReviews, setMonthlyReviews] = useState<MonthlyReview[]>(() => 
    StorageService.getJSON<MonthlyReview[]>('dse_monthly_reviews', [])
  );

  // Sync to StorageService
  useEffect(() => {
    StorageService.setJSON('dse_paper_trade_journals', journals);
  }, [journals]);

  useEffect(() => {
    StorageService.setJSON('dse_portfolio_reviews', portfolioReviews);
  }, [portfolioReviews]);

  useEffect(() => {
    StorageService.setJSON('dse_weekly_reviews', weeklyReviews);
  }, [weeklyReviews]);

  useEffect(() => {
    StorageService.setJSON('dse_monthly_reviews', monthlyReviews);
  }, [monthlyReviews]);

  // Diary State & Form States
  const [selectedTradeForReview, setSelectedTradeForReview] = useState<PaperTrade | null>(null);
  const [editingJournal, setEditingJournal] = useState<Partial<PaperTradeJournal>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [diaryFilter, setDiaryFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED' | 'PENDING_REVIEW' | 'REVIEWED'>('ALL');

  // Portfolio Review form states
  const [selectedPortfolioSymbol, setSelectedPortfolioSymbol] = useState<string>('');
  const [portfolioForm, setPortfolioForm] = useState<Partial<PortfolioReview>>({
    holdingStatus: 'HOLD',
    actionPlan: '',
    riskNote: '',
    exitPlan: '',
    addPlan: '',
  });
  const [editingPortfolioSymbol, setEditingPortfolioSymbol] = useState<string | null>(null);

  // Weekly review form states
  const [showWeeklyForm, setShowWeeklyForm] = useState(false);
  const [weeklyForm, setWeeklyForm] = useState<Partial<WeeklyReview>>({
    week: '',
    totalTrades: 0,
    winRate: 0,
    netPL: 0,
    bestTrade: '',
    worstTrade: '',
    topMistake: '',
    bestStrategy: 'Pullback',
    lessonOfTheWeek: '',
    nextWeekPlan: '',
  });

  // Monthly review form states
  const [showMonthlyForm, setShowMonthlyForm] = useState(false);
  const [monthlyForm, setMonthlyForm] = useState<Partial<MonthlyReview>>({
    month: '',
    totalTrades: 0,
    winRate: 0,
    netReturnPercent: 0,
    strategyPerformance: '',
    gradePerformance: '',
    mistakePattern: '',
    portfolioReviewSummary: '',
    monthlyLessons: '',
    nextMonthPlan: '',
  });

  // Helpers to fetch or initialize journal for a trade
  const handleOpenReview = (trade: PaperTrade) => {
    setSelectedTradeForReview(trade);
    const existing = journals.find(j => j.tradeId === trade.id);
    if (existing) {
      setEditingJournal(existing);
    } else {
      // Default template based on trade properties
      setEditingJournal({
        tradeId: trade.id,
        entryReason: '',
        isSetupValid: true,
        isMinRRMet: (trade.riskReward && trade.riskReward >= 2.0) || false,
        isSupportRespected: true,
        signalSource: (trade.signalGrade === 'A+' || trade.signalGrade === 'A') ? trade.signalGrade : 'MANUAL',
        exitReasonDetail: '',
        followedPlan: true,
        exitEarly: false,
        movedSLWrongly: false,
        lessonLearned: '',
        emotion: 'Calm',
        disciplineScore: 5,
        checklistStatus: 'YES',
        mistakeTag: 'No Mistake',
        confidenceBefore: 4,
        confidenceAfter: 4,
        reviewStatus: 'DRAFT'
      });
    }
    setValidationError(null);
  };

  const handleSaveJournal = (status: 'DRAFT' | 'COMPLETED') => {
    setValidationError(null);

    // If completed, validate required fields
    if (status === 'COMPLETED') {
      const isClosed = paperTrades.find(t => t.id === editingJournal.tradeId)?.status === 'CLOSED';
      
      const missingFields: string[] = [];
      if (!editingJournal.entryReason?.trim()) missingFields.push('Why did I enter? (Entry Reason)');
      if (isClosed && !editingJournal.exitReasonDetail?.trim()) missingFields.push('Why did I exit? (Exit Reason Detail)');
      if (!editingJournal.lessonLearned?.trim()) missingFields.push('What did I learn? (Lesson Learned)');
      if (!editingJournal.disciplineScore) missingFields.push('Discipline Score (1-5)');

      if (missingFields.length > 0) {
        setValidationError(`Required fields missing for COMPLETED reviews:\n${missingFields.join(', ')}`);
        return;
      }
    }

    const journalData: PaperTradeJournal = {
      tradeId: editingJournal.tradeId!,
      entryReason: editingJournal.entryReason || '',
      isSetupValid: editingJournal.isSetupValid ?? true,
      isMinRRMet: editingJournal.isMinRRMet ?? true,
      isSupportRespected: editingJournal.isSupportRespected ?? true,
      signalSource: editingJournal.signalSource || 'MANUAL',
      exitReasonDetail: editingJournal.exitReasonDetail || '',
      followedPlan: editingJournal.followedPlan ?? true,
      exitEarly: editingJournal.exitEarly ?? false,
      movedSLWrongly: editingJournal.movedSLWrongly ?? false,
      lessonLearned: editingJournal.lessonLearned || '',
      emotion: editingJournal.emotion || 'Calm',
      disciplineScore: editingJournal.disciplineScore || 5,
      checklistStatus: editingJournal.checklistStatus || 'YES',
      mistakeTag: editingJournal.mistakeTag || 'No Mistake',
      confidenceBefore: editingJournal.confidenceBefore || 3,
      confidenceAfter: editingJournal.confidenceAfter || 3,
      reviewStatus: status,
      lastUpdated: new Date().toLocaleDateString()
    };

    const index = journals.findIndex(j => j.tradeId === journalData.tradeId);
    if (index >= 0) {
      const updated = [...journals];
      updated[index] = journalData;
      setJournals(updated);
    } else {
      setJournals([...journals, journalData]);
    }

    setSelectedTradeForReview(null);
    setEditingJournal({});
  };

  // LankaBangla Portfolio Review actions
  const handleSavePortfolioReview = () => {
    if (!selectedPortfolioSymbol) return;

    const reviewData: PortfolioReview = {
      symbol: selectedPortfolioSymbol,
      holdingStatus: portfolioForm.holdingStatus || 'HOLD',
      currentSignal: signals.find(s => s.symbol.toUpperCase() === selectedPortfolioSymbol.toUpperCase())?.signal || 'WATCH',
      actionPlan: portfolioForm.actionPlan || '',
      riskNote: portfolioForm.riskNote || '',
      exitPlan: portfolioForm.exitPlan || '',
      addPlan: portfolioForm.addPlan || '',
      reviewDate: new Date().toLocaleDateString(),
      nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString() // default 7 days later
    };

    const index = portfolioReviews.findIndex(r => r.symbol.toUpperCase() === selectedPortfolioSymbol.toUpperCase());
    if (index >= 0) {
      const updated = [...portfolioReviews];
      updated[index] = reviewData;
      setPortfolioReviews(updated);
    } else {
      setPortfolioReviews([...portfolioReviews, reviewData]);
    }

    setSelectedPortfolioSymbol('');
    setEditingPortfolioSymbol(null);
    setPortfolioForm({
      holdingStatus: 'HOLD',
      actionPlan: '',
      riskNote: '',
      exitPlan: '',
      addPlan: '',
    });
  };

  const handleEditPortfolioReview = (review: PortfolioReview) => {
    setSelectedPortfolioSymbol(review.symbol);
    setPortfolioForm(review);
    setEditingPortfolioSymbol(review.symbol);
  };

  const handleDeletePortfolioReview = (symbol: string) => {
    setPortfolioReviews(portfolioReviews.filter(r => r.symbol.toUpperCase() !== symbol.toUpperCase()));
  };

  // Weekly Review actions
  const handleCreateWeeklyReview = () => {
    if (!weeklyForm.week) {
      alert('Please specify the week identifier (e.g. 2026-W26).');
      return;
    }

    const review: WeeklyReview = {
      id: Math.random().toString(36).substring(2, 9),
      week: weeklyForm.week,
      totalTrades: weeklyForm.totalTrades || 0,
      winRate: weeklyForm.winRate || 0,
      netPL: weeklyForm.netPL || 0,
      bestTrade: weeklyForm.bestTrade || '',
      worstTrade: weeklyForm.worstTrade || '',
      topMistake: weeklyForm.topMistake || 'No Mistake',
      bestStrategy: weeklyForm.bestStrategy || 'Pullback',
      lessonOfTheWeek: weeklyForm.lessonOfTheWeek || '',
      nextWeekPlan: weeklyForm.nextWeekPlan || '',
    };

    setWeeklyReviews([review, ...weeklyReviews]);
    setShowWeeklyForm(false);
    setWeeklyForm({
      week: '',
      totalTrades: 0,
      winRate: 0,
      netPL: 0,
      bestTrade: '',
      worstTrade: '',
      topMistake: '',
      bestStrategy: 'Pullback',
      lessonOfTheWeek: '',
      nextWeekPlan: '',
    });
  };

  const handleDeleteWeeklyReview = (id: string) => {
    setWeeklyReviews(weeklyReviews.filter(w => w.id !== id));
  };

  // Monthly Review actions
  const handleCreateMonthlyReview = () => {
    if (!monthlyForm.month) {
      alert('Please specify the month identifier (e.g. 2026-06).');
      return;
    }

    const review: MonthlyReview = {
      id: Math.random().toString(36).substring(2, 9),
      month: monthlyForm.month,
      totalTrades: monthlyForm.totalTrades || 0,
      winRate: monthlyForm.winRate || 0,
      netReturnPercent: monthlyForm.netReturnPercent || 0,
      strategyPerformance: monthlyForm.strategyPerformance || '',
      gradePerformance: monthlyForm.gradePerformance || '',
      mistakePattern: monthlyForm.mistakePattern || '',
      portfolioReviewSummary: monthlyForm.portfolioReviewSummary || '',
      monthlyLessons: monthlyForm.monthlyLessons || '',
      nextMonthPlan: monthlyForm.nextMonthPlan || '',
    };

    setMonthlyReviews([review, ...monthlyReviews]);
    setShowMonthlyForm(false);
    setMonthlyForm({
      month: '',
      totalTrades: 0,
      winRate: 0,
      netReturnPercent: 0,
      strategyPerformance: '',
      gradePerformance: '',
      mistakePattern: '',
      portfolioReviewSummary: '',
      monthlyLessons: '',
      nextMonthPlan: '',
    });
  };

  const handleDeleteMonthlyReview = (id: string) => {
    setMonthlyReviews(monthlyReviews.filter(m => m.id !== id));
  };

  // Export Data Model JSON
  const handleExportJournalJSON = () => {
    const reportData = {
      exportedAt: new Date().toISOString(),
      tradeJournals: journals,
      weeklyReviews: weeklyReviews,
      monthlyReviews: monthlyReviews,
      portfolioReviews: portfolioReviews
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DSE_Swing_Trading_Journal_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculations for Mistake Frequency
  const getMistakeFrequency = () => {
    const counts: Record<string, number> = {
      'Early Entry': 0,
      'Late Entry': 0,
      'Chased Price': 0,
      'Ignored SL': 0,
      'Oversized Position': 0,
      'Low RR': 0,
      'Weak Setup': 0,
      'No Plan': 0,
      'Emotional Exit': 0,
      'No Mistake': 0
    };

    journals.forEach(j => {
      if (j.mistakeTag && counts[j.mistakeTag] !== undefined) {
        counts[j.mistakeTag]++;
      }
    });

    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  };

  // Filter paper trades
  const getFilteredTrades = () => {
    return paperTrades.filter(t => {
      const journal = journals.find(j => j.tradeId === t.id);
      const isReviewed = journal?.reviewStatus === 'COMPLETED';

      if (diaryFilter === 'ACTIVE') return t.status === 'ACTIVE';
      if (diaryFilter === 'CLOSED') return t.status === 'CLOSED';
      if (diaryFilter === 'PENDING_REVIEW') return !isReviewed;
      if (diaryFilter === 'REVIEWED') return isReviewed;
      return true;
    });
  };

  const filteredTrades = getFilteredTrades();
  const mistakeSummary = getMistakeFrequency();
  const totalReviewed = journals.filter(j => j.reviewStatus === 'COMPLETED').length;
  const totalPending = paperTrades.length - totalReviewed;

  // Average discipline score
  const completedJournals = journals.filter(j => j.reviewStatus === 'COMPLETED');
  const avgDiscipline = completedJournals.length > 0
    ? completedJournals.reduce((acc, curr) => acc + (curr.disciplineScore || 0), 0) / completedJournals.length
    : 5;

  return (
    <div className="space-y-6" id="trading-journal-module">
      
      {/* 1. Module Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-white tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-emerald-400" />
            Professional Trading Journal
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Self-analysis, mistake tracking, and discipline management for DSE Swing Trading
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportJournalJSON}
            className="flex items-center gap-1.5 bg-[#1C222D] hover:bg-slate-800 border border-slate-750 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition shadow-sm cursor-pointer"
            title="Export full journal structure as backup JSON"
          >
            <FileJson className="h-3.5 w-3.5 text-blue-400" />
            Export Journal JSON
          </button>
        </div>
      </div>

      {/* 2. Mini KPI Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4" id="journal-kpis">
        <div className="bg-[#151921] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 uppercase font-semibold font-sans tracking-wider block">Journal Status</span>
          <div className="mt-2.5">
            <span className="text-white text-base font-bold font-display flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              Active System
            </span>
            <span className="text-[10px] text-slate-500 block font-mono">Storage Synchronized</span>
          </div>
        </div>

        <div className="bg-[#151921] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 uppercase font-semibold font-sans tracking-wider block">Trades Reviewed</span>
          <div className="mt-2.5">
            <span className="text-emerald-400 text-xl font-bold font-display">
              {totalReviewed}
            </span>
            <span className="text-[10px] text-slate-500 block font-sans">Of {paperTrades.length} paper trades</span>
          </div>
        </div>

        <div className="bg-[#151921] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 uppercase font-semibold font-sans tracking-wider block">Pending Reviews</span>
          <div className="mt-2.5">
            <span className={`text-xl font-bold font-display ${totalPending > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {Math.max(0, totalPending)}
            </span>
            <span className="text-[10px] text-slate-500 block font-sans">Draft / Unreviewed</span>
          </div>
        </div>

        <div className="bg-[#151921] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 uppercase font-semibold font-sans tracking-wider block">Average Discipline</span>
          <div className="mt-2.5">
            <span className="text-yellow-400 text-xl font-bold font-display flex items-baseline gap-1">
              {avgDiscipline.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/ 5</span>
            </span>
            <span className="text-[10px] text-slate-500 block font-sans">Completed reviews avg</span>
          </div>
        </div>

        <div className="bg-[#151921] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 uppercase font-semibold font-sans tracking-wider block">Primary Bottleneck</span>
          <div className="mt-2.5">
            <span className="text-rose-400 text-sm font-bold font-display line-clamp-1">
              {mistakeSummary[0]?.[1] > 0 ? mistakeSummary[0][0] : 'No Mistake'}
            </span>
            <span className="text-[10px] text-slate-500 block font-sans">Most frequent tag</span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="border-b border-slate-800 flex flex-wrap gap-2">
        {(['diary', 'portfolio', 'mistakes', 'weekly', 'monthly', 'lessons'] as const).map((tab) => {
          const tabLabels: Record<JournalTab, string> = {
            diary: 'Trade Diary & Reviews',
            portfolio: 'Portfolio Holding Reviews',
            mistakes: 'Mistake Tracker',
            weekly: 'Weekly Reviews',
            monthly: 'Monthly Reviews',
            lessons: 'Strategy Lessons Base'
          };
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setSelectedTradeForReview(null);
              }}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition font-sans ${
                isActive 
                  ? 'border-b-2 border-emerald-500 text-emerald-400 font-semibold bg-emerald-500/5' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/5'
              }`}
            >
              {tabLabels[tab]}
            </button>
          );
        })}
      </div>

      {/* 4. Tab Contents */}
      
      {/* DIARY TAB */}
      {activeTab === 'diary' && (
        <div className="space-y-6" id="diary-tab">
          
          {selectedTradeForReview ? (
            /* ACTIVE TRADE REVIEW EDITOR */
            <div className="bg-[#151921] border border-slate-800 rounded-xl p-6 space-y-6 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-md font-bold text-white font-display flex items-center gap-2">
                    <Activity className="h-4.5 w-4.5 text-emerald-400" />
                    Reviewing Symbol: <span className="text-emerald-400 font-mono font-bold">{selectedTradeForReview.symbol}</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    {selectedTradeForReview.status === 'CLOSED' ? 'Post-mortem closed trade review' : 'Pre-entry or planning active trade review'}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedTradeForReview(null)}
                  className="text-slate-400 hover:text-slate-200 text-xs font-bold"
                >
                  Back to List
                </button>
              </div>

              {validationError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg p-3.5 text-xs flex items-start gap-2">
                  <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                  <div className="whitespace-pre-line">{validationError}</div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Side: Trade Details & Entry Checklist */}
                <div className="space-y-4">
                  <div className="bg-[#0B0E14] p-4 rounded-lg border border-slate-850">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-3 font-display">Trade Specification</h4>
                    <div className="grid grid-cols-2 gap-y-2 text-xs font-mono">
                      <span className="text-slate-500">Execution Type:</span>
                      <span className="text-slate-200 font-bold">{selectedTradeForReview.type}</span>
                      
                      <span className="text-slate-500">Shares:</span>
                      <span className="text-slate-200">{selectedTradeForReview.shares} units</span>

                      <span className="text-slate-500">Entry Price:</span>
                      <span className="text-slate-200">৳{selectedTradeForReview.entryPrice}</span>

                      {selectedTradeForReview.status === 'CLOSED' && (
                        <>
                          <span className="text-slate-500">Exit Price:</span>
                          <span className="text-slate-200 font-bold text-emerald-400">৳{selectedTradeForReview.closePrice}</span>

                          <span className="text-slate-500">P/L:</span>
                          <span className={`font-bold ${selectedTradeForReview.pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ৳{selectedTradeForReview.pl.toLocaleString()} ({selectedTradeForReview.plPercent.toFixed(1)}%)
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ENTRY SPECIFICS */}
                  <div className="space-y-3 bg-[#0B0E14] p-4 rounded-lg border border-slate-850">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide font-display">Section A: Entry Checklist & Setup Validation</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-slate-400 text-[11px] font-bold block mb-1">Was Setup Valid?</label>
                        <select 
                          className="w-full bg-[#151921] border border-slate-850 text-xs p-1.5 rounded-lg text-white"
                          value={editingJournal.isSetupValid ? 'YES' : 'NO'}
                          onChange={(e) => setEditingJournal({...editingJournal, isSetupValid: e.target.value === 'YES'})}
                        >
                          <option value="YES">Yes (Matched strategy parameters)</option>
                          <option value="NO">No (FOMO / Boredom trade)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 text-[11px] font-bold block mb-1">Was RR {">="} Minimum (2.0)?</label>
                        <select 
                          className="w-full bg-[#151921] border border-slate-850 text-xs p-1.5 rounded-lg text-white"
                          value={editingJournal.isMinRRMet ? 'YES' : 'NO'}
                          onChange={(e) => setEditingJournal({...editingJournal, isMinRRMet: e.target.value === 'YES'})}
                        >
                          <option value="YES">Yes (Minimum 1:2 met)</option>
                          <option value="NO">No (Suboptimal Risk Reward)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 text-[11px] font-bold block mb-1">Was Support Zone Respected?</label>
                        <select 
                          className="w-full bg-[#151921] border border-slate-850 text-xs p-1.5 rounded-lg text-white"
                          value={editingJournal.isSupportRespected ? 'YES' : 'NO'}
                          onChange={(e) => setEditingJournal({...editingJournal, isSupportRespected: e.target.value === 'YES'})}
                        >
                          <option value="YES">Yes (Solid price reaction)</option>
                          <option value="NO">No (Falling knife / blind entry)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 text-[11px] font-bold block mb-1">Signal Source Grade</label>
                        <select 
                          className="w-full bg-[#151921] border border-slate-850 text-xs p-1.5 rounded-lg text-white"
                          value={editingJournal.signalSource}
                          onChange={(e) => setEditingJournal({...editingJournal, signalSource: e.target.value as any})}
                        >
                          <option value="A+">Grade A+ Setup</option>
                          <option value="A">Grade A Setup</option>
                          <option value="WATCH">Grade B / Watchlist Setup</option>
                          <option value="MANUAL">Manual / Custom Analysis</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 text-[11px] font-bold block mb-1">
                        Why did I enter? <span className="text-rose-400">*</span>
                      </label>
                      <textarea
                        rows={2}
                        className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded-lg text-white placeholder-slate-600"
                        placeholder="Detail technical support levels, DSE Index mood, pullbacks, EMA trend confirmations..."
                        value={editingJournal.entryReason || ''}
                        onChange={(e) => setEditingJournal({...editingJournal, entryReason: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Side: Exit Review & Psychological Metrics */}
                <div className="space-y-4">
                  {selectedTradeForReview.status === 'CLOSED' && (
                    <div className="space-y-3 bg-[#0B0E14] p-4 rounded-lg border border-slate-850">
                      <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wide font-display">Section B: Exit Analysis</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-slate-400 text-[11px] font-bold block mb-1">Followed Plan?</label>
                          <select 
                            className="w-full bg-[#151921] border border-slate-850 text-xs p-1.5 rounded-lg text-white"
                            value={editingJournal.followedPlan ? 'YES' : 'NO'}
                            onChange={(e) => setEditingJournal({...editingJournal, followedPlan: e.target.value === 'YES'})}
                          >
                            <option value="YES">Yes (Stayed disciplined)</option>
                            <option value="NO">No (Ignored rules / panicked)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-slate-400 text-[11px] font-bold block mb-1">Exited Early?</label>
                          <select 
                            className="w-full bg-[#151921] border border-slate-850 text-xs p-1.5 rounded-lg text-white"
                            value={editingJournal.exitEarly ? 'YES' : 'NO'}
                            onChange={(e) => setEditingJournal({...editingJournal, exitEarly: e.target.value === 'YES'})}
                          >
                            <option value="NO">No (Let plan run)</option>
                            <option value="YES">Yes (Cut winner short / cold feet)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-slate-400 text-[11px] font-bold block mb-1">
                          Why did I exit? (Exit Reason Detail) <span className="text-rose-400">*</span>
                        </label>
                        <textarea
                          rows={2}
                          className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded-lg text-white placeholder-slate-600"
                          placeholder="SL triggered, target achieved, trend reversal indicators, or manual cut..."
                          value={editingJournal.exitReasonDetail || ''}
                          onChange={(e) => setEditingJournal({...editingJournal, exitReasonDetail: e.target.value})}
                        />
                      </div>
                    </div>
                  )}

                  {/* PSYCHOLOGY & DISCIPLINE */}
                  <div className="space-y-3 bg-[#0B0E14] p-4 rounded-lg border border-slate-850">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide font-display">Section C: Psychological & Discipline Stats</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-slate-400 text-[11px] font-bold block mb-1">Predominant Emotion</label>
                        <select 
                          className="w-full bg-[#151921] border border-slate-850 text-xs p-1.5 rounded-lg text-white font-sans"
                          value={editingJournal.emotion || 'Calm'}
                          onChange={(e) => setEditingJournal({...editingJournal, emotion: e.target.value as any})}
                        >
                          <option value="Calm">Calm (Standard Process)</option>
                          <option value="Confident">Confident (Highly probable setup)</option>
                          <option value="Fear">Fear (Scared of losing)</option>
                          <option value="FOMO">FOMO (Chased green candle)</option>
                          <option value="Revenge">Revenge (Covering previous loss)</option>
                          <option value="Hesitant">Hesitant (Delayed entry execution)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 text-[11px] font-bold block mb-1">
                          Discipline Score <span className="text-rose-400">*</span>
                        </label>
                        <select 
                          className="w-full bg-[#151921] border border-slate-850 text-xs p-1.5 rounded-lg text-white font-mono"
                          value={editingJournal.disciplineScore || 5}
                          onChange={(e) => setEditingJournal({...editingJournal, disciplineScore: parseInt(e.target.value)})}
                        >
                          <option value="5">5 (Perfect adherence to plan)</option>
                          <option value="4">4 (Minor slippage, minor deviation)</option>
                          <option value="3">3 (Partial plan following)</option>
                          <option value="2">2 (Poor execution, weak discipline)</option>
                          <option value="1">1 (Complete violation of trading rules)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 text-[11px] font-bold block mb-1">Pre-trade Confidence</label>
                        <select 
                          className="w-full bg-[#151921] border border-slate-850 text-xs p-1.5 rounded-lg text-white font-mono"
                          value={editingJournal.confidenceBefore || 4}
                          onChange={(e) => setEditingJournal({...editingJournal, confidenceBefore: parseInt(e.target.value)})}
                        >
                          <option value="5">5 / 5 (Strong breakout/bounce block)</option>
                          <option value="4">4 / 5 (Good standard setup)</option>
                          <option value="3">3 / 5 (Average probability)</option>
                          <option value="2">2 / 5 (Low confidence / experiment)</option>
                          <option value="1">1 / 5 (Blind gamble)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 text-[11px] font-bold block mb-1">Checklist Completed?</label>
                        <select 
                          className="w-full bg-[#151921] border border-slate-850 text-xs p-1.5 rounded-lg text-white font-sans"
                          value={editingJournal.checklistStatus || 'YES'}
                          onChange={(e) => setEditingJournal({...editingJournal, checklistStatus: e.target.value as any})}
                        >
                          <option value="YES">Yes, completed all checkboxes</option>
                          <option value="PARTIAL">Partial list validation</option>
                          <option value="NO">No validation checkboxes run</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-slate-400 text-[11px] font-bold block mb-1">Mistake Classification</label>
                        <select 
                          className="w-full bg-[#151921] border border-slate-850 text-xs p-1.5 rounded-lg text-white font-sans"
                          value={editingJournal.mistakeTag || 'No Mistake'}
                          onChange={(e) => setEditingJournal({...editingJournal, mistakeTag: e.target.value as any})}
                        >
                          <option value="No Mistake">No Mistake (Followed professional execution)</option>
                          <option value="Early Entry">Early Entry (Jumping the gun / no trigger yet)</option>
                          <option value="Late Entry">Late Entry (Chasing/buying too high)</option>
                          <option value="Chased Price">Chased Price (Skipped zone limit order)</option>
                          <option value="Ignored SL">Ignored SL (Moved stop loss lower / hope mode)</option>
                          <option value="Oversized Position">Oversized Position (Risked too much capital)</option>
                          <option value="Low RR">Low RR (Took trade with ratio below 2.0)</option>
                          <option value="Weak Setup">Weak Setup (No historical support bounce/pullback pattern)</option>
                          <option value="No Plan">No Plan (Felt like buying)</option>
                          <option value="Emotional Exit">Emotional Exit (Panicked during standard intraday noise)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 text-[11px] font-bold block mb-1">
                        Lesson Learned / Journal Takeaways <span className="text-rose-400">*</span>
                      </label>
                      <textarea
                        rows={2}
                        className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded-lg text-white placeholder-slate-600"
                        placeholder="What lessons on support zones, DSE indicators, or personal discipline can be drawn?"
                        value={editingJournal.lessonLearned || ''}
                        onChange={(e) => setEditingJournal({...editingJournal, lessonLearned: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SAVE BUTTONS */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSaveJournal('DRAFT')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold transition font-sans cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveJournal('COMPLETED')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-xs font-bold transition font-sans flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Finalize Review (Complete)
                </button>
              </div>
            </div>
          ) : (
            /* TRADES LOG / DIRECT DIARY OVERVIEW */
            <div className="bg-[#151921] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0B0E14]/40">
                <div>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-display">Simulated Trading Diary</h3>
                  <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                    Configure reviews for planned active entries and completed trade post-mortems
                  </p>
                </div>

                {/* Filter Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                    <Filter className="h-3 w-3" /> Filter:
                  </span>
                  {(['ALL', 'ACTIVE', 'CLOSED', 'PENDING_REVIEW', 'REVIEWED'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setDiaryFilter(f)}
                      className={`px-2 py-1 text-[10px] font-mono font-bold rounded transition ${
                        diaryFilter === f 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-slate-850 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {f.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTrades.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#0B0E14]/60 text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                        <th className="px-5 py-3">Symbol</th>
                        <th className="px-5 py-3">Status / Pl</th>
                        <th className="px-5 py-3">Entry Specs</th>
                        <th className="px-5 py-3">Exit Specs</th>
                        <th className="px-5 py-3">Review Status</th>
                        <th className="px-5 py-3">Mistake Classification</th>
                        <th className="px-5 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {filteredTrades.map(trade => {
                        const journal = journals.find(j => j.tradeId === trade.id);
                        const isReviewed = journal?.reviewStatus === 'COMPLETED';

                        return (
                          <tr key={trade.id} className="hover:bg-slate-950/20 transition">
                            <td className="px-5 py-4">
                              <span className="font-bold text-white font-mono block text-sm">{trade.symbol}</span>
                              <span className="text-[9px] text-slate-500 font-mono block">ID: {trade.id.substring(0, 8)}</span>
                            </td>

                            <td className="px-5 py-4">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                                trade.status === 'ACTIVE' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-300'
                              }`}>
                                {trade.status}
                              </span>
                              {trade.status === 'CLOSED' ? (
                                <div className={`font-bold mt-1 font-mono ${trade.pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  ৳{trade.pl.toLocaleString()} ({trade.plPercent.toFixed(1)}%)
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-500 font-sans mt-1">Float review</div>
                              )}
                            </td>

                            <td className="px-5 py-4 font-mono">
                              <div className="text-slate-400">৳{trade.entryPrice}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{trade.date.split('(')[0]}</div>
                            </td>

                            <td className="px-5 py-4 font-mono">
                              {trade.status === 'CLOSED' ? (
                                <>
                                  <div className="text-slate-300 font-bold">৳{trade.closePrice}</div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">{trade.closeDate}</div>
                                </>
                              ) : (
                                <span className="text-slate-600 font-sans italic">Hold Active</span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {journal ? (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  isReviewed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400'
                                }`}>
                                  {isReviewed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                  {journal.reviewStatus}
                                </span>
                              ) : (
                                <span className="text-slate-500 italic text-[10px] font-sans">Unplanned</span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <span className={`inline-block text-[10px] font-mono rounded px-1.5 py-0.5 ${
                                journal?.mistakeTag && journal?.mistakeTag !== 'No Mistake' 
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                  : 'bg-slate-850 text-slate-400'
                              }`}>
                                {journal?.mistakeTag || 'No Data'}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-center">
                              <button
                                onClick={() => handleOpenReview(trade)}
                                className="bg-slate-800 hover:bg-emerald-600 hover:text-white border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-[10px] font-bold font-sans transition flex items-center gap-1 mx-auto cursor-pointer"
                              >
                                <Edit className="h-3 w-3" />
                                {journal ? 'Edit Review' : 'Add Review'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-16 text-center text-slate-500 italic text-xs font-sans">
                  No paper trades matched the selected diary filter.
                  <button 
                    onClick={() => onNavigate('paper-trading')}
                    className="block text-emerald-400 font-bold hover:underline mt-2 mx-auto"
                  >
                    Go execute a trade in Paper Trading module
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PORTFOLIO REVIEW TAB */}
      {activeTab === 'portfolio' && (
        <div className="space-y-6" id="portfolio-review-tab">
          
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">LankaBangla Portfolio Holdings Planner</h3>
              <p className="text-[11px] text-slate-400 font-sans">
                Establish review plans for active LankaBangla holding statement entries. This segment runs entirely independent of Paper Trading logs.
              </p>
            </div>

            {/* Selector/Form to review a holding */}
            <div className="bg-[#0B0E14] border border-slate-850 p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide font-display">
                {editingPortfolioSymbol ? `Editing Review Plan for: ${editingPortfolioSymbol}` : 'Record a New Holding Review'}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-400 text-[11px] font-bold block mb-1">Symbol Tick <span className="text-rose-400">*</span></label>
                  {editingPortfolioSymbol ? (
                    <span className="block p-2 bg-[#151921] rounded text-white font-mono font-bold text-sm border border-slate-800">
                      {editingPortfolioSymbol}
                    </span>
                  ) : (
                    <select
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded-lg text-white font-mono font-bold"
                      value={selectedPortfolioSymbol}
                      onChange={(e) => setSelectedPortfolioSymbol(e.target.value)}
                    >
                      <option value="">-- Choose Symbol --</option>
                      {portfolioHoldings.map(h => (
                        <option key={h.symbol} value={h.symbol}>{h.symbol}</option>
                      ))}
                      {/* Allow manual entry if none pre-imported */}
                      {portfolioHoldings.length === 0 && (
                        <option value="DSE_STOCK">Manual Input Dummy</option>
                      )}
                    </select>
                  )}
                  {portfolioHoldings.length === 0 && !editingPortfolioSymbol && (
                    <div className="mt-1">
                      <input 
                        type="text"
                        placeholder="Or type symbol manually"
                        className="w-full bg-[#151921] border border-slate-800 text-xs p-1.5 rounded text-white font-mono uppercase"
                        value={selectedPortfolioSymbol}
                        onChange={(e) => setSelectedPortfolioSymbol(e.target.value.toUpperCase())}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-slate-400 text-[11px] font-bold block mb-1">Holding Action Bias</label>
                  <select
                    className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded-lg text-white font-sans"
                    value={portfolioForm.holdingStatus}
                    onChange={(e) => setPortfolioForm({...portfolioForm, holdingStatus: e.target.value})}
                  >
                    <option value="HOLD">HOLD (Wait for plan targets)</option>
                    <option value="ADD">ADD / PYRAMID (Increases size at bounce)</option>
                    <option value="REDUCE">REDUCE (Slight scale down on weakness)</option>
                    <option value="EXIT">EXIT (Achieved targets or SL breached)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 text-[11px] font-bold block mb-1">Risk Note / Margin Profile</label>
                  <input
                    type="text"
                    placeholder="e.g. 1.2x margin leverage or cash-only"
                    className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded-lg text-white"
                    value={portfolioForm.riskNote}
                    onChange={(e) => setPortfolioForm({...portfolioForm, riskNote: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-400 text-[11px] font-bold block mb-1">Core Action Plan / Triggers</label>
                  <textarea
                    rows={2}
                    placeholder="Describe main technical logic to manage this holding..."
                    className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded-lg text-white"
                    value={portfolioForm.actionPlan}
                    onChange={(e) => setPortfolioForm({...portfolioForm, actionPlan: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-[11px] font-bold block mb-1">Exit Trigger Plan (TP/SL values)</label>
                  <textarea
                    rows={2}
                    placeholder="If drops below ৳X or breaks EMA20, exit..."
                    className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded-lg text-white"
                    value={portfolioForm.exitPlan}
                    onChange={(e) => setPortfolioForm({...portfolioForm, exitPlan: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-[11px] font-bold block mb-1">Accumulation/Pyramid Plan</label>
                  <textarea
                    rows={2}
                    placeholder="If pulls back to support block ৳Y, add..."
                    className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded-lg text-white"
                    value={portfolioForm.addPlan}
                    onChange={(e) => setPortfolioForm({...portfolioForm, addPlan: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {editingPortfolioSymbol && (
                  <button
                    onClick={() => {
                      setEditingPortfolioSymbol(null);
                      setSelectedPortfolioSymbol('');
                      setPortfolioForm({ holdingStatus: 'HOLD', actionPlan: '', riskNote: '', exitPlan: '', addPlan: '' });
                    }}
                    className="bg-slate-800 text-slate-300 px-3.5 py-1.5 rounded text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSavePortfolioReview}
                  disabled={!selectedPortfolioSymbol}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  {editingPortfolioSymbol ? 'Update Holding Plan' : 'Save Holding Plan'}
                </button>
              </div>
            </div>

            {/* List of Portfolio Reviews */}
            <div className="border border-slate-800/80 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-[#0B0E14] border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Active Portfolio Review Records
              </div>

              {portfolioReviews.length > 0 ? (
                <div className="divide-y divide-slate-800/60 bg-[#151921]">
                  {portfolioReviews.map(r => (
                    <div key={r.symbol} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-start hover:bg-slate-950/10 transition">
                      
                      {/* Left Block */}
                      <div className="md:col-span-3 space-y-1.5">
                        <span className="text-md font-bold text-emerald-400 font-mono tracking-tight block">{r.symbol}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-sans uppercase ${
                            r.holdingStatus === 'HOLD' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            r.holdingStatus === 'ADD' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            r.holdingStatus === 'REDUCE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {r.holdingStatus} Plan
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">Signal: {r.currentSignal}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Review Date: {r.reviewDate}
                        </div>
                      </div>

                      {/* Plans Block */}
                      <div className="md:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase font-sans">Core Strategy Plan</span>
                          <p className="text-slate-300 italic">"{r.actionPlan || 'No description added.'}"</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase font-sans">Exit Rules (TP/SL)</span>
                          <p className="text-slate-300 italic font-mono text-[11px]">{r.exitPlan || 'No exit instructions.'}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase font-sans">Pyramid Conditions</span>
                          <p className="text-slate-300 italic">"{r.addPlan || 'No add plan.'}"</p>
                        </div>
                      </div>

                      {/* Action Block */}
                      <div className="md:col-span-2 flex items-center justify-end gap-2 h-full">
                        <button
                          onClick={() => handleEditPortfolioReview(r)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded transition border border-slate-750"
                          title="Modify"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePortfolioReview(r.symbol)}
                          className="bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 p-1.5 rounded transition border border-rose-950/50"
                          title="Delete Plan"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500 italic text-xs font-sans">
                  No active LankaBangla holding reviews present. Create a review above using your imported stock list.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MISTAKE TRACKER TAB */}
      {activeTab === 'mistakes' && (
        <div className="space-y-6" id="mistakes-tab">
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">Rule Violation & Mistake Pattern Analyzer</h3>
              <p className="text-[11px] text-slate-400 font-sans">
                A quantitative tally of trading errors categorized by frequency. Eliminate these psychological loopholes to protect capital.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mistake Frequency List */}
              <div className="space-y-3 bg-[#0B0E14] p-4 rounded-xl border border-slate-850">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide font-display">Mistake Tally Summary</h4>
                <div className="space-y-2">
                  {mistakeSummary.map(([tag, count]) => {
                    const totalEntries = journals.length || 1;
                    const pct = Math.round((count / totalEntries) * 100);
                    const hasCount = count > 0;
                    return (
                      <div key={tag} className="flex items-center justify-between text-xs font-mono p-2 bg-[#151921] rounded border border-slate-800/80">
                        <span className={`font-semibold ${hasCount ? 'text-slate-200 font-bold' : 'text-slate-500'}`}>{tag}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-slate-850 h-1.5 rounded-full overflow-hidden hidden sm:block">
                            <div 
                              className={`h-full ${tag === 'No Mistake' ? 'bg-emerald-500' : 'bg-rose-500'} transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`font-bold ${count > 0 ? (tag === 'No Mistake' ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>
                            {count} occurrences ({pct}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actionable Guidelines */}
              <div className="space-y-4 bg-[#0B0E14] p-4 rounded-xl border border-slate-850">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide font-display">Psychological Hardening Playbook</h4>
                
                <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                  <div className="flex gap-2.5 items-start bg-rose-500/5 p-3 rounded-lg border border-rose-950/20">
                    <ShieldAlert className="h-4.5 w-4.5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-rose-400 font-sans block">Primary Violation: {mistakeSummary[1]?.[0]}</span>
                      <span className="text-[11px] text-slate-400">
                        This is your primary leak. Establish explicit rule adjustments in the Settings panel to constrain your size or delay entry execution until this metric declines.
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2.5 items-start bg-[#151921] p-3 rounded-lg border border-slate-800">
                    <Award className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-emerald-400 font-sans block">Discipline Index Formula</span>
                      <span className="text-[11px] text-slate-400">
                        The score is derived from your manual reviews. Adherence to targets, strict exit rules, and proper stop loss management contributes to a target score of {">"} 4.5.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WEEKLY REVIEW TAB */}
      {activeTab === 'weekly' && (
        <div className="space-y-6" id="weekly-tab">
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">Weekly Retrospective Journals</h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Construct aggregated weekly review sheets to identify structural setup errors
                </p>
              </div>
              <button
                onClick={() => setShowWeeklyForm(!showWeeklyForm)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold font-sans transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                {showWeeklyForm ? 'Close Sheet' : 'Draft New Weekly Retro'}
              </button>
            </div>

            {showWeeklyForm && (
              <div className="bg-[#0B0E14] border border-slate-850 p-4 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide font-display">New Weekly Retro Form</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Week Identifier <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      placeholder="e.g. 2026-W26"
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white font-mono"
                      value={weeklyForm.week}
                      onChange={(e) => setWeeklyForm({...weeklyForm, week: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Total Trades Executed</label>
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white font-mono"
                      value={weeklyForm.totalTrades || ''}
                      onChange={(e) => setWeeklyForm({...weeklyForm, totalTrades: parseInt(e.target.value) || 0})}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Win Rate %</label>
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white font-mono"
                      value={weeklyForm.winRate || ''}
                      onChange={(e) => setWeeklyForm({...weeklyForm, winRate: parseFloat(e.target.value) || 0})}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Net P/L BDT</label>
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white font-mono"
                      value={weeklyForm.netPL || ''}
                      onChange={(e) => setWeeklyForm({...weeklyForm, netPL: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Best Trade (Symbol %)</label>
                    <input
                      type="text"
                      placeholder="e.g. BATBC (+12.5%)"
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white"
                      value={weeklyForm.bestTrade}
                      onChange={(e) => setWeeklyForm({...weeklyForm, bestTrade: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Worst Trade (Symbol %)</label>
                    <input
                      type="text"
                      placeholder="e.g. RENATA (-3.2%)"
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white"
                      value={weeklyForm.worstTrade}
                      onChange={(e) => setWeeklyForm({...weeklyForm, worstTrade: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Top Mistake Pattern</label>
                    <select
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white font-sans"
                      value={weeklyForm.topMistake}
                      onChange={(e) => setWeeklyForm({...weeklyForm, topMistake: e.target.value})}
                    >
                      <option value="No Mistake">No Mistake</option>
                      <option value="Early Entry">Early Entry</option>
                      <option value="Late Entry">Late Entry</option>
                      <option value="Chased Price">Chased Price</option>
                      <option value="Ignored SL">Ignored SL</option>
                      <option value="Oversized Position">Oversized Position</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Dominant Strategy</label>
                    <select
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white"
                      value={weeklyForm.bestStrategy}
                      onChange={(e) => setWeeklyForm({...weeklyForm, bestStrategy: e.target.value as any})}
                    >
                      <option value="Pullback">Pullback</option>
                      <option value="Support Bounce">Support Bounce</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Lesson of the Week</label>
                    <textarea
                      rows={2}
                      placeholder="Main technical or physical takeaways..."
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white"
                      value={weeklyForm.lessonOfTheWeek}
                      onChange={(e) => setWeeklyForm({...weeklyForm, lessonOfTheWeek: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Execution Plan / Next Week Focus</label>
                    <textarea
                      rows={2}
                      placeholder="Specify size constraints, rules adjustments..."
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white"
                      value={weeklyForm.nextWeekPlan}
                      onChange={(e) => setWeeklyForm({...weeklyForm, nextWeekPlan: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCreateWeeklyReview}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" /> Save Weekly Card
                  </button>
                </div>
              </div>
            )}

            {/* List Weekly Reviews */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {weeklyReviews.map(w => (
                <div key={w.id} className="bg-[#0B0E14] border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700/80 transition relative">
                  
                  <button
                    onClick={() => handleDeleteWeeklyReview(w.id)}
                    className="absolute top-4 right-4 text-slate-500 hover:text-rose-400 transition"
                    title="Delete card"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4.5 w-4.5 text-blue-400" />
                    <span className="text-sm font-bold text-white font-mono">Week: {w.week}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-[#151921] p-3 rounded-lg border border-slate-850 text-xs font-mono">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-sans">Total Trades</span>
                      <p className="text-slate-300 font-bold">{w.totalTrades}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-sans">Win Rate</span>
                      <p className="text-emerald-400 font-bold">{w.winRate}%</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-sans">Net P/L</span>
                      <p className={`font-bold ${w.netPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ৳{w.netPL.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-sans block">Best Performance</span>
                      <p className="text-emerald-400 font-semibold">{w.bestTrade || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-sans block">Worst Position</span>
                      <p className="text-rose-400 font-semibold">{w.worstTrade || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs leading-relaxed border-t border-slate-850/60 pt-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase font-sans block">Core Lesson</span>
                      <p className="text-slate-300 italic">"{w.lessonOfTheWeek || 'No details.'}"</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase font-sans block">Next Week Execution Target</span>
                      <p className="text-slate-300 font-sans">"{w.nextWeekPlan || 'No details.'}"</p>
                    </div>
                  </div>

                </div>
              ))}

              {weeklyReviews.length === 0 && (
                <div className="md:col-span-2 text-center py-12 text-slate-500 italic text-xs font-sans">
                  No weekly retro cards logged yet. Start one above.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MONTHLY REVIEW TAB */}
      {activeTab === 'monthly' && (
        <div className="space-y-6" id="monthly-tab">
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">Monthly Performance Audits</h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Compile monthly trade audits to review portfolio trends, mistake patterns and return statistics
                </p>
              </div>
              <button
                onClick={() => setShowMonthlyForm(!showMonthlyForm)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold font-sans transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                {showMonthlyForm ? 'Close Sheet' : 'Draft New Monthly Audit'}
              </button>
            </div>

            {showMonthlyForm && (
              <div className="bg-[#0B0E14] border border-slate-850 p-4 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide font-display">New Monthly Audit Form</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Month Identifier <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      placeholder="e.g. 2026-06"
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white font-mono"
                      value={monthlyForm.month}
                      onChange={(e) => setMonthlyForm({...monthlyForm, month: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Total Completed Trades</label>
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white font-mono"
                      value={monthlyForm.totalTrades || ''}
                      onChange={(e) => setMonthlyForm({...monthlyForm, totalTrades: parseInt(e.target.value) || 0})}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Win Rate %</label>
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white font-mono"
                      value={monthlyForm.winRate || ''}
                      onChange={(e) => setMonthlyForm({...monthlyForm, winRate: parseFloat(e.target.value) || 0})}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Net Return %</label>
                    <input
                      type="number"
                      placeholder="0.0"
                      step="0.1"
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white font-mono"
                      value={monthlyForm.netReturnPercent || ''}
                      onChange={(e) => setMonthlyForm({...monthlyForm, netReturnPercent: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Strategy Performance Review</label>
                    <textarea
                      rows={2}
                      placeholder="Pullback yielded high accuracy, but bounce setups dragged..."
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white"
                      value={monthlyForm.strategyPerformance}
                      onChange={(e) => setMonthlyForm({...monthlyForm, strategyPerformance: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Grade Setup Review</label>
                    <textarea
                      rows={2}
                      placeholder="Grade A+ setups provided 90% of returns..."
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white"
                      value={monthlyForm.gradePerformance}
                      onChange={(e) => setMonthlyForm({...monthlyForm, gradePerformance: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Rule/Mistake Pattern Summary</label>
                    <textarea
                      rows={2}
                      placeholder="Oversized positions in bear phases represents the core issue..."
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white"
                      value={monthlyForm.mistakePattern}
                      onChange={(e) => setMonthlyForm({...monthlyForm, mistakePattern: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">LankaBangla Portfolio Summary</label>
                    <textarea
                      rows={2}
                      placeholder="Margin risk is low, holding values mapped to DSE indicators..."
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white"
                      value={monthlyForm.portfolioReviewSummary}
                      onChange={(e) => setMonthlyForm({...monthlyForm, portfolioReviewSummary: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Monthly Lessons</label>
                    <textarea
                      rows={2}
                      placeholder="General psychological rules to embed in routine..."
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white"
                      value={monthlyForm.monthlyLessons}
                      onChange={(e) => setMonthlyForm({...monthlyForm, monthlyLessons: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-bold block mb-1">Next Month Action Goals</label>
                    <textarea
                      rows={2}
                      placeholder="Target limits, specific EMA filters..."
                      className="w-full bg-[#151921] border border-slate-800 text-xs p-2 rounded text-white"
                      value={monthlyForm.nextMonthPlan}
                      onChange={(e) => setMonthlyForm({...monthlyForm, nextMonthPlan: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCreateMonthlyReview}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" /> Save Monthly Audit
                  </button>
                </div>
              </div>
            )}

            {/* List Monthly Audits */}
            <div className="space-y-4">
              {monthlyReviews.map(m => (
                <div key={m.id} className="bg-[#0B0E14] border border-slate-800 rounded-xl p-5 hover:border-slate-700/80 transition relative">
                  
                  <button
                    onClick={() => handleDeleteMonthlyReview(m.id)}
                    className="absolute top-4 right-4 text-slate-500 hover:text-rose-400 transition"
                    title="Delete card"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-2 mb-3">
                    <BookMarked className="h-4.5 w-4.5 text-emerald-400" />
                    <span className="text-sm font-bold text-white font-mono">Month Audit: {m.month}</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#151921] p-3.5 rounded-lg border border-slate-850/80 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-sans">Total Trades</span>
                      <p className="text-slate-300 font-bold mt-0.5">{m.totalTrades}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-sans">Win Rate</span>
                      <p className="text-emerald-400 font-bold mt-0.5">{m.winRate}%</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-sans">Return ROI</span>
                      <p className={`font-bold mt-0.5 ${m.netReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {m.netReturnPercent >= 0 ? '+' : ''}{m.netReturnPercent}%
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-sans">Audit Standard</span>
                      <p className="text-yellow-400 font-bold mt-0.5">V1 Verified</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs leading-relaxed">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase font-sans block mb-1">Strategy Performance</span>
                      <p className="text-slate-300">"{m.strategyPerformance || 'No data.'}"</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase font-sans block mb-1">Setups Review</span>
                      <p className="text-slate-300">"{m.gradePerformance || 'No data.'}"</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase font-sans block mb-1">Mistake Frequency Summary</span>
                      <p className="text-rose-400">"{m.mistakePattern || 'No data.'}"</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-850/60 pt-4 mt-4 text-xs leading-relaxed">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase font-sans block mb-1">LankaBangla Status Summary</span>
                      <p className="text-slate-300">"{m.portfolioReviewSummary || 'No data.'}"</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase font-sans block mb-1">Monthly Lessons</span>
                      <p className="text-slate-300 italic">"{m.monthlyLessons || 'No data.'}"</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase font-sans block mb-1">Action Rules & Next Month Strategy</span>
                      <p className="text-slate-300 font-sans font-semibold text-emerald-400">"{m.nextMonthPlan || 'No data.'}"</p>
                    </div>
                  </div>

                </div>
              ))}

              {monthlyReviews.length === 0 && (
                <div className="text-center py-12 text-slate-500 italic text-xs font-sans">
                  No monthly audit cards logged yet. Start one above.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* STRATEGY LESSONS TAB */}
      {activeTab === 'lessons' && (
        <div className="space-y-6" id="lessons-tab">
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
                <BookMarked className="h-5 w-5 text-emerald-400" />
                Strategy Lessons Knowledge Base
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">
                Chronological compilation of all verified lessons learned across draft or completed paper trade review cycles
              </p>
            </div>

            {completedJournals.length > 0 ? (
              <div className="space-y-3">
                {completedJournals.map((j, idx) => {
                  const trade = paperTrades.find(t => t.id === j.tradeId);
                  if (!trade) return null;
                  return (
                    <div key={j.tradeId} className="bg-[#0B0E14] border border-slate-850 rounded-lg p-4 space-y-2 hover:border-slate-800 transition">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-emerald-400">{trade.symbol}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500 font-mono">Source: {j.signalSource}</span>
                          <span className="text-slate-500 font-mono">Score: {j.disciplineScore}/5</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-[#151921] p-2.5 rounded border border-slate-800/80">
                          <span className="text-[10px] text-slate-500 block font-sans font-bold uppercase">Setup / Entry Context</span>
                          <p className="text-slate-300 italic mt-1">"{j.entryReason}"</p>
                        </div>
                        <div className="bg-[#151921] p-2.5 rounded border border-slate-800/80">
                          <span className="text-[10px] text-rose-400 block font-sans font-bold uppercase">Lesson For Future Cycles</span>
                          <p className="text-slate-200 font-semibold mt-1">"{j.lessonLearned}"</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 italic text-xs font-sans">
                Strategy Lessons will automatically index once you save Completed reviews under the Trade Diary tab.
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
