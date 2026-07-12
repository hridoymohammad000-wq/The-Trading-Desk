export function calculateEMA(closes:number[], period:number):(number|null)[]{
  const out:(number|null)[]=Array(closes.length).fill(null);
  if(period<=0||closes.length<period||closes.some(v=>!Number.isFinite(v))) return out;
  let ema=closes.slice(0,period).reduce((a,b)=>a+b,0)/period;
  out[period-1]=ema;
  const k=2/(period+1);
  for(let i=period;i<closes.length;i++){ema=(closes[i]-ema)*k+ema;out[i]=ema}
  return out;
}
