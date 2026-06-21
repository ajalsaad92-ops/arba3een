export interface BorderCrossing {
  id: string;
  nameAr: string;
  lat: number;
  lng: number;
  neighboringCountryAr: string;
  countryFlag: string;
  nearestOfficeId: string;
  dailyIn: number;
  dailyOut: number;
}

// Coordinates are the real on-the-ground border-crossing locations (placed on
// Iraq's actual frontier, not inside the country).
export const INITIAL_BORDER_CROSSINGS: BorderCrossing[] = [
  { id: 'bc1', nameAr: 'منفذ شلمجة',          lat: 30.4760, lng: 48.1850, neighboringCountryAr: 'إيران',  countryFlag: '🇮🇷', nearestOfficeId: 'BAS', dailyIn: 42500, dailyOut: 38200 },
  { id: 'bc2', nameAr: 'منفذ صفوان',          lat: 30.1020, lng: 47.7090, neighboringCountryAr: 'الكويت', countryFlag: '🇰🇼', nearestOfficeId: 'BAS', dailyIn: 12800, dailyOut:  9600 },
  { id: 'bc3', nameAr: 'منفذ طريبيل',         lat: 32.9200, lng: 38.9900, neighboringCountryAr: 'الأردن', countryFlag: '🇯🇴', nearestOfficeId: 'ANB', dailyIn:  8400, dailyOut:  6200 },
  { id: 'bc4', nameAr: 'منفذ المنذرية',       lat: 33.7350, lng: 45.5650, neighboringCountryAr: 'إيران',  countryFlag: '🇮🇷', nearestOfficeId: 'DLY', dailyIn:  3200, dailyOut:  2800 },
  { id: 'bc5', nameAr: 'منفذ زرباطية',        lat: 33.1620, lng: 46.1450, neighboringCountryAr: 'إيران',  countryFlag: '🇮🇷', nearestOfficeId: 'WST', dailyIn: 15600, dailyOut: 14200 },
  { id: 'bc6', nameAr: 'منفذ الشيب',          lat: 32.0480, lng: 47.6900, neighboringCountryAr: 'إيران',  countryFlag: '🇮🇷', nearestOfficeId: 'MYS', dailyIn:  4800, dailyOut:  3900 },
  { id: 'bc7', nameAr: 'منفذ القائم',         lat: 34.3910, lng: 41.0010, neighboringCountryAr: 'سوريا',  countryFlag: '🇸🇾', nearestOfficeId: 'ANB', dailyIn:  2200, dailyOut:  1800 },
  { id: 'bc8', nameAr: 'منفذ ربيعة',          lat: 36.8200, lng: 42.0380, neighboringCountryAr: 'سوريا',  countryFlag: '🇸🇾', nearestOfficeId: 'NIN', dailyIn:  1400, dailyOut:  1100 },
  { id: 'bc9', nameAr: 'منفذ إبراهيم الخليل', lat: 37.0900, lng: 42.6900, neighboringCountryAr: 'تركيا',  countryFlag: '🇹🇷', nearestOfficeId: 'DOH', dailyIn:   800, dailyOut:   650 },
  { id: 'bc10',nameAr: 'منفذ مندلي',          lat: 33.7440, lng: 45.5550, neighboringCountryAr: 'إيران',  countryFlag: '🇮🇷', nearestOfficeId: 'DLY', dailyIn:  2100, dailyOut:  1900 },
  { id: 'bc11',nameAr: 'منفذ خانقين',         lat: 34.3500, lng: 45.5300, neighboringCountryAr: 'إيران',  countryFlag: '🇮🇷', nearestOfficeId: 'DLY', dailyIn:  1800, dailyOut:  1600 },
];
