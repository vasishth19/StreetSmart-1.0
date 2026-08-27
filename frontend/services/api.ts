import axios, { AxiosError } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL:  API_BASE,
  timeout:  8000,
  headers:  { 'Content-Type': 'application/json' },
});

// ── Suppress ERR_CONNECTION_REFUSED noise in console ──────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const silent = [
      'ERR_NETWORK',
      'ERR_CONNECTION_REFUSED',
      'ECONNREFUSED',
      'Network Error',
    ];
    const isSilent = silent.some(
      (code) => error.code === code || error.message?.includes(code)
    );
    if (!isSilent) {
      // only log unexpected errors
      console.warn('[StreetSmart API]', error.message);
    }
    return Promise.reject(error);
  }
);

// ─── Types ────────────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RoutePreferences {
  user_profile:       'general' | 'woman' | 'elderly' | 'wheelchair' | 'visually_impaired';
  transport_mode?:    'walking' | 'cycling' | 'driving';
  avoid_stairs?:      boolean;
  avoid_crowds?:      boolean;
  prefer_lit?:        boolean;
  prefer_cameras?:    boolean;
  max_distance_km?:   number;
  weight_safety?:     number;
  weight_lighting?:   number;
  weight_crowd?:      number;
  weight_accessibility?: number;
}

export interface RouteRequest {
  origin:       Coordinates;
  destination:  Coordinates;
  preferences?: Partial<RoutePreferences>;
}

export interface RouteScores {
  overall:       number;
  safety:        number;
  lighting:      number;
  crowd:         number;
  accessibility: number;
  risk_level:    'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RouteResult {
  id:                 string;
  name:               string;
  description:        string;
  coordinates:        number[][];
  segments:           any[];
  scores:             RouteScores;
  distance_km:        number;
  duration_min:       number;
  waypoints:          Coordinates[];
  audio_instructions: string[];
  warnings:           string[];
  highlights:         string[];
  color:              string;
  rank:               number;
}

export interface RoutesResponse {
  routes:               RouteResult[];
  origin:               Coordinates;
  destination:          Coordinates;
  recommended_route_id: string;
  total_routes:         number;
  generated_at:         string;
}

export interface ReportRequest {
  lat:          number;
  lng:          number;
  issue_type:   string;
  severity:     string;
  description:  string;
  address?:     string;
  anonymous?:   boolean;
  reporter_contact?: string;
}

export interface SOSRequest {
  lat: number;
  lng: number;
  accuracy?: number;
  contact_count: number;
  note?: string;
}

export interface AnalyticsData {
  overview: {
    total_routes_today:  number;
    active_users:        number;
    avg_safety_score:    number;
    reports_resolved:    number;
    cities_covered:      number;
    accessibility_score: number;
  };
  hourly_safety:  Array<{ hour: number; safety: number }>;
  profile_usage:  Array<{ profile: string; count: number; percentage: number }>;
  daily_routes:   Array<{ day: string; routes: number }>;
  top_issues:     Array<{ type: string; count: number; resolved: number }>;
  safety_trend:        string;
  accessibility_trend: string;
}

// ─── Parking (SIH1515) types ─────────────────────────────────────

export type VehicleType = 'two_wheeler' | 'car' | 'suv' | 'commercial';
export type SpotStatus = 'available' | 'occupied' | 'reserved' | 'disabled';
export type DemandLevel = 'low' | 'moderate' | 'high' | 'surge';

export interface ParkingSpot {
  id: string;
  zone_id: string;
  label: string;
  lat: number;
  lng: number;
  vehicle_type: VehicleType;
  status: SpotStatus;
  base_price_per_hour: number;
  current_price_per_hour: number;
  covered: boolean;
  ev_charging: boolean;
  reserved_until?: string | null;
  occupied_since?: string | null;
}

export interface ParkingZone {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  radius_m: number;
  total_spots: number;
  available_spots: number;
  occupancy_rate: number;
  demand_level: DemandLevel;
  avg_price_per_hour: number;
  surge_multiplier: number;
}

export interface PricingQuote {
  spot_id: string;
  base_price_per_hour: number;
  price_per_hour: number;
  surge_multiplier: number;
  demand_level: DemandLevel;
  occupancy_rate: number;
  reasons: string[];
}

export interface ReservationRequest {
  spot_id: string;
  vehicle_number: string;
  vehicle_type?: VehicleType;
  duration_minutes?: number;
  user_id?: string;
}

export interface ReservationResponse {
  id: string;
  spot_id: string;
  zone_id: string;
  status: string;
  price_per_hour: number;
  duration_minutes: number;
  estimated_total: number;
  reserved_at: string;
  expires_at: string;
  vehicle_number: string;
}

export interface ParkingAnalytics {
  overview: {
    total_zones: number;
    total_spots: number;
    available_spots: number;
    overall_occupancy_rate: number;
    avg_price_per_hour: number;
  };
  zone_breakdown: Array<{
    id: string; name: string; occupancy_rate: number; demand_level: DemandLevel;
    available_spots: number; total_spots: number; avg_price_per_hour: number;
  }>;
  hourly_occupancy: Array<{ hour: number; occupancy: number }>;
  revenue_today: number;
  demand_trend: string;
}

// ─── API Service ──────────────────────────────────────────────────

export const apiService = {
  async getRoutes(request: RouteRequest): Promise<RoutesResponse> {
    const res = await apiClient.post<RoutesResponse>('/api/routes', request);
    return res.data;
  },

  async getHeatmap(lat: number, lng: number, radius = 2.0) {
    const res = await apiClient.get('/api/heatmap', {
      params: { lat, lng, radius },
    });
    return res.data;
  },

  async getAnalytics(): Promise<AnalyticsData> {
    const res = await apiClient.get<AnalyticsData>('/api/analytics');
    return res.data;
  },

  async submitReport(report: ReportRequest) {
    const res = await apiClient.post('/reports', report);
    return res.data;
  },

  async getReports() {
    const res = await apiClient.get('/reports');
    return res.data;
  },

  async triggerSOS(payload: SOSRequest) {
    const res = await apiClient.post('/sos', payload);
    return res.data;
  },

  async getPreferences() {
    const res = await apiClient.get('/api/preferences');
    return res.data;
  },

  async scoreRoute(coordinates: number[][], profile: string) {
    const res = await apiClient.post('/api/score', {
      coordinates,
      profile,
      time_of_day: 'evening',
    });
    return res.data;
  },

  async healthCheck() {
    const res = await apiClient.get('/health');
    return res.data;
  },

  // ── Parking (SIH1515) ─────────────────────────────────────────

  async getParkingZones(): Promise<ParkingZone[]> {
    const res = await apiClient.get<ParkingZone[]>('/parking/zones');
    return res.data;
  },

  async getNearbyParkingSpots(
    lat: number, lng: number, radiusKm = 1.0, vehicleType?: VehicleType, areaName?: string
  ) {
    const res = await apiClient.get('/parking/spots', {
      params: { lat, lng, radius_km: radiusKm, vehicle_type: vehicleType, area_name: areaName },
    });
    return res.data as { spots: ParkingSpot[]; total_found: number; generated_at: string };
  },

  async getParkingPricing(spotId: string): Promise<PricingQuote> {
    const res = await apiClient.get<PricingQuote>(`/parking/pricing/${spotId}`);
    return res.data;
  },

  async reserveParkingSpot(request: ReservationRequest): Promise<ReservationResponse> {
    const res = await apiClient.post<ReservationResponse>('/parking/reserve', request);
    return res.data;
  },

  async cancelParkingReservation(spotId: string) {
    const res = await apiClient.post(`/parking/reserve/${spotId}/cancel`);
    return res.data;
  },

  async getParkingAnalytics(): Promise<ParkingAnalytics> {
    const res = await apiClient.get<ParkingAnalytics>('/parking/analytics');
    return res.data;
  },
};

export default apiService;