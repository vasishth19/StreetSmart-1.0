'use client';

import { motion } from 'framer-motion';

interface PreferenceSelectorProps {
  selected: string;
  onChange: (profile: string) => void;
}

const PROFILES = [
  {
    value: 'woman',
    label: 'Woman',
    icon: '👩',
    color: '#FF69B4',
    desc: 'Safety + lit routes',
    weights: { safety: 45, lighting: 30, crowd: 15, access: 10 },
  },
  {
    value: 'general',
    label: 'General',
    icon: '🚶',
    color: '#00E5FF',
    desc: 'Balanced routing',
    weights: { safety: 35, lighting: 25, crowd: 20, access: 20 },
  },
  {
    value: 'elderly',
    label: 'Elderly',
    icon: '🧓',
    color: '#FFB020',
    desc: 'No stairs, rest stops',
    weights: { safety: 30, lighting: 20, crowd: 15, access: 35 },
  },
  {
    value: 'wheelchair',
    label: 'Wheelchair',
    icon: '♿',
    color: '#00FF9C',
    desc: 'Full accessibility',
    weights: { safety: 25, lighting: 15, crowd: 10, access: 50 },
  },
  {
    value: 'visually_impaired',
    label: 'Visually Imp.',
    icon: '👁️',
    color: '#B388FF',
    desc: 'Audio navigation',
    weights: { safety: 35, lighting: 30, crowd: 15, access: 20 },
  },
];

export default function PreferenceSelector({ selected, onChange }: PreferenceSelectorProps) {
  const selectedProfile = PROFILES.find(p => p.value === selected) || PROFILES[0];

  return (
    <div>
      <div className="text-[10px] text-[#8892B0] font-mono mb-2">USER PROFILE</div>

      {/* Profile Grid */}
      <div className="grid grid-cols-5 gap-1 mb-3">
        {PROFILES.map(profile => (
          <motion.button
            key={profile.value}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(profile.value)}
            className={`relative flex flex-col items-center gap-1 p-2 rounded-lg text-center transition-all ${
              selected === profile.value ? 'border' : 'border border-transparent hover:border-[#8892B0]/20'
            }`}
            style={selected === profile.value ? {
              borderColor: `${profile.color}50`,
              background: `${profile.color}10`,
            } : {}}
          >
            <span className="text-base leading-none">{profile.icon}</span>
            <span
              className="text-[8px] font-mono leading-none"
              style={{ color: selected === profile.value ? profile.color : '#8892B0' }}
            >
              {profile.label.split(' ')[0]}
            </span>
            {selected === profile.value && (
              <motion.div
                layoutId="profile-indicator"
                className="absolute inset-0 rounded-lg"
                style={{ border: `1px solid ${profile.color}30` }}
              />
            )}
          </motion.button>
        ))}
      </div>

      {/* Selected Profile Info */}
      <motion.div
        key={selected}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg p-2.5"
        style={{
          background: `${selectedProfile.color}08`,
          border: `1px solid ${selectedProfile.color}20`
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold" style={{ color: selectedProfile.color }}>
            {selectedProfile.icon} {selectedProfile.label}
          </span>
          <span className="text-[10px] text-[#8892B0]">{selectedProfile.desc}</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {Object.entries(selectedProfile.weights).map(([key, val]) => (
            <div key={key} className="text-center">
              <div className="text-[10px] font-bold font-mono" style={{ color: selectedProfile.color }}>
                {val}%
              </div>
              <div className="text-[8px] text-[#4A5568] capitalize">{key}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}