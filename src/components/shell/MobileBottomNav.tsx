import { NavLink } from 'react-router-dom';
import { LogOut, MoreHorizontal } from 'lucide-react';

export type NavItem = { to: string; label: string; icon: any; show: boolean };

type Props = {
  items: NavItem[];
  moreOpen: boolean;
  onMoreOpenChange: (o: boolean) => void;
  onLogout: () => void;
};

export default function MobileBottomNav({ items, moreOpen, onMoreOpenChange, onLogout }: Props) {
  const visible = items.filter((i) => i.show);
  const primary = visible.slice(0, 4);
  const overflow = visible.slice(4);

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0d0d0d]/95 backdrop-blur border-t border-[#232323] flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {primary.map((item) => {
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
        {overflow.length > 0 ? (
          <button
            onClick={() => onMoreOpenChange(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] text-slate-400 hover:text-amber-400 transition-colors"
            aria-label="المزيد"
          >
            <MoreHorizontal size={18} />
            <span>المزيد</span>
          </button>
        ) : (
          <button
            onClick={onLogout}
            className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 text-[10px] text-slate-500 hover:text-red-400"
            aria-label="تسجيل الخروج"
          >
            <LogOut size={18} />
            <span>خروج</span>
          </button>
        )}
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50" dir="rtl">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onMoreOpenChange(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-[#0d0d0d] border-t border-[#232323] rounded-t-2xl p-4 pb-6">
            <div className="w-10 h-1 rounded-full bg-[#232323] mx-auto mb-4" />
            <div className="text-sm font-bold text-slate-200 mb-3 px-1">القائمة</div>
            <div className="grid grid-cols-3 gap-2">
              {overflow.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => onMoreOpenChange(false)}
                    className={({ isActive }) =>
                      `flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border text-[11px] transition-colors ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'text-slate-300 bg-[#1a1a1a] border-[#232323] hover:text-slate-100'
                      }`
                    }
                  >
                    <Icon size={20} />
                    <span className="truncate max-w-[80px] text-center">{item.label}</span>
                  </NavLink>
                );
              })}
              <button
                onClick={() => { onMoreOpenChange(false); onLogout(); }}
                className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-[11px] text-red-400 hover:bg-red-500/10"
              >
                <LogOut size={20} />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
