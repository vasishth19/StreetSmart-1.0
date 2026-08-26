'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface AnimatedLogoProps {
  size?: number;
  loop?: boolean; // true = idle ambient glow pulse forever; false = play-once intro
}

/**
 * Animated logo for StreetSmart using the actual brand artwork.
 * Reuses the existing PWA icon (public/icons/icon-512x512.png) as the
 * image source — no separate logo asset needed.
 * - Image scales/fades in on mount
 * - Neon green glow pulses softly behind it on a loop
 * - Used in the nav bar (small) and hero section (large)
 */
export default function AnimatedLogo({ size = 220, loop = true }: AnimatedLogoProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Ambient glow behind the logo, pulses forever */}
      {loop && (
        <motion.div
          initial={{ opacity: 0.25, scale: 0.9 }}
          animate={{ opacity: [0.25, 0.55, 0.25], scale: [0.9, 1.05, 0.9] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(0,255,156,0.45) 0%, rgba(0,255,156,0) 70%)',
            filter: 'blur(12px)',
          }}
        />
      )}

      {/* Logo entrance: fade + scale in */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: 'relative', width: '100%', height: '100%' }}
      >
        <Image
          src="/icons/icon-512x512.png"
          alt="StreetSmart"
          fill
          sizes={`${size}px`}
          style={{ objectFit: 'contain' }}
          priority
        />
      </motion.div>
    </div>
  );
}