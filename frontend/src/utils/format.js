const moneyFmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 });
const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const fullFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const monthShortFmt = new Intl.DateTimeFormat('tr-TR', { month: 'short' });
const monthLongFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const rtf = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' });

export const money = (n) => moneyFmt.format(n || 0);
export const compact = (n) => `₺${compactFmt.format(n || 0)}`;

/** 'YYYY-MM-DD' → yerel gece yarısı Date (UTC kaymasını önler) */
export function parseDay(s) {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const shortDate = (s) => dayFmt.format(parseDay(s));
export const longDate = (s) => fullFmt.format(typeof s === 'string' && s.length === 10 ? parseDay(s) : new Date(s));

export function toMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  return toMonthKey(new Date(y, m - 1 + delta, 1));
}
export const monthShort = (key) => monthShortFmt.format(parseDay(`${key}-01`)).replace('.', '');
export const monthLong = (key) => monthLongFmt.format(parseDay(`${key}-01`));

export function todayIso() {
  const d = new Date();
  return `${toMonthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;
}

export function timeAgo(iso) {
  const diff = (new Date(iso) - Date.now()) / 1000;
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, sec] of units) {
    if (Math.abs(diff) >= sec) return rtf.format(Math.round(diff / sec), unit);
  }
  return 'az önce';
}

/** Vadeye kalan gün: negatif → gecikmiş */
export function daysUntil(s) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseDay(s) - today) / 86400000);
}

export function dueLabel(s) {
  const d = daysUntil(s);
  if (d === 0) return 'Bugün';
  if (d === 1) return 'Yarın';
  if (d < 0) return `${-d} gün gecikti`;
  return `${d} gün kaldı`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}
