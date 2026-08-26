'use client';

import { Suspense } from 'react';
import { BarChart3, User, Star } from 'lucide-react';
import TabHub from '@/components/ui/TabHub';
import DashboardContent from '@/components/features/DashboardContent';
import ProfileContent from '@/components/features/ProfileContent';
import ReviewsContent from '@/components/features/ReviewsContent';

export default function DashboardHub() {
  return (
    <Suspense fallback={null}>
      <TabHub
        title="Dashboard"
        subtitle="ANALYTICS · PROFILE · REVIEWS"
        tabs={[
          { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" />, color: '#00E5FF', content: <DashboardContent /> },
          { key: 'profile',  label: 'Profile',  icon: <User className="w-4 h-4" />,      color: '#B388FF', content: <ProfileContent /> },
          { key: 'reviews',  label: 'Reviews',  icon: <Star className="w-4 h-4" />,      color: '#FFB020', content: <ReviewsContent /> },
        ]}
      />
    </Suspense>
  );
}
