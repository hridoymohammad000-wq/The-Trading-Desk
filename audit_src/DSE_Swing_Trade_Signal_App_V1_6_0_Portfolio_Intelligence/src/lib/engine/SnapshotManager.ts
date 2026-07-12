import { MarketRecord } from './DataEngine';
import { DataOrigin, StorageService } from './StorageService';

export interface MarketSnapshot {
  id: string;
  date: string;
  totalSymbols: number;
  status: string;
  engineVersion: string;
  createdTime: string;
  records: MarketRecord[];
  origin: DataOrigin;
}

const STORAGE_KEY = 'dse_market_snapshots';
const CURRENT_SNAP_KEY = 'dse_current_snapshot_id';

/**
 * Retrieves all stored snapshots from storage.
 */
export function getSavedSnapshots(): MarketSnapshot[] {
  return StorageService.getJSON<MarketSnapshot[]>(STORAGE_KEY, []);
}

/**
 * Saves a new snapshot to storage.
 */
export function saveSnapshot(date: string, records: MarketRecord[], status: string, origin: DataOrigin = 'MANUAL_IMPORT'): MarketSnapshot {
  const snapshots = getSavedSnapshots();
  
  const newSnapshot: MarketSnapshot = {
    id: `SNAP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    date,
    totalSymbols: records.length,
    status,
    engineVersion: 'v1.6.0-Portfolio-Intelligence',
    createdTime: new Date().toLocaleString(),
    records: records.map(record => ({ ...record, origin })),
    origin
  };

  snapshots.unshift(newSnapshot);
  StorageService.setJSON(STORAGE_KEY, snapshots, origin);
  
  // Set as current automatically
  setCurrentSnapshotId(newSnapshot.id);

  return newSnapshot;
}

/**
 * Deletes a snapshot by ID from storage.
 */
export function deleteSnapshot(id: string): MarketSnapshot[] {
  const snapshots = getSavedSnapshots();
  const filtered = snapshots.filter(s => s.id !== id);
  StorageService.setJSON(STORAGE_KEY, filtered);
  
  // Clean up current if deleted
  if (getCurrentSnapshotId() === id) {
    StorageService.remove(CURRENT_SNAP_KEY);
  }
  return filtered;
}

/**
 * Retrieves the current active snapshot ID.
 */
export function getCurrentSnapshotId(): string | null {
  return StorageService.get(CURRENT_SNAP_KEY);
}

/**
 * Sets the current active snapshot ID.
 */
export function setCurrentSnapshotId(id: string): void {
  StorageService.set(CURRENT_SNAP_KEY, id);
}

