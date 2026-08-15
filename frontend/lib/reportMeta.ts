export const ISSUE_TYPES = [
  { value: 'poor_lighting',   label: 'Poor Lighting',     icon: '💡', color: '#FFB020' },
  { value: 'unsafe_area',     label: 'Unsafe Area',       icon: '⚠️', color: '#FF3B3B' },
  { value: 'broken_sidewalk', label: 'Broken Sidewalk',   icon: '🚧', color: '#FFB020' },
  { value: 'missing_ramp',    label: 'Missing Ramp',      icon: '♿', color: '#00FF9C' },
  { value: 'construction',    label: 'Construction',      icon: '🏗️', color: '#FFB020' },
  { value: 'harassment',      label: 'Harassment Report', icon: '🚨', color: '#FF3B3B' },
  { value: 'flooding',        label: 'Flooding',          icon: '💧', color: '#00E5FF' },
  { value: 'obstruction',     label: 'Obstruction',       icon: '🚫', color: '#FF3B3B' },
];

export const SEVERITIES = [
  { value: 'low',      label: 'Low',      color: '#00FF9C', desc: 'Minor inconvenience' },
  { value: 'medium',   label: 'Medium',   color: '#FFB020', desc: 'Needs attention' },
  { value: 'high',     label: 'High',     color: '#FF3B3B', desc: 'Safety concern' },
  { value: 'critical', label: 'Critical', color: '#FF0000', desc: 'Immediate danger' },
];

export function getSeverityColor(severity: string): string {
  return SEVERITIES.find(s => s.value === severity)?.color || '#8892B0';
}

export function getIssueIcon(type: string): string {
  return ISSUE_TYPES.find(t => t.value === type)?.icon || '⚠️';
}

export function getIssueLabel(type: string): string {
  return ISSUE_TYPES.find(t => t.value === type)?.label || type;
}

// A report counts as a "black spot" (elevated, highlighted risk marker) when
// it's high-severity/critical, or has picked up community votes confirming it.
export function isBlackSpot(report: { severity?: string; votes?: number }): boolean {
  return report.severity === 'high' || report.severity === 'critical' || (report.votes ?? 0) >= 3;
}

// Night-time reports (10 PM – 6 AM) get flagged since risk is disproportionately
// higher during these hours — feeds the "red time zone" indicator on the map.
export function isNightReport(createdAt: string): boolean {
  try {
    const hour = new Date(createdAt).getHours();
    return hour >= 22 || hour < 6;
  } catch {
    return false;
  }
}
