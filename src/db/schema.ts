// ─── SQLite Schema for NYC Precinct App ──────────────────────────────────────

export const TABLE_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS precincts (
    precinctNum INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    borough TEXT NOT NULL,
    boundaryJson TEXT NOT NULL,
    centroidLat REAL NOT NULL,
    centroidLng REAL NOT NULL,
    boundingBoxJson TEXT NOT NULL,
    openingHoursJson TEXT NOT NULL DEFAULT '[]'
  )`,

  `CREATE TABLE IF NOT EXISTS sectors (
    sectorId TEXT PRIMARY KEY,
    precinctNum INTEGER NOT NULL,
    boundaryJson TEXT NOT NULL,
    boundingBoxJson TEXT NOT NULL,
    FOREIGN KEY (precinctNum) REFERENCES precincts(precinctNum)
  )`,

  `CREATE TABLE IF NOT EXISTS law_categories (
    categoryId TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    displayOrder INTEGER NOT NULL,
    entryCount INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS law_entries (
    entryId INTEGER PRIMARY KEY AUTOINCREMENT,
    categoryId TEXT NOT NULL,
    sectionNumber TEXT NOT NULL,
    title TEXT NOT NULL,
    bodyText TEXT NOT NULL,
    FOREIGN KEY (categoryId) REFERENCES law_categories(categoryId)
  )`,

  `CREATE TABLE IF NOT EXISTS squads (
    squadId INTEGER PRIMARY KEY,
    squadName TEXT NOT NULL,
    displayOrder INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS rdo_schedules (
    scheduleId INTEGER PRIMARY KEY AUTOINCREMENT,
    squadId INTEGER NOT NULL UNIQUE,
    patternType TEXT NOT NULL,
    cycleLength INTEGER NOT NULL,
    patternArray TEXT NOT NULL,
    anchorDate TEXT NOT NULL,
    squadOffset INTEGER NOT NULL,
    FOREIGN KEY (squadId) REFERENCES squads(squadId)
  )`,

  `CREATE TABLE IF NOT EXISTS recent_searches (
    searchId INTEGER PRIMARY KEY AUTOINCREMENT,
    queryText TEXT NOT NULL,
    displayAddress TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    timestamp INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS favorites (
    favoriteId INTEGER PRIMARY KEY AUTOINCREMENT,
    precinctNum INTEGER NOT NULL UNIQUE,
    label TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (precinctNum) REFERENCES precincts(precinctNum)
  )`,

  `CREATE TABLE IF NOT EXISTS user_preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS data_versions (
    datasetKey TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    lastSyncedAt INTEGER NOT NULL
  )`,
];
