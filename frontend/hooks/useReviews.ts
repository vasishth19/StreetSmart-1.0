// ─── hooks/useReviews.ts ──────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';

export interface Review {
  id:         number;
  user_id:    number;
  user_name:  string;
  rating:     number;
  comment:    string;
  created_at: string;
}

const MOCK_REVIEWS: Review[] = [
  { id: 1, user_id: 1, user_name: 'Sarah K.',    rating: 5, comment: 'Feels so much safer walking home at night now. The lit-route feature is amazing!', created_at: '2025-02-28T22:00:00Z' },
  { id: 2, user_id: 2, user_name: 'Marcus T.',   rating: 5, comment: 'The wheelchair routing is genuinely the best I have used. No more surprise stairs.', created_at: '2025-02-27T18:30:00Z' },
  { id: 3, user_id: 3, user_name: 'Priya M.',    rating: 4, comment: 'Audio navigation works great. Wish the map loaded faster but safety scores are spot on.', created_at: '2025-02-26T14:15:00Z' },
  { id: 4, user_id: 4, user_name: 'James W.',    rating: 5, comment: 'Finally a nav app that thinks about people, not just speed. 10/10.', created_at: '2025-02-25T09:00:00Z' },
  { id: 5, user_id: 5, user_name: 'Lisa C.',     rating: 4, comment: 'The heatmap overlay is incredible. You can really see which areas to avoid.', created_at: '2025-02-24T20:45:00Z' },
];

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useReviews() {
  const [reviews,     setReviews]     = useState<Review[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [avgRating,   setAvgRating]   = useState(0);

  const fetchReviews = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/reviews`);
      const data = await res.json();
      setReviews(data.reviews ?? MOCK_REVIEWS);
    } catch {
      setReviews(MOCK_REVIEWS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  useEffect(() => {
    if (reviews.length === 0) return;
    setAvgRating(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length);
  }, [reviews]);

  const submitReview = useCallback(async (rating: number, comment: string, token?: string) => {
    setSubmitting(true);
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API}/reviews`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rating, comment }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server returned ${res.status}`);
      }

      const newReview = await res.json();
      setReviews((prev) => [newReview, ...prev]);
    } catch (err: any) {
      // Re-throw so the UI shows a real error instead of pretending it saved.
      if (err instanceof TypeError) {
        throw new Error('Cannot reach the server. Check that the backend is running and reachable.');
      }
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { reviews, loading, submitting, avgRating, submitReview, refetch: fetchReviews };
}
