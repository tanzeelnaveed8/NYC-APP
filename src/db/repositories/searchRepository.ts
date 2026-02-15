import { getDatabase } from '../database';
import type { RecentSearch } from '../../models';

const MAX_RECENT_SEARCHES = 10;

// ─── Search Repository ───────────────────────────────────────────────────────

export async function getRecentSearches(): Promise<RecentSearch[]> {
  const db = await getDatabase();
  return db.getAllAsync<RecentSearch>(
    'SELECT * FROM recent_searches ORDER BY timestamp DESC LIMIT ?',
    [MAX_RECENT_SEARCHES]
  );
}

export async function addRecentSearch(search: Omit<RecentSearch, 'searchId'>): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO recent_searches (queryText, displayAddress, latitude, longitude, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [search.queryText, search.displayAddress, search.latitude, search.longitude, search.timestamp]
  );

  // Prune oldest if over limit
  await db.runAsync(
    `DELETE FROM recent_searches WHERE searchId NOT IN (
       SELECT searchId FROM recent_searches ORDER BY timestamp DESC LIMIT ?
     )`,
    [MAX_RECENT_SEARCHES]
  );
}

export async function clearRecentSearches(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM recent_searches');
}
