// ─── Domain Models ───────────────────────────────────────────────────────────

export interface Precinct {
  precinctNum: number;
  name: string;
  address: string;
  phone: string;
  borough: Borough;
  boundaryJson: string;
  centroidLat: number;
  centroidLng: number;
  boundingBoxJson: string;
  openingHoursJson: string;
}

export interface Sector {
  sectorId: string;
  precinctNum: number;
  boundaryJson: string;
  boundingBoxJson: string;
}

export interface LawCategory {
  categoryId: string;
  name: string;
  displayOrder: number;
  entryCount: number;
}

export interface LawEntry {
  entryId: number;
  categoryId: string;
  sectionNumber: string;
  title: string;
  bodyText: string;
}

export interface Squad {
  squadId: number;
  squadName: string;
  displayOrder: number;
}

export interface RdoSchedule {
  scheduleId: number;
  squadId: number;
  patternType: 'rotating' | 'steady';
  cycleLength: number;
  patternArray: string[]; // ["W","W","W","W","W","O","O","W","W","W","W","W","O","O","O"]
  anchorDate: string; // ISO date YYYY-MM-DD
  squadOffset: number;
}

export interface RecentSearch {
  searchId: number;
  queryText: string;
  displayAddress: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface Favorite {
  favoriteId: number;
  precinctNum: number;
  label: string;
  createdAt: number;
}

export interface UserPreference {
  key: PreferenceKey;
  value: string;
  updatedAt: number;
}

export interface DataVersion {
  datasetKey: DatasetKey;
  version: string;
  lastSyncedAt: number;
}

// ─── Enums & Types ──────────────────────────────────────────────────────────

export type Borough = 'Manhattan' | 'Brooklyn' | 'Bronx' | 'Queens' | 'Staten Island';

export type PreferenceKey = 'map_type' | 'boundary_visible' | 'dark_mode';

export type MapType = 'standard' | 'satellite' | 'terrain';

export type DarkMode = 'system' | 'light' | 'dark';

export type DatasetKey = 'precincts' | 'sectors' | 'laws';

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface LawSearchResult {
  entry: LawEntry;
  snippet: string;
  rank: number;
}

// ─── Onboarding State ────────────────────────────────────────────────────────

export type OnboardingState =
  | 'FRESH_INSTALL'
  | 'DOWNLOADING'
  | 'DOWNLOAD_FAILED'
  | 'READY';
