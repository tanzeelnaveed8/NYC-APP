import { getDatabase } from '../database';
import type { LawCategory, LawEntry, LawSearchResult } from '../../models';

// ─── Law Library Repository ──────────────────────────────────────────────────

export async function getAllCategories(): Promise<LawCategory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LawCategory>(
    'SELECT * FROM law_categories ORDER BY displayOrder'
  );
  return rows;
}

export async function getEntriesByCategory(categoryId: string): Promise<LawEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LawEntry>(
    'SELECT * FROM law_entries WHERE categoryId = ? ORDER BY sectionNumber',
    [categoryId]
  );
  return rows;
}

export async function getEntryById(entryId: number): Promise<LawEntry | null> {
  const db = await getDatabase();
  return db.getFirstAsync<LawEntry>(
    'SELECT * FROM law_entries WHERE entryId = ?',
    [entryId]
  );
}

export async function searchLaws(query: string): Promise<LawSearchResult[]> {
  if (!query || query.trim().length === 0) return [];

  const db = await getDatabase();
  const sanitized = query.replace(/['"]/g, '').trim();

  // Use LIKE search - simple and reliable
  const results = await db.getAllAsync<LawEntry>(
    `SELECT * FROM law_entries 
     WHERE title LIKE ? OR bodyText LIKE ? OR sectionNumber LIKE ?
     ORDER BY 
       CASE WHEN sectionNumber LIKE ? THEN 0
            WHEN title LIKE ? THEN 1
            ELSE 2 END
     LIMIT 50`,
    [`%${sanitized}%`, `%${sanitized}%`, `%${sanitized}%`, `%${sanitized}%`, `%${sanitized}%`]
  );

  return results.map((entry, i) => ({
    entry,
    snippet: entry.title,
    rank: i + 1,
  }));
}

export async function insertLawCategory(cat: LawCategory): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO law_categories (categoryId, name, displayOrder, entryCount)
     VALUES (?, ?, ?, ?)`,
    [cat.categoryId, cat.name, cat.displayOrder, cat.entryCount]
  );
}

export async function insertLawEntry(entry: Omit<LawEntry, 'entryId'>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO law_entries (categoryId, sectionNumber, title, bodyText)
     VALUES (?, ?, ?, ?)`,
    [entry.categoryId, entry.sectionNumber, entry.title, entry.bodyText]
  );
}

export async function updateCategoryCount(categoryId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE law_categories SET entryCount = (
       SELECT COUNT(*) FROM law_entries WHERE categoryId = ?
     ) WHERE categoryId = ?`,
    [categoryId, categoryId]
  );
}

export async function getLawStats(): Promise<{ categories: number; entries: number }> {
  const db = await getDatabase();
  const catRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM law_categories');
  const entryRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM law_entries');
  return {
    categories: catRow?.count ?? 0,
    entries: entryRow?.count ?? 0,
  };
}
