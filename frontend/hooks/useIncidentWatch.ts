'use client';

import { useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface PulseLatest { type: string; severity: string; created_at: string; simulated: boolean }

// Watches the area around the selected route. Every ~25 s it asks the server for a digest of
// all ACTIVE incidents there. If the digest changes (new report, confirmation, verification,
// resolution, expiry) `changeTick` increments so the page can silently re-score the routes.
// Polling (not WebSockets) so it works on free hosting with zero extra setup.
export function useIncidentWatch(coords: number[][] | undefined, enabled: boolean, intervalMs = 25000) {
  const [changeTick, setChangeTick] = useState(0);
  const [latest, setLatest] = useState<PulseLatest | null>(null);
  const baseline = useRef<string | null>(null);

  const key = coords && coords.length ? `${coords[0][0]},${coords[0][1]},${coords.length},${coords[coords.length - 1][0]}` : '';

  useEffect(() => {
    baseline.current = null;
    if (!enabled || !coords || coords.length < 2) return;
    const lats = coords.map((c) => c[1]);
    const lngs = coords.map((c) => c[0]);
    const pad = 0.002; // ≈ 200 m
    const qs = `min_lat=${Math.min(...lats) - pad}&min_lng=${Math.min(...lngs) - pad}&max_lat=${Math.max(...lats) + pad}&max_lng=${Math.max(...lngs) + pad}`;
    let stop = false;

    const poll = async () => {
      if (stop || document.hidden) return;
      try {
        const r = await fetch(`${API}/incidents/pulse?${qs}`, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) return;
        const d = await r.json();
        if (baseline.current === null) { baseline.current = d.digest; return; }
        if (d.digest !== baseline.current) {
          baseline.current = d.digest;
          setLatest(d.latest);
          setChangeTick((t) => t + 1);
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, intervalMs);
    return () => { stop = true; clearInterval(id); };
  }, [key, enabled, intervalMs]);

  return { changeTick, latest };
}
