'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { RouteRequest, RouteResult, DataQuality } from '@/services/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Real weather from Open-Meteo (free, no API key) — appended to route warnings.
async function fetchWeather(lat: number, lng: number): Promise<string[]> {
  const warnings: string[] = [];
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,rain,weathercode,windspeed_10m&forecast_days=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    const precip = data.current?.precipitation || 0;
    const rain = data.current?.rain || 0;
    const code = data.current?.weathercode || 0;
    const wind = data.current?.windspeed_10m || 0;
    if (precip > 5 || rain > 2) warnings.push('🌧️ Heavy rain — flooding possible on low-lying roads');
    else if (precip > 0.5) warnings.push('🌦️ Light rain — wet surfaces, carry umbrella');
    if (code >= 95) warnings.push('⛈️ Thunderstorm alert — avoid open areas');
    if (wind > 50) warnings.push('💨 Strong winds — avoid exposed routes');
  } catch {}
  return warnings;
}

// ── Emergency fallback if OUR backend is unreachable ────────────────────────
// Still real routes on the right network. IMPORTANT: the public OSRM demo
// (router.project-osrm.org) ignores the profile and returns CAR routes, so we use
// the FOSSGIS servers whose path prefix (routed-foot / routed-bike / routed-car)
// really selects the profile. No safety scores are invented in this mode.
const FALLBACK: Record<string, { osrm: 'foot' | 'bike' | 'car'; kmh: number | null; label: string }> = {
  walking:    { osrm: 'foot', kmh: 5.0,  label: 'Walking' },
  wheelchair: { osrm: 'foot', kmh: 3.6,  label: 'Wheelchair' },
  cycling:    { osrm: 'bike', kmh: 14,   label: 'Bicycle' },
  motorcycle: { osrm: 'car',  kmh: null, label: 'Motorbike' },
  car:        { osrm: 'car',  kmh: null, label: 'Car' },
  ambulance:  { osrm: 'car',  kmh: null, label: 'Ambulance' },
  fire:       { osrm: 'car',  kmh: null, label: 'Fire brigade' },
  police:     { osrm: 'car',  kmh: null, label: 'Police' },
};

async function fallbackRoutes(
  origin: { lat: number; lng: number }, dest: { lat: number; lng: number }, mode: string,
): Promise<RouteResult[]> {
  const f = FALLBACK[mode] ?? FALLBACK.walking;
  const url = `https://routing.openstreetmap.de/routed-${f.osrm}/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson&alternatives=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error('No route');
  const dq: DataQuality = {
    osm_status: 'unavailable', community_status: 'unavailable', traffic_source: 'none', routing_provider: 'osrm-fossgis (offline mode)',
    lighting_coverage_pct: 0, surface_coverage_pct: 0, safety_evidence_pct: 0, community_reports_used: 0,
    notes: ['StreetSmart server unreachable — showing plain routes. Safety, lighting and traffic analysis is unavailable right now.'],
  };
  const colors = ['#00E5FF', '#FFB020', '#B388FF'];
  return data.routes.slice(0, 3).map((r: any, i: number) => {
    const km = r.distance / 1000;
    const min = f.kmh ? (km / f.kmh) * 60 : r.duration / 60;
    return {
      id: `fallback-${i}-${Date.now()}`, name: i === 0 ? 'Fastest' : `Alternative ${i}`,
      description: `${km.toFixed(1)} km · basic route (analysis unavailable)`,
      coordinates: r.geometry.coordinates, segments: [],
      scores: { overall: 50, safety: 50, lighting: 50, crowd: 50, accessibility: 50, risk_level: 'MEDIUM' },
      distance_km: parseFloat(km.toFixed(2)), duration_min: Math.round(min), waypoints: [origin, dest],
      audio_instructions: [`Starting ${f.label.toLowerCase()} navigation. ${km.toFixed(1)} kilometres.`, 'You have arrived at your destination.'],
      warnings: [], highlights: [], color: colors[i % 3], rank: i + 1, mode,
      eta: { mode, mode_label: f.label, speed_basis: f.kmh ? `${f.kmh} km/h × distance` : 'free-flow road speed, no traffic', moving_min: Math.round(min), delay_min: 0, total_min: Math.round(min), traffic_source: 'none' },
      hazards: [], why: [], draw_style: ['walking', 'wheelchair'].includes(mode) ? 'dotted' : 'solid', data_quality: dq,
    } as RouteResult;
  });
}

export interface RouteMeta { is_night: boolean; data_quality?: DataQuality; mode?: string }

export function useRoutes() {
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<RouteMeta | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqSeq = useRef(0);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const call = useCallback(async (request: RouteRequest, mode: string) => {
    const body = {
      ...request,
      preferences: { ...(request.preferences || {}), travel_mode: mode, departure_time: new Date().toISOString() },
    };
    const res = await fetch(`${API}/routes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(70000),
    });
    if (!res.ok) {
      let detail = `Server returned ${res.status}`;
      try { detail = (await res.json()).detail || detail; } catch {}
      throw new Error(detail);
    }
    return res.json();
  }, []);

  const fetchRoutes = useCallback(async (request: RouteRequest, travelMode: string = 'walking') => {
    const seq = ++reqSeq.current;
    if (timer.current) clearTimeout(timer.current);
    setLoading(true); setError(null); setRefining(false);
    const { origin, destination } = request;
    try {
      const [data, weather] = await Promise.all([call(request, travelMode), fetchWeather(origin.lat, origin.lng)]);
      if (seq !== reqSeq.current) return;
      const list: RouteResult[] = data.routes.map((r: RouteResult) => ({ ...r, warnings: [...weather, ...(r.warnings || [])] }));
      setRoutes(list);
      setMeta({ is_night: data.is_night, data_quality: data.data_quality, mode: data.mode });

      // OpenStreetMap street data still downloading on the server? Refresh quietly (max 2×).
      let attempts = 0;
      const refine = async () => {
        if (seq !== reqSeq.current || attempts >= 2) { setRefining(false); return; }
        attempts++; setRefining(true);
        try {
          const d2 = await call(request, travelMode);
          if (seq !== reqSeq.current) return;
          const l2: RouteResult[] = d2.routes.map((r: RouteResult) => ({ ...r, warnings: [...weather, ...(r.warnings || [])] }));
          setRoutes(l2);
          setMeta({ is_night: d2.is_night, data_quality: d2.data_quality, mode: d2.mode });
          if (d2.data_quality?.osm_status === 'warming') timer.current = setTimeout(refine, 15000);
          else setRefining(false);
        } catch { setRefining(false); }
      };
      if (data.data_quality?.osm_status === 'warming') timer.current = setTimeout(refine, 15000);
    } catch (err: any) {
      if (seq !== reqSeq.current) return;
      try {
        const fb = await fallbackRoutes(origin, destination, travelMode);
        setRoutes(fb);
        setMeta({ is_night: false, data_quality: fb[0].data_quality, mode: travelMode });
        setError('Server unreachable — showing basic routes without safety analysis');
      } catch {
        setRoutes([]);
        setError(err?.message || 'Could not find a route');
      }
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [call]);

  const clearRoutes = useCallback(() => {
    reqSeq.current++;
    if (timer.current) clearTimeout(timer.current);
    setRoutes([]); setError(null); setMeta(null); setRefining(false);
  }, []);

  return { routes, loading, refining, error, meta, fetchRoutes, clearRoutes };
}
