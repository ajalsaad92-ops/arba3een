import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { X, Navigation, WifiOff, Users } from 'lucide-react';
import { useOps } from '../store/opsStore';
import { officeById } from '../data/offices';
import { relativeTime } from '../lib/utils';
import type { Role, Profile, AgentLocation } from '../data/types';

const IRAQ_CENTER: [number, number] = [33.2, 43.7];

// Roles the director is allowed to follow on the map.
// Viewers (مشاهد) and other directors (مدير عام) are intentionally excluded.
const TRACKABLE_ROLES: Role[] = ['supervisor', 'manager', 'agent'];

const ROLE_LABELS: Record<Role, string> = {
  director: 'مدير عام',
  supervisor: 'مشرف عام',
  manager: 'مدير مكتب',
  agent: 'مدخل بيانات',
  viewer: 'مشاهد',
};

// A fix older than 2 minutes likely means the user lost connectivity.
const isStale = (iso: string) => Date.now() - new Date(iso).getTime() > 120_000;

function userMarkerIcon(name: string, stale: boolean) {
  const color = stale ? '#ef4444' : '#10b981';
  const initial = (name?.charAt(0) || '؟');
  return L.divIcon({
    className: 'live-track-icon',
    html: `
      <div style="position:relative;width:36px;height:44px;transform:translate(-50%,-100%);">
        <svg width="36" height="44" viewBox="0 0 36 44">
          <path d="M18 0 C8 0 0 8 0 18 C0 31 18 44 18 44 C18 44 36 31 36 18 C36 8 28 0 18 0 Z" fill="${color}" stroke="#0B0F19" stroke-width="2"/>
          <circle cx="18" cy="17" r="9" fill="#0B0F19"/>
          <text x="18" y="21" text-anchor="middle" fill="#fff" font-size="12" font-weight="800" font-family="Cairo, sans-serif">${initial}</text>
        </svg>
      </div>`,
    iconSize: [36, 44],
    iconAnchor: [0, 0],
  });
}

function FitToMarkers({ points }: { points: [number, number][] }) {
  const map = useMap();
  useMemo(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 14 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);
  return null;
}

export default function LiveTrackingMap({ onClose }: { onClose: () => void }) {
  const { state } = useOps();

  const tracked = useMemo(() => {
    const byUser = new Map<string, { user: Profile; loc: AgentLocation }>();
    for (const u of state.users) {
      if (!TRACKABLE_ROLES.includes(u.role)) continue;
      const loc = state.agentLocations.find(a => a.agentId === u.id);
      if (!loc) continue;
      byUser.set(u.id, { user: u, loc });
    }
    return Array.from(byUser.values());
  }, [state.users, state.agentLocations]);

  const points = useMemo(
    () => tracked.map(t => [Number(t.loc.lat), Number(t.loc.lng)] as [number, number]),
    [tracked],
  );

  const onlineCount = tracked.filter(t => !isStale(t.loc.updatedAt)).length;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-2 md:p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl h-[85vh] bg-[#0B0F19] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-[#1E293B]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <div className="text-sm font-bold text-amber-400">تتبّع مستخدمي الموقع على الخريطة</div>
            <span className="text-[11px] text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded px-1.5 py-0.5">
              متصل: {onlineCount}
            </span>
            <span className="text-[11px] text-slate-300 bg-slate-500/15 border border-slate-500/30 rounded px-1.5 py-0.5">
              الكل: {tracked.length}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#1E293B]"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="flex-1 relative">
          {tracked.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
              لا توجد بيانات مواقع لمستخدمي الموقع بعد.
            </div>
          ) : (
            <MapContainer center={IRAQ_CENTER} zoom={6} className="w-full h-full" style={{ background: '#0B0F19' }}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap &copy; CARTO'
              />
              <FitToMarkers points={points} />
              {tracked.map(({ user, loc }) => {
                const stale = isStale(loc.updatedAt);
                return (
                  <Marker
                    key={user.id}
                    position={[Number(loc.lat), Number(loc.lng)]}
                    icon={userMarkerIcon(user.fullNameAr, stale)}
                  >
                    <Popup>
                      <div dir="rtl" style={{ minWidth: 180 }}>
                        <div style={{ fontWeight: 800, marginBottom: 4 }}>{user.fullNameAr}</div>
                        <div style={{ fontSize: 12, color: '#475569' }}>{ROLE_LABELS[user.role]} • {officeById(user.officeId)?.nameAr || '—'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, color: stale ? '#dc2626' : '#059669' }}>
                          {stale ? 'الاتصال مفقود — آخر موقع معروف' : 'متصل — يُحدّث مباشرة'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>آخر تحديث: {relativeTime(loc.updatedAt)}</div>
                        <a
                          href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-block', marginTop: 6, fontSize: 12, color: '#2563eb', fontWeight: 700 }}
                        >
                          فتح في خرائط جوجل
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          )}
        </div>
        <div className="flex items-center gap-4 p-2 px-3 border-t border-[#1E293B] text-[11px] text-slate-400">
          <span className="flex items-center gap-1"><Navigation className="w-3 h-3 text-emerald-400" /> متصل ويُحدّث الموقع</span>
          <span className="flex items-center gap-1"><WifiOff className="w-3 h-3 text-red-400" /> الاتصال مفقود — آخر موقع معروف</span>
        </div>
      </div>
    </div>
  );
}
