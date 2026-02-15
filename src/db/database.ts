import * as SQLite from 'expo-sqlite';
import { TABLE_STATEMENTS } from './schema';

const DB_NAME = 'nycprecinct.db';

// Use a Promise-based singleton to prevent race conditions
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // Enable WAL mode
  await db.execAsync('PRAGMA journal_mode = WAL');

  // Create each table individually
  for (const stmt of TABLE_STATEMENTS) {
    try {
      await db.execAsync(stmt);
    } catch (err) {
      console.warn('[DB] Schema statement failed:', stmt.substring(0, 60), err);
    }
  }

  return db;
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = initDatabase();
  }
  return dbPromise;
}

export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      await db.closeAsync();
    } catch (err) {
      console.warn('[DB] Error closing database:', err);
    }
    dbPromise = null;
  }
}

/**
 * Reset the database - useful for debugging.
 * Deletes and recreates the DB.
 */
export async function resetDatabase(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      await db.closeAsync();
    } catch (err) {
      console.warn('[DB] Error closing during reset:', err);
    }
    dbPromise = null;
  }
  try {
    await SQLite.deleteDatabaseAsync(DB_NAME);
    // Database deleted successfully
  } catch (err) {
    console.warn('[DB] Error deleting database:', err);
  }
}
