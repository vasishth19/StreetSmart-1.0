'use client';

import { useEffect, useRef, useState } from 'react';
import type { RouteResult } from '@/services/api';
// ─── Install these packages ───────────────────────────────────────────────────
// npm install leaflet leaflet.heat @types/leaflet
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    L: any;
    _leafletLoaded: boolean;
  }
}

interface MapCanvasProps {
  selectedRoute: RouteResult | null;
  routes: RouteResult[];
  showHeatmap: boolean;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  onRouteSelect: (route: RouteResult) => void;
  blackSpots?: BlackSpotReport[];
  showBlackSpots?: boolean;
}

export interface BlackSpotReport {
  id?: string | number;
  lat: number;
  lng: number;
  issue_type: string;
  severity: string;
  description?: string;
  address?: string;
  votes?: number;
  created_at: string;
}

// ─── Route color palette (matches your existing theme) ───────────────────────
const ROUTE_COLORS = ['#00FF9C', '#00E5FF', '#B388FF', '#FFB020', '#FF6B6B'];
const UNSELECTED_OPACITY = 0.45;

// ─── Load Leaflet + leaflet.heat from CDN (no billing, no API key) ────────────
function loadLeaflet(): Promise<void> {
  if (window._leafletLoaded && window.L) return Promise.resolve();

  return new Promise((resolve, reject) => {
    // Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (document.getElementById('leaflet-js')) {
      const check = setInterval(() => {
        if (window.L) { clearInterval(check); resolve(); }
      }, 100);
      return;
    }

    // Leaflet JS
    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      // leaflet.heat plugin (for heatmap support)
      const heatScript = document.createElement('script');
      heatScript.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
      heatScript.onload = () => { window._leafletLoaded = true; resolve(); };
      heatScript.onerror = () => { window._leafletLoaded = true; resolve(); }; // heatmap optional
      document.head.appendChild(heatScript);
    };
    script.onerror = () => reject(new Error('Failed to load Leaflet'));
    document.head.appendChild(script);
  });
}

// ─── Custom SVG marker (same design as your Google Maps version) ──────────────
function makeMarkerIcon(L: any, color: string, label: string): any {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
      <defs>
        <filter id="shadow">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="${color}" flood-opacity="0.5"/>
        </filter>
      </defs>
      <path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 30 14 30S32 26 32 16C32 8.268 25.732 2 18 2z"
            fill="${color}" filter="url(#shadow)"/>
      <circle cx="18" cy="16" r="7" fill="white"/>
      <text x="18" y="20" text-anchor="middle" font-size="10" font-weight="bold"
            font-family="monospace" fill="${color}">${label}</text>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -48],
  });
}

function makeDotIcon(L: any, color: string, label: string): any {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="10" fill="${color}" opacity="0.25"/>
      <circle cx="14" cy="14" r="6" fill="${color}"/>
      <circle cx="14" cy="14" r="3" fill="white"/>
      <text x="14" y="18" text-anchor="middle" font-size="8" font-weight="bold"
            font-family="monospace" fill="white">${label}</text>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function makeBlackSpotIcon(L: any, color: string, emoji: string, elevated: boolean): any {
  const pulse = elevated ? `
      <circle cx="17" cy="17" r="15" fill="${color}" opacity="0.35">
        <animate attributeName="r" values="10;16;10" dur="1.8s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0.05;0.5" dur="1.8s" repeatCount="indefinite"/>
      </circle>` : '';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
      ${pulse}
      <circle cx="17" cy="17" r="10" fill="${color}" stroke="#05080F" stroke-width="2"/>
      <text x="17" y="22" text-anchor="middle" font-size="12">${emoji}</text>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

// ─── Dark tile layer (matches app theme) ─────────────────────────────────────
// Using CartoDB Dark Matter — free, no API key required
const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export default function MapCanvas({
  selectedRoute,
  routes,
  showHeatmap,
  origin,
  destination,
  onRouteSelect,
  blackSpots = [],
  showBlackSpots = false,
}: MapCanvasProps) {
  const mapRef       = useRef<HTMLDivElement>(null);
  const mapInstance  = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const heatmapRef   = useRef<any>(null);
  const originMarkerRef  = useRef<any>(null);
  const destMarkerRef    = useRef<any>(null);
  const waypointMarkersRef = useRef<any[]>([]);
  const blackSpotMarkersRef = useRef<any[]>([]);
  const pulseRef     = useRef<HTMLDivElement | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // ── Initialize map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    loadLeaflet()
      .then(() => {
        if (!mapRef.current || mapInstance.current) return;
        const L = window.L;

        const map = L.map(mapRef.current, {
          center: [origin.lat, origin.lng],
          zoom: 14,
          zoomControl: false,
          attributionControl: true,
        });

        // Dark tile layer (CartoDB Dark Matter — free, no key)
        L.tileLayer(DARK_TILE_URL, {
          attribution: TILE_ATTRIBUTION,
          maxZoom: 19,
          subdomains: 'abcd',
        }).addTo(map);

        // Zoom control (right side to match your layout)
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Fix attribution style
        const attrEl = map.getContainer().querySelector('.leaflet-control-attribution') as HTMLElement;
        if (attrEl) {
          attrEl.style.cssText = 'background:#05080F!important;color:#4A5568!important;font-size:10px;';
        }

        mapInstance.current = map;
        setMapReady(true);
      })
      .catch((e) => setError(e.message));

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Origin marker + pulsing ring ───────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    const L = window.L;
    const map = mapInstance.current;

    originMarkerRef.current?.remove();

    const marker = L.marker([origin.lat, origin.lng], {
      icon: makeMarkerIcon(L, '#00FF9C', 'A'),
      zIndexOffset: 999,
      title: 'Your Location',
    }).addTo(map);

    originMarkerRef.current = marker;
  }, [mapReady, origin.lat, origin.lng]);

  // ── Destination marker ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    const L = window.L;

    destMarkerRef.current?.remove();
    destMarkerRef.current = null;

    const isSame =
      Math.abs(destination.lat - origin.lat) < 0.001 &&
      Math.abs(destination.lng - origin.lng) < 0.001;
    if (isSame) return;

    const marker = L.marker([destination.lat, destination.lng], {
      icon: makeMarkerIcon(L, '#FF3B3B', 'B'),
      zIndexOffset: 998,
      title: 'Destination',
    }).addTo(mapInstance.current);

    destMarkerRef.current = marker;
  }, [mapReady, destination.lat, destination.lng, origin.lat, origin.lng]);

  // ── Fit bounds when origin/destination change ──────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    const L = window.L;
    const map = mapInstance.current;

    const isSame =
      Math.abs(destination.lat - origin.lat) < 0.001 &&
      Math.abs(destination.lng - origin.lng) < 0.001;

    if (isSame) {
      map.setView([origin.lat, origin.lng], 14);
    } else {
      const bounds = L.latLngBounds(
        [origin.lat, origin.lng],
        [destination.lat, destination.lng]
      );
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [mapReady, origin.lat, origin.lng, destination.lat, destination.lng]);

  // ── Draw route polylines ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    const L = window.L;
    const map = mapInstance.current;

    // Clear old polylines
    polylinesRef.current.forEach((p) => p.remove());
    polylinesRef.current = [];

    if (!routes.length) return;

    routes.forEach((route, idx) => {
      const isSelected = selectedRoute?.id === route.id;
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];

      // Decode path — supports encoded polyline string, GeoJSON-style arrays,
      // or the StreetSmart backend's own `coordinates: [[lng, lat], ...]` field
      let path: [number, number][] = [];

      const routeGeometry = (route as any).geometry;
      if (routeGeometry) {
        if (typeof routeGeometry === 'string') {
          // Decode Google-encoded polyline manually (no Google lib needed)
          path = decodePolyline(routeGeometry);
        } else if (Array.isArray(routeGeometry)) {
          path = (routeGeometry as any[]).map((pt: any) =>
            Array.isArray(pt)
              ? [pt[1], pt[0]] as [number, number]   // GeoJSON [lng, lat]
              : [pt.lat ?? pt.latitude, pt.lng ?? pt.longitude] as [number, number]
          );
        }
      }

      if (!path.length && Array.isArray((route as any).coordinates)) {
        // Backend RouteResult.coordinates is [[lng, lat], ...]
        path = (route as any).coordinates.map(
          (pt: number[]) => [pt[1], pt[0]] as [number, number]
        );
      }

      if (!path.length) {
        path = [
          [origin.lat, origin.lng],
          [destination.lat, destination.lng],
        ];
      }

      // Glow/shadow polyline
      const shadow = L.polyline(path, {
        color,
        weight: isSelected ? 14 : 0,
        opacity: isSelected ? 0.15 : 0,
        interactive: false,
      }).addTo(map);

      // Main route line
      const line = L.polyline(path, {
        color,
        weight: isSelected ? 5 : 3,
        opacity: isSelected ? 0.92 : UNSELECTED_OPACITY,
        dashArray: isSelected ? undefined : undefined,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      line.on('click', () => onRouteSelect(route));
      shadow.on('click', () => onRouteSelect(route));

      // Direction arrow (selected route only)
      if (isSelected && path.length > 1) {
        const mid = Math.floor(path.length / 2);
        const arrowDecorator = createArrowDecorator(L, map, path[mid], path[Math.min(mid + 1, path.length - 1)], color);
        polylinesRef.current.push(arrowDecorator);
      }

      polylinesRef.current.push(shadow, line);
    });
  }, [mapReady, routes, selectedRoute, origin, destination]);

  // ── Heatmap overlay ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    const L = window.L;

    if (heatmapRef.current) {
      heatmapRef.current.remove();
      heatmapRef.current = null;
    }

    if (!showHeatmap || !L.heatLayer) return;

    const heatPoints: [number, number, number][] = [];

    if (routes.length > 0) {
      routes.forEach((route) => {
        const pts = (route as any).waypoints ?? (route as any).heatmap_points ?? [];
        pts.forEach((pt: any) => {
          const lat = pt.lat ?? pt[0];
          const lng = pt.lng ?? pt[1];
          const intensity = pt.intensity ?? pt.weight ?? 0.6;
          heatPoints.push([lat, lng, intensity]);
        });
      });
    }

    // Fallback demo points
    if (!heatPoints.length) {
      for (let i = 0; i < 30; i++) {
        heatPoints.push([
          origin.lat + (Math.random() - 0.5) * 0.02,
          origin.lng + (Math.random() - 0.5) * 0.02,
          Math.random(),
        ]);
      }
    }

    const heat = L.heatLayer(heatPoints, {
      radius: 30,
      blur: 15,
      gradient: {
        0.0: 'rgba(0,229,255,0.4)',
        0.4: 'rgba(0,255,156,0.6)',
        0.7: 'rgba(255,176,32,0.8)',
        1.0: 'rgba(255,59,59,1)',
      },
    }).addTo(mapInstance.current);

    heatmapRef.current = heat;
  }, [mapReady, showHeatmap, routes, origin]);

  // ── Waypoint markers for selected route ───────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    const L = window.L;

    waypointMarkersRef.current.forEach((m) => m.remove());
    waypointMarkersRef.current = [];

    if (!selectedRoute?.waypoints?.length) return;

    selectedRoute.waypoints.forEach((wp: any, i: number) => {
      const lat = wp.lat ?? wp[0];
      const lng = wp.lng ?? wp[1];
      const marker = L.marker([lat, lng], {
        icon: makeDotIcon(L, '#00E5FF', `${i + 1}`),
        title: wp.name ?? `Waypoint ${i + 1}`,
        zIndexOffset: 50,
      }).addTo(mapInstance.current);
      waypointMarkersRef.current.push(marker);
    });
  }, [mapReady, selectedRoute]);

  // ── Community-reported black spots ─────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    const L = window.L;

    blackSpotMarkersRef.current.forEach((m) => m.remove());
    blackSpotMarkersRef.current = [];

    if (!showBlackSpots || !blackSpots.length) return;

    blackSpots.forEach((spot) => {
      const elevated = spot.severity === 'high' || spot.severity === 'critical' || (spot.votes ?? 0) >= 3;
      const color =
        spot.severity === 'critical' ? '#FF0000'
        : spot.severity === 'high'   ? '#FF3B3B'
        : spot.severity === 'medium' ? '#FFB020'
        : '#00FF9C';
      const hour = (() => { try { return new Date(spot.created_at).getHours(); } catch { return -1; } })();
      const isNight = hour >= 22 || hour < 6;

      const marker = L.marker([spot.lat, spot.lng], {
        icon: makeBlackSpotIcon(L, color, '⚠️', elevated),
        zIndexOffset: elevated ? 400 : 200,
        title: spot.address || spot.issue_type,
      }).addTo(mapInstance.current);

      marker.bindPopup(`
        <div style="font-family:monospace;font-size:11px;min-width:160px;color:#0B1020">
          <div style="font-weight:bold;text-transform:capitalize;margin-bottom:2px;">
            ${spot.issue_type.replace(/_/g, ' ')}
          </div>
          <div style="color:${color};font-weight:bold;text-transform:uppercase;font-size:10px;">
            ${spot.severity} severity${elevated ? ' · BLACK SPOT' : ''}
          </div>
          ${isNight ? '<div style="color:#7B2FBE;font-size:10px;margin-top:2px;">🌙 Reported during night hours</div>' : ''}
          ${spot.address ? `<div style="margin-top:4px;color:#444;">${spot.address}</div>` : ''}
        </div>
      `);

      blackSpotMarkersRef.current.push(marker);
    });

    return () => {
      blackSpotMarkersRef.current.forEach((m) => m.remove());
      blackSpotMarkersRef.current = [];
    };
  }, [mapReady, blackSpots, showBlackSpots]);

  // ─────────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#05080F] text-center p-8">
        <div className="max-w-sm space-y-3">
          <div className="text-4xl">🗺️</div>
          <p className="text-[#FF3B3B] font-mono text-sm font-bold">Map Error</p>
          <p className="text-[#8892B0] text-xs font-mono leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Leaflet map container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Loading overlay */}
      {!mapReady && (
        <div className="absolute inset-0 bg-[#05080F] flex items-center justify-center z-10">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#00FF9C]/20 border-t-[#00FF9C] rounded-full animate-spin mx-auto" />
            <p className="text-[#8892B0] text-xs font-mono">Initializing Map...</p>
          </div>
        </div>
      )}

      {/* Override Leaflet default styles to match dark theme */}
      <style>{`
        .leaflet-container { background: #05080F !important; }
        .leaflet-control-zoom a {
          background: #0B1020 !important;
          border: 1px solid #1a2a4a !important;
          color: #8892B0 !important;
        }
        .leaflet-control-zoom a:hover { background: #1a2a4a !important; color: #00FF9C !important; }
        .leaflet-control-attribution {
          background: #05080F !important;
          color: #4A5568 !important;
          font-size: 10px !important;
        }
        .leaflet-control-attribution a { color: #4A6C8C !important; }
        .leaflet-bar { border: 1px solid #1a2a4a !important; box-shadow: none !important; }
        /* Remove default marker styling since we use custom SVG */
        .leaflet-div-icon { background: transparent !important; border: none !important; }
      `}</style>
    </div>
  );
}

// ─── Pure-JS Google encoded polyline decoder (no Google SDK needed) ───────────
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// ─── Simple directional arrow marker at midpoint ──────────────────────────────
function createArrowDecorator(L: any, map: any, from: [number, number], to: [number, number], color: string) {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]) * (180 / Math.PI);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <polygon points="10,2 18,18 10,13 2,18" fill="${color}"
               transform="rotate(${angle + 90} 10 10)" opacity="0.9"/>
    </svg>`;
  const icon = L.divIcon({ html: svg, className: '', iconSize: [20, 20], iconAnchor: [10, 10] });
  return L.marker(from, { icon, interactive: false, zIndexOffset: 200 }).addTo(map);
}