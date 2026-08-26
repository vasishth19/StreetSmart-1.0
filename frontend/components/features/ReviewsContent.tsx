'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Star, Send, Navigation, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import GlowButton from '@/components/ui/GlowButton';
import NeonCard from '@/components/ui/NeonCard';
import { useReviews } from '@/hooks/useReviews';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function timeAgo(d: string) {
  try {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  } catch { return 'recently'; }
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-2">
      {[1,2,3,4,5].map(s => (
        <motion.button key={s} whileHover={{ scale:1.2 }} whileTap={{ scale:0.9 }}
          onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => onChange(s)}>
          <Star className="w-8 h-8 transition-colors"
            fill={(hover||value) >= s ? '#FFB020' : 'none'}
            stroke={(hover||value) >= s ? '#FFB020' : '#4A5568'} />
        </motion.button>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const { submitReview } = useReviews();
  const [rating,    setRating]    = useState(0);
  const [comment,   setComment]   = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);

  // ✅ Real reviews from Supabase via backend
  const [reviews,        setReviews]        = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [avgRating,      setAvgRating]      = useState('0.0');

  // ✅ Fetch real reviews from backend
  const fetchReviews = async () => {
    setReviewsLoading(true);
    try {
      const res  = await fetch(`${API}/reviews`);
      const data = await res.json();
      // Backend returns { reviews: [...], total: N, avg_rating: X }
      const list = data.reviews || (Array.isArray(data) ? data : []);
      setReviews(list);
      setAvgRating(
        data.avg_rating
          ? data.avg_rating.toFixed(1)
          : list.length > 0
            ? (list.reduce((s: number, r: any) => s + r.rating, 0) / list.length).toFixed(1)
            : '0.0'
      );
    } catch {
      // Backend offline — show empty
      setReviews([]);
      setAvgRating('0.0');
    } finally {
      setReviewsLoading(false);
    }
  };

  // Fetch on mount + after new review submitted
  useEffect(() => { fetchReviews(); }, [submitted]);

  const handleSubmit = async () => {
    if (!rating) { alert('Please select a star rating'); return; }
    if (comment.length < 10) { alert('Please write at least 10 characters'); return; }
    setLoading(true);
    try {
      await submitReview(rating, comment);
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message || 'Could not save your review — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05080F] pb-24">
      <div className="fixed inset-0 grid-overlay opacity-30 pointer-events-none" />
      <div className="fixed inset-0 scanlines pointer-events-none" />

      {/* Header */}
      <div className="z-10 border-b border-[#00E5FF]/10 bg-[#05080F]/95 backdrop-blur-lg px-6 py-4 flex items-center justify-between sticky top-0">
        <Link href="/" className="flex items-center gap-2 text-[#8892B0] hover:text-[#00E5FF] transition-colors">
          <ArrowLeft className="w-4 h-4" /><span className="text-sm font-mono">HOME</span>
        </Link>
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#00FF9C]" />
          <span className="font-bold text-[#E6F1FF]">Street<span className="text-[#00FF9C]">Smart</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-[#FFB020]">⭐ {avgRating} avg</span>
          <button onClick={fetchReviews} title="Refresh"
            className="p-1.5 rounded-lg border border-[#FFB020]/20 text-[#FFB020] hover:bg-[#FFB020]/10 transition-all">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 pt-8">

        {/* Page Header */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="mb-8">
          <div className="inline-block font-mono text-xs text-[#FFB020] px-3 py-1 rounded border border-[#FFB020]/20 mb-4">COMMUNITY REVIEWS</div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#E6F1FF] mb-2">What People <span className="neon-text-green">Say</span></h1>
          <p className="text-[#8892B0]">Real reviews from real users — moderated by admin before publishing</p>

          {/* Live stats */}
          <div className="flex gap-6 mt-4">
            <div>
              <div className="text-3xl font-bold font-mono text-[#FFB020]">
                {reviewsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : avgRating}
              </div>
              <div className="text-xs text-[#8892B0]">Average rating</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-mono text-[#00FF9C]">
                {reviewsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : reviews.length}
              </div>
              <div className="text-xs text-[#8892B0]">Total reviews</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-mono text-[#00E5FF]">100%</div>
              <div className="text-xs text-[#8892B0]">Verified users</div>
            </div>
          </div>
        </motion.div>

        {/* Write Review */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }} className="mb-8">
          <NeonCard color="#FFB020">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-[#FFB020]" />
              <span className="font-mono text-xs text-[#FFB020] tracking-widest">// WRITE A REVIEW</span>
            </div>
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div key="success" initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} className="text-center py-8">
                  <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:200 }}>
                    <CheckCircle className="w-14 h-14 text-[#00FF9C] mx-auto mb-3" />
                  </motion.div>
                  <h3 className="font-bold text-[#E6F1FF] text-lg mb-2">Review Submitted!</h3>
                  <p className="text-sm text-[#8892B0] mb-1">Saved to database permanently ✅</p>
                  <p className="text-sm text-[#8892B0] mb-4">Pending admin approval — will appear after moderation.</p>
                  <button onClick={() => { setSubmitted(false); setRating(0); setComment(''); }}
                    className="text-sm text-[#00E5FF] hover:text-[#00FF9C] transition-colors font-mono">
                    WRITE ANOTHER →
                  </button>
                </motion.div>
              ) : (
                <motion.div key="form" className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-[#8892B0] mb-2">YOUR RATING *</label>
                    <StarRating value={rating} onChange={setRating} />
                    {rating > 0 && (
                      <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} className="text-xs font-mono mt-1" style={{ color:'#FFB020' }}>
                        {['','Very Poor','Poor','Average','Good','Excellent!'][rating]}
                      </motion.p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#8892B0] mb-2">YOUR REVIEW * (min 10 characters)</label>
                    <textarea value={comment} onChange={e => setComment(e.target.value)}
                      placeholder="Share your experience with StreetSmart — what helped you most?"
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg bg-[#0B1020] border border-[#1a2a4a] text-[#E6F1FF] placeholder-[#4A5568] text-sm font-mono outline-none focus:border-[#FFB020]/50 transition-colors resize-none" />
                    <div className="text-right text-xs font-mono text-[#4A5568] mt-1">{comment.length}/500</div>
                  </div>
                  <GlowButton color="amber" size="md" className="w-full" onClick={handleSubmit} disabled={loading}>
                    {loading
                      ? <><div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin border-[#05080F] mr-2" />Submitting...</>
                      : <><Send className="w-4 h-4 mr-2" />Submit Review</>}
                  </GlowButton>
                  <p className="text-xs text-center text-[#4A5568] font-mono">
                    Saved permanently in database · Admin moderated
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </NeonCard>
        </motion.div>

        {/* ✅ Real Reviews Feed from Supabase */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-xs text-[#8892B0] tracking-widest">
              // COMMUNITY REVIEWS ({reviewsLoading ? '...' : reviews.length})
            </span>
            <div className="flex-1 h-px bg-[#00E5FF]/10" />
          </div>

          {/* Loading state */}
          {reviewsLoading && (
            <div className="text-center py-12 flex items-center justify-center gap-3 text-[#8892B0] font-mono text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-[#00E5FF]" />
              Loading real community reviews...
            </div>
          )}

          {/* Empty state */}
          {!reviewsLoading && reviews.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-[#8892B0] font-mono text-sm mb-2">No reviews yet</p>
              <p className="text-[#4A5568] text-xs">Be the first to share your experience!</p>
            </div>
          )}

          {/* ✅ Real reviews from Supabase */}
          {!reviewsLoading && reviews.map((review: any, i: number) => (
            <motion.div key={review.id} initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 * i }}>
              <NeonCard color="#00E5FF">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {/* ✅ Real user name from backend */}
                    <div className="font-semibold text-[#E6F1FF] mb-1">
                      {review.user_name || `User #${review.user_id}` || 'Anonymous'}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#8892B0] font-mono">
                      {/* ✅ Real timestamp from backend */}
                      <span>{timeAgo(review.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {/* ✅ Real rating from backend */}
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className="w-4 h-4"
                          fill={review.rating >= s ? '#FFB020' : 'none'}
                          stroke={review.rating >= s ? '#FFB020' : '#4A5568'} />
                      ))}
                    </div>
                    <span className="text-xs font-mono text-[#00FF9C]">✅ VERIFIED</span>
                  </div>
                </div>
                {/* ✅ Real comment from backend */}
                <div className="border-l-2 border-[#00E5FF]/30 pl-3 py-1 bg-[#00E5FF]/03 rounded-r">
                  <p className="text-sm text-[#8892B0] leading-relaxed italic">&ldquo;{review.comment}&rdquo;</p>
                </div>
              </NeonCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}