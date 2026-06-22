import { useEffect, useRef, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, Polyline, Circle, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { OFFICES } from '../data/offices';
import { KURDISTAN_CODES } from '../data/iraqGeo';
import iraqAdm1 from '../data/iraq-adm1.json';
import iraqAdm0 from '../data/iraq-adm0.json';
import { useOps } from '../store/opsStore';
import { officeById } from '../data/offices';
import type { Office } from '../data/offices';
import { isFieldLayerOn } from '../lib/mapLayers';

// ─── Province ISO ↔ internal office code mapping ───
const ISO_TO_CODE: Record<string, string> = {
  'IQ-AN': 'ANB', 'IQ-KA': 'KRB', 'IQ-NA': 'NJF', 'IQ-BB': 'BBL',
  'IQ-BG': 'BGD', 'IQ-QA': 'QDS', 'IQ-MU': 'MTH', 'IQ-DQ': 'DHQ',
  'IQ-BA': 'BAS', 'IQ-MA': 'MYS', 'IQ-WA': 'WST', 'IQ-NI': 'NIN',
  'IQ-DA': 'DOH', 'IQ-SD': 'SLD', 'IQ-DI': 'DLY', 'IQ-KI': 'KRK',
  'IQ-AR': 'ERB', 'IQ-SU': 'SUL',
};
const NAMES_AR: Record<string, string> = {
  ANB: 'الأنبار', KRB: 'كربلاء', NJF: 'النجف', BBL: 'بابل',
  BGD: 'بغداد', QDS: 'القادسية', MTH: 'المثنى', DHQ: 'ذي قار',
  BAS: 'البصرة', MYS: 'ميسان', WST: 'واسط', NIN: 'نينوى',
  DOH: 'دهوك', SLD: 'صلاح الدين', DLY: 'ديالى', KRK: 'كركوك',
  ERB: 'أربيل', SUL: 'السليمانية',
};

// Subtle per-province tints over the white basemap
const PROVINCE_FILL: Record<string, string> = {
  NIN: '#DBEAFE', SLD: '#D1FAE5', ANB: '#FFEDD5', BGD: '#FEF3C7',
  DLY: '#FEE2E2', KRK: '#EDE9FE', ERB: '#E5E7EB', SUL: '#E5E7EB', DOH: '#E5E7EB',
  WST: '#CFFAFE', KRB: '#FCE7F3', NJF: '#ECFCCB', BBL: '#FBCFE8',
  QDS: '#FEF9C3', MTH: '#EDE9FE', DHQ: '#FFEDD5', MYS: '#D1FAE5', BAS: '#FECACA',
};

// Fix Leaflet default icon path issues with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MAP_CONFIG = {
  center: [33.2, 43.7] as [number, number],
  zoom: 6,
  minZoom: 5,
  maxZoom: 14,
  maxBounds: [[28.5, 37.5], [38.0, 49.5]] as [[number, number], [number, number]],
  maxBoundsViscosity: 1.0,
};

// ─── Build mask: world rectangle with Iraq cut out ───
// Iraq ADM0 GeoJSON polygons (lat/lng pairs are [lng,lat] in GeoJSON)
function buildMaskRings(): [number, number][][] {
  const outer: [number, number][] = [
    [10, 20], [10, 70], [55, 70], [55, 20], [10, 20],
  ];
  const rings: [number, number][][] = [outer];
  const geom: any = (iraqAdm0 as any).features[0].geometry;
  const pushRing = (coords: any[]) => {
    rings.push(coords.map((c: any) => [c[1], c[0]] as [number, number]));
  };
  if (geom.type === 'Polygon') {
    pushRing(geom.coordinates[0]);
  } else if (geom.type === 'MultiPolygon') {
    geom.coordinates.forEach((poly: any) => pushRing(poly[0]));
  }
  return rings;
}
const MASK_RINGS = buildMaskRings();

// Province centroid (for label placement)
function ringCentroid(ring: [number, number][]): [number, number] {
  let lat = 0, lng = 0;
  for (const p of ring) { lat += p[0]; lng += p[1]; }
  return [lat / ring.length, lng / ring.length];
}
function geometryCentroid(geom: any): [number, number] {
  if (geom.type === 'Polygon') {
    return ringCentroid(geom.coordinates[0].map((c: any) => [c[1], c[0]]));
  }
  // MultiPolygon — use the largest ring
  const polys = geom.coordinates as any[];
  let bestSize = 0, best: any = polys[0][0];
  for (const poly of polys) {
    if (poly[0].length > bestSize) { bestSize = poly[0].length; best = poly[0]; }
  }
  return ringCentroid(best.map((c: any) => [c[1], c[0]]));
}

// Hexagonal amber SVG marker for offices
function createOfficeIcon(submitted: boolean, selected: boolean, kurdistan: boolean): L.DivIcon {
  const color = kurdistan ? '#9CA3AF' : submitted ? '#F59E0B' : '#0F172A';
  const ringColor = submitted ? '#3B82F6' : 'transparent';
  return L.divIcon({
    className: 'office-marker',
    html: `
      <div style="position:relative; width:36px; height:36px;">
        ${submitted ? `<div style="position:absolute; inset:0; border-radius:50%; border:2px solid ${ringColor}; animation:ripple 1.8s ease-out infinite;"></div>` : ''}
        <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;">
          <svg width="28" height="28" viewBox="0 0 28 28" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
            <polygon points="14,2 25,8 25,20 14,26 3,20 3,8" fill="${color}" stroke="${selected ? '#D97706' : '#ffffff'}" stroke-width="${selected ? 2.5 : 1.5}" opacity="${kurdistan ? 0.7 : 1}"/>
            <text x="14" y="17" text-anchor="middle" fill="${submitted && !kurdistan ? '#000' : '#fff'}" font-size="10" font-weight="900" font-family="Cairo, sans-serif">م</text>
          </svg>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function createBorderIcon(): L.DivIcon {
  return L.divIcon({
    className: 'border-marker',
    html: `
      <div style="width:24px; height:24px; position:relative;">
        <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;">
          <svg width="22" height="22" viewBox="0 0 22 22">
            <polygon points="11,1 21,11 11,21 1,11" fill="#10B981" stroke="#0B0F19" stroke-width="1.5" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));"/>
            <polygon points="11,4 18,11 11,18 4,11" fill="#0B0F19" opacity="0.3"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createAgentIcon(): L.DivIcon {
  return L.divIcon({
    className: 'agent-marker',
    html: `
      <div style="position:relative; width:28px; height:28px;">
        <div style="position:absolute; inset:0; border-radius:50%; background:rgba(59,130,246,0.3); animation:ripple 1.5s ease-out infinite;"></div>
        <div style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:10px; height:10px; border-radius:50%; background:#3B82F6; border:2px solid #fff; box-shadow:0 0 6px rgba(59,130,246,0.8);"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createEventIcon(): L.DivIcon {
  return L.divIcon({
    className: 'event-marker',
    html: `<div style="width:14px; height:14px; border-radius:50%; background:#3B82F6; border:2px solid #fff; box-shadow:0 0 8px rgba(59,130,246,0.5);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function createProcessionIcon(): L.DivIcon {
  return L.divIcon({
    className: 'proc-marker',
    html: `<div style="width:14px; height:14px; background:#F59E0B; border:2px solid #0B0F19; box-shadow:0 0 6px rgba(245,158,11,0.5); clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

interface IraqMapProps {
  onSelectOffice?: (office: Office | null) => void;
  selectedOfficeId?: string | null;
  height?: string;
  showLayerControl?: boolean;
  filterOfficeIds?: string[]; // restrict visible offices
  className?: string;
}

function MapController({ selectedOfficeId, onSelect }: { selectedOfficeId: string | null; onSelect?: (o: Office | null) => void }) {
  const map = useMap();
  useEffect(() => {
    if (selectedOfficeId) {
      const office = officeById(selectedOfficeId);
      if (office) {
        map.flyTo([office.lat, office.lng], 9, { duration: 0.8 });
        onSelect?.(office);
      }
    } else {
      map.flyTo(MAP_CONFIG.center, MAP_CONFIG.zoom, { duration: 0.8 });
    }
  }, [selectedOfficeId]);
  return null;
}

export default function IraqMap({ onSelectOffice, selectedOfficeId, height = '100%', filterOfficeIds, className = '' }: IraqMapProps) {
  const { state } = useOps();
  const officeIconCache = useRef<Map<string, L.DivIcon>>(new Map());
  const [hoveredGov, setHoveredGov] = useState<string | null>(null);
  const visibleProvinces = state.visibleProvinces;
  const provinceFiltered = visibleProvinces.size > 0;
  const isVisibleProv = (code: string) => !provinceFiltered || visibleProvinces.has(code);

  const visibleOffices = useMemo(() => {
    let list = (!filterOfficeIds || filterOfficeIds.length === 0) ? OFFICES : OFFICES.filter(o => filterOfficeIds.includes(o.id));
    if (provinceFiltered) {
      list = list.filter(o => visibleProvinces.has(o.id) || (o.id === 'HQ' && visibleProvinces.has('BGD')));
    }
    return list;
  }, [filterOfficeIds, provinceFiltered, visibleProvinces]);

  const submittedOfficeIds = useMemo(() =>
    new Set(state.todayReports.map(r => r.officeId)),
    [state.todayReports]
  );

  // ── Visitor flow paths ──────────────────────────────────────────────
  // Use real DB paths when present; otherwise derive them from today's
  // reports: every office that received visitors becomes a route flowing
  // toward Karbala (the Arba'een destination), with density classified by
  // visitor count so heavier flows render thicker / hotter.
  const flowPaths = useMemo(() => {
    if (state.flowPaths.length > 0) return state.flowPaths;
    const dest = officeById('KRB');
    if (!dest) return [];
    const reports = state.todayReports.filter(r => r.officeId !== 'KRB' && (r.visitorsIn ?? 0) > 0);
    const max = Math.max(1, ...reports.map(r => r.visitorsIn ?? 0));
    return reports.map(r => {
      const o = officeById(r.officeId);
      if (!o) return null;
      const ratio = (r.visitorsIn ?? 0) / max;
      const density: 'high' | 'medium' | 'normal' = ratio >= 0.66 ? 'high' : ratio >= 0.33 ? 'medium' : 'normal';
      return {
        id: `flow-${r.officeId}`,
        officeId: r.officeId,
        fromLat: o.lat, fromLng: o.lng,
        toLat: dest.lat, toLng: dest.lng,
        visitorCount: r.visitorsIn ?? 0,
        density,
        pathNameAr: `${o.governorateAr} ← كربلاء`,
      };
    }).filter(Boolean) as typeof state.flowPaths;
  }, [state.flowPaths, state.todayReports]);


  const getOfficeIcon = (office: Office) => {
    const key = `${office.id}-${submittedOfficeIds.has(office.id) ? 1 : 0}-${selectedOfficeId === office.id ? 1 : 0}`;
    if (!officeIconCache.current.has(key)) {
      officeIconCache.current.set(key, createOfficeIcon(
        submittedOfficeIds.has(office.id),
        selectedOfficeId === office.id,
        KURDISTAN_CODES.includes(office.id)
      ));
    }
    return officeIconCache.current.get(key)!;
  };

  const borderIcon = useMemo(() => createBorderIcon(), []);
  const agentIcon = useMemo(() => createAgentIcon(), []);
  const eventIcon = useMemo(() => createEventIcon(), []);
  const procIcon = useMemo(() => createProcessionIcon(), []);

  const layers = state.activeMapLayers;

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <MapContainer
        center={MAP_CONFIG.center}
        zoom={MAP_CONFIG.zoom}
        minZoom={MAP_CONFIG.minZoom}
        maxZoom={MAP_CONFIG.maxZoom}
        maxBounds={MAP_CONFIG.maxBounds}
        maxBoundsViscosity={0.8}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
        attributionControl={true}
        className="z-0"
      >
        <ZoomControl position="topleft" />
        <MapController selectedOfficeId={selectedOfficeId ?? null} onSelect={onSelectOffice} />

        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
        />

        {/* Mask: world rectangle with official Iraq ADM0 outline as a hole.
            Everything outside Iraq is hidden behind a white overlay so only
            Iraqi territory shows the underlying basemap tiles. */}
        <Polygon
          positions={MASK_RINGS}
          pathOptions={{
            color: '#64748B',
            weight: 2,
            fillColor: '#ffffff',
            fillOpacity: 1,
            interactive: false,
          }}
        />

        {/* Official governorate boundaries (geoBoundaries ADM1). */}
        {((iraqAdm1 as any).features as any[]).map((feat) => {
          const iso = feat.properties.shapeISO as string;
          const code = ISO_TO_CODE[iso];
          if (!code) return null;
          const isKurdistan = KURDISTAN_CODES.includes(code);
          const dimmed = provinceFiltered && !isVisibleProv(code);
          const isHover = hoveredGov === code;
          const officeHere = OFFICES.find(o => o.id === code);
          const isSelected = officeHere && selectedOfficeId === officeHere.id;

          // Convert GeoJSON [lng,lat] → Leaflet [lat,lng] rings.
          const geom = feat.geometry;
          const positions: [number, number][][] | [number, number][][][] =
            geom.type === 'Polygon'
              ? (geom.coordinates as any[]).map((ring: any[]) =>
                  ring.map((c: any) => [c[1], c[0]] as [number, number])
                )
              : (geom.coordinates as any[]).map((poly: any[]) =>
                  poly.map((ring: any[]) =>
                    ring.map((c: any) => [c[1], c[0]] as [number, number])
                  )
                );

          return (
            <Polygon
              key={iso}
              positions={positions as any}
              eventHandlers={{
                mouseover: () => setHoveredGov(code),
                mouseout: () => setHoveredGov(null),
                click: () => {
                  if (officeHere && !isKurdistan) onSelectOffice?.(officeHere);
                },
              }}
              pathOptions={{
                color: dimmed ? '#CBD5E1' : isKurdistan ? '#6B7280' : isSelected ? '#D97706' : isHover ? '#F59E0B' : '#64748B',
                weight: dimmed ? 0.5 : isSelected ? 2.5 : isHover ? 2 : 1.1,
                fillColor: dimmed ? '#FFFFFF' : isKurdistan ? '#E5E7EB' : PROVINCE_FILL[code] || '#F1F5F9',
                fillOpacity: dimmed ? 0.92 : isKurdistan ? 0.45 : isSelected ? 0.55 : isHover ? 0.5 : 0.32,
                dashArray: isKurdistan ? '6, 4' : undefined,
              }}
            />
          );
        })}

        {/* Province name labels at centroids. */}
        {((iraqAdm1 as any).features as any[]).map((feat) => {
          const iso = feat.properties.shapeISO as string;
          const code = ISO_TO_CODE[iso];
          if (!code) return null;
          if (provinceFiltered && !visibleProvinces.has(code)) return null;
          const [lat, lng] = geometryCentroid(feat.geometry);
          return (
            <Marker
              key={`label-${iso}`}
              position={[lat, lng]}
              interactive={false}
              icon={L.divIcon({
                className: 'gov-label',
                html: `<div style="color:#1E293B; font-family:Cairo; font-size:10px; font-weight:700; text-shadow:0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff; white-space:nowrap; pointer-events:none;">${NAMES_AR[code] || code}</div>`,
                iconSize: [80, 14],
                iconAnchor: [40, 7],
              })}
            />
          );
        })}

        {/* Kurdistan region label */}
        <Marker position={[36.7, 44.6]} icon={L.divIcon({
          className: 'kurdistan-label',
          html: '<div style="color:#475569; font-family:Cairo; font-size:11px; font-weight:800; letter-spacing:1px; text-shadow:0 0 4px #fff, 0 0 4px #fff; white-space:nowrap; opacity:0.7;">إقليم كوردستان</div>',
          iconSize: [140, 16],
          iconAnchor: [70, 8],
        })} interactive={false} />

        {/* Office markers */}
        {layers.has('offices') && visibleOffices.map(office => {
          const submitted = submittedOfficeIds.has(office.id);
          const report = state.todayReports.find(r => r.officeId === office.id);
          return (
            <Marker
              key={office.id}
              position={[office.lat, office.lng]}
              icon={getOfficeIcon(office)}
              eventHandlers={{
                click: () => onSelectOffice?.(office),
              }}
            >
              <Popup>
                <div className="text-right font-tajawal" dir="rtl" style={{ minWidth: 180 }}>
                  <div className="font-bold text-amber-400 mb-1">{office.nameAr}</div>
                  <div className="text-xs text-slate-400 mb-2">{office.governorateAr}</div>
                  {report ? (
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span>الداخلون:</span><span className="font-bold text-emerald-400">{report.visitorsIn.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>العجلات:</span><span className="font-bold">{report.vehiclesCount.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>المواكب:</span><span className="font-bold">{report.processionsCount}</span></div>
                      <div className="text-[10px] text-slate-500 mt-1">حالة: {submitted ? (report.isLateSubmission ? 'متأخر' : 'في الوقت') : 'لم يُرسل'}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">لم يُرسل تقرير اليوم</div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Border crossings */}
        {layers.has('borderCrossings') && state.borderCrossings.map(bc => (
          <Marker key={bc.id} position={[bc.lat, bc.lng]} icon={borderIcon}>
            <Popup>
              <div className="text-right font-tajawal" dir="rtl" style={{ minWidth: 180 }}>
                <div className="font-bold text-emerald-400 mb-1">{bc.nameAr}</div>
                <div className="text-xs text-slate-400 mb-2">{bc.countryFlag} {bc.neighboringCountryAr}</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span>داخلون:</span><span className="font-bold text-emerald-400">{bc.dailyIn.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>خارجون:</span><span className="font-bold text-amber-400">{bc.dailyOut.toLocaleString()}</span></div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Visitor flow paths */}
        {layers.has('flowPaths') && state.flowPaths.map(fp => {
          const color = fp.density === 'high' ? '#EF4444' : fp.density === 'medium' ? '#F97316' : '#10B981';
          const weight = fp.density === 'high' ? 5 : fp.density === 'medium' ? 3.5 : 2;
          return (
            <Polyline
              key={fp.id}
              positions={[[fp.fromLat, fp.fromLng], [fp.toLat, fp.toLng]]}
              pathOptions={{
                color,
                weight,
                opacity: 0.7,
                className: fp.density === 'high' ? 'animate-flow' : '',
              }}
            />
          );
        })}

        {/* Events */}
        {layers.has('events') && state.todayReports.flatMap(r => r.eventsCoordinates.map((c, i) => (
          <Marker key={`e-${r.id}-${i}`} position={[c.lat, c.lng]} icon={eventIcon} />
        )))}

        {/* Procession waypoints */}
        {layers.has('events') && state.todayReports.flatMap(r => r.processionWaypoints.map((c, i) => (
          <Marker key={`p-${r.id}-${i}`} position={[c.lat, c.lng]} icon={procIcon} />
        )))}

        {/* ── Custom (admin-added) location & route fields from extraFields ── */}
        {(() => {
          const defs = state.fieldDefinitions.filter(f => !f.isBuiltIn && !f.isHidden);
          const locDefs   = defs.filter(f => f.fieldType === 'location' || f.fieldType === 'multi_location');
          const routeDefs = defs.filter(f => f.fieldType === 'route');
          const out: any[] = [];
          for (const r of state.todayReports) {
            const ex = (r as any).extraFields;
            if (!ex) continue;
            for (const f of locDefs) {
              if (!isFieldLayerOn(layers, f.fieldKey)) continue;
              const v = ex[f.fieldKey];
              if (!v) continue;
              const pts = Array.isArray(v) ? v : [v];
              pts.forEach((p: any, i: number) => {
                if (p && typeof p.lat === 'number' && typeof p.lng === 'number') {
                  out.push(
                    <Marker key={`xL-${r.id}-${f.id}-${i}`} position={[p.lat, p.lng]} icon={eventIcon}>
                      <Popup>
                        <div className="text-right font-tajawal" dir="rtl" style={{ minWidth: 160 }}>
                          <div className="font-bold text-blue-600 text-xs mb-1">{f.labelAr}</div>
                          <div className="text-[10px] text-slate-500">{officeById(r.officeId)?.nameAr}</div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                }
              });
            }
            for (const f of routeDefs) {
              if (!isFieldLayerOn(layers, f.fieldKey)) continue;
              const v = ex[f.fieldKey];
              if (!Array.isArray(v) || v.length < 2) continue;
              const positions = v
                .filter((p: any) => p && typeof p.lat === 'number' && typeof p.lng === 'number')
                .map((p: any) => [p.lat, p.lng] as [number, number]);
              if (positions.length < 2) continue;
              out.push(
                <Polyline
                  key={`xR-${r.id}-${f.id}`}
                  positions={positions}
                  pathOptions={{ color: '#22D3EE', weight: 4, opacity: 0.85 }}
                />
              );
            }
          }
          return out;
        })()}

        {/* Agent GPS */}
        {layers.has('agentGPS') && state.agentLocations.map(agent => {
          const minutesAgo = (Date.now() - new Date(agent.updatedAt).getTime()) / 60000;
          const isOnline = minutesAgo < 10;
          return (
            <div key={agent.agentId}>
              <Circle
                center={[agent.lat, agent.lng]}
                radius={500}
                pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.05, weight: 1, opacity: isOnline ? 0.4 : 0.15 }}
              />
              <Marker position={[agent.lat, agent.lng]} icon={agentIcon} opacity={isOnline ? 1 : 0.4}>
                <Popup>
                  <div className="text-right font-tajawal" dir="rtl">
                    <div className="font-bold text-blue-400 text-sm">{agent.agentName}</div>
                    <div className="text-xs text-slate-400">{officeById(agent.officeId)?.nameAr}</div>
                    <div className="text-[10px] text-slate-500 mt-1">آخر تحديث: {Math.round(minutesAgo)} دقيقة مضت</div>
                  </div>
                </Popup>
              </Marker>
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}
