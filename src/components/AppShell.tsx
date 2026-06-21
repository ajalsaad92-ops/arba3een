import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useOps } from '../store/opsStore';
import { Bell, ChevronLeft, LayoutDashboard, FileText, AlertOctagon, History, Users, Timer, LogOut, Hexagon, Radio, Settings2, MoreHorizontal } from 'lucide-react';
import TimeLockBar from './TimeLockBar';
import EmergencyBanner from './EmergencyBanner';
import PushNotificationToggle from './PushNotificationToggle';
import { OFFICES } from '../data/offices';
import { toast } from 'sonner';
import { useLocationTracker } from '../lib/useLocationTracker';

const roleLabels = {
  director: 'مدير عام',
  supervisor: 'مشرف عام',
  manager: 'مدير مكتب',
  agent: 'مدخل بيانات',
  viewer: 'مشاهد',
};

const roleColors = {
  director: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  supervisor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  manager: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  agent: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  viewer: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
};

export default function AppShell() {
  const { state, actions, dispatch } = useOps();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Continuously track the signed-in user's location in the background.
  useLocationTracker();

  // ProtectedRoute already checks auth, so this should never be null
  // But show loading just in case
  if (!state.currentUser) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0B0F19]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <div className="text-xs text-slate-500 font-display">جاري التحميل...</div>
        </div>
      </div>
    );
  }
  const user = state.currentUser;
  const isAgent = user.role === 'agent';
  const isDirector = user.role === 'director';
  const isViewer = user.role === 'viewer';
  const isSupervisorPlus = user.role === 'director' || user.role === 'supervisor';

  const navItems: { to: string; label: string; icon: any; show: boolean }[] = [
    { to: '/dashboard', label: 'لوحة القيادة', icon: LayoutDashboard, show: !isAgent },
    { to: '/report', label: 'إدخال التقرير', icon: FileText, show: !isViewer },
    { to: '/emergency', label: 'حالة طارئة', icon: AlertOctagon, show: !isViewer },
    { to: '/history', label: 'السجل والتصدير', icon: History, show: !isAgent && !isViewer },
    { to: '/supervisor-panel', label: 'لوحة المشرف', icon: Timer, show: isSupervisorPlus },
    { to: '/report-fields', label: 'حقول التقرير', icon: Settings2, show: isSupervisorPlus },
    { to: '/admin', label: 'المستخدمون', icon: Users, show: isDirector },
  ];

  // Where each notification type should take the user when clicked.
  const notifTarget = (type: string): string => {
    switch (type) {
      case 'emergency': return '/emergency';
      case 'extension': return '/supervisor-panel';
      case 'report': return isViewer ? '/dashboard' : '/history';
      default: return '/dashboard';
    }
  };

  const handleNotificationClick = (a: { id: string; type: string }) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', id: a.id });
    setBellOpen(false);
    const dest = notifTarget(a.type);
    // Viewers can only reach the dashboard.
    navigate(isViewer ? '/dashboard' : dest);
  };

  const handleLogout = async () => {
    await actions.signOut();
    dispatch({ type: 'AUTH_LOGOUT' });
    toast.success('تم تسجيل الخروج بنجاح');
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B0F19] text-slate-100" dir="rtl">
      {/* Sidebar — hidden on mobile, replaced by bottom nav */}
      <aside
        className={`hidden md:flex ${collapsed ? 'w-16' : 'w-56'} shrink-0 bg-[#0B0F19] border-l border-[#1E293B] flex-col transition-all duration-300 relative`}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -left-3 top-6 z-10 w-6 h-6 rounded-full bg-[#1E293B] border border-[#263244] flex items-center justify-center text-slate-400 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
        >
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>

        <div className="p-4 border-b border-[#1E293B] flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Hexagon className="w-5 h-5 text-black fill-black/20" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-amber-400 font-display truncate">منظومة الرصد</div>
              <div className="text-[10px] text-slate-500 truncate">مركز القيادة</div>
            </div>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.filter(i => i.show).map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[inset_0_1px_0_rgba(245,158,11,0.1)]'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-[#111827] border border-transparent'
                  }`
                }
              >
                <Icon className="w-4.5 h-4.5 shrink-0" size={18} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-2 border-t border-[#1E293B]">
          {!collapsed && (
            <div className="p-3 mb-2 rounded-lg bg-[#111827] border border-[#1E293B]">
              <div className="text-sm font-semibold truncate">{user.fullNameAr}</div>
              <div className="text-[11px] text-slate-500 mb-2 truncate">{user.officeId}</div>
              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${roleColors[user.role]}`}>
                {roleLabels[user.role]}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 shrink-0 bg-[#0B0F19] border-b border-[#1E293B] flex items-center justify-between px-3 sm:px-4 gap-2 sm:gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shrink-0">
              <Hexagon className="w-4 h-4 text-black fill-black/20" />
            </div>
            <div className="flex items-center gap-2 text-amber-400">
              <Radio className="w-4 h-4 animate-pulse" />
              <span className="text-xs font-display font-bold hidden sm:inline">منظومة الرصد الميداني العملياتي</span>
              <span className="text-xs font-display font-bold sm:hidden">منظومة الرصد</span>
            </div>
          </div>

          {!isAgent && <div className="flex-1 max-w-2xl mx-2"><TimeLockBar compact /></div>}

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>وقت السيرفر</span>
            <span className="text-slate-300">{state.serverTime.toLocaleTimeString('en-GB', { hour12: false })}</span>
          </div>
          <div className="hidden md:flex items-center gap-1 text-[10px] text-slate-600" title="عدد المكاتب التي أرسلت تقرير اليوم">
            <span className="text-emerald-400 font-bold">{state.todayReports.length}</span>
            <span>/</span>
            <span>{OFFICES.length}</span>
            <span>مكتب</span>
          </div>

            <div className="relative">
              <button
                onClick={() => { setBellOpen(o => !o); dispatch({ type: 'CLEAR_UNREAD' }); }}
                className="relative w-9 h-9 rounded-lg bg-[#111827] border border-[#1E293B] flex items-center justify-center text-slate-400 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
              >
                <Bell size={16} />
                {state.unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold px-1 animate-pulse-alert">
                    {state.unreadNotifications}
                  </span>
                )}
              </button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setBellOpen(false)} />
                  <div className="absolute left-0 mt-2 w-80 bg-[#111827] border border-[#1E293B] rounded-xl shadow-2xl z-40 max-h-[400px] overflow-y-auto">
                    <div className="sticky top-0 bg-[#111827] z-10 p-3 border-b border-[#1E293B] flex items-center justify-between">
                      <span className="font-bold text-sm">الإشعارات</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' })}
                          className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold"
                        >
                          تعليم الكل كمقروءة
                        </button>
                        <span className="text-[10px] text-slate-500">{state.lastActivity.filter(a => !(a as any).read).length} جديدة</span>
                      </div>
                    </div>
                    <div className="divide-y divide-[#1E293B]">
                      {state.lastActivity
                        .filter(a => !(isViewer && a.type === 'emergency'))
                        .map((a, i) => {
                        const isRead = (a as any).read;
                        return (
                          <div
                            key={i}
                            onClick={() => handleNotificationClick(a)}
                            className={`p-3 cursor-pointer transition-colors ${isRead ? 'bg-[#0B0F19]/50' : 'bg-[#1E293B]/30 hover:bg-[#1E293B]/50'}`}
                          >
                            <div className="flex items-start gap-2">
                              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                a.type === 'emergency' ? 'bg-red-500 animate-pulse' :
                                a.type === 'extension' ? 'bg-amber-500' :
                                a.type === 'report' ? 'bg-emerald-500' : 'bg-blue-500'
                              } ${!isRead ? 'animate-pulse' : ''}`} />
                              <div className="flex-1 min-w-0">
                                <div className={`text-xs ${isRead ? 'text-slate-400' : 'text-slate-200 font-semibold'}`}>{a.text}</div>
                                <div className="text-[10px] text-slate-500 mt-1">{new Date(a.createdAt).toLocaleString('ar-IQ')}</div>
                                <div className="text-[10px] text-amber-400/80 mt-1">اضغط للانتقال ←</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {state.lastActivity.filter(a => !(isViewer && a.type === 'emergency')).length === 0 && (
                        <div className="p-6 text-center text-xs text-slate-500">لا توجد إشعارات جديدة</div>
                      )}
                    </div>
                    <div className="p-2 border-t border-[#1E293B]">
                      <PushNotificationToggle />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm">
                {user.fullNameAr.charAt(0)}
              </div>
              <div className="hidden lg:block">
                <div className="text-xs font-semibold leading-tight">{user.fullNameAr}</div>
                <div className="text-[10px] text-slate-500 leading-tight">{roleLabels[user.role]}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Emergency banner (director only) */}
        {isDirector && <EmergencyBanner />}

        {/* Page content */}
        <main className="flex-1 overflow-hidden bg-[#0B0F19] pb-16 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        {(() => {
          const visible = navItems.filter(i => i.show);
          const primary = visible.slice(0, 4);
          const overflow = visible.slice(4);
          return (
            <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0B0F19]/95 backdrop-blur border-t border-[#1E293B] flex items-stretch">
              {primary.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors ${
                        isActive ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={18} className={isActive ? 'scale-110 transition-transform' : ''} />
                        <span className="truncate max-w-[68px]">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
              {overflow.length > 0 && (
                <button
                  onClick={() => setMoreOpen(true)}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] text-slate-400 hover:text-amber-400 transition-colors"
                  aria-label="المزيد"
                >
                  <MoreHorizontal size={18} />
                  <span>المزيد</span>
                </button>
              )}
              {overflow.length === 0 && (
                <button
                  onClick={handleLogout}
                  className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 text-[10px] text-slate-500 hover:text-red-400"
                  aria-label="تسجيل الخروج"
                >
                  <LogOut size={18} />
                  <span>خروج</span>
                </button>
              )}
            </nav>
          );
        })()}

        {/* Mobile "more" sheet */}
        {moreOpen && (
          <div className="md:hidden fixed inset-0 z-50" dir="rtl">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
            <div className="absolute bottom-0 inset-x-0 bg-[#0B0F19] border-t border-[#1E293B] rounded-t-2xl p-4 pb-6">
              <div className="w-10 h-1 rounded-full bg-[#1E293B] mx-auto mb-4" />
              <div className="text-sm font-bold text-slate-200 mb-3 px-1">القائمة</div>
              <div className="grid grid-cols-3 gap-2">
                {navItems.filter(i => i.show).slice(4).map(item => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        `flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border text-[11px] transition-colors ${
                          isActive
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'text-slate-300 bg-[#111827] border-[#1E293B] hover:text-slate-100'
                        }`
                      }
                    >
                      <Icon size={20} />
                      <span className="truncate max-w-[80px] text-center">{item.label}</span>
                    </NavLink>
                  );
                })}
                <button
                  onClick={() => { setMoreOpen(false); handleLogout(); }}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-[11px] text-red-400 hover:bg-red-500/10"
                >
                  <LogOut size={20} />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
