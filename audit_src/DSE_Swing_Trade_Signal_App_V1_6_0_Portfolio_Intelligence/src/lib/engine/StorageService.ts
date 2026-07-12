export type StorageStatus = 'Server Storage Connected' | 'Local Browser Storage' | 'Storage Error';
export type DataOrigin = 'REAL' | 'MANUAL_IMPORT' | 'DEMO';

type StatusListener = (status: StorageStatus) => void;

class LocalStorageAdapter {
  getItem(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
  setItem(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* ignore browser quota errors */ } }
  removeItem(key: string): void { try { localStorage.removeItem(key); } catch { /* ignore */ } }
}

const local = new LocalStorageAdapter();

const HYDRATION_KEYS = [
  'dse_app_settings',
  'dse_paper_capital',
  'dse_paper_trades',
  'dse_paper_trade_journals',
  'dse_portfolio_reviews',
  'dse_weekly_reviews',
  'dse_monthly_reviews',
  'dse_active_confirmed_portfolio',
  'dse_portfolio_history',
  'dse_signals',
  'dse_market_status',
  'dse_market_origin',
] as const;

export class StorageService {
  private static status: StorageStatus = 'Local Browser Storage';
  private static listeners = new Set<StatusListener>();
  private static base = (() => {
    const value = (import.meta as any).env?.VITE_DSE_BACKEND_URL;
    return typeof value === 'string' && value.trim() ? value.replace(/\/$/, '') : '/api';
  })();

  static getBaseUrl(): string { return this.base; }
  static getStatus(): StorageStatus { return this.status; }

  private static setStatus(status: StorageStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  static subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  static async initializeAndHydrate(): Promise<StorageStatus> {
    try {
      const response = await fetch(`${this.base}/health`, { signal: AbortSignal.timeout(3500) });
      if (!response.ok) {
        this.setStatus('Local Browser Storage');
        return this.status;
      }
      this.setStatus('Server Storage Connected');
      await this.hydrateKnownRecords();
      await this.hydrateMarketSnapshots();
    } catch {
      this.setStatus('Local Browser Storage');
    }
    return this.status;
  }

  static async initialize(): Promise<StorageStatus> {
    return this.initializeAndHydrate();
  }

  private static async hydrateKnownRecords(): Promise<void> {
    for (const key of HYDRATION_KEYS) {
      try {
        const response = await fetch(`${this.base}/storage/${encodeURIComponent(key)}`);
        if (response.status === 404) continue;
        if (!response.ok) throw new Error(`Unable to hydrate ${key}`);
        const payload = await response.json();
        if ('data' in payload) local.setItem(key, typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data));
      } catch {
        this.setStatus('Storage Error');
        return;
      }
    }
  }

  private static async hydrateMarketSnapshots(): Promise<void> {
    try {
      const response = await fetch(`${this.base}/market/snapshots`);
      if (!response.ok) return;
      const metas = await response.json();
      if (!Array.isArray(metas) || metas.length === 0) return;

      // Keep server snapshot metadata locally, but do not copy a full one-year
      // REAL dataset into browser localStorage. Large OHLCV remains in SQLite
      // and ChartLab reads it through /api/symbols/{symbol}/ohlcv.
      local.setItem('dse_server_snapshot_metadata', JSON.stringify(metas));
      const browserSnapshots: any[] = [];
      for (const meta of metas) {
        const recordCount = Number(meta.record_count ?? 0);
        const shouldHydrateRecords = meta.origin !== 'REAL' && recordCount <= 5000;
        if (!shouldHydrateRecords) continue;
        const detailResponse = await fetch(`${this.base}/market/snapshots/${encodeURIComponent(meta.id)}`);
        if (!detailResponse.ok) continue;
        const detail = await detailResponse.json();
        browserSnapshots.push({
          id: detail.id,
          date: detail.date,
          totalSymbols: detail.total_symbols ?? detail.records?.length ?? 0,
          status: detail.status,
          engineVersion: detail.engine_version,
          createdTime: detail.created_time,
          origin: detail.origin ?? 'MANUAL_IMPORT',
          records: (detail.records ?? []).map((row: any) => ({
            symbol: row.symbol,
            date: row.trade_date ?? row.date,
            open: Number(row.open),
            high: Number(row.high),
            low: Number(row.low),
            close: Number(row.close),
            volume: Number(row.volume),
            sector: row.sector,
            origin: row.source ?? detail.origin ?? 'MANUAL_IMPORT',
          })),
        });
      }
      if (browserSnapshots.length > 0) {
        local.setItem('dse_market_snapshots', JSON.stringify(browserSnapshots));
        local.setItem('dse_current_snapshot_id', browserSnapshots[0].id);
      }
    } catch {
      // Server storage is still usable even if no snapshots exist.
    }
  }

  static get(key: string): string | null { return local.getItem(key); }

  static set(key: string, value: string, origin: DataOrigin = 'MANUAL_IMPORT'): void {
    local.setItem(key, value);
    void this.mirror(key, value, origin);
  }

  static remove(key: string): void {
    local.removeItem(key);
    void this.removeServer(key);
  }

  static getJSON<T>(key: string, defaultValue: T): T {
    const value = this.get(key);
    if (!value) return defaultValue;
    try { return JSON.parse(value) as T; } catch { return defaultValue; }
  }

  static setJSON<T>(key: string, value: T, origin: DataOrigin = 'MANUAL_IMPORT'): void {
    this.set(key, JSON.stringify(value), origin);
  }

  static async syncFromServer(): Promise<void> {
    if (this.status !== 'Server Storage Connected') return;
    await this.hydrateKnownRecords();
    await this.hydrateMarketSnapshots();
  }

  private static async mirror(key: string, value: string, origin: DataOrigin): Promise<void> {
    if (this.status !== 'Server Storage Connected') return;
    try {
      const parsed = (() => { try { return JSON.parse(value); } catch { return value; } })();
      const response = await fetch(`${this.base}/storage/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: parsed, origin }),
      });
      if (!response.ok) this.setStatus('Storage Error');
    } catch {
      this.setStatus('Storage Error');
    }
  }

  private static async removeServer(key: string): Promise<void> {
    if (this.status !== 'Server Storage Connected') return;
    try {
      const response = await fetch(`${this.base}/storage/${encodeURIComponent(key)}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 404) this.setStatus('Storage Error');
    } catch {
      this.setStatus('Storage Error');
    }
  }
}

if (!local.getItem('dse_storage_version')) local.setItem('dse_storage_version', '1.6.0');
