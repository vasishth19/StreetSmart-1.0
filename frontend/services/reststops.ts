'use client';

// ✅ Real rest-stop / bench / shelter data — pulled live from OpenStreetMap's
// Overpass API. No API key needed, no fabricated points: every result is an
// actual mapped amenity.

export interface RestStop {
  id: number;
  lat: number;
  lng: number;
  type: 'bench' | 'shelter' | 'rest_area' | 'toilets' | 'drinking_water';
  name?: string;
  covered?: boolean;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * Fetch real rest stops (benches, shelters, rest areas, public toilets,
 * drinking water points) within `radiusM` metres of a route's coordinates.
 * Coordinates are [lng, lat] pairs, matching OSRM/GeoJSON order.
 */
export async function fetchRestStopsAlongRoute(
  coordinates: number[][],
  radiusM: number = 120
): Promise<RestStop[]> {
  if (!coordinates || coordinates.length === 0) return [];

  // Sample the route so we don't send a huge query for long routes —
  // every ~8th point is plenty to cover a walking/driving route corridor.
  const sampled = coordinates.filter((_, i) => i % 8 === 0);
  if (sampled.length === 0) sampled.push(coordinates[0]);

  const around = sampled
    .map(([lng, lat]) => `around:${radiusM},${lat},${lng}`)
    .join(';');

  // Build a query matching real, commonly-mapped OSM rest-facility tags.
  const query = `
    [out:json][timeout:20];
    (
      ${sampled.map(([lng, lat]) => `node["amenity"="bench"](around:${radiusM},${lat},${lng});`).join('\n      ')}
      ${sampled.map(([lng, lat]) => `node["amenity"="shelter"](around:${radiusM},${lat},${lng});`).join('\n      ')}
      ${sampled.map(([lng, lat]) => `node["highway"="rest_area"](around:${radiusM},${lat},${lng});`).join('\n      ')}
      ${sampled.map(([lng, lat]) => `node["amenity"="toilets"](around:${radiusM},${lat},${lng});`).join('\n      ')}
      ${sampled.map(([lng, lat]) => `node["amenity"="drinking_water"](around:${radiusM},${lat},${lng});`).join('\n      ')}
    );
    out body;
  `;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const elements: any[] = data.elements || [];

      return elements
        .filter((el) => el.type === 'node' && el.lat && el.lon)
        .map((el) => {
          const tags = el.tags || {};
          let type: RestStop['type'] = 'bench';
          if (tags.amenity === 'shelter') type = 'shelter';
          else if (tags.highway === 'rest_area') type = 'rest_area';
          else if (tags.amenity === 'toilets') type = 'toilets';
          else if (tags.amenity === 'drinking_water') type = 'drinking_water';

          return {
            id: el.id,
            lat: el.lat,
            lng: el.lon,
            type,
            name: tags.name,
            covered: tags.covered === 'yes' || tags.amenity === 'shelter',
          } as RestStop;
        })
        // de-dupe near-identical points across overlapping `around` circles
        .filter(
          (stop, i, arr) =>
            arr.findIndex((s) => Math.abs(s.lat - stop.lat) < 0.00005 && Math.abs(s.lng - stop.lng) < 0.00005) === i
        )
        .slice(0, 40);
    } catch {
      continue; // try next mirror
    }
  }
  return []; // both mirrors failed — caller shows no rest stops rather than fake ones
}
