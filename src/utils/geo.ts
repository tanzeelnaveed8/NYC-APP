import type { LatLng, BoundingBox } from '../models';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeoJSONGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: any;
}

// ─── Bounding Box ────────────────────────────────────────────────────────────

export function parseBoundingBox(json: string): BoundingBox | null {
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr) && arr.length === 4) {
      return { minLat: arr[0], minLng: arr[1], maxLat: arr[2], maxLng: arr[3] };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Circle Polygon Generator ────────────────────────────────────────────────

const POINTS_ON_CIRCLE = 32;

/**
 * Generate a circular polygon around a center point.
 * Returns GeoJSON coordinates [lng, lat] ring.
 *
 * @param lat Center latitude
 * @param lng Center longitude
 * @param radiusMeters Radius in meters
 */
export function generateCircleBoundary(
  lat: number,
  lng: number,
  radiusMeters: number = 150,
): { geometry: GeoJSONGeometry; bbox: BoundingBox } {
  const ring: number[][] = [];

  // Convert radius from meters to degrees (approximate)
  const latOffset = radiusMeters / 111320;
  const lngOffset = radiusMeters / (111320 * Math.cos(lat * (Math.PI / 180)));

  for (let i = 0; i <= POINTS_ON_CIRCLE; i++) {
    const angle = (2 * Math.PI * i) / POINTS_ON_CIRCLE;
    const pLng = lng + lngOffset * Math.cos(angle);
    const pLat = lat + latOffset * Math.sin(angle);
    ring.push([pLng, pLat]);
  }

  const bbox: BoundingBox = {
    minLat: lat - latOffset,
    maxLat: lat + latOffset,
    minLng: lng - lngOffset,
    maxLng: lng + lngOffset,
  };

  return {
    geometry: { type: 'Polygon', coordinates: [ring] },
    bbox,
  };
}
