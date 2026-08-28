'use client';

import PWAInstallBanner from '@/components/ui/PWAInstallBanner';
import AnimatedLogo from '@/components/ui/AnimatedLogo';
import { Suspense, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Shield,
  Navigation,
  Accessibility,
  Volume2,
  ChevronRight,
  Map,
  BarChart3,
  AlertTriangle,
  Star,
  User,
  Lock,
  FileText,
  ParkingCircle,
} from 'lucide-react';

import GlowButton from '@/components/ui/GlowButton';
import NeonCard from '@/components/ui/NeonCard';

const CityScene = dynamic(() => import('@/components/three/CityScene'), {
  ssr: false,
  loading: () => <SceneLoader />,
});

function SceneLoader() {
  return (
    <div className="w-full h-full bg-[#05080F] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border border-[#00E5FF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[#00E5FF] font-mono text-xs tracking-widest animate-pulse">
          LOADING CITY SIMULATION...
        </p>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: Shield,
    title: "Women's Safety, Built In",
    description:
      'Every route is scored for isolation, lighting and community-flagged risk — designed first for women navigating alone.',
    color: '#FF69B4',
  },
  {
    icon: Shield,
    title: 'Safety-First Routing',
    description:
      'Routes scored by real-time crime data, lighting, CCTV coverage and community reports.',
    color: '#00FF9C',
  },
  {
    icon: Accessibility,
    title: 'Universal Accessibility',
    description:
      'Wheelchair ramps, smooth surfaces, no stairs — every body navigates with confidence.',
    color: '#00E5FF',
  },
  {
    icon: Volume2,
    title: 'Audio Navigation',
    description:
      'Turn-by-turn voice guidance for visually impaired users — completely hands-free.',
    color: '#B388FF',
  },
  {
    icon: BarChart3,
    title: 'Smart City Analytics',
    description:
      'Live safety heatmaps, crowd prediction, and infrastructure intelligence dashboards.',
    color: '#FFB020',
  },
  {
    icon: FileText,
    title: 'Civic Issue Reports',
    description:
      'Report safety issues with photo and video evidence. Community-powered city intelligence.',
    color: '#FF3B3B',
  },
  {
    icon: Lock,
    title: 'Admin Control Panel',
    description:
      'Owner-verified admin panel to approve reports, moderate reviews and manage users.',
    color: '#9B5DE5',
  },
  {
    icon: ParkingCircle,
    title: 'Smart Parking',
    description:
      'Find nearby parking, check availability and navigate directly to available parking spaces.',
    color: '#00FF9C',
  },
];

const PROFILES = [
  {
    label: 'Women',
    icon: '👩',
    color: '#FF69B4',
    desc: 'Safe, lit, monitored routes — avoids isolated paths',
  },
  {
    label: 'Elderly',
    icon: '🧓',
    color: '#FFB020',
    desc: 'No stairs, shorter routes, rest stop proximity',
  },
  {
    label: 'Wheelchair',
    icon: '♿',
    color: '#00FF9C',
    desc: 'Full accessibility — ramps, smooth surfaces only',
  },
  {
    label: 'Visually Impaired',
    icon: '👁️',
    color: '#B388FF',
    desc: 'Audio-first navigation, high contrast mode',
  },
];

const STATS = [
  { value: '98.2%', label: 'Safety Rate', color: '#00FF9C' },
  { value: '12', label: 'Cities Covered', color: '#00E5FF' },
  { value: '2.7K', label: 'Routes Today', color: '#FFB020' },
  { value: '4.9★', label: 'User Rating', color: '#B388FF' },
];

const QUICK_LINKS = [
  {
    href: '/map',
    label: 'Navigate',
    desc: 'Safety-scored routes, live voice guidance',
    icon: '🗺️',
    color: '#00FF9C',
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    desc: 'City analytics · your profile · your reviews',
    icon: '📊',
    color: '#00E5FF',
  },
  {
    href: '/community',
    label: 'Community',
    desc: 'Civic reports · admin moderation',
    icon: '🚨',
    color: '#FF3B3B',
  },
  {
    href: '/account',
    label: 'Account',
    desc: 'Sign in or create your account',
    icon: '🔑',
    color: '#B388FF',
  },
];

export default function LandingPage() {
  const [loaded, setLoaded] = useState(false);
  const [activeProfile, setActiveProfile] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveProfile((p) => (p + 1) % PROFILES.length);
    }, 3000);

    return () => clearInterval(id);
  }, []);

  return (
    <main className="relative min-h-screen bg-[#05080F] overflow-hidden">
      <PWAInstallBanner />

      <div className="fixed inset-0 grid-overlay opacity-50 pointer-events-none z-0" />
      <div className="fixed inset-0 scanlines pointer-events-none z-0" />

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col">
        <div className="absolute inset-0 z-0">
          <Suspense fallback={<SceneLoader />}>
            <CityScene />
          </Suspense>
        </div>

        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(5,8,15,0.75) 0%, rgba(5,8,15,0.35) 30%, rgba(5,8,15,0.45) 55%, rgba(5,8,15,0.75) 78%, rgba(5,8,15,1) 100%)',
          }}
        />

        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 46%, rgba(5,8,15,0.55) 0%, rgba(5,8,15,0) 70%)',
          }}
        />

        {/* Nav */}
        <nav className="relative z-20 flex items-center justify-between px-6 py-4 lg:px-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2"
          >
            <AnimatedLogo size={34} loop={false} />

            <span className="font-bold text-lg tracking-tight text-[#E6F1FF]">
              Street<span className="text-[#00FF9C]">Smart</span>
            </span>

            <span className="font-mono text-xs text-[#8892B0] hidden sm:block">
              v1.0
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2"
          >
            <Link href="/map">
              <GlowButton color="cyan" size="sm">
                Launch Navigator
              </GlowButton>
            </Link>

            <Link href="/account?tab=signin">
              <button className="hidden sm:block text-sm text-[#CCD6F6] hover:text-[#00E5FF] transition-colors px-4 py-2">
                Sign In
              </button>
            </Link>

            <Link href="/community?tab=admin">
              <button className="hidden md:block text-xs text-[#9B5DE5] hover:text-[#B388FF] transition-colors px-3 py-2 border border-[#9B5DE5]/30 rounded-lg font-mono">
                🔐 ADMIN
              </button>
            </Link>
          </motion.div>
        </nav>

        {/* Hero content */}
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center text-center px-4 pb-24">
          <AnimatePresence>
            {loaded && (
              <>
                <motion.div
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6 }}
                  className="mb-2"
                >
                  <AnimatedLogo size={140} loop />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel text-xs font-mono text-[#FF69B4] border border-[#FF69B4]/30"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF69B4] animate-pulse" />
                  👩 BUILT FOR WOMEN'S SAFETY FIRST
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel text-xs font-mono text-[#00FF9C] border border-[#00FF9C]/20"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00FF9C] animate-pulse" />
                  SMART CITY NAVIGATION · ONLINE
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-none tracking-tight"
                  style={{
                    textShadow:
                      '0 2px 40px rgba(0,0,0,0.95), 0 0 80px rgba(0,0,0,0.6)',
                  }}
                >
                  Navigate{' '}
                  <span className="neon-text-green">Safer.</span>
                  <br />
                  Navigate{' '}
                  <span className="neon-text-cyan">Smarter.</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="max-w-2xl text-lg md:text-xl text-[#CCD6F6] mb-10 leading-relaxed"
                  style={{
                    textShadow: '0 1px 20px rgba(0,0,0,1)',
                  }}
                >
                  The first navigation platform that optimizes for{' '}
                  <span className="text-[#00FF9C] font-semibold">
                    safety
                  </span>
                  ,{' '}
                  <span className="text-[#00E5FF] font-semibold">
                    accessibility
                  </span>
                  , and{' '}
                  <span className="text-[#B388FF] font-semibold">
                    inclusivity
                  </span>{' '}
                  — not just speed. Built for the cities of tomorrow.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 }}
                  className="flex flex-wrap gap-2 justify-center mb-6"
                >
                  {PROFILES.map((profile, i) => (
                    <motion.button
                      key={profile.label}
                      onClick={() => setActiveProfile(i)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border backdrop-blur-sm"
                      style={
                        activeProfile === i
                          ? {
                              borderColor: `${profile.color}60`,
                              background: `${profile.color}20`,
                              color: profile.color,
                            }
                          : {
                              borderColor: 'rgba(204,214,246,0.3)',
                              color: '#CCD6F6',
                              background: 'rgba(5,8,15,0.55)',
                            }
                      }
                    >
                      <span>{profile.icon}</span>
                      <span>{profile.label}</span>
                    </motion.button>
                  ))}
                </motion.div>

                <motion.p
                  key={activeProfile}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="text-sm text-[#CCD6F6] mb-10 font-mono h-5"
                  style={{
                    textShadow: '0 1px 12px rgba(0,0,0,1)',
                  }}
                >
                  {PROFILES[activeProfile].desc}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.85 }}
                  className="flex flex-col sm:flex-row gap-4 items-center"
                >
                  <Link href="/map">
                    <GlowButton
                      color="green"
                      size="lg"
                      className="min-w-48"
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      Start Navigating
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </GlowButton>
                  </Link>

                  <Link href="/account?tab=signup">
                    <GlowButton
                      color="cyan"
                      size="lg"
                      variant="outline"
                      className="min-w-48"
                    >
                      <User className="w-4 h-4 mr-2" />
                      Create Account
                    </GlowButton>
                  </Link>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="relative z-20 border-t border-[#00E5FF]/10 bg-[#05080F]/90 backdrop-blur-lg"
        >
          <div className="max-w-4xl mx-auto px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div
                  className="text-2xl font-bold font-mono"
                  style={{
                    color: stat.color,
                    textShadow: `0 0 20px ${stat.color}40`,
                  }}
                >
                  {stat.value}
                </div>

                <div className="text-xs text-[#CCD6F6] mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── QUICK ACCESS GRID ── */}
      <section className="relative z-10 border-b border-[#00E5FF]/10 bg-[#05080F]/95 backdrop-blur-lg py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_LINKS.map((link, i) => (
              <Link key={link.href + link.label} href={link.href}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{
                    y: -4,
                    borderColor: link.color,
                  }}
                  whileTap={{ scale: 0.97 }}
                  className="group flex flex-col items-start gap-1 p-4 rounded-xl border cursor-pointer transition-colors duration-200"
                  style={{
                    borderColor: `${link.color}25`,
                    background: `${link.color}0A`,
                    boxShadow: `0 0 0px ${link.color}00`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 24px ${link.color}30`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0px ${link.color}00`;
                  }}
                >
                  <span className="text-xl">{link.icon}</span>

                  <span
                    className="text-sm font-semibold"
                    style={{ color: link.color }}
                  >
                    {link.label}
                  </span>

                  <span className="text-xs text-[#8892B0] leading-snug">
                    {link.desc}
                  </span>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative z-10 py-24 px-4 md:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-block font-mono text-xs text-[#00E5FF] px-3 py-1 rounded border border-[#00E5FF]/20 mb-4">
              CORE CAPABILITIES
            </div>

            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Built for Every{' '}
              <span className="neon-text-green">Body</span>
            </h2>

            <p className="text-[#8892B0] text-lg max-w-2xl mx-auto">
              Smart City infrastructure-grade navigation intelligence
            </p>
          </motion.div>

          {/* 8 Features = 2 Rows × 4 Columns on Large Screens */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <NeonCard color={feature.color} className="h-full">
                  <div className="flex gap-4">
                    <div
                      className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{
                        background: `${feature.color}15`,
                        border: `1px solid ${feature.color}30`,
                      }}
                    >
                      <feature.icon
                        className="w-5 h-5"
                        style={{ color: feature.color }}
                      />
                    </div>

                    <div>
                      <h3 className="font-semibold text-[#E6F1FF] mb-2">
                        {feature.title}
                      </h3>

                      <p className="text-sm text-[#8892B0] leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </NeonCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCORING FORMULA ── */}
      <section className="relative z-10 py-24 px-4 md:px-8 lg:px-16">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-panel p-8 md:p-12 text-center"
          >
            <div className="inline-block font-mono text-xs text-[#FFB020] px-3 py-1 rounded border border-[#FFB020]/20 mb-6">
              ROUTE SCORING ENGINE
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-8">
              Intelligent{' '}
              <span className="neon-text-cyan">Multi-Factor</span>{' '}
              Scoring
            </h2>

            <div className="font-mono text-sm md:text-base bg-[#05080F] rounded-lg p-6 text-left mb-8 border border-[#00E5FF]/10">
              <div className="text-[#8892B0] mb-3">
                // Route Score Computation
              </div>

              <div className="text-[#E6F1FF]">
                <span className="text-[#B388FF]">score</span>
                {' = '}
                <span className="text-[#FFB020]">0.35</span>
                {' × '}
                <span className="text-[#FF3B3B]">safety</span>
              </div>

              <div className="text-[#E6F1FF] mt-1 ml-8">
                {'+ '}
                <span className="text-[#FFB020]">0.25</span>
                {' × '}
                <span className="text-[#FFE082]">lighting</span>
              </div>

              <div className="text-[#E6F1FF] mt-1 ml-8">
                {'+ '}
                <span className="text-[#FFB020]">0.20</span>
                {' × '}
                <span className="text-[#00E5FF]">crowd</span>
              </div>

              <div className="text-[#E6F1FF] mt-1 ml-8">
                {'+ '}
                <span className="text-[#FFB020]">0.20</span>
                {' × '}
                <span className="text-[#00FF9C]">accessibility</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {[
                ['Safety', '35%', '#FF3B3B'],
                ['Lighting', '25%', '#FFE082'],
                ['Crowd', '20%', '#00E5FF'],
                ['Accessibility', '20%', '#00FF9C'],
              ].map(([l, w, c]) => (
                <div key={l} className="hud-stat text-center">
                  <div
                    className="text-2xl font-bold font-mono"
                    style={{ color: c }}
                  >
                    {w}
                  </div>

                  <div className="text-xs text-[#8892B0] mt-1">
                    {l}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SIGN UP + LOGIN ── */}
      <section className="relative z-10 py-24 px-4 border-t border-[#00E5FF]/10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-block font-mono text-xs text-[#9B5DE5] px-3 py-1 rounded border border-[#9B5DE5]/20 mb-6">
              JOIN STREETSMART
            </div>

            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Ready to Navigate{' '}
              <span className="neon-text-green">Safely</span>?
            </h2>

            <p className="text-[#8892B0] text-lg mb-10 max-w-xl mx-auto">
              Create your account and navigate safer today. Already have an
              account? Sign in below.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/account?tab=signup">
                <GlowButton color="green" size="lg">
                  <User className="w-4 h-4 mr-2" />
                  Create Account
                </GlowButton>
              </Link>

              <Link href="/account?tab=signin">
                <GlowButton color="cyan" size="lg" variant="outline">
                  <Lock className="w-4 h-4 mr-2" />
                  Sign In
                </GlowButton>
              </Link>
            </div>

            <Link href="/community?tab=admin">
              <motion.div
                whileHover={{ scale: 1.03 }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#9B5DE5]/30 bg-[#9B5DE5]/05 text-[#9B5DE5] text-sm font-mono cursor-pointer transition-all hover:bg-[#9B5DE5]/15"
              >
                🔐 Admin / Owner Access Panel
              </motion.div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 py-16 px-4 text-center border-t border-[#00E5FF]/10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/map">
              <GlowButton color="green" size="md">
                <Map className="w-4 h-4 mr-2" />
                Open Navigator
              </GlowButton>
            </Link>

            <Link href="/community?tab=report">
              <GlowButton color="amber" size="md" variant="outline">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Report Issue
              </GlowButton>
            </Link>

            <Link href="/dashboard?tab=overview">
              <GlowButton color="cyan" size="md" variant="outline">
                <BarChart3 className="w-4 h-4 mr-2" />
                Dashboard
              </GlowButton>
            </Link>

            <Link href="/dashboard?tab=reviews">
              <GlowButton color="purple" size="md" variant="outline">
                <Star className="w-4 h-4 mr-2" />
                Reviews
              </GlowButton>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-[#00E5FF]/10 py-8 px-6 text-center">
        <p className="text-[#8892B0] text-sm font-mono">
          StreetSmart v1.0 · Smart City Navigation · Built for Inclusivity
        </p>

        <p className="text-xs font-mono mt-2">
          <span className="text-white">Built by</span>{' '}
          <span className="text-[#00FF9C]">Vansh Chaturvedi</span>
          {' · '}
          <span className="text-[#00FF9C]">Assmi Singh</span>
          {' · '}
          <span className="text-[#00FF9C]">and team</span>
          {' · '}
          <span className="text-white">2026</span>
        </p>
      </footer>
    </main>
  );
}