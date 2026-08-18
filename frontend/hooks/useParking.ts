import { useCallback, useEffect, useState } from 'react';
import { apiService, ParkingSpot, VehicleType } from '@/services/api';

interface UseParkingOptions {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  vehicleType?: VehicleType;
  pollMs?: number; // set to 0 to disable polling
}

/**
 * Fetches nearby parking spots and keeps them fresh with periodic
 * polling, since occupancy/pricing on the backend drift in realtime.
 */
export function useParking({
  lat,
  lng,
  radiusKm = 1.0,
  vehicleType,
  pollMs = 15000,
}: UseParkingOptions) {
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (lat === undefined || lng === undefined) return;
    setLoading(true);
    try {
      const data = await apiService.getNearbyParkingSpots(lat, lng, radiusKm, vehicleType);
      setSpots(data.spots || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load nearby parking');
    } finally {
      setLoading(false);
    }
  }, [lat, lng, radiusKm, vehicleType]);

  useEffect(() => {
    refresh();
    if (!pollMs) return;
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { spots, loading, error, refresh };
}

export default useParking;
