import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  Layers, 
  TrendingUp, 
  Activity, 
  HelpCircle,
  Eye,
  EyeOff,
  CornerDownRight,
  TrendingDown,
  RefreshCw
} from 'lucide-react';
import { StockSignal } from '../types';
import { BackendService } from '../lib/engine/BackendService';
import { getSavedSnapshots } from '../lib/engine/SnapshotManager';

interface ChartLabProps {
  signals: StockSignal[];
  selectedStockSymbol: string;
  onSelectStockSymbol: (symbol: string) => void;
}

export const ChartLab: React.FC<ChartLabProps> = ({
  signals,
  selectedStockSymbol,
  onSelectStockSymbol
}) => {
  // Chart Layer Toggles
  const [showEMA20, setShowEMA20] = useState(true);
  const [showEMA50, setShowEMA50] = useState(true);
  const [showSR, setShowSR] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  // States for Real Analytical OHLCV data
  const [ohlcvData, setOhlcvData] = useState<any[]>([]);
  const [loadingOhlcv, setLoadingOhlcv] = useState(false);

  // Find current signal details
  const currentStock = signals.find(s => s.symbol === selectedStockSymbol) || signals[0];

  // Dynamic EOD Historical candles load: same-origin Python API first, local validated snapshots second.
  useEffect(() => {
    let active = true;

    const loadLocalData = () => {
      if (!active || !selectedStockSymbol) return;
      try {
        const localSnapshots = getSavedSnapshots();
        const localOhlcv = localSnapshots
          .flatMap(snapshot => snapshot.records
            .filter(record => record.symbol.toUpperCase() === selectedStockSymbol.toUpperCase())
            .map(record => ({
              time: record.date || snapshot.date,
              open: record.open,
              high: record.high,
              low: record.low,
              close: record.close,
              volume: record.volume,
              origin: record.origin ?? snapshot.origin,
            })))
          .filter(row => Number.isFinite(row.open) && Number.isFinite(row.high) && Number.isFinite(row.low) && Number.isFinite(row.close))
          .sort((a, b) => a.time.localeCompare(b.time));
        const unique = Array.from(new Map(localOhlcv.map(row => [row.time, row])).values());
        setOhlcvData(unique);
      } catch {
        setOhlcvData([]);
      } finally {
        if (active) setLoadingOhlcv(false);
      }
    };

    const loadChartData = async () => {
      if (!selectedStockSymbol) {
        setOhlcvData([]);
        setLoadingOhlcv(false);
        return;
      }
      setLoadingOhlcv(true);
      try {
        const data = await BackendService.getOHLCV(selectedStockSymbol);
        if (!active) return;
        if (Array.isArray(data) && data.length > 0) {
          setOhlcvData(data.sort((a, b) => String(a.time).localeCompare(String(b.time))));
          setLoadingOhlcv(false);
        } else {
          loadLocalData();
        }
      } catch {
        loadLocalData();
      }
    };

    void loadChartData();
    return () => { active = false; };
  }, [selectedStockSymbol]);

  // Dynamic scaling math
  const prices = ohlcvData.flatMap(d => [d.open, d.high, d.low, d.close]);
  const maxPrice = prices.length > 0 ? Math.max(...prices) * 1.04 : 100;
  const minPrice = prices.length > 0 ? Math.min(...prices) * 0.96 : 0;
  const priceRange = maxPrice - minPrice || 1;

  const getPercentY = (price: number) => {
    return ((maxPrice - price) / priceRange) * 100;
  };

  // Standard EMA: SMA seed, then multiplier 2/(period+1).
  const computeEMAArray = (data: any[], period: number) => {
    const result: (number | null)[] = Array(data.length).fill(null);
    if (data.length < period) return result;
    const closes = data.map(item => Number(item.close));
    if (closes.some(v => !Number.isFinite(v))) return result;
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result[period - 1] = ema;
    const multiplier = 2 / (period + 1);
    for (let i = period; i < closes.length; i++) {
      ema = (closes[i] - ema) * multiplier + ema;
      result[i] = ema;
    }
    return result;
  };

  const ema20 = computeEMAArray(ohlcvData, 20);
  const ema50 = computeEMAArray(ohlcvData, 50);
  const latestEMA20 = [...ema20].reverse().find(v => v !== null);
  const latestEMA50 = [...ema50].reverse().find(v => v !== null);

  const canvasWidth = 800;
  const canvasHeight = 220;

  const getSvgX = (index: number) => {
    const step = canvasWidth / (ohlcvData.length - 1 || 1);
    return index * step;
  };

  const getSvgY = (price: number) => {
    return ((maxPrice - price) / priceRange) * canvasHeight;
  };

  const getSvgPathForEMA = (smaArr: (number | null)[]) => {
    if (ohlcvData.length === 0) return '';
    const points: string[] = [];
    smaArr.forEach((val, idx) => {
      if (val === null) return;
      points.push(`${getSvgX(idx)},${getSvgY(val)}`);
    });
    if (points.length === 0) return '';
    return 'M ' + points.join(' L ');
  };

  return (
    <div className="space-y-6" id="chart-lab-module">
      
      {/* Page Title & Stock Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-white">Stock Detail & Chart Lab</h2>
          <p className="text-slate-400 text-sm mt-0.5 font-sans">Visualize technical trend lines, support buffers, and average volumes</p>
        </div>

        {/* Stock Dropdown Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold font-mono">Select DSE Active:</span>
          <select
            value={selectedStockSymbol}
            onChange={(e) => onSelectStockSymbol(e.target.value)}
            className="bg-[#151921] border border-slate-800 rounded-lg px-3 py-2 text-sm font-semibold font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 shadow-sm"
          >
            {signals.map((sig) => (
              <option key={sig.symbol} value={sig.symbol}>
                {sig.symbol} ({sig.signal})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Layout Grid: Left Chart Canvas (8 cols), Right Signal Details (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Chart Canvas & Layer Controls */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Chart Card */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between shadow-sm">
            {/* Watermark */}
            <div className="absolute top-24 left-1/2 -translate-x-1/2 opacity-[0.02] text-white text-[80px] font-bold font-display select-none pointer-events-none">
              {currentStock?.symbol}
            </div>
 
            {/* Quick Chart Indicators Bar */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-3 gap-2">
              <div className="flex items-center gap-4">
                <span className="text-base font-bold font-mono text-white">{currentStock?.symbol}</span>
                <span className="text-xs font-mono text-slate-500">Interval: <span className="text-slate-300 font-semibold">1D</span></span>
                <span className="text-xs font-mono text-slate-500">Price Source: <span className="text-slate-300 font-semibold">Server/Validated Snapshot OHLCV</span></span>
              </div>
              
              <div className="flex items-center gap-2">
                {loadingOhlcv && (
                  <span className="text-[10px] font-mono text-emerald-400 animate-pulse flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Fetching server OHLCV...
                  </span>
                )}
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${currentStock?.signal === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                  {currentStock?.signal} SIGNAL
                </span>
                <span className="text-xs font-mono text-slate-400 bg-[#0B0E14] px-2 py-0.5 rounded border border-slate-800">
                  Ref: ৳{currentStock?.entry.toFixed(1)}
                </span>
              </div>
            </div>
 
            {/* Interactive Layers Selector */}
            <div className="flex flex-wrap gap-2.5 my-3 bg-[#0B0E14] p-2 rounded-lg border border-slate-800/80 shadow-inner">
              <button 
                onClick={() => setShowEMA20(!showEMA20)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition ${
                  showEMA20 
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
                    : 'bg-[#151921] text-slate-600 border-transparent'
                }`}
              >
                {showEMA20 ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                EMA 20 {latestEMA20 !== undefined ? `(৳${latestEMA20.toFixed(1)})` : '(insufficient history)' }
              </button>
 
              <button 
                onClick={() => setShowEMA50(!showEMA50)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition ${
                  showEMA50 
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' 
                    : 'bg-[#151921] text-slate-600 border-transparent'
                }`}
              >
                {showEMA50 ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                EMA 50 {latestEMA50 !== undefined ? `(৳${latestEMA50.toFixed(1)})` : '(insufficient history)' }
              </button>
 
              <button 
                onClick={() => setShowSR(!showSR)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition ${
                  showSR 
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' 
                    : 'bg-[#151921] text-slate-600 border-transparent'
                }`}
              >
                {showSR ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                S/R Levels (৳{currentStock?.sl.toFixed(0)} - ৳{currentStock?.tp.toFixed(0)})
              </button>
 
              <button 
                onClick={() => setShowVolume(!showVolume)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition ${
                  showVolume 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-[#151921] text-slate-600 border-transparent'
                }`}
              >
                {showVolume ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                Volume Bars ({currentStock?.volume})
              </button>
            </div>
 
            {/* SVG Candlestick Canvas */}
            <div className="bg-[#0B0E14] border border-slate-800 rounded-xl h-80 p-4 relative shadow-inner overflow-hidden" id="trading-chart-canvas">
              {ohlcvData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 font-sans italic">
                  No OHLCV data available. Import market data first.
                </div>
              ) : (
                <>
                  {/* S/R Lines (Overlay) */}
                  {showSR && currentStock && (
                    <>
                      {/* Take Profit Target Line */}
                      <div 
                        className="absolute left-0 right-0 border-t border-dashed border-emerald-500/40 flex justify-between px-3 text-[9px] font-mono font-bold text-emerald-400 z-10 transition-all duration-300"
                        style={{ top: `${getPercentY(currentStock?.tp)}%` }}
                      >
                        <span>Take Profit Target: ৳{currentStock?.tp.toFixed(1)}</span>
                        <span>Resistance Zone</span>
                      </div>
 
                      {/* Entry Point Line */}
                      <div 
                        className="absolute left-0 right-0 border-t border-dashed border-blue-400/40 flex justify-between px-3 text-[9px] font-mono font-bold text-blue-400 z-10 transition-all duration-300"
                        style={{ top: `${getPercentY(currentStock?.entry)}%` }}
                      >
                        <span>Alpha Entry Trigger: ৳{currentStock?.entry.toFixed(1)}</span>
                        <span>Entry Zone</span>
                      </div>
 
                      {/* Stop Loss Line */}
                      <div 
                        className="absolute left-0 right-0 border-t border-dashed border-rose-500/40 flex justify-between px-3 text-[9px] font-mono font-bold text-rose-400 z-10 transition-all duration-300"
                        style={{ top: `${getPercentY(currentStock?.sl)}%` }}
                      >
                        <span>Stop Loss Level: ৳{currentStock?.sl.toFixed(1)}</span>
                        <span>Support Zone</span>
                      </div>
                    </>
                  )}
 
                  {/* Graphical Candlesticks */}
                  <div className="w-full h-full flex items-end justify-between px-1 md:px-4 pt-10 pb-12 relative z-10">
                    
                    {/* SVG lines representing dynamic MA overlays */}
                    <svg 
                      className="absolute inset-0 w-full h-full pointer-events-none" 
                      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                      preserveAspectRatio="none"
                    >
                      {/* EMA 20 (Light Blue) */}
                      {showEMA20 && latestEMA20 !== undefined && (
                        <path 
                          d={getSvgPathForEMA(ema20)} 
                          fill="none" 
                          stroke="#3b82f6" 
                          strokeWidth="2" 
                          className="transition-all duration-300"
                        />
                      )}
 
                      {/* EMA 50 (Orange) */}
                      {showEMA50 && latestEMA50 !== undefined && (
                        <path 
                          d={getSvgPathForEMA(ema50)} 
                          fill="none" 
                          stroke="#f97316" 
                          strokeWidth="2"
                          className="transition-all duration-300"
                        />
                      )}
                    </svg>
 
                    {/* Candles Map */}
                    {ohlcvData.map((candle, idx) => {
                      const isBullish = candle.close >= candle.open;
                      
                      // Calculate pixel positions
                      const topY = getPercentY(Math.max(candle.open, candle.close));
                      const bottomY = getPercentY(Math.min(candle.open, candle.close));
                      const bodyHeight = Math.max(bottomY - topY, 1.5); // Minimum 1.5px
                      
                      const highY = getPercentY(candle.high);
                      const lowY = getPercentY(candle.low);
                      
                      return (
                        <div key={idx} className="flex flex-col items-center flex-1 mx-0.5 z-10 h-full relative group">
                          
                          {/* Candle Visual Container */}
                          <div className="relative w-full h-full">
                            {/* High/Low Wick */}
                            <div 
                              className={`absolute left-1/2 -translate-x-1/2 w-0.5 ${isBullish ? 'bg-emerald-500' : 'bg-rose-500'}`}
                              style={{
                                top: `${highY}%`,
                                bottom: `${100 - lowY}%`
                              }}
                            />
 
                            {/* Real Body */}
                            <div 
                              className={`absolute left-1/2 -translate-x-1/2 w-3 md:w-5 rounded-sm border ${
                                isBullish 
                                  ? 'bg-emerald-500/30 border-emerald-500 shadow-sm shadow-emerald-950/20' 
                                  : 'bg-rose-500/30 border-rose-500 shadow-sm shadow-rose-950/20'
                              }`}
                              style={{
                                top: `${topY}%`,
                                height: `${bodyHeight}%`
                              }}
                            />
                          </div>
 
                          {/* Candle Date Label */}
                          <span className="text-[8px] font-mono text-slate-500 absolute bottom-0">{candle.time}</span>
                        </div>
                      );
                    })}
                  </div>
 
                  {/* Volume Histograms Overlay at bottom */}
                  {showVolume && currentStock && (
                    <div className="absolute bottom-4 left-4 right-4 h-10 flex items-end justify-between pointer-events-none gap-0.5 opacity-20">
                      {ohlcvData.map((candle, idx) => {
                        const isBullish = candle.close >= candle.open;
                        const maxVol = Math.max(...ohlcvData.map(d => d.volume));
                        const volHeightPercent = (candle.volume / (maxVol || 1)) * 100;
                        return (
                          <div 
                            key={idx} 
                            className={`flex-1 rounded-t-sm ${isBullish ? 'bg-emerald-400' : 'bg-rose-400'}`}
                            style={{ height: `${volHeightPercent}%` }}
                          />
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
 
          {/* Quick Signal Tip */}
          <div className="bg-[#151921] border border-slate-800 p-4.5 rounded-xl flex gap-3 shadow-sm">
            <Activity className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Active Signal Layer Reason</span>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">
                {currentStock?.reason}
              </p>
            </div>
          </div>
 
        </div>

        {/* Right Side: Stock details & parameters card (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Signal Detail card */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Decision parameters</span>
              <h3 className="text-lg font-bold font-display text-white mt-0.5">{selectedStockSymbol} Setup Report</h3>
            </div>

            {/* Parameters list */}
            <div className="space-y-3 font-mono text-xs">
              
              <div className="flex justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-sans">Alpha Setup Grade:</span>
                <span className={`font-bold px-2 py-0.5 rounded ${
                  currentStock.grade === 'A' ? 'text-emerald-400 bg-[#0B0E14]' : 'text-yellow-400 bg-[#0B0E14]'
                }`}>
                  Grade {currentStock.grade}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-sans">Strategy Model:</span>
                <span className="text-slate-200 font-semibold text-right max-w-[160px] font-sans">{currentStock.strategy}</span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-sans">Entry Level:</span>
                <span className="text-slate-200 font-bold">৳{currentStock.entry.toFixed(1)}</span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-sans">Stop Loss (SL):</span>
                <span className="text-rose-400 font-bold">৳{currentStock.sl.toFixed(1)}</span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-sans">Take Profit (TP):</span>
                <span className="text-emerald-400 font-bold">৳{currentStock.tp.toFixed(1)}</span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-sans">Risk-Reward (RR):</span>
                <span className="text-white font-bold bg-[#0B0E14] px-2 py-0.5 rounded border border-slate-800">
                  {currentStock.rr.toFixed(2)}x
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-sans">Confidence Rating:</span>
                <span className="text-emerald-400 font-bold">{currentStock.confidence}%</span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-slate-400 font-sans">Volume Status:</span>
                <span className="text-slate-300 font-sans">{currentStock.volume}</span>
              </div>

            </div>

            <div className="bg-[#0B0E14] p-3 rounded-lg border border-slate-800/85">
              <span className="text-[10px] text-amber-500 font-bold uppercase block tracking-wider mb-1 font-sans">
                Coming in next module
              </span>
              <p className="text-[10px] text-slate-500 leading-normal font-sans">
                Integration with real chart plotting libraries (Lightweight Charts or TradingView vectors) to draw real-time candlestick charts directly from synced EOD file nodes.
              </p>
            </div>
          </div>

          {/* Quick Math Tool */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 shadow-sm">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Risk Calculator Mock</span>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 block font-semibold mb-1">Target Position Capital</label>
                <div className="flex items-center bg-[#0B0E14] border border-slate-800 p-1 rounded shadow-inner">
                  <span className="text-slate-500 px-2 font-mono text-xs">৳</span>
                  <input 
                    type="number" 
                    defaultValue="10000" 
                    className="bg-transparent w-full border-none text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 font-mono pt-1">
                <span>Shares Bought:</span>
                <span className="text-slate-200">~{Math.floor(10000 / currentStock.entry)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>Risk At SL:</span>
                <span className="text-rose-400 font-bold">৳{((currentStock.entry - currentStock.sl) * Math.floor(10000 / currentStock.entry)).toFixed(0)}</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
