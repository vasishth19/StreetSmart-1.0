'use client';

import { motion } from 'framer-motion';
import { Shield, Lightbulb, Users, Accessibility, TrendingUp } from 'lucide-react';
import type { RouteResult } from '@/services/api';
import { formatDuration } from '@/lib/format';

interface HUDPanelProps {
  route: RouteResult;
}

export default function HUDPanel({ route }: HUDPanelProps) {
  const { scores, name, distance_km, duration_min } = route;

  const metrics = [
    { label: 'SAFETY', value: scores.safety, icon: Shield, color: '#FF3B3B' },
    { label: 'LIGHT', value: scores.lighting, icon: Lightbulb, color: '#FFE082' },
    { label: 'CROWD', value: scores.crowd, icon: Users, color: '#00E5FF' },
    { label: 'ACCESS', value: scores.accessibility, icon: Accessibility, color: '#00FF9C' },
  ];

  const riskColor =
    scores.risk_level === 'LOW' ? '#00FF9C' :
    scores.risk_level === 'MEDIUM' ? '#FFB020' : '#FF3B3B';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20 }}
      className="hud-corners glass-panel p-4 w-56 font-mono"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#00E5FF]/10">
        <div className="text-[9px] text-[#8892B0] uppercase tracking-widest">ACTIVE ROUTE</div>
        <div
          className="text-[9px] px-1.5 py-0.5 rounded font-bold"
          style={{ color: riskColor, background: `${riskColor}15`, border: `1px solid ${riskColor}30` }}
        >
          {scores.risk_level}
        </div>
      </div>

      {/* Route Name */}
      <div className="text-xs text-[#E6F1FF] font-semibold mb-3 line-clamp-1">{name}</div>

      {/* Overall Score */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-[#00FF9C]" />
          <span className="text-[9px] text-[#8892B0]">COMPOSITE</span>
        </div>
        <div className="text-lg font-bold text-[#00FF9C]"
          style={{ textShadow: '0 0 10px rgba(0,255,156,0.6)' }}>
          {scores.overall.toFixed(0)}
        </div>
      </div>

      {/* Metric Bars */}
      <div className="space-y-2 mb-3">
        {metrics.map(m => (
          <div key={m.label} className="flex items-center gap-2">
            <m.icon className="w-2.5 h-2.5 flex-shrink-0" style={{ color: m.color }} />
            <span className="text-[8px] text-[#8892B0] w-10 flex-shrink-0">{m.label}</span>
            <div className="flex-1 h-1 bg-[#0D1526] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${m.value}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: m.color, boxShadow: `0 0 4px ${m.color}60` }}
              />
            </div>
            <span className="text-[9px] font-mono w-6 text-right" style={{ color: m.color }}>
              {m.value.toFixed(0)}
            </span>
          </div>
        ))}
      </div>

      {/* Distance / Time */}
      <div className="border-t border-[#00E5FF]/10 pt-2 grid grid-cols-2 gap-2">
        <div className="text-center">
          <div className="text-xs font-bold text-[#00E5FF]">{distance_km.toFixed(1)}km</div>
          <div className="text-[8px] text-[#4A5568]">DISTANCE</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-bold text-[#00E5FF]">{formatDuration(duration_min)}</div>
          <div className="text-[8px] text-[#4A5568]">DURATION</div>
        </div>
      </div>
    </motion.div>
  );
}