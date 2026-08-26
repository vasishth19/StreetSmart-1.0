'use client';

// Loads the real Google Maps JavaScript API from Google's CDN using your own
// API key (set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local / your host's
// env vars). This is the actual Google Maps product — not a lookalike.

declare global {
  interface Window {
    google: any;
    _googleMapsLoaded?: boolean;
    _googleMapsLoading?: Promise<void>;
  }
}

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window._googleMapsLoaded && window.google?.maps) return Promise.resolve();
  if (window._googleMapsLoading) return window._googleMapsLoading;

  window._googleMapsLoading = new Promise((resolve, reject) => {
    const cbName = '__streetsmart_gmaps_cb';
    (window as any)[cbName] = () => {
      window._googleMapsLoaded = true;
      resolve();
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization,geometry&v=weekly&callback=${cbName}`;
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load Google Maps — check your API key and billing status'));
    document.head.appendChild(script);
  });

  return window._googleMapsLoading;
}

export function hasGoogleMapsKey(): boolean {
  return !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}
