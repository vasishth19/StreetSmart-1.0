'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Navigation, Mic, MicOff, Volume2, VolumeX, Layers,
  Shield, ArrowLeft, ChevronRight,
  MapPin, Accessibility, X, AlertTriangle,
  LocateFixed, Loader2,
} from 'lucide-react';
import GlowButton from '@/components/ui/GlowButton';
import NeonCard from '@/components/ui/NeonCard';
import RouteCard from '@/components/ui/RouteCard';
import HUDPanel from '@/components/ui/HUDPanel';
import PreferenceSelector from '@/components/ui/PreferenceSelector';
import VehicleModeSelector, { isFootMode } from '@/components/ui/VehicleModeSelector';
import MapLegend from '@/components/map/MapLegend';
import NearbyConfirm from '@/components/ui/NearbyConfirm';
import { useNearbyReports } from '@/hooks/useNearbyReports';
import { formatDuration } from '@/lib/format';
import DemoPanel from '@/components/ui/DemoPanel';
import { useIncidentWatch } from '@/hooks/useIncidentWatch';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useRoutes } from '@/hooks/useRoutes';
import { useSpeech } from '@/hooks/useSpeech';
import { useLiveTracking } from '@/hooks/useLiveTracking';
import { fetchRestStopsAlongRoute, type RestStop } from '@/services/reststops';
import { apiService } from '@/services/api';
import type { RouteResult } from '@/services/api';
import type { BlackSpotReport } from '@/components/map/MapCanvas';
import toast from 'react-hot-toast';

const LeafletMapCanvas = dynamic(() => import('@/components/map/MapCanvas'), { ssr: false });
// The map is always the free OpenStreetMap (Leaflet) canvas: dotted walking routes,
// traffic-coloured vehicle routes and hazard markers are drawn there.
const MapCanvas = LeafletMapCanvas;

// ✅ FIXED: Neutral India center — GPS will always override this
// No hardcoded city — works worldwide
const FALLBACK = { lat: 20.5937, lng: 78.9629 };

function useAccessibilityMode() {
  const [enabled, setEnabled] = useState(false);
  const toggle = useCallback(() => {
    setEnabled((v) => {
      const next = !v;
      if (next) document.documentElement.classList.add('a11y-mode');
      else      document.documentElement.classList.remove('a11y-mode');
      return next;
    });
  }, []);
  return { enabled, toggle };
}

function useVoiceRecognition(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Voice not supported in this browser'); return; }
    const rec = new SR();
    rec.lang            = 'en-US';
    rec.interimResults  = false;
    rec.maxAlternatives = 1;
    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onerror  = () => { setListening(false); toast.error('Voice error — try again'); };
    rec.onresult = (e: any) => onResult(e.results[0][0].transcript);
    rec.start();
    recRef.current = rec;
  }, [onResult]);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, startListening, stopListening };
}

async function searchPlaces(query: string): Promise<any[]> {
  if (query.length < 3) return [];

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

  if (MAPBOX_TOKEN.startsWith('pk.')) {
    try {
      const url  = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=6&types=place,address,poi,locality,neighborhood,district,region,country`;
      const data = await fetch(url).then((r) => r.json());
      return (data.features ?? []).map((f: any) => ({
        id:      f.id,
        display: f.place_name,
        lat:     f.center[1],
        lng:     f.center[0],
        type:    f.place_type?.[0] ?? 'place',
      }));
    } catch {}
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?` + new URLSearchParams({
      q:              query,
      format:         'json',
      limit:          '6',
      addressdetails: '1',
      'accept-language': 'en',
    });
    const res  = await fetch(url, { headers: { 'User-Agent': 'StreetSmart-Navigation-App/1.0' } });
    const data = await res.json();
    return data.map((item: any) => ({
      id:      item.place_id.toString(),
      display: item.display_name,
      lat:     parseFloat(item.lat),
      lng:     parseFloat(item.lon),
      type:    item.type ?? 'place',
    }));
  } catch {
    return [];
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
  if (MAPBOX_TOKEN.startsWith('pk.')) {
    try {
      const url  = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address,place`;
      const data = await fetch(url).then((r) => r.json());
      if (data.features?.[0]) return data.features[0].place_name;
    } catch {}
  }
  try {
    const url  = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`;
    const data = await fetch(url, { headers: { 'User-Agent': 'StreetSmart-Navigation-App/1.0' } }).then((r) => r.json());
    if (data.display_name) return data.display_name;
  } catch {}
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

interface GeoInputProps {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  onSelect:    (lat: number, lng: number, name: string) => void;
  placeholder: string;
  dotColor:    string;
  dotShape?:   'circle' | 'square';
}

function GeoInput({ label, value, onChange, onSelect, placeholder, dotColor, dotShape = 'circle' }: GeoInputProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);
  const debounce = useRef<NodeJS.Timeout>();

  const handleChange = (v: string) => {
    onChange(v);
    clearTimeout(debounce.current);
    if (v.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchPlaces(v);
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const handleSelect = (item: any) => {
    onSelect(item.lat, item.lng, item.display);
    onChange(item.display);
    setSuggestions([]);
    setOpen(false);
  };

  const getTypeIcon = (type: string) => {
    if (type === 'country')  return '🌍';
    if (type === 'region' || type === 'state') return '📍';
    if (type === 'city' || type === 'place')   return '🏙️';
    if (type === 'poi' || type === 'tourism')  return '⭐';
    if (type === 'address' || type === 'road') return '🛣️';
    return '📌';
  };

  return (
    <div className="relative">
      <label className="block text-[10px] font-mono mb-1 tracking-wider" style={{ color: dotColor }}>{label}</label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading
            ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: dotColor }} />
            : <div className={`w-2 h-2 ${dotShape === 'square' ? 'rounded-sm rotate-45' : 'rounded-full'}`} style={{ background: dotColor }} />}
        </div>
        <input
          type="text" value={value} onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          className="w-full pl-8 pr-7 py-2.5 rounded-lg text-xs font-mono text-[#E6F1FF] placeholder-[#4A5568] outline-none transition-all duration-200 bg-[#0B1020] border"
          style={{ borderColor: open ? `${dotColor}60` : 'rgba(255,255,255,0.07)' }}
        />
        {value && (
          <button onClick={() => { onChange(''); setSuggestions([]); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4A5568] hover:text-[#8892B0]">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }} transition={{ duration:0.12 }}
            className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden border border-[#1a2a4a] bg-[#0B1020] shadow-2xl"
            style={{ maxHeight:'220px', overflowY:'auto' }}>
            {suggestions.map((item) => (
              <button key={item.id} onMouseDown={() => handleSelect(item)}
                className="w-full text-left px-3 py-2.5 text-xs text-[#8892B0] hover:bg-[#05080F] hover:text-[#E6F1FF] transition-colors flex items-start gap-2 border-b border-[#1a2a4a]/40 last:border-0">
                <span className="flex-shrink-0 mt-0.5">{getTypeIcon(item.type)}</span>
                <span className="truncate leading-relaxed">{item.display}</span>
              </button>
            ))}
            <div className="px-3 py-1.5 text-[9px] font-mono text-[#4A5568] border-t border-[#1a2a4a]/40 flex items-center gap-1">
              <span>🌍</span><span>Worldwide search — powered by OpenStreetMap</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MapPage() {
  const [gpsStatus,    setGpsStatus]    = useState<'detecting' | 'denied' | 'ready'>('detecting');
  const [originCoords, setOriginCoords] = useState(FALLBACK);
  const [destCoords,   setDestCoords]   = useState({ lat: FALLBACK.lat + 0.04, lng: FALLBACK.lng + 0.04 });
  const [originText,   setOriginText]   = useState('');
  const [destText,     setDestText]     = useState('');

  const [selectedProfile, setSelectedProfile]  = useState('woman');
  const [selectedRoute,   setSelectedRoute]     = useState<RouteResult | null>(null);
  const [showHeatmap,     setShowHeatmap]       = useState(false);
  const [showBlackSpots,  setShowBlackSpots]     = useState(true);
  const [blackSpots,      setBlackSpots]         = useState<BlackSpotReport[]>([]);
  const [audioEnabled,    setAudioEnabled]      = useState(false);
  const [instructionIdx,  setInstructionIdx]    = useState(0);
  const [sidebarOpen,     setSidebarOpen]       = useState(true);
  // Phones: the side panel becomes a bottom sheet over a full-screen map
  const isMobile = useIsMobile();
  const [sheet, setSheet] = useState<'peek' | 'half' | 'full'>('half');
  const SHEET_H = { peek: '76px', half: '52dvh', full: '88dvh' } as const;
  const cycleSheet = () => setSheet((v) => (v === 'peek' ? 'half' : v === 'half' ? 'full' : 'peek'));

  const { routes, loading, refining, error: routeError, meta: routeMeta, fetchRoutes, clearRoutes } = useRoutes();
  const router = useRouter();
  const [username, setUsername] = useState('');

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) setUsername(JSON.parse(user).username || 'User');
  }, []);

  // Load community-reported issues for the black-spot map overlay
  useEffect(() => {
    apiService.getReports()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (data.reports || data.data || []);
        const withCoords = list.filter((r: any) => typeof r.lat === 'number' && typeof r.lng === 'number');
        setBlackSpots(withCoords);
      })
      .catch(() => setBlackSpots([]));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const { speak, stop, speaking } = useSpeech();
  const { enabled: a11y, toggle: toggleA11y } = useAccessibilityMode();

  // ✅ FIXED: GPS auto-detects any city — no hardcoded location shown
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      setOriginText('Location unavailable — enter manually');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setOriginCoords({ lat, lng });
        setGpsStatus('ready');
        const name = await reverseGeocode(lat, lng);
        setOriginText(name);
        toast.success(`📍 Location detected! ±${Math.round(accuracy)}m`, { duration: 3000 });
      },
      () => {
        setGpsStatus('denied');
        // ✅ FIXED: No hardcoded city name shown on GPS denial
        setOriginText('');
        toast('📍 GPS unavailable — type your location below', { icon: 'ℹ️', duration: 3000 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setGpsStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setOriginCoords({ lat, lng });
        setGpsStatus('ready');
        const name = await reverseGeocode(lat, lng);
        setOriginText(name);
        toast.success('📍 Location updated!');
      },
      () => {
        setGpsStatus('denied');
        toast.error('Could not get location');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, []);

  const handleVoiceResult = useCallback(async (text: string) => {
    toast.success(`🎤 Heard: "${text}"`);
    setDestText(text);
    const results = await searchPlaces(text);
    if (results.length > 0) {
      const best = results[0];
      setDestCoords({ lat: best.lat, lng: best.lng });
      setDestText(best.display);
      toast.success(`📍 Found: ${best.display.split(',')[0]}`);
    } else {
      toast.error('Could not find that location — try typing it');
    }
  }, []);

  const { listening, supported: voiceOk, startListening, stopListening } = useVoiceRecognition(handleVoiceResult);

  const [vehicleMode, setVehicleMode] = useState('walking');
  const [restStops, setRestStops] = useState<RestStop[]>([]);
  const { position: livePosition, tracking: liveTracking, error: liveTrackError, start: startLiveTracking, stop: stopLiveTracking } = useLiveTracking();

  const nearby = useNearbyReports(livePosition);
  useEffect(() => { if (isMobile && routes.length > 0) setSheet('half'); }, [routes.length, isMobile]);
  const [rerouteNote, setRerouteNote] = useState<string | null>(null);

  const buildRequest = useCallback(() => ({
    origin:      originCoords,
    destination: destCoords,
    preferences: {
      user_profile: (vehicleMode === 'wheelchair' ? 'wheelchair' : isFootMode(vehicleMode) ? selectedProfile : 'general') as any,
      transport_mode: (isFootMode(vehicleMode) ? 'walking' : vehicleMode === 'cycling' ? 'cycling' : 'driving') as any,
    },
  }), [originCoords, destCoords, selectedProfile, vehicleMode]);

  const handleFindRoutes = useCallback(async () => {
    if (!destText.trim()) { toast.error('Please enter a destination'); return; }
    clearRoutes();
    setSelectedRoute(null);
    setInstructionIdx(0);
    setRestStops([]);
    setRerouteNote(null);
    await fetchRoutes(buildRequest(), vehicleMode);
  }, [buildRequest, vehicleMode, fetchRoutes, clearRoutes, destText]);

  // ── Dynamic rerouting (live incidents) ─────────────────────────────────────
  // A route is selected -> watch its corridor. When a report appears / is confirmed / expires,
  // silently re-score ALL routes and explain what changed (or that nothing relevant changed).
  const pendingRefresh = useRef<{ keys: Set<string>; topKm: number } | null>(null);

  const refreshRoutes = useCallback(async () => {
    if (!routes.length) return;
    const keys = new Set<string>();
    routes.forEach((r) => (r.hazards ?? []).forEach((h) => keys.add(`${h.report_id ?? h.type}@${h.lat.toFixed(4)},${h.lng.toFixed(4)}`)));
    pendingRefresh.current = { keys, topKm: routes[0].distance_km };
    await fetchRoutes(buildRequest(), vehicleMode);
  }, [routes, fetchRoutes, buildRequest, vehicleMode]);

  const watch = useIncidentWatch(selectedRoute?.coordinates, !!selectedRoute && !selectedRoute.id.startsWith('fallback'));
  useEffect(() => { if (watch.changeTick > 0) refreshRoutes(); }, [watch.changeTick]);

  useEffect(() => {
    const snap = pendingRefresh.current;
    if (!snap || loading || !routes.length) return;
    pendingRefresh.current = null;
    const added: any[] = [];
    routes.forEach((r) => (r.hazards ?? []).forEach((h) => {
      const k = `${h.report_id ?? h.type}@${h.lat.toFixed(4)},${h.lng.toFixed(4)}`;
      if (!snap.keys.has(k) && h.kind === 'community' && !added.find((a) => a.label === h.label)) added.push(h);
    }));
    const topChanged = Math.abs(routes[0].distance_km - snap.topKm) > 0.1;
    const what = added.slice(0, 2).map((h) => `${h.simulated ? '🧪 simulated ' : ''}${h.type.replace('_', ' ')} near km ${(h.along_m / 1000).toFixed(1)}`).join(', ');
    setRerouteNote(added.length
      ? `🔄 New incident reported (${what}). Routes re-scored — ${topChanged ? 'the recommended route changed to avoid it.' : 'the recommended route is unchanged.'}`
      : '🔄 Incident data updated — routes re-scored, no change to your recommendation.');
    const t = setTimeout(() => setRerouteNote(null), 22000);
    return () => clearTimeout(t);
  }, [routes, loading]);

  // ✅ Real rest stops (benches/shelters/toilets/water) fetched live from
  // OpenStreetMap once a route is selected — only for pedestrian mode,
  // since rest stops matter for people walking, not vehicles.
  useEffect(() => {
    if (!isFootMode(vehicleMode) || !selectedRoute?.coordinates?.length) { setRestStops([]); return; }
    let cancelled = false;
    fetchRestStopsAlongRoute(selectedRoute.coordinates).then((stops) => {
      if (!cancelled) setRestStops(stops);
    });
    return () => { cancelled = true; };
  }, [selectedRoute, vehicleMode]);

  useEffect(() => {
    // after the server silently refreshes routes (street data finished loading) keep a valid selection
    if (routes.length > 0 && selectedRoute && !routes.find((r) => r.id === selectedRoute.id)) {
      const same = routes.find((r) => r.name === selectedRoute.name) ?? routes[0];
      setSelectedRoute(same);
    }
  }, [routes]);

  useEffect(() => {
    if (routes.length > 0 && !selectedRoute) {
      setSelectedRoute(routes[0]);
      if (audioEnabled) speak(`${routes[0].name}. Safety score ${routes[0].scores.overall.toFixed(0)}.`);
    }
  }, [routes]);

  const handlePlayInstruction = useCallback((idx: number) => {
    const instr = selectedRoute?.audio_instructions?.[idx];
    if (instr) { speak(instr); setInstructionIdx(idx); }
  }, [selectedRoute, speak]);

  const sidebarContent = (
<div className="p-4 space-y-4">

                {gpsStatus === 'detecting' && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-mono">
                    <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                    Detecting your real-time location...
                  </div>
                )}

                <NeonCard color="#00FF9C">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#00FF9C] font-semibold tracking-wider">🌍 WORLDWIDE ROUTE PLANNER</span>
                      <div className="flex items-center gap-1">
                        {voiceOk && (
                          <motion.button whileTap={{ scale:0.9 }} onClick={listening ? stopListening : startListening}
                            className={`p-1.5 rounded-lg border transition-all ${listening ? 'border-[#FF3B3B]/60 bg-[#FF3B3B]/10 text-[#FF3B3B] animate-pulse' : 'border-[#1a2a4a] text-[#8892B0] hover:text-[#00FF9C]'}`}>
                            {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                          </motion.button>
                        )}
                        <button onClick={handleLocateMe} disabled={gpsStatus === 'detecting'}
                          className="p-1.5 rounded-lg border border-[#1a2a4a] text-[#8892B0] hover:text-[#00E5FF] transition-all disabled:opacity-40">
                          {gpsStatus === 'detecting' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {listening && (
                      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FF3B3B]/10 border border-[#FF3B3B]/30">
                        <div className="flex gap-0.5 items-end h-5">
                          {[3,6,8,5,9,4,7,5,3,8].map((h, i) => (
                            <div key={i} className="w-0.5 bg-[#FF3B3B] rounded-full animate-pulse" style={{ height:`${h}px`, animationDelay:`${i*80}ms` }} />
                          ))}
                        </div>
                        <span className="text-xs text-[#FF3B3B] font-mono">Say any destination worldwide...</span>
                      </motion.div>
                    )}

                    <GeoInput label="FROM — YOUR LOCATION" value={originText} onChange={setOriginText}
                      onSelect={(lat, lng, name) => { setOriginCoords({ lat, lng }); setOriginText(name); setGpsStatus('ready'); }}
                      placeholder={gpsStatus === 'detecting' ? 'Detecting location...' : 'Search any city, address...'}
                      dotColor="#00FF9C" dotShape="circle" />

                    <GeoInput label="TO — DESTINATION" value={destText} onChange={setDestText}
                      onSelect={(lat, lng, name) => { setDestCoords({ lat, lng }); setDestText(name); }}
                      placeholder="Search anywhere in the world..."
                      dotColor="#FF3B3B" dotShape="square" />

                    <GlowButton color="green" size="md" className="w-full" onClick={handleFindRoutes} disabled={loading || !destText.trim()}>
                      {loading
                        ? <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Calculating safe routes...</span>
                        : <span className="flex items-center gap-2"><Shield className="w-3.5 h-3.5" />Find Safe Routes</span>}
                    </GlowButton>
                  </div>
                </NeonCard>

                <NeonCard color="#FFB020">
                  <p className="text-[10px] font-mono text-[#FFB020] font-semibold tracking-wider mb-3">TRAVEL MODE</p>
                  <VehicleModeSelector selected={vehicleMode} onChange={setVehicleMode} />
                </NeonCard>

                {vehicleMode === 'walking' && (
                  <NeonCard color="#00E5FF">
                    <p className="text-[10px] font-mono text-[#00E5FF] font-semibold tracking-wider mb-3">USER PROFILE</p>
                    <PreferenceSelector selected={selectedProfile} onChange={setSelectedProfile} />
                  </NeonCard>
                )}

                <NeonCard color={liveTracking ? '#00FF9C' : '#8892B0'}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-mono text-[#8892B0] font-semibold tracking-wider">LIVE GPS TRACKING</p>
                      <p className="text-[9px] text-[#4A5568] mt-0.5">
                        {liveTracking
                          ? livePosition
                            ? `${livePosition.speedKmh ?? '—'} km/h · ±${livePosition.accuracyM}m accuracy`
                            : 'Waiting for GPS fix...'
                          : 'Track your real device location on the map'}
                      </p>
                      {liveTrackError && <p className="text-[9px] text-[#FF3B3B] mt-0.5">{liveTrackError}</p>}
                    </div>
                    <button
                      onClick={() => (liveTracking ? stopLiveTracking() : startLiveTracking())}
                      className="text-[10px] font-mono px-3 py-1.5 rounded-lg border transition-colors"
                      style={liveTracking
                        ? { borderColor: '#00FF9C50', color: '#00FF9C', background: '#00FF9C10' }
                        : { borderColor: '#8892B030', color: '#8892B0' }}
                    >
                      {liveTracking ? 'STOP' : 'START'}
                    </button>
                  </div>
                </NeonCard>

                <AnimatePresence>
                  {routes.length > 0 && (
                    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="space-y-3">
                      <p className="text-[10px] font-mono text-[#8892B0] tracking-wider px-1">{routes.length} ROUTE{routes.length > 1 ? 'S' : ''} FOUND{routeMeta?.is_night ? ' · 🌙 NIGHT' : ' · ☀️ DAYLIGHT'}</p>
                      {routeError && <p className="text-[10px] font-mono text-[#FFB020] px-1">{routeError}</p>}
                      {refining && <p className="text-[10px] font-mono text-[#00E5FF] px-1">⏳ Street data finished loading — refining scores…</p>}
                      <DemoPanel route={selectedRoute} onChanged={refreshRoutes} />
                      {selectedRoute && <div className="md:hidden"><MapLegend route={selectedRoute} /></div>}
                      {(routeMeta?.data_quality?.notes ?? []).map((n, i) => (
                        <p key={i} className="text-[10px] font-mono text-[#8892B0] px-1 leading-snug">ℹ️ {n}</p>
                      ))}
                      {routes.map((route) => (
                        <RouteCard key={route.id} route={route} rank={route.rank ?? 1}
                          isSelected={selectedRoute?.id === route.id}
                          onSelect={() => {
                            setSelectedRoute(route);
                            setInstructionIdx(0);
                            if (audioEnabled) speak(`${route.name}. Safety score ${route.scores.overall.toFixed(0)}.`);
                          }} />
                      ))}

                      {/* Parking search reuses this route's own real destination
                          coordinates — same OSRM-geocoded point, not a separate lookup */}
                      <Link
                        href={`/parking?lat=${destCoords.lat}&lng=${destCoords.lng}&name=${encodeURIComponent(destText || 'Destination')}`}
                        className="block"
                      >
                        <GlowButton color="cyan" size="sm" className="w-full">
                          🅿️ Find Parking Near Destination
                        </GlowButton>
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {selectedRoute && audioEnabled && (
                    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                      <NeonCard color="#B388FF">
                        <p className="text-[10px] font-mono text-[#B388FF] font-semibold tracking-wider mb-3 flex items-center gap-2">
                          <Volume2 className="w-3.5 h-3.5" /> AUDIO NAVIGATION
                        </p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {selectedRoute.audio_instructions?.map((instr, i) => (
                            <button key={i} onClick={() => handlePlayInstruction(i)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all ${
                                instructionIdx === i ? 'bg-[#B388FF]/15 text-[#B388FF] border border-[#B388FF]/30' : 'text-[#8892B0] hover:text-[#E6F1FF] hover:bg-[#0B1020]'
                              }`}>
                              <span className="text-[#4A5568] mr-2">{i + 1}.</span>{instr}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <GlowButton color="purple" size="sm" className="flex-1" onClick={() => handlePlayInstruction(instructionIdx)}>
                            {speaking ? '▐▐ Stop' : '▶ Play'}
                          </GlowButton>
                          <GlowButton color="cyan" size="sm" className="flex-1"
                            onClick={() => { const next = instructionIdx + 1; if (next < (selectedRoute?.audio_instructions?.length ?? 0)) handlePlayInstruction(next); }}>
                            Next →
                          </GlowButton>
                        </div>
                      </NeonCard>
                    </motion.div>
                  )}
                </AnimatePresence>

                {a11y && selectedRoute && (
                  <NeonCard color="#00FF9C">
                    <p className="text-sm font-mono text-[#00FF9C] font-bold mb-3 flex items-center gap-2">
                      <Accessibility className="w-4 h-4" /> SIMPLIFIED NAVIGATION
                    </p>
                    <div className="text-2xl font-bold text-[#E6F1FF] mb-3">{selectedRoute.name}</div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="text-center p-3 bg-[#0B1020] rounded-xl border border-[#00FF9C]/20">
                        <div className="text-3xl font-bold font-mono text-[#00FF9C]">{selectedRoute.scores.overall.toFixed(0)}</div>
                        <div className="text-xs text-[#8892B0] mt-1">Safety Score</div>
                      </div>
                      <div className="text-center p-3 bg-[#0B1020] rounded-xl border border-[#00E5FF]/20">
                        <div className="text-3xl font-bold font-mono text-[#00E5FF]">{formatDuration(selectedRoute.duration_min)}</div>
                        <div className="text-xs text-[#8892B0] mt-1">{selectedRoute.eta?.mode_label ?? 'Travel'} time</div>
                      </div>
                    </div>
                    <GlowButton color="green" size="lg" className="w-full" onClick={() => handlePlayInstruction(0)}>
                      <Volume2 className="w-5 h-5 mr-2" /> START VOICE GUIDE
                    </GlowButton>
                  </NeonCard>
                )}
              </div>
  );

  return (
    <div className={`h-[calc(100dvh_-_56px)] bg-[#05080F] flex flex-col overflow-hidden ${a11y ? 'pt-8' : ''}`}>

      {a11y && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#00FF9C] text-[#05080F] text-xs font-mono py-1.5 px-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Accessibility className="w-3.5 h-3.5" />
            ACCESSIBILITY MODE — High Contrast · Large Text
          </span>
          <button onClick={toggleA11y} className="underline font-bold">Disable</button>
        </div>
      )}

      {/* Top bar */}
      <div className="flex-shrink-0 z-30 border-b border-[#00E5FF]/10 bg-[#05080F]/95 backdrop-blur-lg">
        <div className="flex items-center justify-between px-2 md:px-4 py-2 md:py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[#8892B0] hover:text-[#00E5FF] transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-[#00FF9C]" />
              <span className="font-bold text-[#E6F1FF] text-sm">
                Street<span className="text-[#00FF9C]">Smart</span>
                <span className="ml-2 font-mono text-xs text-[#8892B0] hidden sm:inline">Navigator</span>
              </span>
            </div>
            <div className={`hidden sm:flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              gpsStatus === 'ready'     ? 'text-[#00FF9C] border-[#00FF9C]/30 bg-[#00FF9C]/10'
              : gpsStatus === 'detecting' ? 'text-[#00E5FF] border-[#00E5FF]/30 bg-[#00E5FF]/10'
              : 'text-[#FFB020] border-[#FFB020]/30 bg-[#FFB020]/10'
            }`}>
              {gpsStatus === 'detecting' && <><Loader2 className="w-2.5 h-2.5 animate-spin" /> GPS...</>}
              {gpsStatus === 'ready'     && <><span className="w-1.5 h-1.5 rounded-full bg-[#00FF9C] animate-pulse inline-block" /> LIVE GPS</>}
              {gpsStatus === 'denied'    && <><MapPin className="w-2.5 h-2.5" /> MANUAL</>}
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-1.5">
            <button onClick={toggleA11y}
              className={`p-1.5 md:p-2 rounded-lg border transition-all ${a11y ? 'border-[#00FF9C]/60 bg-[#00FF9C]/10 text-[#00FF9C]' : 'border-[#1a2a4a] text-[#8892B0] hover:text-[#00FF9C]'}`}>
              <Accessibility className="w-4 h-4" />
            </button>
            <button onClick={() => setShowHeatmap((v) => !v)}
              className={`p-1.5 md:p-2 rounded-lg border transition-all ${showHeatmap ? 'border-[#FFB020]/60 bg-[#FFB020]/10 text-[#FFB020]' : 'border-[#1a2a4a] text-[#8892B0] hover:text-[#FFB020]'}`}>
              <Layers className="w-4 h-4" />
            </button>
            <button onClick={() => setShowBlackSpots((v) => !v)}
              title="Toggle black spots — community-reported unsafe areas"
              className={`p-1.5 md:p-2 rounded-lg border transition-all ${showBlackSpots ? 'border-[#FF3B3B]/60 bg-[#FF3B3B]/10 text-[#FF3B3B]' : 'border-[#1a2a4a] text-[#8892B0] hover:text-[#FF3B3B]'}`}>
              <AlertTriangle className="w-4 h-4" />
            </button>
            <button onClick={() => { setAudioEnabled((v) => !v); if (speaking) stop(); }}
              className={`p-1.5 md:p-2 rounded-lg border transition-all ${audioEnabled ? 'border-[#B388FF]/60 bg-[#B388FF]/10 text-[#B388FF]' : 'border-[#1a2a4a] text-[#8892B0] hover:text-[#B388FF]'}`}>
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            {username && <span className="hidden md:inline text-xs font-mono text-[#00FF9C]">👤 {username}</span>}
            <button onClick={handleLogout}
              className="p-1.5 md:p-2 rounded-lg border border-[#FF3B3B]/40 text-[#FF3B3B] hover:bg-[#FF3B3B]/10 text-xs font-mono transition-all">
              Logout
            </button>
            <button onClick={() => setSidebarOpen((v) => !v)}
              className="hidden md:block p-2 rounded-lg border border-[#1a2a4a] text-[#8892B0] hover:text-[#00E5FF] transition-all">
              <ChevronRight className={`w-4 h-4 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        <AnimatePresence initial={false}>
          {!isMobile && sidebarOpen && (
            <motion.div initial={{ width:0, opacity:0 }} animate={{ width:340, opacity:1 }} exit={{ width:0, opacity:0 }} transition={{ duration:0.2 }}
              className="flex-shrink-0 h-full overflow-y-auto border-r border-[#00E5FF]/08 bg-[#05080F]/95 z-20" style={{ minWidth:0 }}>
              {sidebarContent}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 relative overflow-hidden">
          <MapCanvas selectedRoute={selectedRoute} routes={routes} showHeatmap={showHeatmap}
            origin={originCoords} destination={destCoords}
            blackSpots={blackSpots} showBlackSpots={showBlackSpots}
            restStops={restStops} livePosition={livePosition}
            onRouteSelect={(r) => { setSelectedRoute(r); if (audioEnabled) speak(`${r.name} selected.`); }} />

          {selectedRoute && !a11y && (
            <div className="absolute top-4 right-4 z-20 hidden md:block"><HUDPanel route={selectedRoute} /></div>
          )}
          {selectedRoute && (
            <div className="absolute bottom-8 left-4 z-20 hidden md:block"><MapLegend route={selectedRoute} /></div>
          )}
          {rerouteNote && (
            <div className="absolute top-16 md:top-4 left-2 right-2 md:left-1/2 md:right-auto md:-translate-x-1/2 z-30 md:max-w-[560px] glass-panel rounded-xl px-4 py-2.5 border border-[#00E5FF]/40 text-xs font-mono text-[#E6F1FF]">
              {rerouteNote}
              <button onClick={() => setRerouteNote(null)} className="ml-3 text-[#8892B0]">✕</button>
            </div>
          )}
          <div className="absolute left-3 right-3 md:right-auto md:left-4 md:bottom-24 z-30" style={isMobile ? { bottom: `calc(${SHEET_H[sheet]} + 12px)` } : undefined}>
            <NearbyConfirm prompt={nearby.prompt} onAnswer={nearby.answer} onSkip={nearby.skip} />
          </div>


          {/* ───────── PHONE ONLY: navigation bar on the map ───────── */}
          {isMobile && selectedRoute && (selectedRoute.audio_instructions?.length ?? 0) > 0 && (
            <div className="absolute top-2 left-14 right-2 z-30 glass-panel rounded-xl px-3 py-2 border border-[#B388FF]/40 flex items-center gap-2">
              <button onClick={() => handlePlayInstruction(Math.max(0, instructionIdx - 1))}
                className="text-[#8892B0] px-1 text-sm" aria-label="Previous instruction">◀</button>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-mono text-[#B388FF] tracking-wider">
                  STEP {instructionIdx + 1}/{selectedRoute.audio_instructions.length} · {selectedRoute.eta?.mode_label ?? ''} {formatDuration(selectedRoute.duration_min)}
                </div>
                <div className="text-xs text-[#E6F1FF] leading-snug line-clamp-2">{selectedRoute.audio_instructions[Math.min(instructionIdx, selectedRoute.audio_instructions.length - 1)]}</div>
              </div>
              <button onClick={() => handlePlayInstruction(Math.min(selectedRoute.audio_instructions.length - 1, instructionIdx + 1))}
                className="text-[#B388FF] px-1 text-sm" aria-label="Next instruction">▶</button>
            </div>
          )}

          {/* ───────── PHONE ONLY: slide-up panel (replaces the 340px side panel) ───────── */}
          {isMobile && (
            <div className="absolute inset-x-0 bottom-0 z-40 flex flex-col rounded-t-2xl border-t border-[#00E5FF]/25 bg-[#05080F]/97 backdrop-blur-lg shadow-[0_-12px_30px_rgba(0,0,0,0.55)] transition-[height] duration-200"
              style={{ height: SHEET_H[sheet], paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <button onClick={cycleSheet} className="w-full pt-2 pb-1.5 flex flex-col items-center flex-shrink-0" aria-label="Expand or collapse panel">
                <span className="w-10 h-1.5 rounded-full bg-[#8892B0]/50" />
                <span className="text-[10px] font-mono text-[#8892B0] mt-1">
                  {selectedRoute ? `${selectedRoute.distance_km.toFixed(1)} km · ${formatDuration(selectedRoute.duration_min)} · ` : ''}
                  {sheet === 'peek' ? '▲ tap for route options' : sheet === 'half' ? '▲ tap for full panel' : '▼ tap to see map'}
                </span>
              </button>
              <div className="flex-1 overflow-y-auto overscroll-contain pb-28">{sidebarContent}</div>
            </div>
          )}

          {voiceOk && (
            <motion.button whileTap={{ scale:0.9 }} onClick={listening ? stopListening : startListening}
              style={isMobile ? { bottom: `calc(${SHEET_H[sheet]} + 12px)` } : undefined}
              className={`absolute md:bottom-8 right-4 md:right-6 z-20 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-2xl border-2 transition-all duration-300 ${
                listening ? 'bg-[#FF3B3B] border-[#FF3B3B] shadow-[0_0_30px_#FF3B3B60] animate-pulse' : 'bg-[#0B1020] border-[#00E5FF]/40 shadow-[0_0_20px_#00E5FF20] hover:border-[#00E5FF]'
              }`}>
              {listening ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-[#00E5FF]" />}
            </motion.button>
          )}

          <motion.button whileTap={{ scale:0.9 }} onClick={handleLocateMe}
            style={isMobile ? { bottom: `calc(${SHEET_H[sheet]} + 12px)` } : undefined}
            className="absolute md:bottom-8 left-4 md:left-6 z-20 w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center bg-[#0B1020] border-2 border-[#00FF9C]/40 shadow-[0_0_20px_#00FF9C20] hover:border-[#00FF9C] transition-all">
            <LocateFixed className={`w-5 h-5 ${gpsStatus === 'detecting' ? 'text-[#FFB020] animate-spin' : 'text-[#00FF9C]'}`} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}