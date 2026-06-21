import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { OpsProvider, useOps } from './store/opsStore';
import { WalkieProvider } from './store/walkieStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AppShell from './components/AppShell';
import DashboardPage from './pages/DashboardPage';
import ReportPage from './pages/ReportPage';
import EmergencyPage from './pages/EmergencyPage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';
import ReportFieldsPage from './pages/ReportFieldsPage';
import SupervisorPanelPage from './pages/SupervisorPanelPage';
import { useEffect, useState } from 'react';
import { ToastPermissions } from './components/ToastPermissions';
import type { Role } from './data/types';
import { unlockAudio } from './lib/notify';
import { syncPushSubscriptionState } from './lib/pushSubscription';
import { requestAllNativePermissions, isNative } from './lib/nativePermissions';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { state } = useOps();
  const location = useLocation();
  
  // Check authentication
  if (!state.currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Check role-based access
  if (roles && !roles.includes(state.currentUser.role)) {
    const def = state.currentUser.role === 'agent' ? '/report' : '/dashboard';
    return <Navigate to={def} replace />;
  }
  
  return <>{children}</>;
}

function RoleBasedRedirect() {
  const { state } = useOps();
  if (!state.currentUser) return <Navigate to="/login" replace />;
  const target = state.currentUser.role === 'agent' ? '/report' : '/dashboard';
  return <Navigate to={target} replace />;
}

// Native hardware back button (Android): navigate the React Router history
// instead of letting Capacitor close the app. Only exits when already at a
// top-level screen.
function CapacitorBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!isNative()) return;
    let remove: (() => void) | undefined;
    (async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const handle = await CapApp.addListener('backButton', () => {
          const roots = ['/', '/dashboard', '/report', '/login'];
          const atRoot = roots.includes(location.pathname);
          if (!atRoot && window.history.length > 1) {
            navigate(-1);
          } else {
            CapApp.exitApp();
          }
        });
        remove = () => { handle.remove(); };
      } catch { /* @capacitor/app unavailable on web */ }
    })();
    return () => { remove?.(); };
  }, [location.pathname, navigate]);
  return null;
}

function AnimatedRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* All authenticated routes */}
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/" element={<RoleBasedRedirect />} />
        <Route path="/dashboard" element={<ProtectedRoute roles={['director','supervisor','manager','viewer']}><DashboardPage /></ProtectedRoute>} />
        <Route path="/report" element={<ProtectedRoute roles={['director','supervisor','manager','agent']}><ReportPage /></ProtectedRoute>} />
        <Route path="/emergency" element={<ProtectedRoute roles={['director','supervisor','manager','agent']}><EmergencyPage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute roles={['director','supervisor','manager']}><HistoryPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={['director']}><AdminPage /></ProtectedRoute>} />
        <Route path="/report-fields" element={<ProtectedRoute roles={['director','supervisor']}><ReportFieldsPage /></ProtectedRoute>} />
        <Route path="/supervisor-panel" element={<ProtectedRoute roles={['director','supervisor']}><SupervisorPanelPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const [permsRequested, setPermsRequested] = useState(false);

  // On a native device, request ALL permissions at once on first launch
  // (location, push + local notifications, microphone). On the web we fall back
  // to the staggered browser prompts below.
  useEffect(() => {
    if (isNative()) {
      const t = setTimeout(() => { requestAllNativePermissions().catch(() => {}); }, 1500);
      return () => clearTimeout(t);
    }
  }, []);

  // Request browser permissions on first load (staggered)
  useEffect(() => {
    if (isNative()) return;
    if (permsRequested) return;
    const asked = localStorage.getItem('ops:perms-asked');
    if (asked) { setPermsRequested(true); return; }

    const t1 = setTimeout(() => {
      // Trigger the native location permission prompt. Once granted, the
      // global tracker (useLocationTracker) keeps following the user live.
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true, timeout: 10_000 });
      }
    }, 3000);
    const t2 = setTimeout(() => {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }, 13_000);
    setTimeout(() => localStorage.setItem('ops:perms-asked', '1'), 25_000);
    setPermsRequested(true);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [permsRequested]);

  // Sync any existing Web Push subscription with the backend once the app
  // loads. This re-uploads the endpoint/key pair if the user already granted
  // permission, so the server can reach them when the app is fully closed.
  useEffect(() => {
    const t = setTimeout(() => {
      syncPushSubscriptionState().catch(() => {});
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  // Unlock WebAudio on the first user gesture anywhere (required by iOS), and
  // keep re-resuming on every gesture so a context iOS suspended in the
  // background comes back — this is what makes notification sounds work on
  // iPhone outside the always-active emergency/walkie screen.
  useEffect(() => {
    const handler = () => { unlockAudio(); };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('touchstart', handler);
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('touchstart', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  return (
    <OpsProvider>
      <WalkieProvider>
        <BrowserRouter>
          <CapacitorBackHandler />
          <AnimatedRoutes />
          <ToastPermissions />
          <Toaster
            position="top-center"
            dir="rtl"
            theme="dark"
            richColors
            closeButton
            toastOptions={{
              style: {
                background: '#111827',
                border: '1px solid #1E293B',
                color: '#F8FAFC',
                fontFamily: 'Tajawal, sans-serif',
              },
            }}
          />
        </BrowserRouter>
      </WalkieProvider>
    </OpsProvider>
  );
}
