import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

  // Request browser permissions on first load (staggered)
  useEffect(() => {
    if (permsRequested) return;
    const asked = localStorage.getItem('ops:perms-asked');
    if (asked) { setPermsRequested(true); return; }

    const t1 = setTimeout(() => {
      if (navigator.geolocation && 'requestPermission' in navigator.geolocation) {
        (navigator.geolocation as any).requestPermission?.();
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

  // Unlock WebAudio on the first user gesture anywhere (required by iOS)
  useEffect(() => {
    const handler = () => { unlockAudio(); };
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  return (
    <OpsProvider>
      <WalkieProvider>
        <BrowserRouter>
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
