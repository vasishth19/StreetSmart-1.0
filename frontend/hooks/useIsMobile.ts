'use client';

import { useEffect, useState } from 'react';

// true on phones / narrow windows (matches Tailwind's `md` breakpoint = 768px)
export function useIsMobile(breakpointPx = 768): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpointPx]);
  return mobile;
}
