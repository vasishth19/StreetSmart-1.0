'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function LoginRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/account?tab=signin'); }, [router]);
  return null;
}
