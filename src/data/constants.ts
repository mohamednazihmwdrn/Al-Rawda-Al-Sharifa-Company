import { User } from "../types";

export const AYAT = [
  { text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', reference: 'الفاتحة 1', absoluteNumber: 1 },
  { text: 'وَإِنَّ اللَّهَ مَعَ الصَّابِرِينَ', reference: 'البقرة 153', absoluteNumber: 160 },
  { text: 'إِنَّ اللَّهَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ', reference: 'البقرة 20', absoluteNumber: 27 },
  { text: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', reference: 'الشرح 6', absoluteNumber: 6110 },
  { text: 'وَتَوَكَّلْ عَلَى اللَّهِ وَكَفَىٰ بِاللَّهِ وَكِيلًا', reference: 'النساء 81', absoluteNumber: 574 },
  { text: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', reference: 'الشرح 5', absoluteNumber: 6109 },
  { text: 'إِنَّ اللَّهَ يُحِبُّ الْمُتَّقِينَ', reference: 'آل عمران 76', absoluteNumber: 369 },
  { text: 'وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ', reference: 'البقرة 186', absoluteNumber: 193 },
  { text: 'اللَّهُ وَلِيُّ الَّذِينَ آمَنُوا', reference: 'البقرة 257', absoluteNumber: 264 },
  { text: 'إِنَّ اللَّهَ مَعَ الَّذِينَ اتَّقَوْا', reference: 'النحل 128', absoluteNumber: 2029 },
  { text: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', reference: 'الرعد 28', absoluteNumber: 1735 },
  { text: 'وَمَنْ يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', reference: 'الطلاق 3', absoluteNumber: 5188 },
  { text: 'فَاللَّهُ خَيْرٌ حَافِظًا وَهُوَ أَرْحَمُ الرَّاحِمِينَ', reference: 'يوسف 64', absoluteNumber: 1658 }
];

export const companyItemsMap: { [key: string]: string[] } = {
  "JOTUN": ["بستلة", "جالون", "كيلو", "نص", "علبة", "منتجات متنوعه"],
  "GLC": ["بستلة", "جالون", "كيلو", "علبة", "شيكارة", "منتجات متنوعه"],
  "Skip": ["بستلة", "جالون", "كيلو", "نص", "شيكارة", "منتجات متنوعه"],
  "Sipes": ["بستلة", "جالون", "كيلو", "نص", "علبة", "شيكارة", "منتجات متنوعه"],
  "CMB": ["بستلة", "جالون", "كيلو", "شيكارة", "منتجات متنوعه"],
  "Saveto": ["شيكارة", "جالون", "منتجات متنوعه"],
  "Sika": ["مجموعة", "شيكارة", "جالون", "منتجات متنوعه"],
  "منتجات متنوعه (اكسسوارات)": ["كالون", "اكره", "ترباس", "مقبض", "زرار درج", "تيلة", "مصد", "ماسورة", "حامل", "فلانشة", "منتجات متنوعه"],
  "حدايد ومسامير": ["شمبر", "مسمار", "تيش", "صامولة", "ورده", "منتجات متنوعه"],
  "منتجات متنوعه (عام)": ["كرتون", "اكسيد", "مواد عزل", "فرشة", "اسمنت", "اكسسوارات", "لوازم", "حدايد منوعه", "مفصلات", "اسطوانات", "مشمع", "استرتش", "صنفرة", "فوم", "ليب", "ممتاز", "تيب", "لصق شفاف", "بريمو كات", "عضم", "سليكون عاده", "منتجات متنوعه"]
};

export function getRandomAyat() {
  const randomIndex = Math.floor(Math.random() * AYAT.length);
  return AYAT[randomIndex];
}

export function getToday() {
  return new Date().toLocaleDateString('ar-EG');
}

export function isItemInTodayWindow(item: { createdAt?: number; date?: string }): boolean {
  const now = new Date();
  
  // Start of the current window
  const windowStart = new Date();
  if (now.getHours() >= 22) { // 10:00 PM or later
    windowStart.setHours(22, 0, 0, 0);
  } else {
    windowStart.setDate(windowStart.getDate() - 1);
    windowStart.setHours(22, 0, 0, 0);
  }
  
  // End of the current window
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + 1);

  if (item.createdAt) {
    return item.createdAt >= windowStart.getTime() && item.createdAt < windowEnd.getTime();
  }
  
  // Fallback if no createdAt exists: check date
  const todayStr = now.toLocaleDateString("ar-EG");
  return item.date === todayStr;
}

export function getNow() {
  const d = new Date();
  return d.toLocaleTimeString('ar-EG');
}

export function getFullDate() {
  const d = new Date();
  return `${d.toLocaleDateString('ar-EG')} - ${d.toLocaleTimeString('ar-EG')}`;
}
