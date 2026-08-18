'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, MapPin, TrendingUp, X, CheckCircle, Car } from 'lucide-react';
import toast from 'react-hot-toast';
import NeonCard from '@/components/ui/NeonCard';
import GlowButton from '@/components/ui/GlowButton';
import ParkingCard from '@/components/ui/ParkingCard';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useParking } from '@/hooks/useParking';
import { apiService, ParkingSpot, ParkingZone, ReservationResponse, VehicleType } from '@/services/api';

// Fallback centre (Cyber Hub, Gurugram) so the page has something to
// show before/without a browser location permission grant.
const DEFAULT_CENTER = { lat: 28.4950, lng: 77.0890 };

const DEMAND_COLOR: Record<string, string> = {
  low: '#00FF9C',
  moderate: '#00E5FF',
  high: '#FFB020',
  surge: '#FF3B3B',
};

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export default function ParkingPage() {
  const { lat, lng, error: geoError, getCurrentPosition } = useGeolocation();
  const center = lat && lng ? { lat, lng } : DEFAULT_CENTER;

  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<VehicleType | undefined>(undefined);
  const { spots, loading, refresh } = useParking({
    lat: center.lat,
    lng: center.lng,
    radiusKm: 1.5,
    vehicleType: vehicleFilter,
  });

  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [duration, setDuration] = useState(60);
  const [reserving, setReserving] = useState(false);
  const [confirmation, setConfirmation] = useState<ReservationResponse | null>(null);

  useEffect(() => {
    getCurrentPosition();
  }, [getCurrentPosition]);

  useEffect(() => {
    apiService.getParkingZones().then(setZones).catch(() => {});
    const id = setInterval(() => {
      apiService.getParkingZones().then(setZones).catch(() => {});
    }, 20000);
    return () => clearInterval(id);
  }, []);

  const handleReserve = async () => {
    if (!selectedSpot) return;
    if (vehicleNumber.trim().length < 3) {
      toast.error('Enter a valid vehicle number');
      return;
    }
    setReserving(true);
    try {
      const result = await apiService.reserveParkingSpot({
        spot_id: selectedSpot.id,
        vehicle_number: vehicleNumber.trim().toUpperCase(),
        vehicle_type: selectedSpot.vehicle_type,
        duration_minutes: duration,
      });
      setConfirmation(result);
      toast.success('Spot reserved!');
      refresh();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      toast.error(detail || 'Could not reserve this spot — it may have just been taken');
      refresh();
    } finally {
      setReserving(false);
    }
  };

  const closeModal = () => {
    setSelectedSpot(null);
    setConfirmation(null);
    setVehicleNumber('');
    setDuration(60);
  };

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="opacity-70 hover:opacity-100 transition-opacity">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-mono text-xl font-bold flex items-center gap-2">
            <Car className="w-5 h-5 text-[#00FF9C]" /> Street Parking
          </h1>
          <p className="text-xs text-[#8892B0]">
            Realtime spot availability with demand-based pricing — SIH1515
          </p>
        </div>
      </div>

      {geoError && (
        <div className="mb-4 text-xs text-[#FFB020] font-mono">
          {geoError} — showing spots near Cyber Hub, Gurugram instead.
        </div>
      )}

      {/* Zone overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {zones.map((zone) => (
          <NeonCard key={zone.id} color={DEMAND_COLOR[zone.demand_level]} hover={false} className="!p-3">
            <div className="text-xs font-mono font-semibold truncate">{zone.name}</div>
            <div className="text-[10px] text-[#8892B0] truncate mb-2">{zone.area}</div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold font-mono">
                {zone.available_spots}<span className="text-xs text-[#8892B0]">/{zone.total_spots}</span>
              </span>
              <span
                className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded"
                style={{
                  color: DEMAND_COLOR[zone.demand_level],
                  background: `${DEMAND_COLOR[zone.demand_level]}18`,
                }}
              >
                {zone.demand_level}
              </span>
            </div>
            <div className="text-[10px] text-[#8892B0] mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> ₹{zone.avg_price_per_hour.toFixed(0)}/hr avg
            </div>
          </NeonCard>
        ))}
      </div>

      {/* Vehicle filter */}
      <div className="flex items-center gap-2 mb-4">
        {(['car', 'two_wheeler', 'suv', 'commercial'] as VehicleType[]).map((vt) => (
          <button
            key={vt}
            onClick={() => setVehicleFilter(vehicleFilter === vt ? undefined : vt)}
            className="text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors"
            style={{
              borderColor: vehicleFilter === vt ? '#00FF9C80' : '#8892B030',
              color: vehicleFilter === vt ? '#00FF9C' : '#8892B0',
              background: vehicleFilter === vt ? '#00FF9C15' : 'transparent',
            }}
          >
            {vt.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Nearby spots */}
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4 text-[#00E5FF]" />
        <h2 className="font-mono text-sm font-semibold">Nearby spots</h2>
        {loading && <span className="text-[10px] text-[#8892B0]">refreshing…</span>}
      </div>

      {spots.length === 0 && !loading ? (
        <p className="text-sm text-[#8892B0]">No parking spots found within range. Try widening your search.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {spots.map((spot) => (
            <ParkingCard
              key={spot.id}
              spot={spot}
              distanceKm={distanceKm(center.lat, center.lng, spot.lat, spot.lng)}
              onReserve={setSelectedSpot}
            />
          ))}
        </div>
      )}

      {/* Reservation modal */}
      <AnimatePresence>
        {selectedSpot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm"
            >
              <NeonCard color={confirmation ? '#00FF9C' : '#00E5FF'} hover={false}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-mono text-sm font-bold">
                    {confirmation ? 'Reservation confirmed' : 'Reserve spot'}
                  </h3>
                  <button onClick={closeModal}><X className="w-4 h-4 opacity-60" /></button>
                </div>

                {!confirmation ? (
                  <div className="flex flex-col gap-3">
                    <div className="text-xs text-[#8892B0]">{selectedSpot.label}</div>
                    <div className="text-lg font-mono font-bold text-[#00FF9C]">
                      ₹{selectedSpot.current_price_per_hour.toFixed(0)}/hr
                    </div>

                    <label className="text-xs font-mono text-[#8892B0]">Vehicle number</label>
                    <input
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      placeholder="DL 01 AB 1234"
                      className="bg-[#05080F] border border-[#00E5FF30] rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-[#00E5FF80]"
                    />

                    <label className="text-xs font-mono text-[#8892B0]">Duration</label>
                    <div className="flex gap-2">
                      {[30, 60, 120, 240].map((mins) => (
                        <button
                          key={mins}
                          onClick={() => setDuration(mins)}
                          className="flex-1 text-xs font-mono py-1.5 rounded-lg border transition-colors"
                          style={{
                            borderColor: duration === mins ? '#00E5FF80' : '#8892B030',
                            color: duration === mins ? '#00E5FF' : '#8892B0',
                            background: duration === mins ? '#00E5FF15' : 'transparent',
                          }}
                        >
                          {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                        </button>
                      ))}
                    </div>

                    <div className="text-xs text-[#8892B0] flex justify-between pt-1">
                      <span>Estimated total</span>
                      <span className="text-[#E6F1FF] font-mono">
                        ₹{((selectedSpot.current_price_per_hour * duration) / 60).toFixed(0)}
                      </span>
                    </div>

                    <GlowButton color="green" onClick={handleReserve} disabled={reserving}>
                      {reserving ? 'Reserving…' : 'Confirm reservation'}
                    </GlowButton>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[#00FF9C]">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-mono text-sm">Spot held for {confirmation.duration_minutes} min</span>
                    </div>
                    <div className="text-xs text-[#8892B0] font-mono grid grid-cols-2 gap-y-1 mt-2">
                      <span>Vehicle</span><span className="text-[#E6F1FF] text-right">{confirmation.vehicle_number}</span>
                      <span>Price/hr</span><span className="text-[#E6F1FF] text-right">₹{confirmation.price_per_hour}</span>
                      <span>Total</span><span className="text-[#E6F1FF] text-right">₹{confirmation.estimated_total}</span>
                      <span>Expires</span>
                      <span className="text-[#E6F1FF] text-right">
                        {new Date(confirmation.expires_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <GlowButton color="cyan" className="mt-2" onClick={closeModal}>Done</GlowButton>
                  </div>
                )}
              </NeonCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
