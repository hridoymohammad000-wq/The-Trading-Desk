import assert from 'node:assert/strict';
import {calculateEMA} from '../src/lib/market/indicators';
import {paperAccount} from '../src/lib/engine/PaperAccount';
const closes=Array.from({length:60},(_,i)=>i+1);
const e20=calculateEMA(closes,20), e50=calculateEMA(closes,50);
assert.equal(e20[18],null); assert.equal(e20[19],10.5); assert.ok(Math.abs((e20[20] as number)-11.5)<1e-10);
assert.equal(e50[48],null); assert.equal(e50[49],25.5); assert.ok(Math.abs((e50[50] as number)-26.5)<1e-10);
assert.deepEqual(paperAccount([]),{startingCapital:100000,availableCash:100000,investedCapital:0,openMarketValue:0,paperEquity:100000,realizedPL:0,unrealizedPL:0,openTrades:0,closedTrades:0});
const buy=paperAccount([{shares:100,entryPrice:100,currentPrice:110,status:'ACTIVE'}]); assert.equal(buy.availableCash,90000); assert.equal(buy.paperEquity,101000);
const partial=paperAccount([{shares:50,entryPrice:100,currentPrice:110,status:'ACTIVE',realizedPL:500}]); assert.equal(partial.paperEquity,101000);
const win=paperAccount([{shares:0,entryPrice:100,currentPrice:110,status:'CLOSED',realizedPL:1000}]); assert.equal(win.paperEquity,101000);
const loss=paperAccount([{shares:0,entryPrice:100,currentPrice:90,status:'CLOSED',realizedPL:-1000}]); assert.equal(loss.paperEquity,99000);
console.log('logic tests passed');

import { matchHoldingToSignal, calculatePortfolioSummary } from '../src/lib/engine/PortfolioEngine';
const concentratedHolding = {
  symbol: 'BDFINANCE', quantity: 2500, avgCost: 14.52, marketPrice: 12.90,
  marketValue: 32250, costValue: 36300, unrealizedPL: -4050,
  unrealizedPLPercent: -11.16, portfolioPercent: 64.32
};
const freshSignal = {
  symbol: 'BDFINANCE', strategy: 'Pullback' as const, signal: 'BUY' as const, grade: 'A' as const,
  entry: 13.4, sl: 12.5, tp: 15.2, rr: 2.0, confidence: 90,
  holdingPeriod: '3-10 Sessions', supportZone: '12.5-13.0', reason: 'test', volume: '389K',
  date: new Date().toISOString().slice(0, 10), status: 'ACTIVE' as const
};
const mapped = matchHoldingToSignal(concentratedHolding, [freshSignal]);
assert.equal(mapped.holdingStatus, 'REDUCE CONCENTRATION');
assert.equal(mapped.concentrationWarning, true);
const summary = calculatePortfolioSummary([concentratedHolding], [freshSignal]);
assert.equal(summary.totalMarketValue, 32250);
