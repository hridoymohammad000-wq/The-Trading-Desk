import { MarketRecord } from './DataEngine';
import { StockSignal, MarketBiasType } from '../../types';
import { StorageService } from './StorageService';

export interface BackendSnapshotMeta {
  id: string;
  date: string;
  origin?: 'REAL' | 'MANUAL_IMPORT' | 'DEMO';
  total_symbols: number;
  record_count?: number;
  start_date?: string;
  end_date?: string;
  source?: string;
  engine_version: string;
  created_time: string;
  status: string;
}

export interface BackendSnapshotResponse extends BackendSnapshotMeta {
  records: Array<{
    symbol: string;
    trade_date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    sector?: string;
    source?: string;
  }>;
}

export type CollectorMode = 'backfill' | 'daily';

export interface CollectorJob {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  stage: string;
  mode: CollectorMode;
  progress: number;
  message: string;
  total_symbols?: number;
  completed_symbols?: number;
  successful_symbols?: number;
  failed_symbols?: number;
  records_collected?: number;
  current_symbol?: string;
  result?: {
    snapshot_id?: string;
    total_symbols?: number;
    records_collected?: number;
    new_records_collected?: number;
    failed_symbols?: number;
    market_bias?: MarketBiasType;
    signals_generated?: number;
    start_date?: string;
    end_date?: string;
  };
  error?: string;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => null);
  const detail = payload?.detail;
  if (typeof detail === 'string') return new Error(detail);
  if (detail?.message) return new Error(detail.message);
  return new Error(fallback);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BackendService {
  public static getBaseUrl(): string {
    return StorageService.getBaseUrl();
  }

  public static async checkHealth(): Promise<boolean> {
    const timeouts = [4500, 9000, 12000];
    for (let index = 0; index < timeouts.length; index += 1) {
      try {
        const response = await fetch(`${this.getBaseUrl()}/health`, { signal: AbortSignal.timeout(timeouts[index]) });
        if (!response.ok) continue;
        const data = await response.json();
        if (data.status === 'ok') return true;
      } catch {
        // Render free instances may be waking from cold start; retry below.
      }
      if (index < timeouts.length - 1) {
        await sleep(1500);
      }
    }
    return false;
  }

  public static async startCollection(
    mode: CollectorMode,
    options: { daysBack?: number; symbols?: string[]; refreshSymbols?: boolean; pauseSeconds?: number } = {},
  ): Promise<CollectorJob> {
    const response = await fetch(`${this.getBaseUrl()}/market/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        days_back: options.daysBack ?? 365,
        symbols: options.symbols,
        refresh_symbols: options.refreshSymbols ?? true,
        pause_seconds: options.pauseSeconds ?? 0.8,
      }),
    });
    if (!response.ok) throw await parseError(response, 'DSE collector could not start.');
    return response.json();
  }

  public static async getCollectionJob(jobId: string): Promise<CollectorJob> {
    const response = await fetch(`${this.getBaseUrl()}/market/collect/${encodeURIComponent(jobId)}`);
    if (!response.ok) throw await parseError(response, 'Collector job status could not be loaded.');
    return response.json();
  }

  public static async collectDSEData(): Promise<CollectorJob> {
    return this.startCollection('backfill');
  }

  public static async importMarketCSV(csvData: string, date?: string, origin: 'MANUAL_IMPORT' | 'DEMO' = 'MANUAL_IMPORT'): Promise<any> {
    const response = await fetch(`${this.getBaseUrl()}/market/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv_data: csvData, date, origin }),
    });
    if (!response.ok) throw await parseError(response, 'Market data import failed.');
    return response.json();
  }

  public static async importBundledMaster(): Promise<any> {
    const response = await fetch(`${this.getBaseUrl()}/market/import-bundled-master`, {
      method: 'POST',
    });
    if (!response.ok) throw await parseError(response, 'Bundled 1-year server dataset reload failed.');
    return response.json();
  }

  public static async listSnapshots(): Promise<BackendSnapshotMeta[]> {
    const response = await fetch(`${this.getBaseUrl()}/market/snapshots`);
    if (!response.ok) throw new Error('Failed to retrieve server snapshots.');
    return response.json();
  }

  public static async getSnapshot(snapshotId: string, includeRecords = true): Promise<BackendSnapshotResponse> {
    const query = includeRecords ? '' : '?include_records=false';
    const response = await fetch(`${this.getBaseUrl()}/market/snapshots/${encodeURIComponent(snapshotId)}${query}`);
    if (!response.ok) throw new Error(`Failed to load server snapshot ${snapshotId}.`);
    return response.json();
  }

  public static async deleteSnapshot(snapshotId: string): Promise<boolean> {
    const response = await fetch(`${this.getBaseUrl()}/market/snapshots/${encodeURIComponent(snapshotId)}`, { method: 'DELETE' });
    return response.ok;
  }

  public static async runSignalEngine(records?: MarketRecord[]): Promise<{ market_bias: MarketBiasType; signals: StockSignal[] }> {
    const payload = records?.map(record => ({
      symbol: record.symbol,
      trade_date: record.date,
      open: record.open,
      high: record.high,
      low: record.low,
      close: record.close,
      volume: record.volume,
      sector: record.sector,
      source: record.origin ?? 'MANUAL_IMPORT',
    }));
    const response = await fetch(`${this.getBaseUrl()}/signals/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : JSON.stringify(null),
    });
    if (!response.ok) throw await parseError(response, 'Server signal calculation failed.');
    const data = await response.json();
    return { market_bias: data.market_bias as MarketBiasType, signals: data.signals as StockSignal[] };
  }

  public static async getSignals(): Promise<StockSignal[]> {
    const response = await fetch(`${this.getBaseUrl()}/signals`);
    if (!response.ok) throw new Error('Failed to retrieve server signals.');
    return response.json();
  }

  public static async getOHLCV(symbol: string, snapshotId?: string): Promise<any[]> {
    const suffix = snapshotId ? `?snapshot_id=${encodeURIComponent(snapshotId)}` : '';
    const response = await fetch(`${this.getBaseUrl()}/symbols/${encodeURIComponent(symbol)}/ohlcv${suffix}`);
    if (!response.ok) throw new Error(`Failed to load OHLCV data for ${symbol}.`);
    return response.json();
  }

  public static async getLatestMarketRecords(): Promise<{ date: string | null; total_symbols: number; market_bias: MarketBiasType; records: any[] }> {
    const response = await fetch(`${this.getBaseUrl()}/market/latest`);
    if (!response.ok) throw new Error('Failed to retrieve latest market session.');
    return response.json();
  }

  public static getMarketExportUrl(): string {
    return `${this.getBaseUrl()}/market/export.csv`;
  }
}
