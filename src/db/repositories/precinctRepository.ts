import { getDatabase } from '../database';
import type { Precinct, Sector, BoundingBox, LatLng } from '../../models';
import { isPointInPolygon, parseBoundingBox } from '../../utils/geo';

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

export async function findPrecinctAtLocation(point: LatLng): Promise<Precinct | null> {
  const db = await getDatabase();
  const precincts = await db.getAllAsync<Precinct>('SELECT * FROM precincts');

  // Bounding box pre-filter then ray-casting
  const candidates = precincts.filter(p => {
    const bbox = parseBoundingBox(p.boundingBoxJson);
    return bbox && isPointInBoundingBox(point, bbox);
  });

  let bestMatch: Precinct | null = null;
  let bestDistance = Infinity;

  for (const precinct of candidates) {
    try {
      const geometry = JSON.parse(precinct.boundaryJson);
      if (isPointInPolygon(point, geometry)) {
        const dist = distanceTo(point, {
          latitude: precinct.centroidLat,
          longitude: precinct.centroidLng,
        });
        if (dist < bestDistance) {
          bestDistance = dist;
          bestMatch = precinct;
        }
      }
    } catch {
      // Skip malformed geometry
    }
  }

  return bestMatch;
}

export async function getSectorsForPrecinct(precinctNum: number): Promise<Sector[]> {
  const db = await getDatabase();
  return db.getAllAsync<Sector>(
    'SELECT * FROM sectors WHERE precinctNum = ? ORDER BY sectorId',
    [precinctNum]
  );
}

export async function findSectorAtLocation(point: LatLng): Promise<Sector | null> {
  const db = await getDatabase();
  const sectors = await db.getAllAsync<Sector>('SELECT * FROM sectors');

  const candidates = sectors.filter(s => {
    const bbox = parseBoundingBox(s.boundingBoxJson);
    return bbox && isPointInBoundingBox(point, bbox);
  });

  for (const sector of candidates) {
    try {
      const geometry = JSON.parse(sector.boundaryJson);
      if (isPointInPolygon(point, geometry)) {
        return sector;
      }
    } catch {
      // Skip malformed
    }
  }

  return null;
}

/**
 * Find the nearest precinct by centroid distance (fallback when point-in-polygon fails).
 * Only returns a result within ~3km to avoid matching far-away precincts.
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

  // ~0.0009 squared distance ≈ ~3km — reject if too far from any precinct
  if (minDist > 0.0009) return null;
  return nearest;
}

export async function insertPrecinct(p: Precinct): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO precincts (precinctNum, name, address, phone, borough, boundaryJson, centroidLat, centroidLng, boundingBoxJson)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.precinctNum, p.name, p.address, p.phone, p.borough, p.boundaryJson, p.centroidLat, p.centroidLng, p.boundingBoxJson]
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

function isPointInBoundingBox(point: LatLng, bbox: BoundingBox): boolean {
  return (
    point.latitude >= bbox.minLat &&
    point.latitude <= bbox.maxLat &&
    point.longitude >= bbox.minLng &&
    point.longitude <= bbox.maxLng
  );
}

function distanceTo(a: LatLng, b: LatLng): number {
  const dlat = a.latitude - b.latitude;
  const dlng = a.longitude - b.longitude;
  return dlat * dlat + dlng * dlng;
}
