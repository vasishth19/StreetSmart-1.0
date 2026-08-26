'use client';

import { useState, ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export interface HubTab {
  key: string;
  label: string;
  icon: ReactNode;
  color: string;
  content: ReactNode;
}

export default function TabHub({
  title,
  subtitle,
  tabs,
  paramKey = 'tab',
}: {
  title: string;
  subtitle: string;
  tabs: HubTab[];
  paramKey?: string;
}) {
  const searchParams = useSearchParams();
  const initial = searchParams.get(paramKey);
  const [active, setActive] = useState(
    tabs.find((t) => t.key === initial)?.key ?? tabs[0].key
  );

  useEffect(() => {
    const fromUrl = searchParams.get(paramKey);
    if (fromUrl && tabs.some((t) => t.key === fromUrl)) setActive(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <main className="relative min-h-screen bg-[#05080F]">
      <div className="fixed inset-0 grid-overlay opacity-30 pointer-events-none z-0" />

      {/* Top bar */}
      <div className="relative z-20 border-b border-[#00E5FF]/10 bg-[#05080F]/90 backdrop-blur-md sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-[#8892B0] hover:text-[#00E5FF] transition-colors font-mono"
            >
              <ArrowLeft className="w-4 h-4" /> Home
            </Link>
            <div className="text-right">
              <h1 className="text-lg font-bold text-[#E6F1FF] leading-tight">{title}</h1>
              <p className="text-xs text-[#8892B0] font-mono">{subtitle}</p>
            </div>
          </div>

          {/* Tab strip */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {tabs.map((t) => {
              const isActive = t.key === activeTab.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActive(t.key)}
                  className="relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors"
                  style={{ color: isActive ? t.color : '#8892B0' }}
                >
                  <span className="w-4 h-4 flex items-center justify-center">{t.icon}</span>
                  {t.label}
                  {isActive && (
                    <motion.div
                      layoutId={`hub-underline-${title}`}
                      className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full"
                      style={{ background: t.color, boxShadow: `0 0 8px ${t.color}` }}
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Panel */}
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
