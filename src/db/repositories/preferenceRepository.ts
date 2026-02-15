import { getDatabase } from '../database';
import type { UserPreference, PreferenceKey, MapType, DarkMode } from '../../models';

// ─── Preference Repository ───────────────────────────────────────────────────

const DEFAULTS: Record<PreferenceKey, string> = {
  map_type: 'standard',
  boundary_visible: 'true',
  dark_mode: 'system',
};

export async function getPreference(key: PreferenceKey): Promise<string> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<UserPreference>(
    'SELECT * FROM user_preferences WHERE key = ?',
    [key]
  );
  return row?.value ?? DEFAULTS[key];
}

export async function setPreference(key: PreferenceKey, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO user_preferences (key, value, updatedAt)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    [key, value, Date.now()]
  );
}

export async function getAllPreferences(): Promise<Record<PreferenceKey, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<UserPreference>('SELECT * FROM user_preferences');

  const result = { ...DEFAULTS };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export async function getMapType(): Promise<MapType> {
  return (await getPreference('map_type')) as MapType;
}

export async function getBoundaryVisible(): Promise<boolean> {
  return (await getPreference('boundary_visible')) === 'true';
}

export async function getDarkMode(): Promise<DarkMode> {
  return (await getPreference('dark_mode')) as DarkMode;
}
