export interface PaperPosition {shares:number; entryPrice:number; currentPrice:number; status:'ACTIVE'|'CLOSED'; realizedPL?:number}
export function paperAccount(positions:PaperPosition[], startingCapital=100000){
  const active=positions.filter(p=>p.status==='ACTIVE');
  const invested=active.reduce((s,p)=>s+p.shares*p.entryPrice,0);
  const marketValue=active.reduce((s,p)=>s+p.shares*p.currentPrice,0);
  const realizedPL=positions.reduce((s,p)=>s+(p.realizedPL||0),0);
  const availableCash=startingCapital-invested+realizedPL;
  const unrealizedPL=marketValue-invested;
  return {startingCapital,availableCash,investedCapital:invested,openMarketValue:marketValue,paperEquity:availableCash+marketValue,realizedPL,unrealizedPL,openTrades:active.length,closedTrades:positions.length-active.length};
}
