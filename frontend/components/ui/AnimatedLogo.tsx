'use client';

import { motion } from 'framer-motion';

interface AnimatedLogoProps {
  size?: number;
  loop?: boolean; // true = idle ambient animation forever; false = play-once intro
}

/**
 * Animated dark-theme neon logo for StreetSmart.
 * - Outer ring "draws" itself in, then pulses with a soft glow
 * - Hex badge rotates in with a 3D-ish tilt via scale/skew, gradient fill
 * - A diagonal shine sweeps across the badge on a loop
 * - "SS" monogram fades/scales in with a glow pulse
 *
 * Note: this is a real animated component (SVG + Framer Motion), meant for
 * use inside the app (splash/loading screens) — NOT for manifest/PWA icon
 * files, which OSes only render as static PNGs.
 */
export default function AnimatedLogo({ size = 220, loop = true }: AnimatedLogoProps) {
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="ss-bg" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#0B1020" />
            <stop offset="100%" stopColor="#05080F" />
          </radialGradient>
          <linearGradient id="ss-hex" x1="10%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stopColor="#9B5DE5" />
            <stop offset="100%" stopColor="#FF69B4" />
          </linearGradient>
          <linearGradient id="ss-shine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id="ss-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="ss-hex-clip">
            <polygon points="256,110 391,183 391,329 256,402 121,329 121,183" />
          </clipPath>
        </defs>

        {/* Background */}
        <circle cx="256" cy="256" r="250" fill="url(#ss-bg)" />

        {/* Outer neon ring — "draws" itself once, then holds */}
        <motion.circle
          cx="256" cy="256" r="196"
          fill="none"
          stroke="#00FF9C"
          strokeWidth="6"
          strokeLinecap="round"
          filter="url(#ss-glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />

        {/* Ambient breathing glow ring (loops forever) */}
        {loop && (
          <motion.circle
            cx="256" cy="256" r="196"
            fill="none"
            stroke="#00E5FF"
            strokeWidth="2"
            filter="url(#ss-glow)"
            initial={{ opacity: 0.15, r: 190 }}
            animate={{ opacity: [0.15, 0.45, 0.15], r: [190, 202, 190] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Hex badge — rotates + scales in for a pseudo-3D "flip" entrance */}
        <motion.g
          initial={{ opacity: 0, scale: 0.4, rotate: -35 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: '256px 256px' }}
        >
          <polygon
            points="256,110 391,183 391,329 256,402 121,329 121,183"
            fill="url(#ss-hex)"
            stroke="#00FF9C"
            strokeWidth="5"
          />
          {/* Diagonal shine sweep, loops */}
          {loop && (
            <motion.rect
              x="-260" y="80" width="120" height="360"
              fill="url(#ss-shine)"
              clipPath="url(#ss-hex-clip)"
              initial={{ x: -260 }}
              animate={{ x: 560 }}
              transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }}
            />
          )}
        </motion.g>

        {/* "SS" monogram */}
        <motion.text
          x="256" y="278"
          textAnchor="middle"
          fontFamily="Poppins, Arial, sans-serif"
          fontWeight={700}
          fontSize="120"
          fill="#F0F6FF"
          filter="url(#ss-glow)"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.9, ease: 'easeOut' }}
        >
          SS
        </motion.text>
      </svg>
    </div>
  );
}