'use client';

import { useCallback, useRef, useState } from 'react';

export interface LivePosition {
  lat: number;
  lng: number;
  heading: number | null;   // degrees, null if device can't report it
  speedKmh: number | null;  // real device speed, null if unavailable
  accuracyM: number;
  timestamp: number;
}

/**
 * Tracks the device's REAL GPS position in real time via
 * navigator.geolocation.watchPosition — no scripted/fake movement.
 * Used to show the actual live position of whoever is navigating
 * (pedestrian, cyclist, driver, or emergency vehicle operator).
 */
export function useLiveTracking() {
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('GPS is not available on this device/browser');
      return;
    }
    setError(null);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          speedKmh: pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6) : null,
          accuracyM: Math.round(pos.coords.accuracy),
          timestamp: pos.timestamp,
        });
      },
      (err) => setError(err.message || 'Unable to get live GPS position'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    watchIdRef.current = id;
    setTracking(true);
  }, []);

  const stop = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }, []);

  return { position, tracking, error, start, stop };
}
