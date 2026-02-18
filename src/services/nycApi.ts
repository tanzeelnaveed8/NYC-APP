import type { Borough } from '../models';

const GOOGLE_MAPS_KEY = 'AIzaSyAy6Un1PzgY5BgUNwgbch9dES5yE9En96I';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DayHours {
  day: string;       // "Monday", "Tuesday", etc.
  hours: string;     // "Open 24 hours", "9:00 AM – 5:00 PM", "Closed"
  isOpen: boolean;
}

export interface GooglePrecinctInfo {
  precinctNum: number;
  name: string;
  address: string;
  phone: string;
  borough: Borough;
  latitude: number;
  longitude: number;
  openingHours: DayHours[];
}

// ─── Precinct Details (Google Maps Places API) ──────────────────────────────

const BOROUGH_SEARCHES: { query: string; borough: Borough }[] = [
  { query: 'NYPD precinct Manhattan', borough: 'Manhattan' },
  { query: 'NYPD precinct Brooklyn', borough: 'Brooklyn' },
  { query: 'NYPD precinct Bronx', borough: 'Bronx' },
  { query: 'NYPD precinct Queens', borough: 'Queens' },
  { query: 'NYPD precinct Staten Island', borough: 'Staten Island' },
];

// All 77 NYC precinct numbers for gap-filling
const ALL_PRECINCT_NUMS = [
  1,5,6,7,9,10,13,14,17,18,19,20,22,23,24,25,26,28,30,32,33,34,
  40,41,42,43,44,45,46,47,48,49,50,52,
  60,61,62,63,66,67,68,69,70,71,72,73,75,76,77,78,79,81,83,84,88,90,94,
  100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,
  120,121,122,
];

/**
 * Fetch all NYPD precinct details from Google Maps Places API.
 * 1. Borough-wide searches with pagination
 * 2. Individual searches for any missing precincts
 * 3. Phone number fetch for each precinct
 */
export async function fetchPrecinctDetailsFromGoogle(): Promise<Map<number, GooglePrecinctInfo>> {
  const precinctMap = new Map<number, GooglePrecinctInfo>();

  // Step 1: Borough-wide searches
  for (const { query, borough } of BOROUGH_SEARCHES) {
    await searchAndCollect(query, borough, precinctMap);
  }

  // Step 2: Fill any missing precincts with individual searches
  const missing = ALL_PRECINCT_NUMS.filter(n => !precinctMap.has(n));
  for (const num of missing) {
    const borough = getBoroughFromNumber(num);
    await searchAndCollect(
      `NYPD ${num}${getOrdinalSuffix(num)} precinct ${borough}`,
      borough,
      precinctMap,
    );
  }

  return precinctMap;
}

async function searchAndCollect(
  query: string,
  defaultBorough: Borough,
  resultMap: Map<number, GooglePrecinctInfo>,
  pageToken?: string,
): Promise<void> {
  const params: Record<string, string> = {
    query,
    key: GOOGLE_MAPS_KEY,
  };

  if (pageToken) {
    params.pagetoken = pageToken;
  }

  const qs = new URLSearchParams(params).toString();
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${qs}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    console.warn(`[nycApi] Network error for "${query}"`);
    return;
  }

  if (!response.ok) {
    console.warn(`[nycApi] Google Places failed for "${query}": ${response.status}`);
    return;
  }

  const data = await response.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.warn(`[nycApi] Google Places status: ${data.status} — ${data.error_message || ''}`);
    return;
  }

  const results: any[] = data.results || [];

  for (const place of results) {
    const precinctNum = extractPrecinctNumber(place.name);
    if (precinctNum === null) continue;
    if (!ALL_PRECINCT_NUMS.includes(precinctNum)) continue;
    if (resultMap.has(precinctNum)) continue;

    const borough = detectBorough(place.formatted_address, defaultBorough);
    const details = await fetchPlaceDetails(place.place_id);

    resultMap.set(precinctNum, {
      precinctNum,
      name: place.name,
      address: cleanAddress(place.formatted_address),
      phone: details.phone || '',
      borough,
      latitude: place.geometry?.location?.lat ?? 0,
      longitude: place.geometry?.location?.lng ?? 0,
      openingHours: details.openingHours,
    });
  }

  // Follow pagination
  if (data.next_page_token) {
    await delay(2500);
    await searchAndCollect(query, defaultBorough, resultMap, data.next_page_token);
  }
}

interface PlaceDetailsResult {
  phone: string;
  openingHours: DayHours[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_HOURS: DayHours[] = DAY_NAMES.map(day => ({ day, hours: 'Open 24 hours', isOpen: true }));

async function fetchPlaceDetails(placeId: string): Promise<PlaceDetailsResult> {
  try {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'formatted_phone_number,opening_hours',
      key: GOOGLE_MAPS_KEY,
    });

    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[nycApi] Place Details HTTP ${response.status} for ${placeId}`);
      return { phone: '', openingHours: DEFAULT_HOURS };
    }

    const data = await response.json();
    const phone = data.result?.formatted_phone_number || '';
    const openingHours = parseOpeningHours(data.result?.opening_hours);

    return { phone, openingHours };
  } catch (err) {
    console.warn(`[nycApi] Place Details failed for ${placeId}:`, err);
    return { phone: '', openingHours: DEFAULT_HOURS };
  }
}

function parseOpeningHours(oh: any): DayHours[] {
  if (!oh) {
    return [...DEFAULT_HOURS];
  }

  try {
    const weekdayText: string[] = oh.weekday_text || [];
    const periods: any[] = oh.periods || [];

    if (weekdayText.length > 0) {
      const parsed: DayHours[] = [];
      for (const line of weekdayText) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const day = line.substring(0, colonIdx).trim();
        const hours = line.substring(colonIdx + 1).trim();
        const isClosed = hours.toLowerCase() === 'closed';
        parsed.push({ day, hours: isClosed ? 'Closed' : hours, isOpen: !isClosed });
      }
      // weekday_text starts with Monday; reorder to start with Sunday
      if (parsed.length === 7) {
        const sunday = parsed.pop()!;
        parsed.unshift(sunday);
      }
      if (parsed.length > 0) return parsed;
    }

    if (periods.length === 1 && !periods[0].close) {
      return [...DEFAULT_HOURS];
    }

    return DAY_NAMES.map(day => ({ day, hours: 'Hours unavailable', isOpen: true }));
  } catch {
    return [...DEFAULT_HOURS];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract precinct number from Google Places name.
 * Handles: "NYPD - 13th Precinct", "Midtown Precinct South", "Central Park Precinct", etc.
 */
function extractPrecinctNumber(name: string): number | null {
  const lower = name.toLowerCase();

  // Special named precincts (no number in name)
  if (lower.includes('midtown') && lower.includes('south')) return 14;
  if (lower.includes('midtown') && lower.includes('north')) return 18;
  if (lower.includes('central park')) return 22;

  // Standard: any number followed by optional ordinal + "precinct"
  const numMatch = name.match(/(\d+)\s*(?:st|nd|rd|th)?\s*(?:precinct|pct)/i);
  if (numMatch) return parseInt(numMatch[1], 10);

  // "NYPD 28th Precinct" style - number anywhere before "precinct"
  const precinctMatch = name.match(/(\d+)/);
  if (precinctMatch && lower.includes('precinct')) {
    return parseInt(precinctMatch[1], 10);
  }

  // Fallback: just a number in NYPD/police context
  if (lower.includes('nypd') || lower.includes('police')) {
    const anyNum = name.match(/\b(\d{1,3})\b/);
    if (anyNum) {
      const n = parseInt(anyNum[1], 10);
      if (ALL_PRECINCT_NUMS.includes(n)) return n;
    }
  }

  return null;
}

function cleanPrecinctName(rawName: string, precinctNum: number): string {
  const lower = rawName.toLowerCase();
  if (lower.includes('midtown') && lower.includes('south')) return 'Midtown South Precinct';
  if (lower.includes('midtown') && lower.includes('north')) return 'Midtown North Precinct';
  if (lower.includes('central park')) return 'Central Park Precinct';

  const suffix = getOrdinalSuffix(precinctNum);
  return `${precinctNum}${suffix} Precinct`;
}

function cleanAddress(address: string): string {
  return address
    .replace(', United States', '')
    .replace(', USA', '')
    .trim();
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function detectBorough(address: string, fallback: Borough): Borough {
  const lower = address.toLowerCase();
  if (lower.includes('staten island')) return 'Staten Island';
  if (lower.includes('bronx')) return 'Bronx';
  if (lower.includes('brooklyn')) return 'Brooklyn';
  if (lower.includes('queens') || lower.includes('jamaica') ||
      lower.includes('flushing') || lower.includes('astoria') ||
      lower.includes('ridgewood') || lower.includes('ozone park') ||
      lower.includes('rockaway') || lower.includes('elmhurst') ||
      lower.includes('bayside') || lower.includes('forest hills') ||
      lower.includes('long island city') || lower.includes('jackson heights') ||
      lower.includes('college point') || lower.includes('queens village') ||
      lower.includes('fresh meadows') || lower.includes('far rockaway') ||
      lower.includes('richmond hill') || lower.includes('woodside') ||
      lower.includes('corona')) return 'Queens';
  if (lower.includes('new york, ny') || lower.includes('manhattan')) return 'Manhattan';
  return fallback;
}

function getBoroughFromNumber(num: number): Borough {
  if (num < 40) return 'Manhattan';
  if (num < 60) return 'Bronx';
  if (num < 100) return 'Brooklyn';
  if (num < 120) return 'Queens';
  return 'Staten Island';
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Google Geocoding API ────────────────────────────────────────────────────

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

/**
 * Forward geocode an address using Google Maps Geocoding API.
 * Biased toward NYC bounding box.
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      address: address + ', New York City, NY, USA',
      bounds: '40.49,-74.26|40.92,-73.70',
      key: GOOGLE_MAPS_KEY,
    });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== 'OK' || !data.results?.length) return null;

    const result = data.results[0];
    const loc = result.geometry?.location;
    if (!loc) return null;

    return {
      latitude: loc.lat,
      longitude: loc.lng,
      formattedAddress: result.formatted_address || address,
    };
  } catch {
    console.warn('[nycApi] Google Geocoding failed');
    return null;
  }
}

/**
 * Find the nearest NYPD precinct to a given location using Google Places Nearby Search.
 * Returns the precinct number if found.
 */
export async function findNearbyNYPDPrecinct(
  latitude: number,
  longitude: number,
): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      location: `${latitude},${longitude}`,
      rankby: 'distance',
      keyword: 'NYPD precinct',
      key: GOOGLE_MAPS_KEY,
    });

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== 'OK' || !data.results?.length) return null;

    // Find the first result that looks like a precinct
    for (const place of data.results) {
      const num = extractPrecinctNum(place.name);
      if (num !== null && ALL_PRECINCT_NUMS.includes(num)) {
        return num;
      }
    }

    return null;
  } catch {
    console.warn('[nycApi] Google Nearby Search failed');
    return null;
  }
}

/**
 * Extract precinct number from a place name.
 */
function extractPrecinctNum(name: string): number | null {
  const lower = name.toLowerCase();

  if (lower.includes('midtown') && lower.includes('south')) return 14;
  if (lower.includes('midtown') && lower.includes('north')) return 18;
  if (lower.includes('central park')) return 22;

  const numMatch = name.match(/(\d+)\s*(?:st|nd|rd|th)?\s*(?:precinct|pct)/i);
  if (numMatch) return parseInt(numMatch[1], 10);

  const precinctMatch = name.match(/(\d+)/);
  if (precinctMatch && lower.includes('precinct')) {
    return parseInt(precinctMatch[1], 10);
  }

  if (lower.includes('nypd') || lower.includes('police')) {
    const anyNum = name.match(/\b(\d{1,3})\b/);
    if (anyNum) {
      const n = parseInt(anyNum[1], 10);
      if (ALL_PRECINCT_NUMS.includes(n)) return n;
    }
  }

  return null;
}

/**
 * Reverse geocode coordinates using Google Maps Geocoding API.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      latlng: `${latitude},${longitude}`,
      key: GOOGLE_MAPS_KEY,
    });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== 'OK' || !data.results?.length) return null;

    return data.results[0].formatted_address || null;
  } catch {
    console.warn('[nycApi] Google Reverse Geocoding failed');
    return null;
  }
}
