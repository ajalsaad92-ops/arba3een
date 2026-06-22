import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { OpsProvider, useOps } from './store/opsStore';
import AppShell from './components/AppShell';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';

// lazy pages – code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const EmergencyPage = lazy(() => import('./pages/EmergencyPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ReportFieldsPage = lazy(() => import('./pages/ReportFieldsPage'));
const SupervisorPanelPage = lazy(() => import('./pages/SupervisorPanelPage'));

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <div className="text-[11px] text-slate-500">جاري التحميل...</div>
      </div>
    </div>
  );
}

function ProtectedRoute({ roles }: { roles?: string[] }) {
  const { state } = useOps();
  if (state.authLoading) return <LoadingFallback />;
  if (!state.currentUser) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(state.currentUser.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function RoleBasedRedirect() {
  const { state } = useOps();
  const u = state.currentUser;
  if (!u) return <Navigate to="/login" replace />;
  if (u.role === 'agent') return <Navigate to="/report" replace />;
  return <Navigate to="/dashboard" replace />;
}

function NotFound() {
  return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center text-center p-6" dir="rtl">
      <div>
        <div className="text-5xl font-black text-amber-400 mb-2">404</div>
        <div className="text-slate-300 mb-4">الصفحة غير موجودة</div>
        <a href="/" className="px-4 py-2 rounded-lg bg-amber-500 text-black font-bold text-sm">العودة للرئيسية</a>
      </div>
    </div>
  );
}

function AnimatedRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute roles={['director','supervisor','manager','agent','viewer']} />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<RoleBasedRedirect />} />
            <Route path="/dashboard" element={
              <ProtectedRoute roles={['director','supervisor','manager','viewer']} />
            }>
              <Route index element={<DashboardPage />} />
            </Route>
            <Route path="/report" element={
              <ProtectedRoute roles={['director','supervisor','manager','agent']} />
            }>
              <Route index element={<ReportPage />} />
            </Route>
            <Route path="/emergency" element={
              <ProtectedRoute roles={['director','supervisor','manager','agent']} />
            }>
              <Route index element={<EmergencyPage />} />
            </Route>
            <Route path="/history" element={
              <ProtectedRoute roles={['director','supervisor','manager']} />
            }>
              <Route index element={<HistoryPage />} />
            </Route>
            <Route path="/supervisor-panel" element={
              <ProtectedRoute roles={['director','supervisor']} />
            }>
              <Route index element={<SupervisorPanelPage />} />
            </Route>
            <Route path="/report-fields" element={
              <ProtectedRoute roles={['director','supervisor']} />
            }>
              <Route index element={<ReportFieldsPage />} />
            </Route>
            <Route path="/admin" element={
              <ProtectedRoute roles={['director']} />
            }>
              <Route index element={<AdminPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <OpsProvider>
          <OfflineBanner />
          <AnimatedRoutes />
          <Toaster richColors position="top-center" dir="rtl" />
        </OpsProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
