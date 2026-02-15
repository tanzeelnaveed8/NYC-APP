import type { LatLng, BoundingBox } from '../models';

/**
 * Parse a bounding box JSON string into a BoundingBox object.
 */
export function parseBoundingBox(json: string): BoundingBox | null {
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr) && arr.length === 4) {
      return {
        minLat: arr[0],
        minLng: arr[1],
        maxLat: arr[2],
        maxLng: arr[3],
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Ray-casting algorithm for point-in-polygon detection.
 * Supports both Polygon and MultiPolygon GeoJSON geometry objects.
 */
export function isPointInPolygon(point: LatLng, geometry: GeoJSONGeometry): boolean {
  if (geometry.type === 'Polygon') {
    return isPointInSinglePolygon(point, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly: number[][][]) =>
      isPointInSinglePolygon(point, poly)
    );
  }
  return false;
}

function isPointInSinglePolygon(point: LatLng, coordinates: number[][][]): boolean {
  // First ring is the exterior ring
  if (!coordinates || coordinates.length === 0) return false;
  const ring = coordinates[0];
  return rayCasting(point.latitude, point.longitude, ring);
}

function rayCasting(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  const n = ring.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    // GeoJSON coordinates are [lng, lat]
    const yi = ring[i][1];
    const xi = ring[i][0];
    const yj = ring[j][1];
    const xj = ring[j][0];

    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Compute the centroid of a polygon (first ring only).
 */
export function computeCentroid(coordinates: number[][][]): LatLng {
  const ring = coordinates[0];
  let sumLat = 0;
  let sumLng = 0;
  const len = ring.length - 1; // Skip closing point

  for (let i = 0; i < len; i++) {
    sumLng += ring[i][0];
    sumLat += ring[i][1];
  }

  return {
    latitude: sumLat / len,
    longitude: sumLng / len,
  };
}

/**
 * Compute bounding box from polygon coordinates.
 */
export function computeBoundingBox(coordinates: number[][][]): BoundingBox {
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const ring of coordinates) {
    for (const coord of ring) {
      if (coord[1] < minLat) minLat = coord[1];
      if (coord[1] > maxLat) maxLat = coord[1];
      if (coord[0] < minLng) minLng = coord[0];
      if (coord[0] > maxLng) maxLng = coord[0];
    }
  }

  return { minLat, minLng, maxLat, maxLng };
}

/**
 * Convert GeoJSON coordinates [lng, lat] to react-native-maps format { latitude, longitude }
 */
export function geoJsonToLatLngArray(coordinates: number[][]): LatLng[] {
  return coordinates.map(coord => ({
    latitude: coord[1],
    longitude: coord[0],
  }));
}

/**
 * Get all polygon rings from a GeoJSON geometry as LatLng arrays.
 */
export function getPolygonRings(geometry: GeoJSONGeometry): LatLng[][] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map((ring: number[][]) => geoJsonToLatLngArray(ring));
  }
  if (geometry.type === 'MultiPolygon') {
    const rings: LatLng[][] = [];
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        rings.push(geoJsonToLatLngArray(ring));
      }
    }
    return rings;
  }
  return [];
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeoJSONGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: any;
}

export interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: GeoJSONGeometry;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}
