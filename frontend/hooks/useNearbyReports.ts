'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getDeviceId } from '@/lib/deviceId';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface NearbyReport {
  id: string | number; issue_type: string; severity: string; description?: string;
  lat: number; lng: number; confirmations?: number; verified?: boolean;
}

// While live GPS tracking is on, look for open community reports within ~80 m and
// ask the walker "is this still a problem?". One tap = crowd verification, no admin needed.
export function useNearbyReports(pos: { lat: number; lng: number } | null) {
  const [prompt, setPrompt] = useState<NearbyReport | null>(null);
  const last = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const skipped = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!pos) return;
    const now = Date.now();
    const l = last.current;
    if (l) {
      const dLat = (pos.lat - l.lat) * 111320;
      const dLng = (pos.lng - l.lng) * 111320 * Math.cos((pos.lat * Math.PI) / 180);
      if (Math.hypot(dLat, dLng) < 40 && now - l.t < 60000) return;   // not moved enough
      if (now - l.t < 15000) return;                                   // be gentle on the server
    }
    last.current = { lat: pos.lat, lng: pos.lng, t: now };
    fetch(`${API}/reports/nearby?lat=${pos.lat}&lng=${pos.lng}&radius_m=80&device_id=${encodeURIComponent(getDeviceId())}`, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: NearbyReport[]) => {
        const next = list.find((r) => !skipped.current.has(String(r.id)));
        setPrompt((cur) => cur ?? next ?? null);
      })
      .catch(() => {});
  }, [pos?.lat, pos?.lng]);

  const answer = useCallback(async (stillPresent: boolean) => {
    if (!prompt || !pos) return { ok: false, message: 'no position' };
    try {
      const res = await fetch(`${API}/reports/${prompt.id}/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: getDeviceId(), still_present: stillPresent, lat: pos.lat, lng: pos.lng }),
      });
      const data = await res.json().catch(() => ({}));
      skipped.current.add(String(prompt.id));
      setPrompt(null);
      return { ok: res.ok, message: res.ok ? (data.verified ? 'Verified by the community ✅' : 'Thanks — recorded') : (data.detail || 'Could not record') };
    } catch {
      return { ok: false, message: 'Network error' };
    }
  }, [prompt, pos]);

  const skip = useCallback(() => {
    if (prompt) skipped.current.add(String(prompt.id));
    setPrompt(null);
  }, [prompt]);

  return { prompt, answer, skip };
}
