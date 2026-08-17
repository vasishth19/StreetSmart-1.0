import axios, { AxiosError } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL:  API_BASE,
  // 45s — Render's free tier puts the backend to sleep after 15 min idle,
  // and waking it back up can take 30-50s. A short timeout here would
  // abort every request during that cold-start window, even though the
  // backend eventually responds fine.
  timeout:  45000,
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
};

export default apiService;