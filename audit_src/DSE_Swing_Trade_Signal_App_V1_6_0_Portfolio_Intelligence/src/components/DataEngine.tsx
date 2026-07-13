import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  Upload, 
  CheckCircle2, 
  Play, 
  AlertCircle, 
  RefreshCw, 
  FileSpreadsheet, 
  FileText,
  Info,
  Trash2,
  FolderOpen,
  Save,
  Check,
  AlertTriangle
} from 'lucide-react';
import { StockSignal, MarketBiasType } from '../types';
import { parseAndValidateCSV, getMockDSEMarketCSV, MarketRecord, DataValidationSummary } from '../lib/engine/DataEngine';
import { getSavedSnapshots, saveSnapshot, deleteSnapshot, getCurrentSnapshotId, setCurrentSnapshotId, MarketSnapshot } from '../lib/engine/SnapshotManager';
import { BackendService, BackendSnapshotMeta, CollectorJob, CollectorMode } from '../lib/engine/BackendService';
import { DataOrigin } from '../lib/engine/StorageService';

interface DataEngineProps {
  marketStatus: string;
  setMarketStatus: (status: string) => void;
  setStocksCount: (count: number) => void;
  signals: StockSignal[];
  setSignals: (signals: StockSignal[]) => void;
  marketBias: MarketBiasType;
  setMarketBias: (bias: MarketBiasType) => void;
  minRR: number;
  onMarketRecordsActivated: (records: MarketRecord[], origin: DataOrigin) => void;
}

export const DataEngine: React.FC<DataEngineProps> = ({
  marketStatus,
  setMarketStatus,
  setStocksCount,
  signals,
  setSignals,
  marketBias,
  setMarketBias,
  minRR,
  onMarketRecordsActivated
}) => {
  const [dragActive, setDragActive] = useState(false);
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvInput, setCsvInput] = useState<string>('');
  const [validationSummary, setValidationSummary] = useState<DataValidationSummary | null>(null);
  const [snapshots, setSnapshots] = useState<MarketSnapshot[]>([]);
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);
  
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'pasted' | 'validating' | 'validated' | 'saved'>('idle');
  const [validationLogs, setValidationLogs] = useState<string[]>([]);
  const [scannerProgress, setScannerProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [dataOrigin, setDataOrigin] = useState<DataOrigin>('MANUAL_IMPORT');

  // Backend Integration States
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [backendSnapshots, setBackendSnapshots] = useState<BackendSnapshotMeta[]>([]);
  const [checkingBackend, setCheckingBackend] = useState<boolean>(false);
  const [collectorJob, setCollectorJob] = useState<CollectorJob | null>(null);

  const isBackendDisabled = backendConnected !== true;

  const loadLatestServerState = async (statusLabel: string) => {
    const [serverSnapshots, serverSignals, latest] = await Promise.all([
      BackendService.listSnapshots(),
      BackendService.getSignals(),
      BackendService.getLatestMarketRecords(),
    ]);
    setBackendSnapshots(serverSnapshots);
    setSignals(serverSignals);
    if (latest.records.length > 0) {
      setStocksCount(latest.total_symbols);
      setMarketBias(latest.market_bias);
      setMarketStatus(`${statusLabel} - ${latest.date ?? 'Latest Session'}`);
      setDataOrigin('REAL');
      const records: MarketRecord[] = latest.records.map((row: any) => ({
        symbol: row.symbol,
        date: row.trade_date,
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
        sector: row.sector,
        origin: 'REAL',
      }));
      onMarketRecordsActivated(records, 'REAL');
    }
    return { serverSnapshots, serverSignals, latest };
  };

  const checkBackendConnection = async (quiet = false) => {
    if (!quiet) setCheckingBackend(true);
    if (!quiet) addLog(`BACKEND: Pinging Python server at ${BackendService.getBaseUrl()} and allowing time for Render cold-start wake-up...`);
    const connected = await BackendService.checkHealth();
    setBackendConnected(connected);
    setCheckingBackend(false);
    if (connected) {
      if (!quiet) addLog('SUCCESS: Connected to Python FastAPI backend and server database storage.');
      try {
        const [list, serverSignals, latest] = await Promise.all([
          BackendService.listSnapshots(),
          BackendService.getSignals(),
          BackendService.getLatestMarketRecords(),
        ]);
        setBackendSnapshots(list);
        if (serverSignals.length > 0) setSignals(serverSignals);
        if (latest.records.length > 0) {
          setStocksCount(latest.total_symbols);
          setMarketBias(latest.market_bias);
          setMarketStatus(`Server Market Data Active — ${latest.date}`);
          const records: MarketRecord[] = latest.records.map((row: any) => ({
            symbol: row.symbol,
            date: row.trade_date,
            open: Number(row.open),
            high: Number(row.high),
            low: Number(row.low),
            close: Number(row.close),
            volume: Number(row.volume),
            sector: row.sector,
            origin: row.source ?? 'REAL',
          }));
          onMarketRecordsActivated(records, (records[0]?.origin ?? 'REAL') as DataOrigin);
        }
        if (!quiet) addLog(`BACKEND: Loaded ${list.length} snapshots and ${serverSignals.length} signals.`);
      } catch (err: any) {
        if (!quiet) addLog(`WARN: Connected, but server state loading failed: ${err.message}`);
      }
    } else if (!quiet) {
      addLog(`FAIL: Python server still unreachable after cold-start retries at ${BackendService.getBaseUrl()}. Local CSV/manual mode remains available.`);
    }
  };

  // Load snapshots on mount
  useEffect(() => {
    const saved = getSavedSnapshots();
    setSnapshots(saved);
    const currId = getCurrentSnapshotId();
    if (currId) {
      setActiveSnapshotId(currId);
    }
    checkBackendConnection(true);
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setValidationLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Populate mock DSE CSV
  const handleLoadMockCSV = () => {
    const mockCsv = getMockDSEMarketCSV();
    setCsvInput(mockCsv);
    setUploadStatus('pasted');
    setValidationSummary(null);
    setDataOrigin('DEMO');
    addLog('INFO: Loaded demo market dataset into the manual import buffer. This is not real DSE collection.');
  };

  const loadCSVFile = (file: File) => {
    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel';
    if (!isCsv) {
      alert('Please select a CSV file.');
      addLog(`FAIL: Rejected non-CSV file: ${file.name}`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        setCsvInput(event.target.result);
        setUploadStatus('pasted');
        setValidationSummary(null);
        setDataOrigin('MANUAL_IMPORT');
        addLog(`INFO: Loaded CSV file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB). Click Validate Structure next.`);
      }
    };
    reader.onerror = () => {
      alert('The CSV file could not be read.');
      addLog(`FAIL: Browser FileReader could not read ${file.name}.`);
    };
    reader.readAsText(file);
  };

  const handleCSVFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) loadCSVFile(file);
    event.target.value = '';
  };

  // Drag & Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadCSVFile(e.dataTransfer.files[0]);
    }
  };

  // Action Pipeline: Validate Structure
  const handleValidate = () => {
    if (!csvInput.trim()) {
      alert('Please enter or paste CSV data first.');
      return;
    }
    setUploadStatus('validating');
    addLog('INFO: Initializing strict validation rules engine...');
    
    setTimeout(() => {
      const summary = parseAndValidateCSV(csvInput);
      setValidationSummary(summary);
      
      if (summary.status === 'FAILED') {
        setUploadStatus('pasted');
        addLog(`FAIL: Structural alignment failed. Valid: ${summary.validRecords.length}, Invalid: ${summary.invalidRows.length}`);
        summary.invalidRows.forEach(row => {
          addLog(`ERR: Row ${row.rowNumber} has validation errors: ${row.errors.join('; ')}`);
        });
      } else {
        setUploadStatus('validated');
        addLog(`PASS: Alignment validation complete. Status: ${summary.status}`);
        addLog(`INFO: Valid rows detected: ${summary.validRecords.length}`);
        if (summary.duplicateRowsCount > 0) {
          addLog(`WARN: Filtered out ${summary.duplicateRowsCount} duplicate records.`);
        }
        if (summary.missingValuesCount > 0) {
          addLog(`WARN: Identified ${summary.missingValuesCount} blank cells / missing values.`);
        }
        if (summary.invalidRows.length > 0) {
          addLog(`WARN: Bypassed ${summary.invalidRows.length} corrupted rows.`);
        }
      }
    }, 800);
  };

  // Save a validated snapshot locally and mirror it into SQLite when the Python server is connected.
  const handleSaveSnapshot = async () => {
    if (!validationSummary || validationSummary.validRecords.length === 0) {
      alert('No validated records to save.');
      return;
    }

    const date = validationSummary.validRecords[0].date;
    const snap = saveSnapshot(date, validationSummary.validRecords, validationSummary.status, dataOrigin);
    const updated = getSavedSnapshots();
    setSnapshots(updated);
    setActiveSnapshotId(snap.id);
    setUploadStatus('saved');
    setMarketStatus(`Snapshot ${snap.id} Loaded (${dataOrigin})`);
    onMarketRecordsActivated(snap.records, dataOrigin);
    addLog(`SUCCESS: Created local snapshot ${snap.id} with ${snap.totalSymbols} symbols.`);

    if (backendConnected) {
      try {
        const result = await BackendService.importMarketCSV(csvInput, date, dataOrigin === 'DEMO' ? 'DEMO' : 'MANUAL_IMPORT');
        const serverList = await BackendService.listSnapshots();
        setBackendSnapshots(serverList);
        addLog(`SUCCESS: Mirrored validated dataset to server snapshot ${result.snapshot_id}.`);
      } catch (error: any) {
        addLog(`WARN: Local snapshot saved, but server mirror failed: ${error.message}`);
      }
    } else {
      addLog('INFO: Python server disconnected. Snapshot remains in local browser storage only.');
    }
  };

  // Action Pipeline: Run the authoritative Python historical signal engine.
  const handleRunSignalEngine = async () => {
    let recordsToRun: MarketRecord[] = [];
    let snapSource = '';

    if (validationSummary && validationSummary.validRecords.length > 0) {
      recordsToRun = validationSummary.validRecords;
      snapSource = 'Active Validation Buffer';
    } else {
      const currentSnap = snapshots.find(s => s.id === activeSnapshotId);
      if (currentSnap) {
        recordsToRun = currentSnap.records;
        snapSource = `Snapshot ${currentSnap.id}`;
      }
    }

    if (recordsToRun.length === 0) {
      alert('Please validate market data or select an existing snapshot first.');
      return;
    }
    if (!backendConnected) {
      alert('Python backend must be connected. Historical signals are not calculated in the browser.');
      addLog('BLOCKED: Signal run requires the Python historical engine; no browser fallback was used.');
      return;
    }

    setIsScanning(true);
    setScannerProgress(20);
    addLog(`ENGINE: Sending ${recordsToRun.length} historical OHLCV rows to Python...`);
    addLog('ENGINE: Calculating EMA20/50/200, RSI14, ATR14, average volume and market structure.');
    try {
      setScannerProgress(60);
      const result = await BackendService.runSignalEngine(recordsToRun);
      setScannerProgress(100);
      setSignals(result.signals);
      setMarketBias(result.market_bias);
      setStocksCount(new Set(recordsToRun.map(row => row.symbol)).size);
      setMarketStatus(`Historical Engine Scanned (${snapSource})`);
      onMarketRecordsActivated(recordsToRun, dataOrigin);
      addLog(`SUCCESS: Historical engine generated ${result.signals.length} symbol evaluations.`);
      addLog(`ENGINE: ${result.signals.filter(s => s.signal === 'BUY').length} BUY, ${result.signals.filter(s => s.signal === 'WATCH').length} WATCH, ${result.signals.filter(s => s.signal === 'AVOID').length} AVOID.`);
    } catch (error: any) {
      addLog(`FAIL: Historical signal engine failed: ${error.message}`);
      alert(error.message);
    } finally {
      setIsScanning(false);
      setTimeout(() => setScannerProgress(0), 500);
    }
  };

  // Snapshot Actions
  const handleReloadSnapshot = async (snapId: string) => {
    const target = snapshots.find(s => s.id === snapId);
    if (!target) return;

    setCurrentSnapshotId(snapId);
    setActiveSnapshotId(snapId);
    setStocksCount(target.totalSymbols);
    setMarketStatus(`Snapshot ${snapId} Loaded`);
    setDataOrigin(target.origin ?? 'MANUAL_IMPORT');
    onMarketRecordsActivated(target.records, target.origin ?? 'MANUAL_IMPORT');

    // Signals are generated only by the Python historical engine.
    let reloadedSignals: StockSignal[] = [];
    let computedBias: MarketBiasType = 'Unknown';
    if (backendConnected) {
      try {
        const result = await BackendService.runSignalEngine(target.records);
        reloadedSignals = result.signals;
        computedBias = result.market_bias;
        setSignals(reloadedSignals);
        setMarketBias(computedBias);
      } catch (error: any) {
        addLog(`WARN: Snapshot loaded, but historical signal calculation failed: ${error.message}`);
      }
    } else {
      addLog('INFO: Snapshot loaded without signals because Python backend is disconnected.');
    }

    // Populate buffer back to input so user can edit if they want
    const csvStr = 'SYMBOL,DATE,OPEN,HIGH,LOW,CLOSE,VOLUME\n' + 
      target.records.map(r => `${r.symbol},${r.date},${r.open},${r.high},${r.low},${r.close},${r.volume}`).join('\n');
    setCsvInput(csvStr);
    setValidationSummary({
      totalRowsProcessed: target.records.length,
      validRecords: target.records,
      invalidRows: [],
      duplicateRowsCount: 0,
      missingValuesCount: 0,
      status: target.status as any
    });
    setUploadStatus('validated');

    addLog(`INFO: Loaded snapshot ${snapId} into active memory workspace.`);
    addLog(`ENGINE: Calculated ${reloadedSignals.length} signals. Market bias calculated: ${computedBias}.`);
  };

  const handleDeleteSnapshot = (snapId: string) => {
    const updated = deleteSnapshot(snapId);
    setSnapshots(updated);
    if (activeSnapshotId === snapId) {
      setActiveSnapshotId(null);
    }
    addLog(`INFO: Deleted snapshot ${snapId} from local sandbox database.`);
  };

  // Backend API Actions
  const handleCollectBackendData = async (mode: CollectorMode) => {
    setIsScanning(true);
    setScannerProgress(1);
    setCollectorJob(null);
    addLog(`REAL COLLECTOR: Starting ${mode === 'backfill' ? '1-year historical backfill collect + save' : 'daily collect + save update'} via bdshare...`);
    try {
      const healthy = await BackendService.checkHealth();
      if (!healthy) {
        throw new Error('Python backend is unavailable. Start the included Windows launcher.');
      }
      let job = await BackendService.startCollection(mode, { daysBack: 365, refreshSymbols: true, pauseSeconds: 0.8 });
      setCollectorJob(job);
      addLog(`REAL COLLECTOR: Job ${job.id} queued.`);
      let lastMessage = '';
      while (job.status === 'QUEUED' || job.status === 'RUNNING') {
        await new Promise(resolve => setTimeout(resolve, 1800));
        job = await BackendService.getCollectionJob(job.id);
        setCollectorJob(job);
        setScannerProgress(job.progress ?? 0);
        if (job.message && job.message !== lastMessage) {
          addLog(`${job.stage}: ${job.message}`);
          lastMessage = job.message;
        }
      }
      if (job.status !== 'COMPLETED') {
        throw new Error(job.error || job.message || 'DSE collection failed.');
      }

      const { serverSignals, latest } = await loadLatestServerState(
        `DSE ${mode === 'backfill' ? '1Y Backfill' : 'Daily Update'} Active`
      );
      const newRows = job.result?.new_records_collected;
      addLog(
        `SUCCESS: ${newRows ?? job.result?.records_collected ?? 0} ${mode === 'daily' ? 'new ' : ''}rows collected and saved; `
        + `${job.result?.records_collected ?? 0} total rows active; `
        + `${job.result?.total_symbols ?? latest.total_symbols} symbols; ${serverSignals.length} signals refreshed.`
      );
      setScannerProgress(100);
    } catch (err: any) {
      const message = err.message || 'Unknown collection error.';
      addLog(`REAL COLLECTOR FAILED: ${message}`);
      const shouldFallback = /TLS_CERTIFICATE_ERROR|DNS_RESOLUTION_ERROR|No verified DSE historical source/i.test(message);
      if (shouldFallback) {
        addLog('FALLBACK: Running bundled server-side 1-year Python import because live DSE source is unreachable.');
        try {
          const result = await BackendService.importBundledMaster();
          const { serverSignals, latest } = await loadLatestServerState('Server Historical Database Active');
          addLog(
            `SUCCESS: Bundled 1-year server dataset reloaded into active storage. `
            + `${result.stats?.validRows ?? latest.total_symbols} latest-session symbols active; `
            + `${serverSignals.length} signals refreshed for ${latest.date ?? 'latest session'}.`
          );
          setScannerProgress(100);
        } catch (fallbackError: any) {
          addLog(`FALLBACK FAILED: ${fallbackError.message || 'Bundled server reload failed.'}`);
          setScannerProgress(0);
        }
      } else {
        setScannerProgress(0);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleUploadCSVToBackend = async () => {
    if (!csvInput.trim()) {
      alert('Please load or paste CSV data first.');
      return;
    }
    addLog('BACKEND: Uploading validated CSV/text data to Python server...');
    try {
      const res = await BackendService.importMarketCSV(csvInput, undefined, dataOrigin === 'DEMO' ? 'DEMO' : 'MANUAL_IMPORT');
      addLog(`SUCCESS: Server created snapshot ${res.snapshot_id}.`);
      const list = await BackendService.listSnapshots();
      setBackendSnapshots(list);
      const created = await BackendService.getSnapshot(res.snapshot_id);
      const createdOrigin = (created.origin ?? dataOrigin) as DataOrigin;
      const createdRecords: MarketRecord[] = created.records.map(r => ({
        symbol: r.symbol,
        date: r.trade_date,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume,
        sector: r.sector,
        origin: createdOrigin,
      }));
      onMarketRecordsActivated(createdRecords, createdOrigin);
      setMarketStatus(`Server Snapshot ${res.snapshot_id} Active`);
      setStocksCount(createdRecords.length);
    } catch (err: any) {
      addLog(`ERR: Server import failed: ${err.message}`);
    }
  };

  const handleReloadBackendSnapshot = async (snapId: string) => {
    const meta = backendSnapshots.find(item => item.id === snapId);
    addLog(`BACKEND: Activating snapshot ${snapId}...`);
    try {
      if ((meta?.record_count ?? 0) > 5000) {
        const latest = await BackendService.getLatestMarketRecords();
        const latestRecords: MarketRecord[] = latest.records.map((row: any) => ({
          symbol: row.symbol,
          date: row.trade_date,
          open: Number(row.open),
          high: Number(row.high),
          low: Number(row.low),
          close: Number(row.close),
          volume: Number(row.volume),
          sector: row.sector,
          origin: row.source ?? 'REAL',
        }));
        setStocksCount(latest.total_symbols);
        setMarketBias(latest.market_bias);
        setMarketStatus(`Server Historical Database Active — ${latest.date}`);
        setActiveSnapshotId(snapId);
        setDataOrigin('REAL');
        onMarketRecordsActivated(latestRecords, 'REAL');
        addLog(`SUCCESS: Large historical snapshot remains in server storage; loaded ${latestRecords.length} latest-session rows into the UI.`);
        return;
      }

      const snap = await BackendService.getSnapshot(snapId);
      const backendOrigin = (snap.origin ?? 'MANUAL_IMPORT') as DataOrigin;
      const formattedRecords: MarketRecord[] = snap.records.map(r => ({
        symbol: r.symbol,
        date: r.trade_date,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume,
        sector: r.sector,
        origin: backendOrigin,
      }));
      setStocksCount(snap.total_symbols);
      setMarketStatus(`Backend Snapshot ${snapId} Loaded`);
      setActiveSnapshotId(snapId);
      setDataOrigin(backendOrigin);
      onMarketRecordsActivated(formattedRecords, backendOrigin);
      addLog(`SUCCESS: Loaded ${formattedRecords.length} records from backend snapshot.`);
    } catch (err: any) {
      addLog(`ERR: Could not reload backend snapshot: ${err.message}`);
    }
  };

  const handleDeleteBackendSnapshot = async (snapId: string) => {
    if (!confirm(`Are you sure you want to delete backend snapshot ${snapId}?`)) return;
    try {
      await BackendService.deleteSnapshot(snapId);
      addLog(`SUCCESS: Deleted backend snapshot ${snapId}`);
      // Refresh snapshots
      const list = await BackendService.listSnapshots();
      setBackendSnapshots(list);
    } catch (err: any) {
      addLog(`ERR: Failed to delete backend snapshot ${snapId}: ${err.message}`);
    }
  };

  const handleRunSignalEngineBackend = async () => {
    let recordsToRun: MarketRecord[] = [];
    if (validationSummary && validationSummary.validRecords.length > 0) {
      recordsToRun = validationSummary.validRecords;
    } else {
      alert('Please validate or load CSV data into active workspace first.');
      return;
    }

    if (isBackendDisabled) {
      addLog(`LOCAL: Backend disconnected. Routing to integrated Swing Signal Engine...`);
      handleRunSignalEngine();
      return;
    }

    addLog(`BACKEND: Submitting ${recordsToRun.length} records to server-side Python Signal Engine...`);
    setIsScanning(true);
    setScannerProgress(20);
    
    try {
      setScannerProgress(50);
      const res = await BackendService.runSignalEngine(recordsToRun);
      setScannerProgress(90);
      
      setSignals(res.signals);
      setMarketBias(res.market_bias);
      setStocksCount(recordsToRun.length);
      setMarketStatus('Engine Scanned (Backend)');
      onMarketRecordsActivated(recordsToRun, dataOrigin);
      
      setScannerProgress(100);
      setIsScanning(false);
      addLog(`SUCCESS: Python Signal Engine computed ${res.signals.length} setup signals.`);
      addLog(`BACKEND: Market Bias evaluated as: ${res.market_bias}`);
    } catch (err: any) {
      addLog(`WARN: Python Signal Engine failed: ${err.message}. Routing to integrated client-side engine...`);
      handleRunSignalEngine();
    }
  };

  return (
    <div className="space-y-6" id="data-engine-module">
      
      {/* Module Title */}
      <div>
        <h2 className="text-2xl font-bold font-display text-white">Manual Market Data Engine</h2>
        <p className="text-slate-400 text-sm mt-0.5">Import, validate, and parse raw DSE end-of-day market data into premium trading signals</p>
      </div>

      {/* Main Grid split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Collect & Pipeline (7 columns) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Python Analytical Backend Integration Controls */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400 animate-pulse" />
                Python Analytical Backend Status
              </h3>
              <div className="flex items-center gap-1.5">
                {checkingBackend || backendConnected === null ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Waking Server
                  </span>
                ) : backendConnected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
                  </span>
                ) : null}
                {!checkingBackend && backendConnected === false && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Disconnected
                  </span>
                )}
              </div>
            </div>

            <div className="bg-[#0B0E14] p-3 rounded-lg border border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between items-center text-slate-400 font-mono text-[11px]">
                <span>Backend URL:</span>
                <span className="text-white font-bold">{BackendService.getBaseUrl()}</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal font-sans">
                Uses the integrated bdshare adapter for DSE day-end history, stores validated OHLCV in the server database, and falls back to the bundled verified 1-year dataset when live DSE sources are unreachable.
              </p>
            </div>

            {checkingBackend ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400 leading-normal font-sans">
                Render free server is waking up. Health check now retries automatically before marking the backend offline.
              </div>
            ) : isBackendDisabled && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400 leading-normal font-sans">
                Python server is still unreachable after cold-start retries. Wait a few more seconds, then ping again or continue with local CSV/manual mode.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => checkBackendConnection(false)}
                disabled={checkingBackend}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer font-sans"
              >
                <RefreshCw className={`h-3 w-3 ${checkingBackend ? 'animate-spin' : ''}`} />
                Ping Health
              </button>

              <button
                type="button"
                onClick={() => handleCollectBackendData('backfill')}
                disabled={isScanning || isBackendDisabled}
                className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-3 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-sans"
                title="First-time setup: try live 1-year DSE collection, then auto-fallback to the bundled verified server dataset if DSE is unreachable"
              >
                <Play className="h-3 w-3" />
                Collect + Save 1-Year
              </button>

              <button
                type="button"
                onClick={() => handleCollectBackendData('daily')}
                disabled={isScanning || isBackendDisabled}
                className="bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 px-3 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-sans"
                title="After the initial backfill: append the newest available DSE EOD rows"
              >
                <RefreshCw className="h-3 w-3" />
                Daily Collect + Save
              </button>

              <button
                type="button"
                onClick={handleUploadCSVToBackend}
                disabled={!csvInput.trim() || isBackendDisabled}
                className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-sans"
              >
                <Upload className="h-3 w-3" />
                Save CSV to Server
              </button>

              <button
                type="button"
                onClick={handleRunSignalEngineBackend}
                disabled={!validationSummary || isScanning}
                className="bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-500/30 px-3 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-sans"
              >
                <Play className="h-3 w-3" />
                Run Setup Signals
              </button>
            </div>
            {collectorJob && (
              <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400">{collectorJob.stage}: {collectorJob.current_symbol ?? collectorJob.mode}</span>
                  <span className={collectorJob.status === 'FAILED' ? 'text-rose-400' : collectorJob.status === 'COMPLETED' ? 'text-emerald-400' : 'text-cyan-400'}>{collectorJob.progress}%</span>
                </div>
                <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${collectorJob.progress}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">{collectorJob.message}</p>
                {(collectorJob.completed_symbols ?? 0) > 0 && (
                  <p className="text-[9px] text-slate-600 font-mono">
                    Symbols: {collectorJob.completed_symbols}/{collectorJob.total_symbols ?? '?'} · Rows: {(collectorJob.records_collected ?? 0).toLocaleString()} · Failed: {collectorJob.failed_symbols ?? 0}
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Section 1: Collect Market Data */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-400" /> 
              1. Market Data Import (CSV / Text)
            </h3>
            
            <div 
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all relative
                ${dragActive 
                  ? 'border-emerald-500 bg-emerald-500/5' 
                  : 'border-slate-800 hover:border-slate-700 bg-[#0B0E14]'
                }
              `}
            >
              <FileSpreadsheet className="h-9 w-9 text-slate-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-300">Drag & drop your DSE CSV export here</p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-sans">Accepts standard SYMBOL,DATE,OPEN,HIGH,LOW,CLOSE,VOLUME columns</p>
              
              <input
                ref={csvFileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCSVFileSelection}
                className="hidden"
              />
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => csvFileInputRef.current?.click()}
                  className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-blue-500/30 transition-colors font-sans"
                >
                  Choose CSV File
                </button>
                <button 
                  type="button"
                  onClick={handleLoadMockCSV}
                  className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-emerald-500/30 transition-colors font-sans"
                >
                  Load Demo Market CSV
                </button>
              </div>
            </div>

            {/* CSV Manual Input Textarea */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase block font-sans">
                CSV Input Editor (Paste / Edit raw data)
              </label>
              <textarea
                value={csvInput}
                onChange={(e) => {
                  setCsvInput(e.target.value);
                  setUploadStatus('pasted');
                  setValidationSummary(null);
                }}
                placeholder="SYMBOL,DATE,OPEN,HIGH,LOW,CLOSE,VOLUME&#10;GP,2026-06-26,260.5,268.0,259.0,265.8,1500000"
                className="w-full h-32 bg-[#0B0E14] border border-slate-800 rounded-lg p-3 font-mono text-[10.5px] text-slate-300 focus:outline-none focus:border-emerald-500 leading-relaxed resize-y"
              />
            </div>
          </div>

          {/* Section 2: Data Validation Output Block */}
          {validationSummary && (
            <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  2. Ingested Data Validation Results
                </h3>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider ${
                  validationSummary.status === 'PASSED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  validationSummary.status === 'PASSED_WITH_WARNINGS' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {validationSummary.status}
                </span>
              </div>

              {/* Counts Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800 text-center">
                  <span className="text-[9px] text-slate-500 font-mono block uppercase">Processed</span>
                  <span className="text-white text-sm font-bold font-mono mt-0.5 block">{validationSummary.totalRowsProcessed} Rows</span>
                </div>
                <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800 text-center">
                  <span className="text-[9px] text-slate-500 font-mono block uppercase">Valid</span>
                  <span className="text-emerald-400 text-sm font-bold font-mono mt-0.5 block">{validationSummary.validRecords.length} Rows</span>
                </div>
                <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800 text-center">
                  <span className="text-[9px] text-slate-500 font-mono block uppercase">Invalid</span>
                  <span className={`${validationSummary.invalidRows.filter(r => r.type === 'INVALID').length > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'} text-sm font-mono mt-0.5 block`}>
                    {validationSummary.invalidRows.filter(r => r.type === 'INVALID').length} Rows
                  </span>
                </div>
                <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800 text-center">
                  <span className="text-[9px] text-slate-500 font-mono block uppercase">Duplicates</span>
                  <span className={`${validationSummary.duplicateRowsCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'} text-sm font-mono mt-0.5 block`}>
                    {validationSummary.duplicateRowsCount} Rows
                  </span>
                </div>
                <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800 text-center">
                  <span className="text-[9px] text-slate-500 font-mono block uppercase">Missing</span>
                  <span className={`${validationSummary.missingValuesCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'} text-sm font-mono mt-0.5 block`}>
                    {validationSummary.missingValuesCount} Cells
                  </span>
                </div>
              </div>

              {/* Show errors list if existing */}
              {validationSummary.invalidRows.length > 0 && (
                <div className="bg-[#0B0E14] rounded-lg border border-slate-800 p-3 max-h-36 overflow-y-auto space-y-1.5 font-mono text-[10px]">
                  <span className="text-[9px] text-amber-500 uppercase font-bold block mb-1">Detailed Diagnostic Warning Logs</span>
                  {validationSummary.invalidRows.map((err, idx) => (
                    <div key={idx} className="text-slate-400 border-b border-slate-900 pb-1 last:border-0">
                      <span className="text-rose-400 font-bold font-mono">[ROW {err.rowNumber}]</span> {err.errors.join(' | ')}
                      <div className="text-[9px] text-slate-600 font-mono mt-0.5 truncate">Raw: "{err.rawData}"</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 3: Preview Table */}
          {validationSummary && validationSummary.validRecords.length > 0 && (
            <div className="bg-[#151921] border border-slate-800 rounded-xl overflow-hidden shadow-sm animate-fade-in">
              <div className="px-5 py-3 border-b border-slate-800 bg-[#151921]">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">
                  Validated Data Workspace Preview
                </h3>
              </div>
              <div className="overflow-x-auto max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[9px] font-bold text-slate-400 border-b border-slate-800 uppercase bg-[#0B0E14]/50 font-mono">
                      <th className="px-4 py-2 font-mono">Symbol</th>
                      <th className="px-4 py-2 font-mono">Date</th>
                      <th className="px-4 py-2 text-right font-mono">Open</th>
                      <th className="px-4 py-2 text-right font-mono">High</th>
                      <th className="px-4 py-2 text-right font-mono">Low</th>
                      <th className="px-4 py-2 text-right font-mono">Close</th>
                      <th className="px-4 py-2 text-right font-mono">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 font-mono text-[11px] text-slate-300">
                    {validationSummary.validRecords.map((rec, idx) => (
                      <tr key={idx} className="hover:bg-[#0B0E14]/40 font-mono">
                        <td className="px-4 py-1.5 font-bold font-mono text-white">{rec.symbol}</td>
                        <td className="px-4 py-1.5 font-mono">{rec.date}</td>
                        <td className="px-4 py-1.5 text-right font-mono">৳{rec.open.toFixed(1)}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-emerald-400">৳{rec.high.toFixed(1)}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-rose-400">৳{rec.low.toFixed(1)}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-white">৳{rec.close.toFixed(1)}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-slate-400">{rec.volume.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 4: Pipeline Actions Panel (Validate, Save, Run) */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-400" />
              Ingestion Action Pipeline
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Step A: Validate */}
              <button
                type="button"
                onClick={handleValidate}
                disabled={!csvInput.trim() || uploadStatus === 'validating'}
                className={`
                  p-3 rounded-lg border text-left transition-all font-sans
                  ${!csvInput.trim() || uploadStatus === 'validating'
                    ? 'bg-[#0B0E14]/20 border-slate-900 text-slate-600 cursor-not-allowed'
                    : uploadStatus === 'pasted'
                    ? 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/30 text-amber-400 cursor-pointer'
                    : 'bg-[#0B0E14]/60 border-slate-800 text-emerald-400'
                  }
                `}
              >
                <div className="font-semibold text-xs font-sans">A. Validate Structure</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-normal font-sans">
                  {uploadStatus === 'idle' || uploadStatus === 'pasted' ? 'Run integrity parser' : '✓ Data parsed safely'}
                </div>
              </button>

              {/* Step B: Save to Local Storage */}
              <button
                type="button"
                onClick={handleSaveSnapshot}
                disabled={uploadStatus !== 'validated'}
                className={`
                  p-3 rounded-lg border text-left transition-all font-sans
                  ${uploadStatus !== 'validated' && uploadStatus !== 'saved'
                    ? 'bg-[#0B0E14]/20 border-slate-900 text-slate-600 cursor-not-allowed'
                    : uploadStatus === 'validated'
                    ? 'bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/30 text-blue-400 cursor-pointer'
                    : 'bg-[#0B0E14]/60 border-slate-800 text-emerald-400'
                  }
                `}
              >
                <div className="font-semibold text-xs font-sans">B. Save Snapshot</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-normal font-sans">
                  {uploadStatus === 'saved' ? '✓ Snapshot committed' : 'Commit to Local Storage'}
                </div>
              </button>

              {/* Step C: Run Signal Engine */}
              <button
                type="button"
                onClick={handleRunSignalEngine}
                disabled={isScanning || (snapshots.length === 0 && !validationSummary)}
                className={`
                  p-3 rounded-lg border text-left transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/20 font-bold font-sans
                  ${isScanning ? 'opacity-50 cursor-wait' : ''}
                  ${snapshots.length === 0 && !validationSummary ? 'opacity-40 cursor-not-allowed' : ''}
                `}
              >
                <div className="text-xs font-sans">C. Run Signal Engine</div>
                <div className="text-[10px] text-emerald-200 mt-1 font-normal leading-normal font-sans">
                  {isScanning ? 'Processing swing...' : 'Compute alpha structures'}
                </div>
              </button>
            </div>

            {/* Scanning Progress Bar */}
            {(isScanning || scannerProgress > 0) && (
              <div className="bg-[#0B0E14] p-4 rounded-lg border border-slate-800 space-y-2 shadow-inner animate-fade-in">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-300 flex items-center gap-1.5 font-bold">
                    <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
                    Executing MA & RSI Swing Rules Evaluator...
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">{scannerProgress}%</span>
                </div>
                <div className="h-2 w-full bg-[#151921] rounded-full overflow-hidden border border-slate-800/50">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-200" 
                    style={{ width: `${scannerProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Snapshot Manager */}
          <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
              <FolderOpen className="h-4 w-4 text-blue-400" />
              3. Local Database Snapshots Manager
            </h3>
            
            {snapshots.length === 0 ? (
              <div className="text-center py-6 bg-[#0B0E14] border border-slate-800 rounded-lg text-slate-500 italic text-xs font-sans">
                No saved snapshots found in Local Storage. Upload a file above to persist a dataset.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {snapshots.map((snap) => (
                  <div 
                    key={snap.id} 
                    className={`
                      p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors
                      ${activeSnapshotId === snap.id 
                        ? 'bg-emerald-500/5 border-emerald-500/30 text-white' 
                        : 'bg-[#0B0E14] border-slate-800 text-slate-300 hover:border-slate-700'
                      }
                    `}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-white">{snap.id}</span>
                        <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono font-bold">{snap.engineVersion}</span>
                        {activeSnapshotId === snap.id && (
                          <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold font-sans">Active</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans">
                        Data Date: <span className="font-mono text-slate-400">{snap.date}</span> | Symbols: <span className="font-mono text-slate-400">{snap.totalSymbols}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">Saved: {snap.createdTime}</div>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleReloadSnapshot(snap.id)}
                        className={`
                          px-2.5 py-1 rounded text-[10px] font-bold transition font-sans flex items-center gap-1
                          ${activeSnapshotId === snap.id
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          }
                        `}
                      >
                        <RefreshCw className="h-3 w-3" /> Reload
                      </button>
                      <button
                        onClick={() => handleDeleteSnapshot(snap.id)}
                        className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition"
                        title="Delete Snapshot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5B: Backend Snapshot Manager (FastAPI) */}
          {backendConnected && (
            <div className="bg-[#151921] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm animate-fade-in">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
                <Database className="h-4 w-4 text-emerald-400" />
                4. Python Server Storage Snapshots
              </h3>
              
              {isBackendDisabled ? (
                <div className="text-center py-6 bg-[#0B0E14] border border-slate-800 rounded-lg text-slate-500 italic text-xs font-sans">
                  Backend snapshots unavailable while disconnected or unconfigured.
                </div>
              ) : backendSnapshots.length === 0 ? (
                <div className="text-center py-6 bg-[#0B0E14] border border-slate-800 rounded-lg text-slate-500 italic text-xs font-sans">
                  No snapshots stored on Python Backend. Upload or validate a dataset above to create one.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {backendSnapshots.map((snap) => (
                    <div 
                      key={snap.id} 
                      className={`
                        p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors
                        ${activeSnapshotId === snap.id 
                          ? 'bg-emerald-500/5 border-emerald-500/30 text-white' 
                          : 'bg-[#0B0E14] border-slate-800 text-slate-300 hover:border-slate-700'
                        }
                      `}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono text-white">{snap.id}</span>
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono font-bold">{snap.engine_version}</span>
                          {activeSnapshotId === snap.id && (
                            <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold font-sans">Active</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans">
                          Data Date: <span className="font-mono text-slate-400">{snap.date}</span> | Symbols: <span className="font-mono text-slate-400">{snap.total_symbols}</span>
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono">Saved: {snap.created_time}</div>
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleReloadBackendSnapshot(snap.id)}
                          className={`
                            px-2.5 py-1 rounded text-[10px] font-bold transition font-sans flex items-center gap-1 cursor-pointer
                            ${activeSnapshotId === snap.id
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                            }
                          `}
                        >
                          <RefreshCw className="h-3 w-3" /> Reload
                        </button>
                        <button
                          onClick={() => handleDeleteBackendSnapshot(snap.id)}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition cursor-pointer"
                          title="Delete Snapshot"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Side: Logging Console (5 columns) */}
        <div className="lg:col-span-5 flex flex-col h-full space-y-4">
          
          {/* Section 6: Engine Process Console */}
          <div className="bg-[#0B0E14] border border-slate-800 rounded-xl flex-1 flex flex-col overflow-hidden font-mono text-xs shadow-inner min-h-[350px]">
            
            {/* Header */}
            <div className="bg-[#151921] px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Engine Process Console</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 glow-pulse-green" />
            </div>

            {/* Log Window */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2 text-slate-300 max-h-[380px] font-mono leading-relaxed">
              <div className="text-slate-500 font-mono">[SYSTEM] Sandbox Data Engine initialized. Ready for ingestion.</div>
              {validationLogs.length === 0 ? (
                <div className="text-slate-600 italic font-mono">No logs generated. Initiate CSV drop, paste data, or reload a snapshot to trace execution.</div>
              ) : (
                validationLogs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`
                      font-mono
                      ${log.includes('FAIL') || log.includes('ERR') ? 'text-rose-400 font-bold' : ''}
                      ${log.includes('SUCCESS') || log.includes('PASS') ? 'text-emerald-400 font-bold' : ''}
                      ${log.includes('WARN') ? 'text-amber-400 font-semibold' : ''}
                      ${log.includes('ENGINE') ? 'text-blue-400' : ''}
                    `}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>

            {/* Clear Button */}
            <div className="bg-[#151921]/60 px-4 py-2 border-t border-slate-800 text-right">
              <button 
                type="button"
                onClick={() => setValidationLogs([])}
                className="text-[10px] text-slate-500 hover:text-slate-300 font-bold uppercase tracking-wide font-mono"
              >
                Clear Console
              </button>
            </div>

          </div>

          {/* Core Spec Disclaimer info box */}
          <div className="bg-[#151921]/50 border border-slate-800 p-4 rounded-xl flex gap-3 items-start shadow-sm font-sans">
            <Info className="h-4.5 w-4.5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1 font-sans">
              <span className="text-xs font-semibold text-slate-300 block font-sans">Sandbox Mode Safety Handshake</span>
              <p className="text-[10px] text-slate-400 leading-normal font-sans">
                Market data is accepted only from an explicitly configured server collector, validated manual import, or clearly labelled demo dataset. No broker credentials or real orders are used.
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
