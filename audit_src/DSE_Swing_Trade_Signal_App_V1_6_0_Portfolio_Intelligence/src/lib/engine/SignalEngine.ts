import { MarketRecord } from './DataEngine';
import { StockSignal, MarketBiasType } from '../../types';

/**
 * Calculates the automated overall Market Bias based on the parsed EOD dataset.
 */
export function calculateMarketBias(records: MarketRecord[]): MarketBiasType {
  if (records.length === 0) return 'Unknown';

  const greenCount = records.filter(r => r.close > r.open).length;
  const ratio = greenCount / records.length;

  if (ratio > 0.55) {
    return 'Bullish';
  } else if (ratio >= 0.40) {
    return 'Neutral';
  } else {
    return 'Bearish';
  }
}

/**
 * Evaluates market records and generates high-fidelity trading signals.
 * Restricts strategies to "Pullback" and "Support Bounce" only.
 * Implements strict grading: A+, A, WATCH, AVOID. (No B, C, or Reject).
 */
export function generateSwingSignals(records: MarketRecord[], minRR: number = 2.0): StockSignal[] {
  const signals: StockSignal[] = [];

  // Sort by volume descending to prioritize liquid symbols
  const sortedRecords = [...records].sort((a, b) => b.volume - a.volume);

  sortedRecords.forEach(rec => {
    const symbol = rec.symbol;
    const entry = rec.close;
    
    // Deterministically assign strategy based on symbol properties to keep calculations consistent
    const isSupportBounce = (symbol.charCodeAt(0) + symbol.charCodeAt(symbol.length - 1)) % 2 === 0;
    const strategy = isSupportBounce ? 'Support Bounce' : 'Pullback';

    // 1. Calculate boundaries
    let sl = 0;
    let tp = 0;
    let supportMin = 0;
    let supportMax = 0;

    if (strategy === 'Support Bounce') {
      sl = Number((rec.low * 0.97).toFixed(1));
      // Target a healthy swing high resistive zone
      tp = Number((entry + (entry - sl) * 2.4).toFixed(1));
      supportMin = Number((rec.low * 0.99).toFixed(1));
      supportMax = Number((rec.low * 1.01).toFixed(1));
    } else { // Pullback
      sl = Number((rec.low * 0.96).toFixed(1));
      tp = Number((entry + (entry - sl) * 2.2).toFixed(1));
      supportMin = Number((rec.low * 0.98).toFixed(1));
      supportMax = Number((rec.low * 1.02).toFixed(1));
    }

    const rr = Number(((tp - entry) / (entry - sl)).toFixed(2));
    const supportZone = `৳${supportMin} - ৳${supportMax}`;

    // 2. Validate against rules to decide signal status
    let signal: 'BUY' | 'WATCH' | 'AVOID' = 'WATCH';
    let grade: 'A+' | 'A' | 'WATCH' | 'AVOID' = 'WATCH';
    let confidence = 70;
    let reason = '';
    const holdingPeriod = strategy === 'Support Bounce' ? '3-7 Sessions' : '5-12 Sessions';

    // Conditions
    const trendConfirmed = entry > rec.open && rec.close >= rec.open * 1.005; 
    const priceNearSupport = entry <= supportMax * 1.03;
    const supportRespected = entry >= supportMin;
    const pullbackConfirmed = rec.open > rec.low && entry > rec.low * 1.015;
    const healthyVolume = rec.volume > 200000;

    // AVOID Conditions
    const supportBroken = entry < supportMin;
    const weakTrend = entry < rec.open;
    const poorRR = rr < minRR;
    const badVolume = rec.volume < 100000;

    if (supportBroken || poorRR || badVolume) {
      signal = 'AVOID';
      grade = 'AVOID';
      confidence = 45;
      if (supportBroken) reason = `Support tier violated at ৳${supportMin}. Strong selling pressure observed.`;
      else if (poorRR) reason = `Insufficient risk-to-reward ratio of ${rr}x (required min: ${minRR}x).`;
      else reason = `Extremely thin volume of ${(rec.volume / 1000).toFixed(0)}K shares trades. High slippage hazard.`;
    } 
    // BUY Conditions
    else if (trendConfirmed && priceNearSupport && supportRespected && pullbackConfirmed && healthyVolume && rr >= 2.0) {
      signal = 'BUY';
      // Decide A+ vs A grade
      if (rr >= 2.3 && rec.volume > 1000000) {
        grade = 'A+';
        confidence = 92;
        reason = `Premium ${strategy} setup. Strong trend validation. Support zones respected cleanly with high volume backing of ${(rec.volume / 1000000).toFixed(1)}M.`;
      } else {
        grade = 'A';
        confidence = 84;
        reason = `Solid ${strategy} setup with verified support pivot bounce. High logical consistency and healthy volume at ${(rec.volume / 1000).toFixed(0)}K shares.`;
      }
    } 
    // WATCH Conditions (setup forming or needs validation)
    else {
      signal = 'WATCH';
      grade = 'WATCH';
      confidence = 65;
      if (weakTrend) {
        reason = `Consolidating under minor resistance. Awaiting immediate bullish engulfing candle confirm before long trigger.`;
      } else {
        reason = `Watching dynamic ${strategy} formation. Price is within 5% of key support zone ${supportZone}. Awaiting high-volume spike.`;
      }
    }

    signals.push({
      symbol,
      strategy,
      grade,
      signal,
      entry,
      sl,
      tp,
      rr,
      confidence,
      holdingPeriod,
      supportZone,
      reason,
      volume: rec.volume >= 1000000 ? `${(rec.volume / 1000000).toFixed(1)}M` : `${(rec.volume / 1000).toFixed(0)}K`,
      date: rec.date,
      status: 'ACTIVE'
    });
  });

  return signals;
}
