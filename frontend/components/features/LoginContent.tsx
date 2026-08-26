'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navigation, Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import GlowButton from '@/components/ui/GlowButton';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { login, loading } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!email || !password) { setError('Please fill all fields'); return; }
    try {
      await login(email, password);
      router.push('/map');
    } catch (e: any) {
      setError(e.message ?? 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-[#05080F] flex items-center justify-center px-4">
      <div className="fixed inset-0 grid-overlay opacity-40 pointer-events-none" />
      <div className="fixed inset-0 scanlines pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#00FF9C]/10 border border-[#00FF9C]/40 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-[#00FF9C]" />
            </div>
            <span className="font-bold text-2xl text-[#E6F1FF]">
              Street<span className="text-[#00FF9C]">Smart</span>
            </span>
          </div>
          <h1 className="text-3xl font-bold text-[#E6F1FF] mb-2">Welcome back</h1>
          <p className="text-[#8892B0] text-sm">Sign in to your navigator account</p>
        </div>

        {/* Card */}
        <div className="glass-panel p-8 rounded-2xl border border-[#00E5FF]/10">

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 text-[#FF3B3B] text-sm mb-4"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-mono text-[#8892B0] mb-1.5">EMAIL</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5568]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#0B1020] border border-[#1a2a4a] text-[#E6F1FF] placeholder-[#4A5568] text-sm font-mono outline-none focus:border-[#00E5FF]/50 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-mono text-[#8892B0] mb-1.5">PASSWORD</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5568]" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-lg bg-[#0B1020] border border-[#1a2a4a] text-[#E6F1FF] placeholder-[#4A5568] text-sm font-mono outline-none focus:border-[#00E5FF]/50 transition-colors"
                />
                <button
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5568] hover:text-[#8892B0]"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-right mt-1.5">
                <Link href="/forgot-password" className="text-xs font-mono text-[#8892B0] hover:text-[#00E5FF] transition-colors">
                  Forgot password?
                </Link>
              </div>
            </div>

            <GlowButton
              color="green"
              size="md"
              className="w-full mt-2"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin border-[#05080F]" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </GlowButton>
          </div>

          <div className="mt-6 text-center text-sm text-[#8892B0]">
            Don't have an account?{' '}
            <Link href="/signup" className="text-[#00E5FF] hover:text-[#00FF9C] transition-colors font-mono">
              Create one →
            </Link>
          </div>

          {/* Demo credentials */}
          <div className="mt-4 p-3 rounded-lg bg-[#0B1020] border border-[#FFB020]/20">
            <p className="text-xs font-mono text-[#FFB020] mb-1">Demo Account</p>
            <p className="text-xs text-[#8892B0] font-mono">demo@streetsmart.city / demo123</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}