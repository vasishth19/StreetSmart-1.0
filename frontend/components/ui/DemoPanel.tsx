'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import type { RouteResult } from '@/services/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const OPTIONS = [
  { type: 'pothole',       label: 'Pothole',          icon: '🕳️', severity: 'high' },
  { type: 'poor_lighting', label: 'Streetlight out',  icon: '💡', severity: 'high' },
  { type: 'accident',      label: 'Accident',         icon: '💥', severity: 'high' },
  { type: 'crowd',         label: 'Crowd',            icon: '👥', severity: 'high' },
  { type: 'flooding',      label: 'Waterlogging',     icon: '💧', severity: 'critical' },
  { type: 'road_blocked',  label: 'Road blocked',     icon: '⛔', severity: 'critical' },
];

// Judges' demo: drop a clearly-labelled SIMULATED incident on the selected route and
// watch scoring / rerouting react. Never mixes with real data: rows are tagged is_simulated.
export default function DemoPanel({ route, onChanged }: { route: RouteResult | null; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!route) return null;

  const simulate = async (o: (typeof OPTIONS)[number]) => {
    const pts = route.coordinates;
    const p = pts[Math.floor(pts.length * 0.45)];
    setBusy(true);
    try {
      const r = await fetch(`${API}/demo/simulate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: p[1], lng: p[0], issue_type: o.type, severity: o.severity, verified: true }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || `HTTP ${r.status}`); }
      toast.success(`🧪 Simulated ${o.label.toLowerCase()} added — re-scoring routes`);
      onChanged();
    } catch (e: any) { toast.error(e.message || 'Could not add simulated incident'); }
    finally { setBusy(false); }
  };

  const clear = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/demo/simulated`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      toast.success('Simulated incidents cleared');
      onChanged();
    } catch { toast.error('Could not clear'); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-[#B388FF]/30 bg-[#B388FF]/5 p-3 mt-2">
      <div className="text-[10px] font-mono text-[#B388FF] tracking-wider mb-1">🧪 DEMO · SIMULATE A LIVE INCIDENT</div>
      <div className="text-[9px] text-[#8892B0] mb-2 leading-snug">Adds a clearly labelled SIMULATED report on this route, then re-scores. Not real data.</div>
      <div className="grid grid-cols-3 gap-1.5">
        {OPTIONS.map((o) => (
          <button key={o.type} disabled={busy} onClick={() => simulate(o)}
            className="text-[9px] font-mono py-1.5 rounded-lg border border-[#1a2a4a] text-[#E6F1FF] hover:border-[#B388FF]/50 disabled:opacity-40">
            {o.icon}<br />{o.label}
          </button>
        ))}
      </div>
      <button disabled={busy} onClick={clear} className="mt-2 w-full text-[9px] font-mono py-1 text-[#8892B0] underline disabled:opacity-40">clear all simulated incidents</button>
    </div>
  );
}
