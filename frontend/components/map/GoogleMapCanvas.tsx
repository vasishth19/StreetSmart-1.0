'use client';

import { useEffect, useRef, useState } from 'react';
import type { RouteResult } from '@/services/api';
import type { BlackSpotReport } from './MapCanvas';
import { loadGoogleMaps } from '@/services/googleMapsLoader';
import { GOOGLE_DARK_STYLE } from './googleMapStyle';

interface GoogleMapCanvasProps {
  selectedRoute: RouteResult | null;
  routes: RouteResult[];
  showHeatmap: boolean;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  onRouteSelect: (route: RouteResult) => void;
  blackSpots?: BlackSpotReport[];
  showBlackSpots?: boolean;
  restStops?: { id: number; lat: number; lng: number; type: string; name?: string }[];
  livePosition?: { lat: number; lng: number; heading: number | null } | null;
}

const ROUTE_COLORS = ['#00FF9C', '#00E5FF', '#B388FF', '#FFB020', '#FF6B6B'];
const UNSELECTED_OPACITY = 0.45;

function pinSvg(color: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
    <path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 30 14 30S32 26 32 16C32 8.268 25.732 2 18 2z" fill="${color}"/>
    <circle cx="18" cy="16" r="7" fill="white"/>
    <text x="18" y="20" text-anchor="middle" font-size="10" font-weight="bold" font-family="monospace" fill="${color}">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function dotSvg(color: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="10" fill="${color}" opacity="0.25"/>
    <circle cx="14" cy="14" r="6" fill="${color}"/>
    <circle cx="14" cy="14" r="3" fill="white"/>
    <text x="14" y="18" text-anchor="middle" font-size="8" font-weight="bold" font-family="monospace" fill="white">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function blackSpotSvg(color: string, emoji: string, elevated: boolean): string {
  const pulse = elevated ? `<circle cx="17" cy="17" r="15" fill="${color}" opacity="0.35">
      <animate attributeName="r" values="10;16;10" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.5;0.05;0.5" dur="1.8s" repeatCount="indefinite"/>
    </circle>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
    ${pulse}
    <circle cx="17" cy="17" r="10" fill="${color}" stroke="#05080F" stroke-width="2"/>
    <text x="17" y="22" text-anchor="middle" font-size="12">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function restStopSvg(type: string): string {
  const EMOJI: Record<string, string> = { bench: '🪑', shelter: '🏠', rest_area: '🛑', toilets: '🚻', drinking_water: '🚰' };
  const emoji = EMOJI[type] || '🪑';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="#8892B0" opacity="0.18"/>
    <circle cx="12" cy="12" r="8" fill="#0B1120" stroke="#8892B0" stroke-width="1.5"/>
    <text x="12" y="16" text-anchor="middle" font-size="10">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function liveSvg(heading: number | null): string {
  const rotate = heading != null ? `transform: rotate(${heading}deg);` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
    <circle cx="17" cy="17" r="15" fill="#00E5FF" opacity="0.3">
      <animate attributeName="r" values="10;15;10" dur="1.6s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.5;0.05;0.5" dur="1.6s" repeatCount="indefinite"/>
    </circle>
    <g style="${rotate}transform-origin:17px 17px;">
      <path d="M17 7 L23 24 L17 20 L11 24 Z" fill="#00E5FF" stroke="#05080F" stroke-width="1"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function routePath(route: any, origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) {
  if (Array.isArray(route.coordinates) && route.coordinates.length) {
    // backend gives [[lng, lat], ...]
    return route.coordinates.map((pt: number[]) => ({ lat: pt[1], lng: pt[0] }));
  }
  return [origin, destination];
}

export default function GoogleMapCanvas({
  selectedRoute, routes, showHeatmap, origin, destination, onRouteSelect,
  blackSpots = [], showBlackSpots = false, restStops = [], livePosition = null,
}: GoogleMapCanvasProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const originMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const waypointMarkersRef = useRef<any[]>([]);
  const blackSpotMarkersRef = useRef<any[]>([]);
  const restStopMarkersRef = useRef<any[]>([]);
  const liveMarkerRef = useRef<any>(null);
  const heatmapRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // ── Init map ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    if (!apiKey) { setError('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set — add it to your .env to enable real Google Maps.'); return; }

    loadGoogleMaps(apiKey)
      .then(() => {
        if (!mapRef.current || mapInstance.current) return;
        const google = window.google;
        const map = new google.maps.Map(mapRef.current, {
          center: origin,
          zoom: 14,
          styles: GOOGLE_DARK_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          gestureHandling: 'greedy',
        });
        infoWindowRef.current = new google.maps.InfoWindow();
        mapInstance.current = map;
        setMapReady(true);
      })
      .catch((e) => setError(e.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // ── Origin / destination markers ───────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const google = window.google;
    originMarkerRef.current?.setMap(null);
    originMarkerRef.current = new google.maps.Marker({
      position: origin, map: mapInstance.current,
      icon: { url: pinSvg('#00FF9C', 'A'), scaledSize: new google.maps.Size(36, 48), anchor: new google.maps.Point(18, 48) },
      title: 'Your Location', zIndex: 999,
    });
  }, [mapReady, origin.lat, origin.lng]);

  useEffect(() => {
    if (!mapReady) return;
    const google = window.google;
    destMarkerRef.current?.setMap(null);
    destMarkerRef.current = null;
    const isSame = Math.abs(destination.lat - origin.lat) < 0.001 && Math.abs(destination.lng - origin.lng) < 0.001;
    if (isSame) return;
    destMarkerRef.current = new google.maps.Marker({
      position: destination, map: mapInstance.current,
      icon: { url: pinSvg('#FF3B3B', 'B'), scaledSize: new google.maps.Size(36, 48), anchor: new google.maps.Point(18, 48) },
      title: 'Destination', zIndex: 998,
    });
  }, [mapReady, destination.lat, destination.lng, origin.lat, origin.lng]);

  // ── Fit bounds ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const google = window.google;
    const map = mapInstance.current;
    const isSame = Math.abs(destination.lat - origin.lat) < 0.001 && Math.abs(destination.lng - origin.lng) < 0.001;
    if (isSame) { map.setCenter(origin); map.setZoom(14); }
    else {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(origin); bounds.extend(destination);
      map.fitBounds(bounds, 60);
    }
  }, [mapReady, origin.lat, origin.lng, destination.lat, destination.lng]);

  // ── Route polylines ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const google = window.google;
    const map = mapInstance.current;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    if (!routes.length) return;

    routes.forEach((route, idx) => {
      const isSelected = selectedRoute?.id === route.id;
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
      const path = routePath(route, origin, destination);

      const shadow = new google.maps.Polyline({
        path, map, strokeColor: color,
        strokeWeight: isSelected ? 14 : 0, strokeOpacity: isSelected ? 0.15 : 0, zIndex: 1,
      });
      const line = new google.maps.Polyline({
        path, map, strokeColor: color,
        strokeWeight: isSelected ? 5 : 3, strokeOpacity: isSelected ? 0.92 : UNSELECTED_OPACITY, zIndex: 2,
      });
      line.addListener('click', () => onRouteSelect(route));
      shadow.addListener('click', () => onRouteSelect(route));
      polylinesRef.current.push(shadow, line);
    });
  }, [mapReady, routes, selectedRoute, origin, destination]);

  // ── Waypoint markers ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const google = window.google;
    waypointMarkersRef.current.forEach((m) => m.setMap(null));
    waypointMarkersRef.current = [];
    if (!selectedRoute?.waypoints?.length) return;

    (selectedRoute.waypoints as any[]).forEach((wp, i) => {
      const lat = wp.lat ?? wp[0]; const lng = wp.lng ?? wp[1];
      const marker = new google.maps.Marker({
        position: { lat, lng }, map: mapInstance.current,
        icon: { url: dotSvg('#00E5FF', `${i + 1}`), scaledSize: new google.maps.Size(28, 28), anchor: new google.maps.Point(14, 14) },
        title: wp.name ?? `Waypoint ${i + 1}`, zIndex: 50,
      });
      waypointMarkersRef.current.push(marker);
    });
  }, [mapReady, selectedRoute]);

  // ── Black spots ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const google = window.google;
    blackSpotMarkersRef.current.forEach((m) => m.setMap(null));
    blackSpotMarkersRef.current = [];
    if (!showBlackSpots || !blackSpots.length) return;

    blackSpots.forEach((spot) => {
      const elevated = spot.severity === 'high' || spot.severity === 'critical' || (spot.votes ?? 0) >= 3;
      const color = spot.severity === 'critical' ? '#FF0000' : spot.severity === 'high' ? '#FF3B3B' : spot.severity === 'medium' ? '#FFB020' : '#00FF9C';
      const hour = (() => { try { return new Date(spot.created_at).getHours(); } catch { return -1; } })();
      const isNight = hour >= 22 || hour < 6;

      const marker = new google.maps.Marker({
        position: { lat: spot.lat, lng: spot.lng }, map: mapInstance.current,
        icon: { url: blackSpotSvg(color, '⚠️', elevated), scaledSize: new google.maps.Size(34, 34), anchor: new google.maps.Point(17, 17) },
        title: spot.address || spot.issue_type, zIndex: elevated ? 400 : 200,
      });
      marker.addListener('click', () => {
        infoWindowRef.current.setContent(`
          <div style="font-family:monospace;font-size:11px;min-width:160px;color:#0B1020">
            <div style="font-weight:bold;text-transform:capitalize;margin-bottom:2px;">${spot.issue_type.replace(/_/g, ' ')}</div>
            <div style="color:${color};font-weight:bold;text-transform:uppercase;font-size:10px;">${spot.severity} severity${elevated ? ' · BLACK SPOT' : ''}</div>
            ${isNight ? '<div style="color:#7B2FBE;font-size:10px;margin-top:2px;">🌙 Reported during night hours</div>' : ''}
            ${spot.address ? `<div style="margin-top:4px;color:#444;">${spot.address}</div>` : ''}
          </div>`);
        infoWindowRef.current.open(mapInstance.current, marker);
      });
      blackSpotMarkersRef.current.push(marker);
    });
  }, [mapReady, blackSpots, showBlackSpots]);

  // ── Rest stops (real OSM data) ──────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const google = window.google;
    restStopMarkersRef.current.forEach((m) => m.setMap(null));
    restStopMarkersRef.current = [];

    restStops.forEach((stop) => {
      const marker = new google.maps.Marker({
        position: { lat: stop.lat, lng: stop.lng }, map: mapInstance.current,
        icon: { url: restStopSvg(stop.type), scaledSize: new google.maps.Size(24, 24), anchor: new google.maps.Point(12, 12) },
        title: stop.name || stop.type.replace(/_/g, ' '), zIndex: 100,
      });
      marker.addListener('click', () => {
        infoWindowRef.current.setContent(`<div style="font-family:monospace;font-size:11px;color:#0B1020;text-transform:capitalize">${stop.name || stop.type.replace(/_/g, ' ')}</div>`);
        infoWindowRef.current.open(mapInstance.current, marker);
      });
      restStopMarkersRef.current.push(marker);
    });
  }, [mapReady, restStops]);

  // ── Live GPS position ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const google = window.google;
    if (!livePosition) { liveMarkerRef.current?.setMap(null); liveMarkerRef.current = null; return; }

    if (liveMarkerRef.current) {
      liveMarkerRef.current.setPosition({ lat: livePosition.lat, lng: livePosition.lng });
      liveMarkerRef.current.setIcon({ url: liveSvg(livePosition.heading), scaledSize: new google.maps.Size(34, 34), anchor: new google.maps.Point(17, 17) });
    } else {
      liveMarkerRef.current = new google.maps.Marker({
        position: { lat: livePosition.lat, lng: livePosition.lng }, map: mapInstance.current,
        icon: { url: liveSvg(livePosition.heading), scaledSize: new google.maps.Size(34, 34), anchor: new google.maps.Point(17, 17) },
        title: 'Your live position', zIndex: 1000,
      });
    }
  }, [mapReady, livePosition]);

  // ── Heatmap (real Google visualization library) ─────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const google = window.google;
    if (heatmapRef.current) { heatmapRef.current.setMap(null); heatmapRef.current = null; }
    if (!showHeatmap || !google.maps.visualization) return;

    const points: any[] = [];
    routes.forEach((route) => {
      const pts = (route as any).waypoints ?? [];
      pts.forEach((pt: any) => {
        const lat = pt.lat ?? pt[0]; const lng = pt.lng ?? pt[1];
        points.push(new google.maps.LatLng(lat, lng));
      });
    });
    if (!points.length) {
      for (let i = 0; i < 30; i++) {
        points.push(new google.maps.LatLng(origin.lat + (Math.random() - 0.5) * 0.02, origin.lng + (Math.random() - 0.5) * 0.02));
      }
    }
    heatmapRef.current = new google.maps.visualization.HeatmapLayer({ data: points, map: mapInstance.current, radius: 30 });
  }, [mapReady, showHeatmap, routes, origin]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#05080F] text-center p-8">
        <div className="max-w-sm space-y-3">
          <div className="text-4xl">🗺️</div>
          <p className="text-[#FF3B3B] font-mono text-sm font-bold">Google Maps not configured</p>
          <p className="text-[#8892B0] text-xs font-mono leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      {!mapReady && (
        <div className="absolute inset-0 bg-[#05080F] flex items-center justify-center z-10">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#00FF9C]/20 border-t-[#00FF9C] rounded-full animate-spin mx-auto" />
            <p className="text-[#8892B0] text-xs font-mono">Loading Google Maps...</p>
          </div>
        </div>
      )}
    </div>
  );
}
