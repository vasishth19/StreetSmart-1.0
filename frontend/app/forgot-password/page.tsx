'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Navigation, Mail, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import GlowButton from '@/components/ui/GlowButton';
import { useAuth } from '@/hooks/useAuth';

export default function ForgotPasswordPage() {
  const { forgotPassword, loading } = useAuth();

  const [email,     setEmail]     = useState('');
  const [error,     setError]     = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!email) { setError('Please enter your email'); return; }
    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#00FF9C]/10 border border-[#00FF9C]/40 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-[#00FF9C]" />
            </div>
            <span className="font-bold text-2xl text-[#E6F1FF]">
              Street<span className="text-[#00FF9C]">Smart</span>
            </span>
          </div>
          <h1 className="text-3xl font-bold text-[#E6F1FF] mb-2">Reset your password</h1>
          <p className="text-[#8892B0] text-sm">We'll email you a link to set a new one</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl border border-[#00E5FF]/10">
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-4"
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#00FF9C]/10 border border-[#00FF9C]/40 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-[#00FF9C]" />
              </div>
              <p className="text-[#E6F1FF] font-semibold mb-2">Check your email</p>
              <p className="text-[#8892B0] text-sm leading-relaxed">
                If <span className="text-[#CCD6F6]">{email}</span> is registered, we've sent a link to reset your password. It expires in 30 minutes.
              </p>
            </motion.div>
          ) : (
            <>
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
                      Sending...
                    </span>
                  ) : 'Send reset link'}
                </GlowButton>
              </div>
            </>
          )}

          <div className="mt-6 text-center text-sm">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-[#00E5FF] hover:text-[#00FF9C] transition-colors font-mono">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
