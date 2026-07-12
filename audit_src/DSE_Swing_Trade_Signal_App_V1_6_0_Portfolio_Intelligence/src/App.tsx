import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { DataEngine } from './components/DataEngine';
import { SignalBoard } from './components/SignalBoard';
import { ChartLab } from './components/ChartLab';
import { PortfolioView } from './components/PortfolioView';
import { PaperTrading } from './components/PaperTrading';
import { SignalHistoryView } from './components/SignalHistoryView';
import { SettingsView } from './components/SettingsView';
import { TradingJournal } from './components/TradingJournal';

import { 
  StockSignal, 
  PaperTrade, 
  PortfolioHolding, 
  AppSettings, 
  ActiveModule, 
  MarketBiasType 
} from './types';
import { getActiveConfirmedPortfolio } from './lib/engine/PortfolioEngine';
import { StorageService, StorageStatus, DataOrigin } from './lib/engine/StorageService';
import { MarketRecord } from './lib/engine/DataEngine';
import { getCurrentSnapshotId, getSavedSnapshots } from './lib/engine/SnapshotManager';
import { BackendService } from './lib/engine/BackendService';

export default function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core Data State
  const initialSnapshot = getSavedSnapshots().find(snapshot => snapshot.id === getCurrentSnapshotId()) ?? getSavedSnapshots()[0];
  const [marketStatus, setMarketStatus] = useState<string>(() => StorageService.get('dse_market_status') || (initialSnapshot ? `Snapshot ${initialSnapshot.id} Loaded` : 'No active market dataset'));
  const [stocksCount, setStocksCount] = useState<number>(initialSnapshot?.totalSymbols ?? 0);
  const [marketBias, setMarketBias] = useState<MarketBiasType>('Unknown');
  const [activeMarketRecords, setActiveMarketRecords] = useState<MarketRecord[]>(initialSnapshot?.records ?? []);
  const [marketOrigin, setMarketOrigin] = useState<DataOrigin>(() => (StorageService.get('dse_market_origin') as DataOrigin) || initialSnapshot?.origin || 'MANUAL_IMPORT');
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string>(() => StorageService.getJSON<StockSignal[]>('dse_signals', [])[0]?.symbol || '');
  const [storageStatus, setStorageStatus] = useState<StorageStatus>(StorageService.getStatus());
  const [portfolioValue, setPortfolioValue] = useState<number>(() => {
    const active = getActiveConfirmedPortfolio();
    return active ? active.value : 0;
  }); // ৳0 until uploaded & confirmed
  const [portfolioHoldings, setPortfolioHoldings] = useState<PortfolioHolding[]>(() => {
    const active = getActiveConfirmedPortfolio();
    return active ? active.holdings : [];
  });

  // Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    const raw = StorageService.get('dse_app_settings');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return {
          paperCapital: parsed.paperCapital ?? 100000,
          riskPerTrade: parsed.riskPerTrade ?? 1.0,
          minRR: parsed.minRR ?? 2.0,
          storageType: parsed.storageType ?? 'LOCAL',
          demoMode: parsed.demoMode ?? false,
          maxOpenTrades: parsed.maxOpenTrades ?? 5,
          maxPortfolioExposure: parsed.maxPortfolioExposure ?? 100,
          maxHoldingDays: parsed.maxHoldingDays ?? 30
        };
      } catch (e) {}
    }
    return {
      paperCapital: 100000,
      riskPerTrade: 1.0,
      minRR: 2.0,
      storageType: 'LOCAL',
      demoMode: false,
      maxOpenTrades: 5,
      maxPortfolioExposure: 100,
      maxHoldingDays: 30
    };
  });

  const [paperCapital, setPaperCapital] = useState<number>(() => {
    const raw = StorageService.get('dse_paper_capital');
    if (raw) {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) return parsed;
    }
    return 100000;
  });

  // Signals are generated only from a validated imported/collected dataset.
  const [signals, setSignals] = useState<StockSignal[]>(() => StorageService.getJSON<StockSignal[]>('dse_signals', []));

  // Initial Paper Trades History
  const [paperTrades, setPaperTrades] = useState<PaperTrade[]>(() => {
    const raw = StorageService.get('dse_paper_trades');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    return [];
  });

  // Persist states via useEffect hooks
  useEffect(() => StorageService.subscribe(setStorageStatus), []);

  // One-click startup: load the bundled/server dataset and signals without requiring
  // the user to visit Data Engine first.
  useEffect(() => {
    let cancelled = false;
    const hydrateServerState = async () => {
      const connected = await BackendService.checkHealth();
      if (!connected || cancelled) return;
      try {
        const [serverSignals, latest] = await Promise.all([
          BackendService.getSignals(),
          BackendService.getLatestMarketRecords(),
        ]);
        if (cancelled) return;
        if (serverSignals.length > 0) setSignals(serverSignals);
        if (latest.records.length > 0) {
          setStocksCount(latest.total_symbols);
          setMarketBias(latest.market_bias);
          setMarketStatus(`Server Market Data Active — ${latest.date}`);
          setMarketOrigin('REAL');
          setActiveMarketRecords(latest.records.map((row: any) => ({
            symbol: row.symbol,
            date: row.trade_date,
            open: Number(row.open),
            high: Number(row.high),
            low: Number(row.low),
            close: Number(row.close),
            volume: Number(row.volume),
            sector: row.sector,
            origin: row.source ?? 'REAL',
          })));
        }
      } catch {
        // Local/manual mode remains available; do not fabricate a connected state.
      }
    };
    void hydrateServerState();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    StorageService.setJSON('dse_app_settings', settings, 'MANUAL_IMPORT');
  }, [settings]);

  useEffect(() => {
    StorageService.set('dse_paper_capital', paperCapital.toString(), marketOrigin);
  }, [paperCapital]);

  useEffect(() => {
    StorageService.setJSON('dse_paper_trades', paperTrades, marketOrigin);
  }, [paperTrades]);

  useEffect(() => {
    StorageService.setJSON('dse_signals', signals, marketOrigin);
    if (!selectedStockSymbol && signals[0]) setSelectedStockSymbol(signals[0].symbol);
  }, [signals, marketOrigin, selectedStockSymbol]);

  useEffect(() => {
    StorageService.set('dse_market_status', marketStatus, marketOrigin);
    StorageService.set('dse_market_origin', marketOrigin, marketOrigin);
  }, [marketStatus, marketOrigin]);

  const handleMarketRecordsActivated = (records: MarketRecord[], origin: DataOrigin) => {
    setActiveMarketRecords(records);
    setMarketOrigin(origin);
  };


  const handleSelectStock = (symbol: string) => {
    setSelectedStockSymbol(symbol);
    setActiveModule('chart-lab');
  };

  const handlePaperTradeBridge = (signal: StockSignal) => {
    setSelectedStockSymbol(signal.symbol);
    setActiveModule('paper-trading');
  };

  // Granular Reset Handlers
  const handleResetPaperTrading = () => {
    const defaultCapital = 100000;
    setPaperCapital(defaultCapital);
    setPaperTrades([]);
    StorageService.set('dse_paper_capital', defaultCapital.toString());
    StorageService.setJSON('dse_paper_trades', []);
  };

  const handleResetPortfolio = () => {
    setPortfolioHoldings([]);
    setPortfolioValue(0);
    StorageService.remove('dse_active_confirmed_portfolio');
    StorageService.remove('dse_portfolio_history');
  };

  const handleResetJournal = () => {
    StorageService.remove('dse_paper_trade_journals');
    StorageService.remove('dse_portfolio_reviews');
    StorageService.remove('dse_weekly_reviews');
    StorageService.remove('dse_monthly_reviews');
  };

  const handleResetMarketData = () => {
    StorageService.remove('dse_market_snapshots');
    StorageService.remove('dse_current_snapshot_id');
    setMarketStatus('No active market dataset');
    setStocksCount(0);
    setActiveMarketRecords([]);
    setSignals([]);
    StorageService.remove('dse_signals');
  };

  const handleFullSandboxReset = () => {
    StorageService.remove('dse_app_settings');
    StorageService.remove('dse_paper_capital');
    StorageService.remove('dse_paper_trades');
    StorageService.remove('dse_paper_trade_journals');
    StorageService.remove('dse_portfolio_reviews');
    StorageService.remove('dse_weekly_reviews');
    StorageService.remove('dse_monthly_reviews');
    StorageService.remove('dse_market_snapshots');
    StorageService.remove('dse_current_snapshot_id');
    StorageService.remove('dse_active_confirmed_portfolio');
    StorageService.remove('dse_portfolio_history');

    setPaperCapital(100000);
    setPaperTrades([]);
    setPortfolioHoldings([]);
    setPortfolioValue(0);
    setStocksCount(0);
    setActiveMarketRecords([]);
    setSignals([]);
    setMarketStatus('Sandbox Full Reset Complete');
    setSettings({
      paperCapital: 100000,
      riskPerTrade: 1.0,
      minRR: 2.0,
      storageType: 'LOCAL',
      demoMode: false,
      maxOpenTrades: 5,
      maxPortfolioExposure: 100,
      maxHoldingDays: 30
    });
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    const hasTradeHistory = paperTrades.length > 0;
    setSettings(newSettings);
    if (!hasTradeHistory) {
      setPaperCapital(newSettings.paperCapital);
    } else if (newSettings.paperCapital !== settings.paperCapital) {
      alert('Starting capital was saved as a setting, but current cash was not overwritten because paper trades already exist. Use Reset Paper Trading to start a clean account with the new capital.');
    }
  };

  // Page Content Switchboard
  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return (
          <Dashboard 
            signals={signals}
            paperTrades={paperTrades}
            portfolioValue={portfolioValue}
            portfolioHoldings={portfolioHoldings}
            stocksCount={stocksCount}
            marketStatus={marketStatus}
            onNavigate={(mod) => setActiveModule(mod)}
            marketBias={marketBias}
            setMarketBias={setMarketBias}
            paperCapital={paperCapital}
          />
        );
      case 'data-engine':
        return (
          <DataEngine 
            marketStatus={marketStatus}
            setMarketStatus={setMarketStatus}
            setStocksCount={setStocksCount}
            signals={signals}
            setSignals={setSignals}
            marketBias={marketBias}
            setMarketBias={setMarketBias}
            minRR={settings.minRR}
            onMarketRecordsActivated={handleMarketRecordsActivated}
          />
        );
      case 'signal-board':
        return (
          <SignalBoard 
            signals={signals}
            onSelectStock={handleSelectStock}
            onPaperTrade={handlePaperTradeBridge}
          />
        );
      case 'chart-lab':
        return (
          <ChartLab 
            signals={signals}
            selectedStockSymbol={selectedStockSymbol}
            onSelectStockSymbol={setSelectedStockSymbol}
          />
        );
      case 'portfolio':
        return (
          <PortfolioView 
            portfolioHoldings={portfolioHoldings}
            setPortfolioHoldings={setPortfolioHoldings}
            portfolioValue={portfolioValue}
            setPortfolioValue={setPortfolioValue}
            signals={signals}
          />
        );
      case 'paper-trading':
        return (
          <PaperTrading 
            signals={signals}
            paperTrades={paperTrades}
            setPaperTrades={setPaperTrades}
            paperCapital={paperCapital}
            setPaperCapital={setPaperCapital}
            onNavigate={setActiveModule}
            settings={settings}
            portfolioHoldings={portfolioHoldings}
            marketRecords={activeMarketRecords}
            marketOrigin={marketOrigin}
          />
        );
      case 'signal-history':
        return <SignalHistoryView paperTrades={paperTrades} />;
      case 'trading-journal':
        return (
          <TradingJournal 
            paperTrades={paperTrades}
            portfolioHoldings={portfolioHoldings}
            signals={signals}
            onNavigate={setActiveModule}
          />
        );
      case 'settings':
        return (
          <SettingsView 
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onResetPaperTrading={handleResetPaperTrading}
            onResetPortfolio={handleResetPortfolio}
            onResetJournal={handleResetJournal}
            onResetMarketData={handleResetMarketData}
            onFullSandboxReset={handleFullSandboxReset}
          />
        );
      default:
        return (
          <div className="text-center py-12">
            <h2 className="text-lg font-bold text-slate-300">Module under construction</h2>
            <p className="text-xs text-slate-500 mt-1">Please select an active tab on the sidebar layout.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-200 flex flex-col font-sans" id="dse-app-container">
      
      {/* 1. Header component */}
      <Header 
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} 
        marketStatus={marketStatus}
        stocksCount={stocksCount}
        storageStatus={storageStatus}
      />

      {/* 2. Main content split wrapper */}
      <div className="flex-1 flex flex-col md:flex-row relative">
        
        {/* Sidebar Nav */}
        <Sidebar 
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Dynamic page container */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full space-y-6">
          {renderModule()}
        </main>

      </div>
    </div>
  );
}
