import { getDatabase } from '../database';
import type { Favorite } from '../../models';

// ─── Favorite Repository ─────────────────────────────────────────────────────

export async function getAllFavorites(): Promise<Favorite[]> {
  const db = await getDatabase();
  return db.getAllAsync<Favorite>(
    'SELECT * FROM favorites ORDER BY createdAt DESC'
  );
}

export async function isFavorited(precinctNum: number): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM favorites WHERE precinctNum = ?',
    [precinctNum]
  );
  return (row?.count ?? 0) > 0;
}

export async function upsertFavorite(precinctNum: number, label: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO favorites (precinctNum, label, createdAt)
     VALUES (?, ?, ?)
     ON CONFLICT(precinctNum) DO UPDATE SET label = excluded.label`,
    [precinctNum, label, Date.now()]
  );
}

export async function removeFavorite(precinctNum: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM favorites WHERE precinctNum = ?', [precinctNum]);
}
