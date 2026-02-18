import { getDatabase } from '../database';
import type { Precinct, Sector, LatLng } from '../../models';

// ─── Precinct Repository ─────────────────────────────────────────────────────

export async function getAllPrecincts(): Promise<Precinct[]> {
  const db = await getDatabase();
  return db.getAllAsync<Precinct>('SELECT * FROM precincts ORDER BY precinctNum');
}

export async function getPrecinctByNumber(precinctNum: number): Promise<Precinct | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Precinct>(
    'SELECT * FROM precincts WHERE precinctNum = ?',
    [precinctNum]
  );
}

/**
 * Find the nearest precinct to a given location.
 * Uses Google Maps building locations as centroids.
 */
export async function findPrecinctAtLocation(point: LatLng): Promise<Precinct | null> {
  return findNearestPrecinct(point);
}

export async function getSectorsForPrecinct(precinctNum: number): Promise<Sector[]> {
  const db = await getDatabase();
  return db.getAllAsync<Sector>(
    'SELECT * FROM sectors WHERE precinctNum = ? ORDER BY sectorId',
    [precinctNum]
  );
}

export async function findSectorAtLocation(_point: LatLng): Promise<Sector | null> {
  return null;
}

/**
 * Find the nearest precinct by centroid distance.
 */
export async function findNearestPrecinct(point: LatLng): Promise<Precinct | null> {
  const db = await getDatabase();
  const precincts = await db.getAllAsync<Precinct>('SELECT * FROM precincts');

  let nearest: Precinct | null = null;
  let minDist = Infinity;

  for (const p of precincts) {
    const dist = distanceTo(point, { latitude: p.centroidLat, longitude: p.centroidLng });
    if (dist < minDist) {
      minDist = dist;
      nearest = p;
    }
  }

  // ~0.05 squared distance ≈ ~25km
  if (minDist > 0.05) return null;
  return nearest;
}

export async function insertPrecinct(p: Precinct): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO precincts (precinctNum, name, address, phone, borough, boundaryJson, centroidLat, centroidLng, boundingBoxJson, openingHoursJson)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.precinctNum, p.name, p.address, p.phone, p.borough, p.boundaryJson, p.centroidLat, p.centroidLng, p.boundingBoxJson, p.openingHoursJson]
  );
}

export async function insertSector(s: Sector): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO sectors (sectorId, precinctNum, boundaryJson, boundingBoxJson)
     VALUES (?, ?, ?, ?)`,
    [s.sectorId, s.precinctNum, s.boundaryJson, s.boundingBoxJson]
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function distanceTo(a: LatLng, b: LatLng): number {
  const dlat = a.latitude - b.latitude;
  const dlng = a.longitude - b.longitude;
  return dlat * dlat + dlng * dlng;
}
