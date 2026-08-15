'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Siren, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEmergencyContacts } from '@/hooks/useEmergencyContacts';
import { apiService } from '@/services/api';

const HOLD_MS = 1500;

export default function SOSButton() {
  const { contacts } = useEmergencyContacts();
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [firing, setFiring] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  const clearHold = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setHolding(false);
    setProgress(0);
  };

  const startHold = () => {
    if (firing) return;
    setHolding(true);
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - startRef.current) / HOLD_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearHold();
        fireSOS();
      }
    }, 30);
  };

  const fireSOS = () => {
    if (!navigator.geolocation) {
      toast.error('Location unavailable on this device');
      return;
    }
    setFiring(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
        const message = `SOS! I need help. My live location: ${mapsLink}`;

        // Best-effort log for the admin/live dashboard — never blocks the alert
        apiService
          .triggerSOS({ lat, lng, accuracy, contact_count: contacts.length })
          .catch(() => {});

        if (contacts.length === 0) {
          toast.error('No emergency contacts saved — add some in your Profile');
        } else {
          // Open an SMS composer pre-filled per contact. Browsers only allow
          // one app-switch reliably, so we open the first directly and give
          // WhatsApp fallbacks for the rest via a toast the user can tap.
          window.location.href = `sms:${contacts[0].phone}?body=${encodeURIComponent(message)}`;
          if (contacts.length > 1) {
            toast(
              `Also alert: ${contacts.slice(1).map(c => c.name).join(', ')}`,
              { icon: '📨', duration: 6000 }
            );
          }
          toast.success('SOS triggered — sending your location');
        }
        setFiring(false);
      },
      () => {
        toast.error('Could not get your location — check location permissions');
        setFiring(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="fixed bottom-6 right-6 z-[950]">
      <AnimatePresence>
        {holding && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-full right-0 mb-3 px-3 py-2 rounded-lg bg-[#0B1020] border border-[#FF3B3B]/40 text-xs font-mono text-[#FF3B3B] whitespace-nowrap"
          >
            Keep holding to send SOS...
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        aria-label="Hold to trigger SOS emergency alert"
        onMouseDown={startHold}
        onMouseUp={clearHold}
        onMouseLeave={clearHold}
        onTouchStart={startHold}
        onTouchEnd={clearHold}
        whileTap={{ scale: 0.95 }}
        disabled={firing}
        className="relative w-16 h-16 rounded-full bg-[#FF3B3B]/90 shadow-[0_0_25px_rgba(255,59,59,0.5)] flex items-center justify-center text-white disabled:opacity-60"
      >
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="29" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
          <circle
            cx="32" cy="32" r="29" fill="none" stroke="white" strokeWidth="3"
            strokeDasharray={2 * Math.PI * 29}
            strokeDashoffset={2 * Math.PI * 29 * (1 - progress / 100)}
            strokeLinecap="round"
          />
        </svg>
        {firing ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Siren className="w-6 h-6" />
        )}
      </motion.button>
    </div>
  );
}
