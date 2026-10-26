'use client';

import { useEffect, useRef, useState } from 'react';
import type { ParkingSpot } from '@/services/api';

declare global {
  interface Window {
    L: any;
    _leafletLoaded: boolean;
  }
}

interface ParkingMapProps {
  center: { lat: number; lng: number };
  spots: ParkingSpot[];
  selectedSpotId?: string | null;
  onSpotClick?: (spot: ParkingSpot) => void;
  height?: number;
}

const STATUS_COLOR: Record<string, string> = {
  available: '#00FF9C',
  occupied:  '#FF3B3B',
  reserved:  '#FFB020',
  disabled:  '#4A5568',
};

function loadLeaflet(): Promise<void> {
  if (window._leafletLoaded && window.L) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (document.getElementById('leaflet-js')) {
      const check = setInterval(() => { if (window.L) { clearInterval(check); resolve(); } }, 100);
      return;
    }
    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => { window._leafletLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Leaflet'));
    document.head.appendChild(script);
  });
}

function makeSpotIcon(L: any, color: string, selected: boolean): any {
  const size = selected ? 26 : 18;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
      ${selected ? `<circle cx="12" cy="12" r="11" fill="${color}" opacity="0.25"><animate attributeName="r" values="8;11;8" dur="1.6s" repeatCount="indefinite"/></circle>` : ''}
      <circle cx="12" cy="12" r="7" fill="${color}" stroke="#05080F" stroke-width="2"/>
      <text x="12" y="16" text-anchor="middle" font-size="9">🅿️</text>
    </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function makeCenterIcon(L: any): any {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="9" fill="#00E5FF" opacity="0.3">
        <animate attributeName="r" values="6;9;6" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="10" cy="10" r="5" fill="#00E5FF" stroke="#05080F" stroke-width="2"/>
    </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [20, 20], iconAnchor: [10, 10] });
}

export default function ParkingMap({ center, spots, selectedSpotId, onSpotClick, height = 320 }: ParkingMapProps) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance  = useRef<any>(null);
  const markersRef   = useRef<any[]>([]);
  const centerMarkerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Init map once
  useEffect(() => {
    if (!mapRef.current) return;
    loadLeaflet().then(() => {
      if (!mapRef.current || mapInstance.current) return;
      const L = window.L;
      const map = L.map(mapRef.current, {
        center: [center.lat, center.lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: true,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      const attrEl = map.getContainer().querySelector('.leaflet-control-attribution') as HTMLElement;
      if (attrEl) attrEl.style.cssText = 'background:#05080F!important;color:#4A5568!important;font-size:9px;';
      mapInstance.current = map;
      setMapReady(true);
    });
    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center when the search/GPS location changes
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    mapInstance.current.setView([center.lat, center.lng], 15);
    const L = window.L;
    centerMarkerRef.current?.remove();
    centerMarkerRef.current = L.marker([center.lat, center.lng], {
      icon: makeCenterIcon(L), zIndexOffset: 999, title: 'You are here',
    }).addTo(mapInstance.current);
  }, [mapReady, center.lat, center.lng]);

  // Render spot markers
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    const L = window.L;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    spots.forEach((spot) => {
      const color = STATUS_COLOR[spot.status] ?? '#8892B0';
      const marker = L.marker([spot.lat, spot.lng], {
        icon: makeSpotIcon(L, color, spot.id === selectedSpotId),
        zIndexOffset: spot.id === selectedSpotId ? 500 : 100,
      }).addTo(mapInstance.current);

      marker.bindPopup(`
        <div style="font-family:monospace;font-size:11px;min-width:140px;color:#0B1020">
          <div style="font-weight:bold;margin-bottom:2px;">${spot.label}</div>
          <div style="color:${color};font-weight:bold;text-transform:uppercase;font-size:10px;">${spot.status}</div>
          <div style="margin-top:4px;">₹${spot.current_price_per_hour.toFixed(0)}/hr</div>
        </div>
      `);
      if (onSpotClick) marker.on('click', () => onSpotClick(spot));
      markersRef.current.push(marker);
    });
  }, [mapReady, spots, selectedSpotId, onSpotClick]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-[#00E5FF]/15" style={{ height }}>
      <div ref={mapRef} className="w-full h-full" />
      {!mapReady && (
        <div className="absolute inset-0 bg-[#05080F] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#00FF9C]/20 border-t-[#00FF9C] rounded-full animate-spin" />
        </div>
      )}
      <style>{`
        .leaflet-container { background: #05080F !important; }
        .leaflet-control-zoom a { background: #0B1020 !important; border: 1px solid #1a2a4a !important; color: #8892B0 !important; }
        .leaflet-control-zoom a:hover { background: #1a2a4a !important; color: #00FF9C !important; }
        .leaflet-div-icon { background: transparent !important; border: none !important; }
      `}</style>
    </div>
  );
}
