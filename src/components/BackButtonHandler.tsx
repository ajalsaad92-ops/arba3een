import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Handles the hardware back button on Capacitor (Android) and the browser
 * back gesture inside installed PWAs. Instead of exiting the app on the
 * root page, we navigate back through the router history when possible,
 * and only allow app exit after a second press within 2s (Android).
 */
export default function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let lastBackPress = 0;
    let unsub: (() => void) | null = null;

    (async () => {
      try {
        const cap = (window as any).Capacitor;
        if (!cap?.isNativePlatform?.()) return;
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('backButton', ({ canGoBack }) => {
          const rootPaths = ['/', '/dashboard', '/report', '/login'];
          const atRoot = rootPaths.includes(location.pathname);
          if (!atRoot && (canGoBack || window.history.length > 1)) {
            navigate(-1);
            return;
          }
          const now = Date.now();
          if (now - lastBackPress < 2000) {
            App.exitApp();
          } else {
            lastBackPress = now;
            try {
              // Simple visual hint via toast if available
              (window as any).dispatchEvent(new CustomEvent('app:back-exit-hint'));
            } catch {}
          }
        });
        unsub = () => handle.remove();
      } catch {
        /* noop */
      }
    })();

    return () => { if (unsub) unsub(); };
  }, [navigate, location.pathname]);

  return null;
}
