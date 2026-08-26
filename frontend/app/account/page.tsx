'use client';

import { Suspense } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import TabHub from '@/components/ui/TabHub';
import LoginContent from '@/components/features/LoginContent';
import SignupContent from '@/components/features/SignupContent';

export default function AccountHub() {
  return (
    <Suspense fallback={null}>
      <TabHub
        title="Account"
        subtitle="SIGN IN · SIGN UP"
        tabs={[
          { key: 'signin', label: 'Sign In', icon: <LogIn className="w-4 h-4" />,    color: '#00E5FF', content: <LoginContent /> },
          { key: 'signup', label: 'Sign Up', icon: <UserPlus className="w-4 h-4" />, color: '#00FF9C', content: <SignupContent /> },
        ]}
      />
    </Suspense>
  );
}
