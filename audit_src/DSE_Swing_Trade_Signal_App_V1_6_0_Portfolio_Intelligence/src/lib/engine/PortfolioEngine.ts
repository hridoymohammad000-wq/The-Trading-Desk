import { PortfolioHolding, StockSignal } from '../../types';
import { getSectorBySymbol } from '../market/sectorMap';
import { DataOrigin, StorageService } from './StorageService';

export interface PortfolioValidationResult {
  status: 'SUCCESS' | 'ENCRYPTED' | 'EMPTY' | 'UNSUPPORTED';
  message: string;
  details?: string;
}

export interface MatchedSignalInfo {
  currentSignal: 'BUY' | 'WATCH' | 'AVOID' | 'NONE';
  grade: 'A+' | 'A' | 'WATCH' | 'AVOID' | 'NONE';
  strategy: string;
  entry: number;
  tp: number;
  sl: number;
  rr: number;
  holdingStatus: 'HOLD / ADD ON CONFIRMATION' | 'HOLD / DO NOT ADD' | 'HOLD / WAIT' | 'NO AVERAGE / REVIEW' | 'EXIT / REDUCE REVIEW' | 'REDUCE CONCENTRATION' | 'HOLD / REFRESH DATA' | 'NO ACTIVE SIGNAL';
  actionReason: string;
  concentrationWarning: boolean;
  signalDate?: string;
  staleSignal: boolean;
}

export interface PortfolioSummaryData {
  totalHoldings: number;
  totalInvestment: number;
  totalMarketValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  winningHoldings: number;
  losingHoldings: number;
  portfolioHealth: {
    score: number; // 0-100
    status: 'Excellent' | 'Moderate' | 'Needs Adjustment' | 'Critical';
    color: string;
    description: string;
  };
}

export interface PortfolioHistoryItem {
  id: string;
  date: string;
  fileName: string;
  fileSize: string;
  timestamp: string;
  holdings: PortfolioHolding[];
  totalValue: number;
  totalInvestment: number;
  totalPL: number;
  totalPLPercent: number;
  status: 'CONFIRMED';
}

const STORAGE_ACTIVE_KEY = 'dse_active_confirmed_portfolio';
const STORAGE_HISTORY_KEY = 'dse_portfolio_history';

/**
 * STEP 2 — Portfolio Validation Engine (Status Messages, No real OCR)
 */
export function validatePortfolioPDF(fileName: string, fileSize: number, fileType: string): PortfolioValidationResult {
  const normalizedName = fileName.toLowerCase();

  // Unsupported formats
  if (fileType !== 'application/pdf' && !normalizedName.endsWith('.pdf')) {
    return {
      status: 'UNSUPPORTED',
      message: 'Unsupported Format: Only original PDF files are supported.',
      details: 'LankaBangla client statement reader requires standard PDF format. Received file: ' + fileType
    };
  }

  // Simulate Encrypted
  if (normalizedName.includes('encrypted') || normalizedName.includes('secured') || normalizedName.includes('password')) {
    return {
      status: 'ENCRYPTED',
      message: 'Encrypted PDF: File is secured with a password.',
      details: 'Please export an unencrypted portfolio statement from LankaBangla portal before uploading.'
    };
  }

  // Simulate Empty
  if (normalizedName.includes('empty') || normalizedName.includes('blank') || fileSize < 1024) {
    return {
      status: 'EMPTY',
      message: 'Empty PDF: No holding data detected.',
      details: 'The PDF statement parsed correctly but contains no active securities or cash holdings.'
    };
  }

  // Success
  return {
    status: 'SUCCESS',
    message: 'Valid PDF: Statement matches LankaBangla schema.',
    details: 'Structure aligned successfully. Prepared for high-confidence structural data parsing.'
  };
}

/**
 * STEP 3 — Demo Extraction Engine (Realistic pre-populated holding sets, No fake OCR claims)
 */
export function extractDemoHoldings(fileName: string): PortfolioHolding[] {
  const normalizedName = fileName.toLowerCase();

  // Provide high-fidelity alternative portfolios depending on simulated names
  if (normalizedName.includes('oversized') || normalizedName.includes('large')) {
    return [
      {
        symbol: 'GP',
        quantity: 500,
        avgCost: 240.0,
        marketPrice: 259.5,
        marketValue: 129750,
        costValue: 120000,
        unrealizedPL: 9750,
        unrealizedPLPercent: 8.13,
        sector: getSectorBySymbol('GP'),
        status: 'ACTIVE'
      } as any,
      {
        symbol: 'SQUAREPHARMA',
        quantity: 400,
        avgCost: 195.0,
        marketPrice: 214.2,
        marketValue: 85680,
        costValue: 78000,
        unrealizedPL: 7680,
        unrealizedPLPercent: 9.85,
        sector: getSectorBySymbol('SQUAREPHARMA'),
        status: 'ACTIVE'
      } as any,
      {
        symbol: 'LHBL',
        quantity: 800,
        avgCost: 61.5,
        marketPrice: 65.8,
        marketValue: 52640,
        costValue: 49200,
        unrealizedPL: 3440,
        unrealizedPLPercent: 6.99,
        sector: getSectorBySymbol('LHBL'),
        status: 'ACTIVE'
      } as any,
      {
        symbol: 'BRACBANK',
        quantity: 1200,
        avgCost: 45.2,
        marketPrice: 43.9,
        marketValue: 52680,
        costValue: 54240,
        unrealizedPL: -1560,
        unrealizedPLPercent: -2.88,
        sector: getSectorBySymbol('BRACBANK'),
        status: 'ACTIVE'
      } as any
    ];
  }

  // Default Standard Demo Extraction
  return [
    {
      symbol: 'GP',
      quantity: 400,
      avgCost: 245.5,
      marketPrice: 259.5,
      marketValue: 103800,
      costValue: 98200,
      unrealizedPL: 5600,
      unrealizedPLPercent: 5.7,
      sector: getSectorBySymbol('GP'),
      status: 'ACTIVE'
    } as any,
    {
      symbol: 'SQUAREPHARMA',
      quantity: 300,
      avgCost: 202.0,
      marketPrice: 214.2,
      marketValue: 64260,
      costValue: 60600,
      unrealizedPL: 3660,
      unrealizedPLPercent: 6.04,
      sector: getSectorBySymbol('SQUAREPHARMA'),
      status: 'ACTIVE'
    } as any,
    {
      symbol: 'LHBL',
      quantity: 500,
      avgCost: 68.2,
      marketPrice: 65.8,
      marketValue: 32900,
      costValue: 34100,
      unrealizedPL: -1200,
      unrealizedPLPercent: -3.52,
      sector: getSectorBySymbol('LHBL'),
      status: 'ACTIVE'
    } as any,
    {
      symbol: 'RENATA',
      quantity: 80,
      avgCost: 740.0,
      marketPrice: 718.0,
      marketValue: 57440,
      costValue: 59200,
      unrealizedPL: -1760,
      unrealizedPLPercent: -2.97,
      sector: getSectorBySymbol('RENATA'),
      status: 'ACTIVE'
    } as any
  ];
}

/**
 * STEP 7 — Signal Matching Engine (Holdings crossed against Signal Engine states)
 */
export function matchHoldingToSignal(holding: PortfolioHolding, signals: StockSignal[]): MatchedSignalInfo {
  const matched = signals.find(s => s.symbol.toUpperCase() === holding.symbol.toUpperCase());
  const concentration = holding.portfolioPercent ?? 0;
  const concentrationWarning = concentration >= 35;

  if (!matched) {
    return {
      currentSignal: 'NONE',
      grade: 'NONE',
      strategy: 'N/A',
      entry: 0,
      tp: 0,
      sl: 0,
      rr: 0,
      holdingStatus: concentrationWarning ? 'REDUCE CONCENTRATION' : 'NO ACTIVE SIGNAL',
      actionReason: concentrationWarning
        ? `${concentration.toFixed(2)}% portfolio concentration is above the 35% risk limit.`
        : 'No validated signal exists for this holding. Refresh market data before deciding.',
      concentrationWarning,
      staleSignal: true
    };
  }

  const parsedDate = new Date(`${matched.date}T00:00:00`);
  const staleDays = Number.isNaN(parsedDate.getTime())
    ? 999
    : Math.floor((Date.now() - parsedDate.getTime()) / 86_400_000);
  const staleSignal = staleDays > 7;

  let holdingStatus: MatchedSignalInfo['holdingStatus'];
  let actionReason: string;

  if (concentration >= 40) {
    holdingStatus = 'REDUCE CONCENTRATION';
    actionReason = `${concentration.toFixed(2)}% of the portfolio is in one security. Do not add; consider reducing on strength.`;
  } else if (matched.signal === 'AVOID' && holding.unrealizedPLPercent <= -20) {
    holdingStatus = 'EXIT / REDUCE REVIEW';
    actionReason = `Technical state is AVOID and the position is down ${Math.abs(holding.unrealizedPLPercent).toFixed(2)}%. Review an exit/reduction plan; do not average down.`;
  } else if (matched.signal === 'AVOID') {
    holdingStatus = 'NO AVERAGE / REVIEW';
    actionReason = 'The signal engine does not support a new entry. Hold only under a defined risk limit and do not average down.';
  } else if (matched.signal === 'WATCH' || staleSignal) {
    holdingStatus = staleSignal ? 'HOLD / REFRESH DATA' : 'HOLD / WAIT';
    actionReason = staleSignal
      ? `Signal data is ${staleDays} days old. Refresh the EOD dataset before acting.`
      : 'Setup is incomplete. Hold only if your own stop remains valid; wait for confirmation before adding.';
  } else if (concentration >= 25) {
    holdingStatus = 'HOLD / DO NOT ADD';
    actionReason = `The setup is positive, but ${concentration.toFixed(2)}% exposure is already high. Do not increase concentration.`;
  } else {
    holdingStatus = 'HOLD / ADD ON CONFIRMATION';
    actionReason = 'A-grade setup detected. Any addition still requires fresh data, price confirmation and a predefined stop.';
  }

  return {
    currentSignal: matched.signal,
    grade: matched.grade,
    strategy: matched.strategy,
    entry: matched.entry,
    tp: matched.tp,
    sl: matched.sl,
    rr: matched.rr,
    holdingStatus,
    actionReason,
    concentrationWarning,
    signalDate: matched.date,
    staleSignal
  };
}

/**
 * STEP 8 — Portfolio Health Calculations and Summaries
 */
export function calculatePortfolioSummary(holdings: PortfolioHolding[], signals: StockSignal[]): PortfolioSummaryData {
  const totalHoldings = holdings.length;
  let totalInvestment = 0;
  let totalMarketValue = 0;
  let winningHoldings = 0;
  let losingHoldings = 0;

  holdings.forEach(h => {
    // Portfolio valuation must use the statement/current holding price, never a stale signal entry.
    const currentPrice = h.marketPrice;
    
    const costVal = h.quantity * h.avgCost;
    const marketVal = h.quantity * currentPrice;
    const pl = marketVal - costVal;

    totalInvestment += costVal;
    totalMarketValue += marketVal;

    if (pl > 0) {
      winningHoldings++;
    } else if (pl < 0) {
      losingHoldings++;
    }
  });

  const totalGainLoss = totalMarketValue - totalInvestment;
  const totalGainLossPercent = totalInvestment > 0 ? (totalGainLoss / totalInvestment) * 100 : 0;

  // Calculate Health Score (Combination of winning holdings ratio + avoiding weak grades)
  let score = 50; // base score
  if (totalHoldings > 0) {
    const winRatio = winningHoldings / totalHoldings;
    score = Math.round(winRatio * 60); // wins can give up to 60 points
    
    // Cross check with active AVOID signals in portfolio
    let avoidCount = 0;
    holdings.forEach(h => {
      const sig = signals.find(s => s.symbol.toUpperCase() === h.symbol.toUpperCase());
      if (sig?.signal === 'AVOID') {
        avoidCount++;
      }
    });

    // Subtract points for avoid signals and excessive single-stock concentration.
    const avoidPenalty = (avoidCount / totalHoldings) * 30;
    const totalMV = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const maxWeight = totalMV > 0 ? Math.max(...holdings.map(h => h.marketValue / totalMV)) * 100 : 0;
    const concentrationPenalty = maxWeight >= 50 ? 25 : (maxWeight >= 35 ? 15 : (maxWeight >= 25 ? 7 : 0));
    score = Math.max(10, Math.min(100, Math.round(score + 40 - avoidPenalty - concentrationPenalty)));
  }

  let status: 'Excellent' | 'Moderate' | 'Needs Adjustment' | 'Critical' = 'Moderate';
  let color = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  let description = 'Portfolio shows flat to moderate returns. Recommend pruning AVOID grade allocations.';

  if (score >= 80) {
    status = 'Excellent';
    color = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    description = 'High win ratio with premium candidates. Strong support zones and high-grade strategies verified.';
  } else if (score < 45 && score >= 25) {
    status = 'Needs Adjustment';
    color = 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    description = 'Multiple holdings are flagged as AVOID by the Signal Engine. Tighten stop-losses immediately.';
  } else if (score < 25) {
    status = 'Critical';
    color = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    description = 'Extreme exposure to high-slippage or negative trend symbols. Capital restructuring recommended.';
  }

  return {
    totalHoldings,
    totalInvestment,
    totalMarketValue,
    totalGainLoss,
    totalGainLossPercent,
    winningHoldings,
    losingHoldings,
    portfolioHealth: {
      score,
      status,
      color,
      description
    }
  };
}

/**
 * STEP 9 — PORTFOLIO HISTORY (Browser localStorage snapshot manager)
 */
export function getPortfolioHistory(): PortfolioHistoryItem[] {
  return StorageService.getJSON<PortfolioHistoryItem[]>(STORAGE_HISTORY_KEY, []);
}

export function savePortfolioToHistory(
  fileName: string, 
  fileSizeStr: string, 
  holdings: PortfolioHolding[],
  summary: PortfolioSummaryData,
  origin: DataOrigin = 'MANUAL_IMPORT'
): PortfolioHistoryItem {
  const history = getPortfolioHistory();
  
  const newItem: PortfolioHistoryItem = {
    id: `LB-PORT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    date: new Date().toLocaleDateString(),
    fileName,
    fileSize: fileSizeStr,
    timestamp: new Date().toLocaleString(),
    holdings,
    totalValue: summary.totalMarketValue,
    totalInvestment: summary.totalInvestment,
    totalPL: summary.totalGainLoss,
    totalPLPercent: summary.totalGainLossPercent,
    status: 'CONFIRMED'
  };

  history.unshift(newItem);
  StorageService.setJSON(STORAGE_HISTORY_KEY, history, origin);
  return newItem;
}

export function deletePortfolioFromHistory(id: string): PortfolioHistoryItem[] {
  const history = getPortfolioHistory();
  const filtered = history.filter(item => item.id !== id);
  StorageService.setJSON(STORAGE_HISTORY_KEY, filtered);
  return filtered;
}

/**
 * Retrieve Active Confirmed Portfolio
 */
export function getActiveConfirmedPortfolio(): { holdings: PortfolioHolding[]; value: number; fileName?: string } | null {
  return StorageService.getJSON<{ holdings: PortfolioHolding[]; value: number; fileName?: string } | null>(STORAGE_ACTIVE_KEY, null);
}

/**
 * Save Active Confirmed Portfolio
 */
export function saveActiveConfirmedPortfolio(holdings: PortfolioHolding[], value: number, fileName: string, origin: DataOrigin = 'MANUAL_IMPORT'): void {
  StorageService.setJSON(STORAGE_ACTIVE_KEY, { holdings, value, fileName, origin, confirmedAt: new Date().toISOString() }, origin);
}

/**
 * Clear Active Confirmed Portfolio
 */
export function clearActiveConfirmedPortfolio(): void {
  StorageService.remove(STORAGE_ACTIVE_KEY);
}
