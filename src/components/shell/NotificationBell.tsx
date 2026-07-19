import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOps } from '../store/opsStore';
import PushNotificationToggle from './PushNotificationToggle';

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isViewer: boolean;
};

// Where each notification type should take the user when clicked.
function notifTarget(type: string, targetPath: string | undefined, isViewer: boolean): string {
  if (targetPath) return targetPath;
  switch (type) {
    case 'emergency': return '/emergency';
    case 'extension': return '/supervisor-panel';
    case 'frozen': return '/frozen-requests';
    case 'report': return isViewer ? '/dashboard' : '/history';
    default: return '/dashboard';
  }
}

export default function NotificationBell({ open, onOpenChange, isViewer }: Props) {
  const { state, dispatch } = useOps();
  const navigate = useNavigate();

  const handleClick = (a: { id: string; type: string; targetPath?: string }) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', id: a.id });
    onOpenChange(false);
    navigate(isViewer ? '/dashboard' : notifTarget(a.type, a.targetPath, isViewer));
  };

  const items = state.lastActivity.filter(a => !(isViewer && a.type === 'emergency'));

  return (
    <div className="relative">
      <button
        onClick={() => { onOpenChange(!open); dispatch({ type: 'CLEAR_UNREAD' }); }}
        className="relative w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#232323] flex items-center justify-center text-slate-400 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
      >
        <Bell size={16} />
        {state.unreadNotifications > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold px-1 animate-pulse-alert">
            {state.unreadNotifications}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => onOpenChange(false)} />
          <div className="absolute left-0 mt-2 w-80 bg-[#1a1a1a] border border-[#232323] rounded-xl shadow-2xl z-40 max-h-[400px] overflow-y-auto">
            <div className="sticky top-0 bg-[#1a1a1a] z-10 p-3 border-b border-[#232323] flex items-center justify-between">
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
            <div className="divide-y divide-[#232323]">
              {items.map((a, i) => {
                const isRead = (a as any).read;
                return (
                  <div
                    key={i}
                    onClick={() => handleClick(a)}
                    className={`p-3 cursor-pointer transition-colors ${isRead ? 'bg-[#0d0d0d]/50' : 'bg-[#232323]/30 hover:bg-[#232323]/50'}`}
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
              {items.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-500">لا توجد إشعارات جديدة</div>
              )}
            </div>
            <div className="p-2 border-t border-[#232323]">
              <PushNotificationToggle />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
