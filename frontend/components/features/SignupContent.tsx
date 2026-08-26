'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navigation, Eye, EyeOff, Lock, Mail, User, AlertCircle } from 'lucide-react';
import GlowButton from '@/components/ui/GlowButton';
import { useAuth } from '@/hooks/useAuth';

export default function SignupPage() {
  const router = useRouter();
  const { signup, loading } = useAuth();

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [selectedProfile, setSelectedProfile] = useState('general');

  const handleSubmit = async () => {
    setError('');
    if (!name || !email || !password || !confirm) { setError('Please fill all fields'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return; }
    try {
      await signup(name, email, password);
      router.push('/map');
    } catch (e: any) {
      setError(e.message ?? 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen bg-[#05080F] flex items-center justify-center px-4 py-8">
      <div className="fixed inset-0 grid-overlay opacity-40 pointer-events-none" />
      <div className="fixed inset-0 scanlines pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#00FF9C]/10 border border-[#00FF9C]/40 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-[#00FF9C]" />
            </div>
            <span className="font-bold text-2xl text-[#E6F1FF]">
              Street<span className="text-[#00FF9C]">Smart</span>
            </span>
          </div>
          <h1 className="text-3xl font-bold text-[#E6F1FF] mb-2">Create account</h1>
          <p className="text-[#8892B0] text-sm">Join the safest navigation community</p>
        </div>

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
            <div>
              <label className="block text-xs font-mono text-[#8892B0] mb-1.5">FULL NAME</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5568]" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#0B1020] border border-[#1a2a4a] text-[#E6F1FF] placeholder-[#4A5568] text-sm font-mono outline-none focus:border-[#00E5FF]/50 transition-colors" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8892B0] mb-1.5">EMAIL</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5568]" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#0B1020] border border-[#1a2a4a] text-[#E6F1FF] placeholder-[#4A5568] text-sm font-mono outline-none focus:border-[#00E5FF]/50 transition-colors" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8892B0] mb-1.5">PASSWORD</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5568]" />
                <input type={showPw ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters"
                  className="w-full pl-10 pr-10 py-3 rounded-lg bg-[#0B1020] border border-[#1a2a4a] text-[#E6F1FF] placeholder-[#4A5568] text-sm font-mono outline-none focus:border-[#00E5FF]/50 transition-colors" />
                <button onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5568] hover:text-[#8892B0]">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8892B0] mb-1.5">CONFIRM PASSWORD</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5568]" />
                <input type={showPw ? 'text' : 'password'} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#0B1020] border border-[#1a2a4a] text-[#E6F1FF] placeholder-[#4A5568] text-sm font-mono outline-none focus:border-[#00E5FF]/50 transition-colors" />
              </div>
            </div>

            {/* Profile Selector */}
            <div>
              <label className="block text-xs font-mono text-[#8892B0] mb-2">SELECT YOUR PROFILE</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value:'general', label:'General', icon:'🧑' },
                  { value:'woman', label:'Women', icon:'👩' },
                  { value:'elderly', label:'Elderly', icon:'🧓' },
                  { value:'wheelchair', label:'Wheelchair', icon:'♿' },
                  { value:'visually_impaired', label:'Vis. Impaired', icon:'👁️' },
                  { value:'child', label:'Child', icon:'👶' },
                ].map(p => (
                  <button key={p.value} type="button"
                    onClick={() => setSelectedProfile(p.value)}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg border transition-all"
                    style={selectedProfile === p.value
                      ? { borderColor:'#00FF9C50', background:'#00FF9C12', color:'#00FF9C' }
                      : { borderColor:'rgba(26,42,74,1)', background:'transparent', color:'#8892B0' }}>
                    <span className="text-xl">{p.icon}</span>
                    <span className="text-xs font-mono">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <GlowButton color="green" size="md" className="w-full mt-2"
              onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin border-[#05080F]" />
                  Creating account...
                </span>
              ) : 'Create Account'}
            </GlowButton>
          </div>

          <div className="mt-6 text-center text-sm text-[#8892B0]">
            Already have an account?{' '}
            <Link href="/login" className="text-[#00E5FF] hover:text-[#00FF9C] transition-colors font-mono">
              Sign in →
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}