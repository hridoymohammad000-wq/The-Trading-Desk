export type MarketBiasType = 'Bullish' | 'Neutral' | 'Bearish' | 'Unknown';

export interface StockSignal {
  symbol: string;
  strategy: 'Pullback' | 'Support Bounce';
  signal: 'BUY' | 'WATCH' | 'AVOID';
  grade: 'A+' | 'A' | 'WATCH' | 'AVOID';
  entry: number;
  sl: number;
  tp: number;
  rr: number; // Risk-Reward Ratio
  confidence: number; // e.g., 85 for 85%
  holdingPeriod: string; // e.g., "3-7 Sessions"
  supportZone: string; // e.g., "৳208.5 - ৳212.0"
  reason: string;
  volume: string; // e.g., "2.5M"
  date: string;
  status: 'ACTIVE' | 'EXPIRED' | 'COMPLETED';
  origin?: 'REAL' | 'MANUAL_IMPORT' | 'DEMO';
  trendState?: 'STRONG_BULLISH' | 'RECOVERY' | 'NEUTRAL' | 'BEARISH' | 'WEAK';
  targetSource?: 'STRUCTURE' | 'ATR_EXTENSION' | 'NONE';
  actionHint?: 'REVIEW CANDIDATE' | 'WAIT' | 'NO NEW ENTRY';
  metrics?: Record<string, number | null>;
}

export interface PaperTrade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  shares: number;
  sl: number;
  tp: number;
  status: 'ACTIVE' | 'CLOSED';
  pl: number; // Profit/Loss in BDT
  plPercent: number;
  date: string;
  closeDate?: string;
  closePrice?: number;
  
  // Professional trading features
  strategy?: string;
  signalGrade?: string;
  investment?: number;
  riskReward?: number;
  holdingPeriod?: string;
  exitReason?: string;
  notes?: string;
  origin?: 'REAL' | 'MANUAL_IMPORT' | 'DEMO';
  history?: Array<{
    date: string;
    action: string;
    shares: number;
    price: number;
    pl?: number;
    notes?: string;
  }>;
}

export interface PortfolioHolding {
  symbol: string;
  quantity: number;
  avgCost: number;
  marketPrice: number;
  marketValue: number;
  costValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  sector?: string;
  status?: string;
  originalName?: string;
  mappingConfidence?: number;
  portfolioPercent?: number;
  origin?: 'REAL' | 'MANUAL_IMPORT' | 'DEMO';
}

export interface AppSettings {
  paperCapital: number;
  riskPerTrade: number; // percent e.g. 1% or 2%
  minRR: number; // e.g. 2.0
  storageType: 'LOCAL' | 'SESSION';
  demoMode: boolean;
  
  // Custom Risk Management variables
  maxOpenTrades?: number;
  maxPortfolioExposure?: number; // percentage, e.g., 100%
  maxHoldingDays?: number; // e.g. 30 days
}

export type ActiveModule =
  | 'dashboard'
  | 'data-engine'
  | 'signal-board'
  | 'chart-lab'
  | 'portfolio'
  | 'paper-trading'
  | 'signal-history'
  | 'settings'
  | 'trading-journal';

export interface PaperTradeJournal {
  tradeId: string;
  entryReason: string;
  isSetupValid: boolean;
  isMinRRMet: boolean;
  isSupportRespected: boolean;
  signalSource: 'A+' | 'A' | 'WATCH' | 'AVOID' | 'MANUAL';
  exitReasonDetail?: string;
  followedPlan?: boolean;
  exitEarly?: boolean;
  movedSLWrongly?: boolean;
  lessonLearned?: string;
  emotion?: 'Calm' | 'Confident' | 'Fear' | 'FOMO' | 'Revenge' | 'Hesitant';
  disciplineScore?: number; // 1 to 5
  checklistStatus?: 'YES' | 'NO' | 'PARTIAL';
  mistakeTag?: 'Early Entry' | 'Late Entry' | 'Chased Price' | 'Ignored SL' | 'Oversized Position' | 'Low RR' | 'Weak Setup' | 'No Plan' | 'Emotional Exit' | 'No Mistake';
  confidenceBefore?: number; // 1 to 5
  confidenceAfter?: number; // 1 to 5
  reviewStatus: 'DRAFT' | 'COMPLETED';
  lastUpdated: string;
}

export interface PortfolioReview {
  symbol: string;
  holdingStatus: string;
  currentSignal?: string;
  actionPlan: string;
  riskNote: string;
  exitPlan: string;
  addPlan: string;
  reviewDate: string;
  nextReviewDate: string;
}

export interface WeeklyReview {
  id: string;
  week: string; // e.g., "2026-W26"
  totalTrades: number;
  winRate: number; // percentage
  netPL: number;
  bestTrade: string;
  worstTrade: string;
  topMistake: string;
  bestStrategy: string;
  lessonOfTheWeek: string;
  nextWeekPlan: string;
}

export interface MonthlyReview {
  id: string;
  month: string; // e.g., "2026-06"
  totalTrades: number;
  winRate: number; // percentage
  netReturnPercent: number;
  strategyPerformance: string;
  gradePerformance: string;
  mistakePattern: string;
  portfolioReviewSummary: string;
  monthlyLessons: string;
  nextMonthPlan: string;
}

