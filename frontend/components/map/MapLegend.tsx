'use client';

import type { RouteResult } from '@/services/api';

// Small legend that explains what the line on the map means for the chosen mode.
export default function MapLegend({ route }: { route: RouteResult | null }) {
  if (!route) return null;
  const vehicle = route.draw_style === 'solid';
  const src = route.eta?.traffic_source;
  const Dot = ({ c, label }: { c: string; label: string }) => (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-3 h-1.5 rounded-full" style={{ background: c }} />
      <span>{label}</span>
    </span>
  );
  return (
    <div className="glass-panel rounded-xl px-3 py-2 text-[10px] font-mono text-[#8892B0] space-y-1 max-w-[220px]">
      {vehicle ? (
        <>
          <div className="text-[#E6F1FF] font-semibold tracking-wider">
            TRAFFIC {src === 'live' ? '· LIVE' : src === 'estimated' ? '· ESTIMATED' : ''}
          </div>
          <Dot c="#22C55E" label="Flowing (no traffic)" />
          <Dot c="#FACC15" label="Slow (some traffic)" />
          <Dot c="#EF4444" label="Heavy traffic" />
          {src === 'estimated' && <div className="text-[9px] text-[#FFB020] leading-snug">Typical pattern for this hour — add a TomTom key for live data.</div>}
        </>
      ) : (
        <>
          <div className="text-[#E6F1FF] font-semibold tracking-wider">DOTTED ROUTE · QUALITY</div>
          <Dot c="#00FF9C" label="Good (lit, safe, smooth)" />
          <Dot c="#FFB020" label="Fair" />
          <Dot c="#FF3B3B" label="Poor / reported problem" />
          <Dot c="#7DD3FC" label="Not enough data" />
        </>
      )}
      <div className="pt-1 border-t border-[#1a2a4a] text-[9px]">Tap a stretch for details. Icons = verified reports, SOS clusters, steps.</div>
    </div>
  );
}
