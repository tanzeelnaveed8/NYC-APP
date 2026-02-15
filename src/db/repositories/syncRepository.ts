import { getDatabase } from '../database';
import type { DataVersion, DatasetKey } from '../../models';

// ─── Sync / Data Version Repository ──────────────────────────────────────────

export async function getDataVersion(key: DatasetKey): Promise<DataVersion | null> {
  const db = await getDatabase();
  return db.getFirstAsync<DataVersion>(
    'SELECT * FROM data_versions WHERE datasetKey = ?',
    [key]
  );
}

export async function setDataVersion(key: DatasetKey, version: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO data_versions (datasetKey, version, lastSyncedAt)
     VALUES (?, ?, ?)
     ON CONFLICT(datasetKey) DO UPDATE SET version = excluded.version, lastSyncedAt = excluded.lastSyncedAt`,
    [key, version, Date.now()]
  );
}

export async function isInitialLoadComplete(): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM data_versions WHERE datasetKey IN ('precincts', 'sectors', 'laws')"
  );
  return (row?.count ?? 0) >= 3;
}
