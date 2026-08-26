'use client';

import { motion } from 'framer-motion';

export interface VehicleMode {
  value: string;
  label: string;
  icon: string;
  color: string;
  desc: string;
  osrmProfile: 'foot' | 'bike' | 'car';
  priority: boolean;
}

export const VEHICLE_MODES: VehicleMode[] = [
  { value: 'pedestrian', label: 'On Foot',  icon: '🚶', color: '#00E5FF', desc: 'Walking / accessibility routing', osrmProfile: 'foot', priority: false },
  { value: 'vehicle',    label: 'Vehicle',  icon: '🚗', color: '#FFB020', desc: 'Own car / bike — fastest real road route', osrmProfile: 'car', priority: false },
  { value: 'ambulance',  label: 'Ambulance', icon: '🚑', color: '#FF3B3B', desc: 'Fastest real route, priority-flagged', osrmProfile: 'car', priority: true },
  { value: 'fire',       label: 'Fire Brigade', icon: '🚒', color: '#FF7A00', desc: 'Fastest real route, priority-flagged', osrmProfile: 'car', priority: true },
  { value: 'police',     label: 'Police',   icon: '🚓', color: '#3B82F6', desc: 'Fastest real route, priority-flagged', osrmProfile: 'car', priority: true },
];

export default function VehicleModeSelector({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (mode: string) => void;
}) {
  const active = VEHICLE_MODES.find((m) => m.value === selected) || VEHICLE_MODES[0];

  return (
    <div>
      <div className="text-[10px] text-[#8892B0] font-mono mb-2">TRAVEL MODE</div>
      <div className="grid grid-cols-5 gap-1 mb-3">
        {VEHICLE_MODES.map((mode) => (
          <motion.button
            key={mode.value}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(mode.value)}
            className={`relative flex flex-col items-center gap-1 p-2 rounded-lg text-center transition-all ${
              selected === mode.value ? 'border' : 'border border-transparent hover:border-[#8892B0]/20'
            }`}
            style={
              selected === mode.value
                ? { borderColor: `${mode.color}50`, background: `${mode.color}10` }
                : {}
            }
          >
            <span className="text-base leading-none">{mode.icon}</span>
            <span
              className="text-[8px] font-mono leading-none"
              style={{ color: selected === mode.value ? mode.color : '#8892B0' }}
            >
              {mode.label.split(' ')[0]}
            </span>
          </motion.button>
        ))}
      </div>

      {active.priority && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg p-2.5 mb-1"
          style={{ background: `${active.color}10`, border: `1px solid ${active.color}30` }}
        >
          <div className="text-[10px] font-semibold" style={{ color: active.color }}>
            {active.icon} Priority corridor mode
          </div>
          <div className="text-[9px] text-[#8892B0] mt-0.5 leading-snug">
            Shows the real fastest road route for this vehicle type. This app
            can't control traffic signals — treat this as route guidance,
            not an actual dispatch/clearance system.
          </div>
        </motion.div>
      )}
    </div>
  );
}
