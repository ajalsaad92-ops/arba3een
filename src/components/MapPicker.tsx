import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { X, MapPin, Trash2, Undo2, Route as RouteIcon, Loader2, Crosshair } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

// Default Leaflet icon fix (matches IraqMap.tsx)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const IRAQ_CENTER: [number, number] = [33.2, 43.7];
const IRAQ_BOUNDS: [[number, number], [number, number]] = [[28.5, 37.5], [38.0, 49.5]];

function pinIcon(color: string, label?: string) {
  return L.divIcon({
    className: 'map-pick-icon',
    html: `
      <div style="position:relative;width:32px;height:32px;transform:translate(-50%,-100%);">
        <svg width="32" height="40" viewBox="0 0 32 40">
          <path d="M16 0 C7 0 0 7 0 16 C0 28 16 40 16 40 C16 40 32 28 32 16 C32 7 25 0 16 0 Z" fill="${color}" stroke="#0B0F19" stroke-width="1.5"/>
          <circle cx="16" cy="15" r="6" fill="#0B0F19"/>
          ${label ? `<text x="16" y="19" text-anchor="middle" fill="#fff" font-size="10" font-weight="800" font-family="Cairo, sans-serif">${label}</text>` : ''}
        </svg>
      </div>`,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
  });
}

type Pt = { lat: number; lng: number };

function ClickCapture({ onClick }: { onClick: (p: Pt) => void }) {
  useMapEvents({
    click(e) { onClick({ lat: e.latlng.lat, lng: e.latlng.lng }); },
  });
  return null;
}

/**
 * Centres the map on the user's GPS position the first time it becomes
 * available, at a zoom that matches roughly 750m of altitude
 * (≈ zoom level 17 in the Web Mercator tile pyramid).
 */
function CenterOnUser({ pos }: { pos: Pt | null }) {
  const map = useMap();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!pos || done) return;
    map.setView([pos.lat, pos.lng], 17, { animate: true });
    setDone(true);
  }, [pos, done, map]);
  return null;
}

function userIcon() {
  return L.divIcon({
    className: 'map-user-icon',
    html: `
      <div style="position:relative;width:22px;height:22px;transform:translate(-50%,-50%);">
        <div style="position:absolute;inset:0;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 0 2px #3B82F6, 0 0 10px rgba(59,130,246,.6);"></div>
        <div style="position:absolute;inset:-10px;border-radius:50%;background:rgba(59,130,246,.18);animation:ping-slow 1.6s ease-out infinite;"></div>
      </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

interface Props {
  mode: 'single' | 'multi' | 'route';
  title: string;
  subtitle?: string;
  initialSingle?: Pt | null;
  initialMulti?: Pt[];
  userLocation?: Pt | null;
  onCancel: () => void;
  onConfirmSingle?: (p: Pt) => void;
  onConfirmMulti?: (pts: Pt[]) => void;
}

/**
 * Real Leaflet picker — replaces the previous fake-coords picker.
 * - 'single': one point.
 * - 'multi':  ordered list of waypoints (just connect by polyline).
 * - 'route':  same UI as multi for now; once Google Maps Platform
 *             connector is linked, the waypoints will be snapped to
 *             the road network via the Routes API.
 */
export default function MapPicker({
  mode, title, subtitle, initialSingle, initialMulti,
  userLocation, onCancel, onConfirmSingle, onConfirmMulti,
}: Props) {
  const [single, setSingle] = useState<Pt | null>(initialSingle ?? null);
  const [pts, setPts] = useState<Pt[]>(initialMulti ?? []);
  const [snapped, setSnapped] = useState<Pt[] | null>(null);
  const [snapping, setSnapping] = useState(false);
  const [livePos, setLivePos] = useState<Pt | null>(userLocation ?? null);

  // Try to obtain a high-accuracy GPS fix when the picker opens —
  // independent from the parent (so the picker works even when the
  // parent hasn't requested location yet).
  useEffect(() => {
    if (livePos || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setLivePos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    );
  }, [livePos]);

  // close on ESC
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);

  const handleClick = (p: Pt) => {
    if (mode === 'single') setSingle(p);
    else { setPts(prev => [...prev, p]); setSnapped(null); }
  };

  const snapToRoads = async () => {
    if (pts.length < 2) return;
    setSnapping(true);
    try {
      const { data, error } = await supabase.functions.invoke('route-snap', {
        body: { waypoints: pts, travelMode: 'DRIVE' },
      });
      if (error) throw error;
      if (!data?.polyline?.length) throw new Error('no polyline');
      setSnapped(data.polyline);
      toast.success('تم محاذاة المسار على الشوارع');
    } catch (e) {
      toast.error('تعذّر محاذاة المسار على الشوارع');
    } finally {
      setSnapping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[700] bg-black/70 flex items-center justify-center p-3 animate-fade-in-up" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl max-h-[95vh] flex flex-col bg-[#0B0F19] border border-amber-500/30 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-3 sm:p-4 border-b border-[#1E293B] flex items-center justify-between gap-2">
          <div>
            <div className="font-display font-black text-amber-400 text-sm sm:text-base">{title}</div>
            <div className="text-[11px] sm:text-xs text-slate-400 line-clamp-2">{subtitle ?? (mode === 'single' ? 'انقر على الخريطة لتحديد موقع واحد' : 'انقر لإضافة نقاط على المسار')}</div>
          </div>
          <button onClick={onCancel} className="w-9 h-9 rounded-lg bg-[#1E293B] hover:bg-[#263244] flex items-center justify-center text-slate-400 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative flex-1 min-h-[55vh] sm:min-h-[420px]">
          <MapContainer
            center={livePos ? [livePos.lat, livePos.lng] : IRAQ_CENTER}
            zoom={livePos ? 17 : 6}
            minZoom={5}
            maxZoom={19}
            maxBounds={IRAQ_BOUNDS}
            maxBoundsViscosity={0.8}
            style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap &copy; CARTO'
              maxZoom={19}
            />
            <ClickCapture onClick={handleClick} />
            <CenterOnUser pos={livePos} />

            {livePos && (
              <Marker position={[livePos.lat, livePos.lng]} icon={userIcon()} />
            )}

            {mode === 'single' && single && (
              <Marker position={[single.lat, single.lng]} icon={pinIcon('#F59E0B')} />
            )}

            {mode !== 'single' && pts.length > 0 && (
              <>
                {pts.map((p, i) => (
                  <Marker key={i} position={[p.lat, p.lng]} icon={pinIcon('#F59E0B', String(i + 1))} />
                ))}
                {pts.length > 1 && (
                  <Polyline
                    positions={pts.map(p => [p.lat, p.lng] as [number, number])}
                    pathOptions={{ color: '#F59E0B', weight: snapped ? 2 : 4, opacity: snapped ? 0.5 : 0.8, dashArray: '6,6' }}
                  />
                )}
                {mode === 'route' && snapped && snapped.length > 1 && (
                  <Polyline
                    positions={snapped.map(p => [p.lat, p.lng] as [number, number])}
                    pathOptions={{ color: '#22D3EE', weight: 5, opacity: 0.95 }}
                  />
                )}
              </>
            )}
          </MapContainer>

          <div className="absolute top-2 left-2 bg-[#0B0F19]/85 border border-[#1E293B] rounded-md px-2.5 py-1 text-[10px] sm:text-[11px] text-amber-300 pointer-events-none flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {mode === 'single'
              ? (single ? `${single.lat.toFixed(5)}, ${single.lng.toFixed(5)}` : 'انقر لتحديد موقع')
              : `${pts.length} نقطة`}
          </div>
          {livePos && (
            <div className="absolute bottom-2 left-2 bg-[#0B0F19]/85 border border-blue-500/30 rounded-md px-2.5 py-1 text-[10px] sm:text-[11px] text-blue-300 pointer-events-none flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5" /> موقعك الحالي
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4 border-t border-[#1E293B] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2">
            {mode !== 'single' && pts.length > 0 && (
              <>
                <button
                  onClick={() => { setPts(p => p.slice(0, -1)); setSnapped(null); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1E293B] hover:bg-[#263244] text-slate-300 text-xs font-bold"
                >
                  <Undo2 className="w-3.5 h-3.5" /> تراجع
                </button>
                <button
                  onClick={() => { setPts([]); setSnapped(null); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/30"
                >
                  <Trash2 className="w-3.5 h-3.5" /> مسح الكل
                </button>
                {mode === 'route' && pts.length >= 2 && (
                  <button
                    onClick={snapToRoads}
                    disabled={snapping}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 text-xs font-bold border border-cyan-500/40 disabled:opacity-50"
                  >
                    {snapping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RouteIcon className="w-3.5 h-3.5" />}
                    محاذاة الشوارع
                  </button>
                )}
              </>
            )}
            {mode === 'single' && single && (
              <button
                onClick={() => setSingle(null)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/30"
              >
                <Trash2 className="w-3.5 h-3.5" /> إزالة
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-[#1E293B] hover:bg-[#263244] text-slate-300 text-sm font-bold">إلغاء</button>
            {mode === 'single' ? (
              <button
                disabled={!single}
                onClick={() => single && onConfirmSingle?.(single)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-display font-black"
              >تأكيد</button>
            ) : (
              <button
                disabled={pts.length === 0}
                onClick={() => onConfirmMulti?.(mode === 'route' && snapped ? snapped : pts)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-display font-black"
              >تأكيد ({mode === 'route' && snapped ? `${snapped.length} على الشوارع` : pts.length})</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}