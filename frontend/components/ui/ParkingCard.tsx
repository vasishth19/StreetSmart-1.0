'use client';

import { Car, Bike, Zap, Umbrella, IndianRupee } from 'lucide-react';
import NeonCard from './NeonCard';
import GlowButton from './GlowButton';
import type { ParkingSpot } from '@/services/api';

interface ParkingCardProps {
  spot: ParkingSpot;
  distanceKm?: number;
  onReserve?: (spot: ParkingSpot) => void;
  reserving?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  available: '#00FF9C',
  occupied: '#FF3B3B',
  reserved: '#FFB020',
  disabled: '#8892B0',
};

const STATUS_LABEL: Record<string, string> = {
  available: 'Available',
  occupied: 'Occupied',
  reserved: 'Reserved',
  disabled: 'Out of service',
};

export default function ParkingCard({ spot, distanceKm, onReserve, reserving }: ParkingCardProps) {
  const color = STATUS_COLOR[spot.status] || '#8892B0';
  const VehicleIcon = spot.vehicle_type === 'two_wheeler' ? Bike : Car;
  const surging = spot.current_price_per_hour > spot.base_price_per_hour * 1.05;

  return (
    <NeonCard color={color} hover className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <VehicleIcon className="w-4 h-4 opacity-70" />
          <span className="font-mono text-sm font-semibold">{spot.label}</span>
        </div>
        <span
          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wide"
          style={{ color, background: `${color}18`, border: `1px solid ${color}40` }}
        >
          {STATUS_LABEL[spot.status]}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-[#8892B0]">
        {distanceKm !== undefined && <span>{distanceKm.toFixed(2)} km away</span>}
        {spot.covered && (
          <span className="flex items-center gap-1"><Umbrella className="w-3 h-3" /> Covered</span>
        )}
        {spot.ev_charging && (
          <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> EV charging</span>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-baseline gap-1 font-mono">
          <IndianRupee className="w-3.5 h-3.5" style={{ color: surging ? '#FFB020' : '#00E5FF' }} />
          <span className="text-lg font-bold" style={{ color: surging ? '#FFB020' : '#E6F1FF' }}>
            {spot.current_price_per_hour.toFixed(0)}
          </span>
          <span className="text-xs text-[#8892B0]">/hr</span>
          {surging && (
            <span className="text-[10px] text-[#FFB020] ml-1">
              (base ₹{spot.base_price_per_hour.toFixed(0)})
            </span>
          )}
        </div>

        {onReserve && (
          <GlowButton
            color={spot.status === 'available' ? 'green' : 'cyan'}
            size="sm"
            disabled={spot.status !== 'available' || reserving}
            onClick={() => onReserve(spot)}
          >
            {reserving ? 'Reserving…' : spot.status === 'available' ? 'Reserve' : 'Unavailable'}
          </GlowButton>
        )}
      </div>
    </NeonCard>
  );
}
