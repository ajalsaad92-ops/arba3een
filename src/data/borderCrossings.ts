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

export const INITIAL_BORDER_CROSSINGS: BorderCrossing[] = [
  { id: 'bc1', nameAr: 'منفذ شلمجة',         lat: 30.4356, lng: 48.1203, neighboringCountryAr: 'إيران',  countryFlag: '🇮🇷', nearestOfficeId: 'BAS', dailyIn: 42500, dailyOut: 38200 },
  { id: 'bc2', nameAr: 'منفذ صفوان',         lat: 30.0558, lng: 47.7105, neighboringCountryAr: 'الكويت', countryFlag: '🇰🇼', nearestOfficeId: 'BAS', dailyIn: 12800, dailyOut:  9600 },
  { id: 'bc3', nameAr: 'منفذ طريبيل',        lat: 33.3889, lng: 40.5153, neighboringCountryAr: 'الأردن', countryFlag: '🇯🇴', nearestOfficeId: 'ANB', dailyIn:  8400, dailyOut:  6200 },
  { id: 'bc4', nameAr: 'منفذ المنذرية',      lat: 33.9167, lng: 44.8667, neighboringCountryAr: 'إيران',  countryFlag: '🇮🇷', nearestOfficeId: 'DLY', dailyIn:  3200, dailyOut:  2800 },
  { id: 'bc5', nameAr: 'منفذ زرباطية',       lat: 32.7667, lng: 46.0667, neighboringCountryAr: 'إيران',  countryFlag: '🇮🇷', nearestOfficeId: 'WST', dailyIn: 15600, dailyOut: 14200 },
  { id: 'bc6', nameAr: 'منفذ الشيب',         lat: 29.9667, lng: 48.0167, neighboringCountryAr: 'الكويت', countryFlag: '🇰🇼', nearestOfficeId: 'BAS', dailyIn:  4800, dailyOut:  3900 },
  { id: 'bc7', nameAr: 'منفذ القائم',        lat: 34.3731, lng: 40.9803, neighboringCountryAr: 'سوريا',  countryFlag: '🇸🇾', nearestOfficeId: 'ANB', dailyIn:  2200, dailyOut:  1800 },
  { id: 'bc8', nameAr: 'منفذ ربيعة',         lat: 36.7792, lng: 42.0586, neighboringCountryAr: 'سوريا',  countryFlag: '🇸🇾', nearestOfficeId: 'SLD', dailyIn:  1400, dailyOut:  1100 },
  { id: 'bc9', nameAr: 'منفذ إبراهيم الخليل',lat: 37.1056, lng: 42.3525, neighboringCountryAr: 'تركيا',  countryFlag: '🇹🇷', nearestOfficeId: 'SLD', dailyIn:   800, dailyOut:   650 },
  { id: 'bc10',nameAr: 'منفذ جيلان',         lat: 34.1667, lng: 46.0833, neighboringCountryAr: 'إيران',  countryFlag: '🇮🇷', nearestOfficeId: 'DLY', dailyIn:  2100, dailyOut:  1900 },
  { id: 'bc11',nameAr: 'منفذ الحسينية',      lat: 34.2667, lng: 46.1833, neighboringCountryAr: 'إيران',  countryFlag: '🇮🇷', nearestOfficeId: 'DLY', dailyIn:  1800, dailyOut:  1600 },
];
