import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import SOSButton from '@/components/ui/SOSButton';
import PWAInstallBanner from '@/components/ui/PWAInstallBanner';
import '@/styles/globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets:  ['latin'],
  variable: '--font-space',
  display:  'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets:  ['latin'],
  variable: '--font-mono',
  display:  'swap',
});

// ── PWA + SEO Metadata ────────────────────────────────────────────
export const metadata: Metadata = {
  title:       'StreetSmart — Safety Navigation',
  description: 'Safety-first navigation optimized for safety, lighting, accessibility and inclusivity.',
  manifest:    '/manifest.json',
  appleWebApp: {
    capable:           true,
    statusBarStyle:    'black-translucent',
    title:             'StreetSmart',
    startupImage:      '/icons/icon-512x512.png',
  },
  icons: {
    icon:    [
      { url: '/icons/icon-32x32.png',   sizes: '32x32',   type: 'image/png' },
      { url: '/icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple:   [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/icons/icon-512x512.png', color: '#00FF9C' },
    ],
  },
  other: {
    'mobile-web-app-capable':          'yes',
    'apple-mobile-web-app-capable':    'yes',
    'application-name':                'StreetSmart',
    'apple-mobile-web-app-title':      'StreetSmart',
    'msapplication-TileColor':         '#05080F',
    'msapplication-TileImage':         '/icons/icon-144x144.png',
  },
};

export const viewport: Viewport = {
  width:                'device-width',
  initialScale:         1,
  maximumScale:         1,
  userScalable:         false,
  themeColor:           '#05080F',
  colorScheme:          'dark',
  viewportFit:          'cover',   // iPhone notch support
};

// ── Service Worker registration script ───────────────────────────
const SW_SCRIPT = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(reg) {
        console.log('[StreetSmart] SW registered:', reg.scope);
      })
      .catch(function(err) {
        console.warn('[StreetSmart] SW registration failed:', err);
      });
  });
}
`;

// ── Install prompt script ─────────────────────────────────────────
// Stores the beforeinstallprompt event so we can trigger it later
const INSTALL_SCRIPT = `
window.__pwaInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  window.__pwaInstallPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-install-available'));
  console.log('[StreetSmart] App is installable');
});
window.addEventListener('appinstalled', function() {
  window.__pwaInstallPrompt = null;
  console.log('[StreetSmart] App installed successfully!');
});
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* PWA color for browser chrome */}
        <meta name="theme-color" content="#05080F" />
        {/* iOS full-screen */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Prevent phone number detection on iOS */}
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={`${spaceGrotesk.className} bg-[#05080F] text-[#E6F1FF] antialiased`}>

        {/* Skip to content for screen readers */}
        <a href="#main-content"
          className="fixed top-0 left-0 z-[9999] px-4 py-2 bg-[#00FF9C] text-[#05080F] font-bold text-sm -translate-y-full focus:translate-y-0 transition-transform">
          Skip to content
        </a>

        {/* Global top nav */}
        <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:900, background:'rgba(5,8,15,0.97)', borderBottom:'1px solid rgba(0,229,255,0.1)', backdropFilter:'blur(20px)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1.5rem', height:'56px' }}>
          <a href="/" style={{ fontFamily:'JetBrains Mono, monospace', fontWeight:900, fontSize:'1.1rem', color:'#00FF9C', textDecoration:'none', letterSpacing:'1px' }}>STREET<span style={{ color:'#00E5FF' }}>SMART</span></a>
          <div style={{ display:'flex', gap:'0.25rem', alignItems:'center', flexWrap:'wrap' }}>
           <a href="/" style={{ fontFamily:'JetBrains Mono, monospace', fontWeight:900, fontSize:'1.1rem', color:'#00FF9C', textDecoration:'none', letterSpacing:'1px' }}>STREET<span style={{ color:'#00E5FF' }}>SMART</span></a>
          </div>
        </nav>

        <main id="main-content" style={{ paddingTop:'56px' }}>
          {children}
        </main>

        <SOSButton />
        <PWAInstallBanner />

        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#0B1020',
              color:      '#E6F1FF',
              border:     '1px solid rgba(0,229,255,0.2)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize:   '12px',
            },
          }}
        />

        {/* Register service worker */}
        <script dangerouslySetInnerHTML={{ __html: SW_SCRIPT }} />
        {/* Store install prompt */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_SCRIPT }} />
      </body>
    </html>
  );
}