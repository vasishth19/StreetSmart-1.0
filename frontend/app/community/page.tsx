'use client';

import { Suspense } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import TabHub from '@/components/ui/TabHub';
import ReportContent from '@/components/features/ReportContent';
import AdminContent from '@/components/features/AdminContent';

export default function CommunityHub() {
  return (
    <Suspense fallback={null}>
      <TabHub
        title="Community"
        subtitle="CIVIC REPORTS · ADMIN MODERATION"
        tabs={[
          { key: 'report', label: 'Reports', icon: <AlertTriangle className="w-4 h-4" />, color: '#FF3B3B', content: <ReportContent /> },
          { key: 'admin',  label: 'Admin',   icon: <ShieldCheck className="w-4 h-4" />,    color: '#9B5DE5', content: <AdminContent /> },
        ]}
      />
    </Suspense>
  );
}
