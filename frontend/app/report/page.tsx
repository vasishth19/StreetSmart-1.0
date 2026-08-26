'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function ReportRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/community?tab=report'); }, [router]);
  return null;
}
