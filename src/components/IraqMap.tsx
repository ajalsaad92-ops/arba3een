import React, { useEffect, useRef, useMemo, useState, memo } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, Polyline, Circle, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { KURDISTAN_CODES } from '../data/iraqGeo';
import iraqAdm1 from '../data/iraq-adm1.json';
import iraqAdm0 from '../data/iraq-adm0.json';
import { useMapData, useOps } from '../store/opsStore';
import { useOffices } from '../lib/offices';
import type { Office } from '../data/offices';

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
const PROVINCE_FILL: Record<string, string> = {
  NIN: '#DBEAFE', SLD: '#D1FAE5', ANB: '#FFEDD5', BGD: '#FEF3C7',
  DLY: '#FEE2E2', KRK: '#EDE9FE', ERB: '#E5E7EB', SUL: '#E5E7EB', DOH: '#E5E7EB',
  WST: '#CFFAFE', KRB: '#FCE7F3', NJF: '#ECFCCB', BBL: '#FBCFE8',
  QDS: '#FEF9C3', MTH: '#EDE9FE', DHQ: '#FFEDD5', MYS: '#D1FAE5', BAS: '#FECACA',
};

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MAP_CONFIG = {
  center: [33.2, 43.7] as [number, number],
  zoom: 6, minZoom: 5, maxZoom: 14,
  maxBounds: [[28.5, 37.5], [38.0, 49.5]] as [[number, number], [number, number]],
  maxBoundsViscosity: 1.0,
};

function buildMaskRings(): [number, number][][] {
  const outer: [number, number][] = [[10,20],[10,70],[55,70],[55,20],[10,20]];
  const rings: [number, number][][] = [outer];
  const geom: any = (iraqAdm0 as any).features[0].geometry;
  const pushRing = (coords: any[]) => { rings.push(coords.map((c:any)=> [c[1], c[0]] as [number,number])); };
  if (geom.type === 'Polygon') pushRing(geom.coordinates[0]);
  else if (geom.type === 'MultiPolygon') geom.coordinates.forEach((poly:any)=>pushRing(poly[0]));
  return rings;
}
const MASK_RINGS = buildMaskRings();

function ringCentroid(ring: [number, number][]): [number, number] {
  let lat=0,lng=0; for(const p of ring){ lat+=p[0]; lng+=p[1]; }
  return [lat/ring.length, lng/ring.length];
}
function geometryCentroid(geom: any): [number, number] {
  if (geom.type === 'Polygon') return ringCentroid(geom.coordinates[0].map((c:any)=>[c[1],c[0]]));
  const polys = geom.coordinates as any[];
  let best=polys[0][0], bestSize=0;
  for(const poly of polys){ if(poly[0].length > bestSize){ bestSize=poly[0].length; best=poly[0]; }}
  return ringCentroid(best.map((c:any)=>[c[1],c[0]]));
}

function createOfficeIcon(submitted: boolean, selected: boolean, kurdistan: boolean): L.DivIcon {
  const color = kurdistan ? '#9CA3AF' : submitted ? '#F59E0B' : '#0F172A';
  return L.divIcon({
    className: 'office-marker',
    html: `<div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center">
      <svg width="26" height="26" viewBox="0 0 28 28" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">
        <polygon points="14,2 25,8 25,20 14,26 3,20 3,8" fill="${color}" stroke="${selected ? '#D97706' : '#ffffff'}" stroke-width="${selected ? 2.5 : 1.5}" opacity="${kurdistan ? 0.7 : 1}"/>
        <text x="14" y="17" text-anchor="middle" fill="${submitted && !kurdistan ? '#000' : '#fff'}" font-size="10" font-weight="900" font-family="Cairo,sans-serif">م</text>
      </svg>
    </div>`,
    iconSize: [32,32], iconAnchor: [16,16],
  });
}
const borderIcon = L.divIcon({ className:'border-marker', html:`<div style="width:20px;height:20px;transform:rotate(45deg);background:#10B981;border:2px solid #0B0F19;box-shadow:0 2px 4px rgba(0,0,0,.4)"></div>`, iconSize:[20,20], iconAnchor:[10,10]});
const agentIcon = L.divIcon({ className:'agent-marker', html:`<div style="width:10px;height:10px;border-radius:50%;background:#3B82F6;border:2px solid #fff;box-shadow:0 0 6px rgba(59,130,246,.8)"></div>`, iconSize:[14,14], iconAnchor:[7,7]});
const eventIcon = L.divIcon({ className:'event-marker', html:`<div style="width:10px;height:10px;border-radius:50%;background:#3B82F6;border:2px solid #fff"></div>`, iconSize:[14,14], iconAnchor:[7,7]});
const procIcon = L.divIcon({ className:'proc-marker', html:`<div style="width:12px;height:12px;background:#F59E0B;border:2px solid #0B0F19;transform:rotate(45deg)"></div>`, iconSize:[14,14], iconAnchor:[7,7]});

function MapController({ selectedOfficeId, offices, onSelect }: { selectedOfficeId: string | null; offices: Office[]; onSelect?: (o: Office | null) => void }) {
  const map = useMap();
  useEffect(() => {
    if (selectedOfficeId) {
      const office = offices.find(o=>o.id===selectedOfficeId);
      if (office) { map.flyTo([office.lat, office.lng], 9, { duration: 0.6 }); onSelect?.(office); }
    } else {
      map.flyTo(MAP_CONFIG.center, MAP_CONFIG.zoom, { duration: 0.6 });
    }
  }, [selectedOfficeId, offices, map, onSelect]);
  return null;
}

interface IraqMapProps {
  onSelectOffice?: (office: Office | null) => void;
  selectedOfficeId?: string | null;
  height?: string;
  filterOfficeIds?: string[];
  className?: string;
}

function IraqMapInner({ onSelectOffice, selectedOfficeId, height = '100%', filterOfficeIds, className = '' }: IraqMapProps) {
  const mapData = useMapData();
  const { offices, officeById } = useOffices();
  const [hoveredGov, setHoveredGov] = useState<string | null>(null);



  const visibleOffices = useMemo(() => {
    let list = (!filterOfficeIds || filterOfficeIds.length === 0) ? offices : offices.filter(o => filterOfficeIds.includes(o.id));
    return list;
  }, [offices, filterOfficeIds]);

  // reports are from OpsContext – we need submitted office ids only
  // Use a lightweight selector via useOps – but mapData doesn't include reports.
  // So we read reports separately, memoized.
  const { state: { todayReports } } = useOps();
  const submittedOfficeIds = useMemo(() => new Set(todayReports.map((r:any)=>r.officeId)), [todayReports]);

  const iconCache = useRef<Map<string, L.DivIcon>>(new Map());
  const getOfficeIcon = (office: Office, submitted: boolean, selected: boolean) => {
    const key = `${office.id}-${submitted?1:0}-${selected?1:0}`;
    if (!iconCache.current.has(key)) {
      iconCache.current.set(key, createOfficeIcon(submitted, selected, KURDISTAN_CODES.includes(office.id)));
    }
    return iconCache.current.get(key)!;
  };

  // memoize event/procession points – prevents hundreds of Marker remounts per realtime tick
  const eventPoints = useMemo(() => {
    const pts: { lat:number; lng:number; key:string }[] = [];
    todayReports.forEach((r:any) => {
      (r.eventsCoordinates || []).forEach((c:any,i:number)=> pts.push({ lat:c.lat, lng:c.lng, key:`e-${r.id}-${i}` }));
    });
    return pts;
  }, [todayReports]);

  const processionPoints = useMemo(() => {
    const pts: { lat:number; lng:number; key:string }[] = [];
    todayReports.forEach((r:any) => {
      (r.processionWaypoints || []).forEach((c:any,i:number)=> pts.push({ lat:c.lat, lng:c.lng, key:`p-${r.id}-${i}` }));
    });
    return pts;
  }, [todayReports]);

  const layers = mapData.activeMapLayers;

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <MapContainer center={MAP_CONFIG.center} zoom={MAP_CONFIG.zoom} minZoom={MAP_CONFIG.minZoom} maxZoom={MAP_CONFIG.maxZoom}
        maxBounds={MAP_CONFIG.maxBounds} maxBoundsViscosity={0.8} zoomControl={false} style={{ width:'100%', height:'100%' }} attributionControl={true} className="z-0">
        <ZoomControl position="topleft" />
        <MapController selectedOfficeId={selectedOfficeId ?? null} offices={offices} onSelect={onSelectOffice} />
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap &copy; CARTO" />

        <Polygon positions={MASK_RINGS} pathOptions={{ color:'#64748B', weight:2, fillColor:'#ffffff', fillOpacity:1, interactive:false }} />

        {/* provinces */}
        {((iraqAdm1 as any).features as any[]).map((feat) => {
          const iso = feat.properties.shapeISO as string;
          const code = ISO_TO_CODE[iso];
          if (!code) return null;
          const isKurdistan = KURDISTAN_CODES.includes(code);
          const isHover = hoveredGov === code;
          const officeHere = offices.find(o => o.id === code);
          const isSelected = officeHere && selectedOfficeId === officeHere.id;
          const geom = feat.geometry;
          const positions: any = geom.type === 'Polygon'
            ? geom.coordinates.map((ring:any[])=>ring.map((c:any)=>[c[1],c[0]]))
            : geom.coordinates.map((poly:any[])=> poly.map((ring:any[])=>ring.map((c:any)=>[c[1],c[0]])));
          return (
            <Polygon key={iso} positions={positions}
              eventHandlers={{
                mouseover: ()=>setHoveredGov(code),
                mouseout: ()=>setHoveredGov(null),
                click: ()=> { if(officeHere && !isKurdistan) onSelectOffice?.(officeHere); }
              }}
              pathOptions={{
                color: isKurdistan ? '#6B7280' : isSelected ? '#D97706' : isHover ? '#F59E0B' : '#64748B',
                weight: isSelected ? 2.5 : isHover ? 2 : 1.1,
                fillColor: isKurdistan ? '#E5E7EB' : PROVINCE_FILL[code] || '#F1F5F9',
                fillOpacity: isKurdistan ? 0.45 : isSelected ? 0.55 : isHover ? 0.5 : 0.32,
                dashArray: isKurdistan ? '6, 4' : undefined,
              }}
            />
          );
        })}

        {/* province labels */}
        {((iraqAdm1 as any).features as any[]).map((feat) => {
          const code = ISO_TO_CODE[feat.properties.shapeISO];
          if (!code) return null;
          const [lat,lng] = geometryCentroid(feat.geometry);
          return <Marker key={`lbl-${code}`} position={[lat,lng]} interactive={false}
            icon={L.divIcon({ className:'gov-label', html:`<div style="color:#1E293B;font-family:Cairo;font-size:10px;font-weight:700;text-shadow:0 0 3px #fff,0 0 3px #fff;white-space:nowrap;pointer-events:none">${NAMES_AR[code]||code}</div>`, iconSize:[80,14], iconAnchor:[40,7] })} />;
        })}

        {/* offices */}
        {layers.has('offices') && visibleOffices.map(office => {
          const submitted = submittedOfficeIds.has(office.id);
          return (
            <Marker key={office.id} position={[office.lat, office.lng]}
              icon={getOfficeIcon(office, submitted, selectedOfficeId === office.id)}
              eventHandlers={{ click: () => onSelectOffice?.(office) }}>
              <Popup>
                <div className="text-right" dir="rtl" style={{ minWidth:160 }}>
                  <div className="font-bold text-amber-600">{office.nameAr}</div>
                  <div className="text-xs text-slate-500">{office.governorateAr}</div>
                  <div className="text-xs mt-1">{submitted ? '✓ تم الإرسال' : 'لم يُرسل بعد'}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* border crossings */}
        {layers.has('borderCrossings') && mapData.borderCrossings.map((bc:any)=>(
          <Marker key={bc.id} position={[bc.lat, bc.lng]} icon={borderIcon}>
            <Popup><div dir="rtl" className="text-right"><b className="text-emerald-600">{bc.nameAr}</b><br/>
              داخلون: {bc.dailyIn.toLocaleString('ar-IQ')} • خارجون: {bc.dailyOut.toLocaleString('ar-IQ')}
            </div></Popup>
          </Marker>
        ))}

        {/* flow paths */}
        {layers.has('flowPaths') && mapData.flowPaths.map((fp:any)=>{
          const color = fp.density==='high'?'#EF4444':fp.density==='medium'?'#F97316':'#10B981';
          const weight = fp.density==='high'?4:fp.density==='medium'?3:2;
          return <Polyline key={fp.id} positions={[[fp.fromLat, fp.fromLng],[fp.toLat, fp.toLng]]} pathOptions={{ color, weight, opacity:0.7 }} />;
        })}

        {/* events / processions – memoized */}
        {layers.has('events') && eventPoints.map(p => <Marker key={p.key} position={[p.lat, p.lng]} icon={eventIcon} />)}
        {layers.has('events') && processionPoints.map(p => <Marker key={p.key} position={[p.lat, p.lng]} icon={procIcon} />)}

        {/* agent GPS – no wrapping div, proper key */}
        {layers.has('agentGPS') && mapData.agentLocations.map((agent:any)=>{
          const minutesAgo = (Date.now() - new Date(agent.updatedAt).getTime())/60000;
          const isOnline = minutesAgo < 10;
          return (
            <React.Fragment key={agent.agentId}>
              <Circle center={[agent.lat, agent.lng]} radius={400} pathOptions={{ color:'#3B82F6', fillOpacity:0.04, weight:1, opacity: isOnline?0.35:0.12 }} />
              <Marker position={[agent.lat, agent.lng]} icon={agentIcon} opacity={isOnline?1:0.45}>
                <Popup><div dir="rtl" className="text-right"><b className="text-blue-600">{agent.agentName}</b><br/>{officeById(agent.officeId)?.nameAr}<br/><span className="text-[10px] text-slate-500">{Math.round(minutesAgo)} دقيقة</span></div></Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}

export default memo(IraqMapInner);
