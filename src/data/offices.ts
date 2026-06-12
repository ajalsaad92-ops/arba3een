export interface Office {
  id: string;
  code: string;
  nameAr: string;
  governorateAr: string;
  lat: number;
  lng: number;
}

export const OFFICES: Office[] = [
  { id: 'HQ',  code: 'HQ',  nameAr: 'مقر المديرية',        governorateAr: 'بغداد',         lat: 33.3152, lng: 44.3661 },
  { id: 'BGD', code: 'BGD', nameAr: 'مكتب بغداد',          governorateAr: 'بغداد',         lat: 33.3406, lng: 44.4009 },
  { id: 'KRB', code: 'KRB', nameAr: 'مكتب كربلاء المقدسة', governorateAr: 'كربلاء المقدسة', lat: 32.6161, lng: 44.0248 },
  { id: 'NJF', code: 'NJF', nameAr: 'مكتب النجف الأشرف',  governorateAr: 'النجف الأشرف',  lat: 32.0017, lng: 44.3369 },
  { id: 'BBL', code: 'BBL', nameAr: 'مكتب بابل',          governorateAr: 'بابل',          lat: 32.4785, lng: 44.4284 },
  { id: 'QDS', code: 'QDS', nameAr: 'مكتب الديوانية',     governorateAr: 'الديوانية',     lat: 31.9919, lng: 44.9200 },
  { id: 'MTH', code: 'MTH', nameAr: 'مكتب المثنى',        governorateAr: 'المثنى',        lat: 31.3299, lng: 45.2839 },
  { id: 'DHQ', code: 'DHQ', nameAr: 'مكتب ذي قار',        governorateAr: 'ذي قار',        lat: 31.0626, lng: 46.2754 },
  { id: 'MYS', code: 'MYS', nameAr: 'مكتب ميسان',         governorateAr: 'ميسان',         lat: 31.8432, lng: 47.1433 },
  { id: 'BAS', code: 'BAS', nameAr: 'مكتب البصرة',        governorateAr: 'البصرة',        lat: 30.5085, lng: 47.7804 },
  { id: 'WST', code: 'WST', nameAr: 'مكتب واسط',          governorateAr: 'واسط',          lat: 32.5405, lng: 45.8201 },
  { id: 'SLD', code: 'SLD', nameAr: 'مكتب صلاح الدين',    governorateAr: 'صلاح الدين',    lat: 34.5593, lng: 43.6750 },
  { id: 'ANB', code: 'ANB', nameAr: 'مكتب الأنبار',       governorateAr: 'الأنبار',       lat: 33.4420, lng: 43.3025 },
  { id: 'DLY', code: 'DLY', nameAr: 'مكتب ديالى',         governorateAr: 'ديالى',         lat: 33.7697, lng: 44.6509 },
  { id: 'KRK', code: 'KRK', nameAr: 'مكتب كركوك',         governorateAr: 'كركوك',         lat: 35.4681, lng: 44.3922 },
];

export const KURDISTAN_OFFICES = ['KRK']; // visually masked but rendered

export const officeById = (id: string) => OFFICES.find(o => o.id === id);
export const officeByCode = (code: string) => OFFICES.find(o => o.code === code);
