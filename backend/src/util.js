import { timingSafeEqual } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

export function text(value, { name, max = 200, required = false } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw new HttpError(400, `${name} zorunludur.`);
    return null;
  }
  const s = String(value).trim();
  if (s.length > max) throw new HttpError(400, `${name} en fazla ${max} karakter olabilir.`);
  return s;
}

export function oneOf(value, allowed, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!allowed.includes(value)) throw new HttpError(400, `Geçersiz değer: ${value}`);
  return value;
}

export function isoDate(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `${name} geçerli bir tarih olmalıdır.`);
  }
  return value;
}

export function id(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Geçersiz kayıt numarası.');
  return n;
}

function tokenMatches(given) {
  // Yayında ADMIN_TOKEN tanımlı değilse yönetici girişi kapalıdır; varsayılan şifre sadece lokal içindir.
  const isProd = process.env.VERCEL || process.env.NODE_ENV === 'production';
  const expected = process.env.ADMIN_TOKEN || (isProd ? null : 'sila-yonetici');
  if (!expected || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAdmin(req) {
  return tokenMatches(req.get('x-admin-token'));
}

export function requireAdmin(req, _res, next) {
  if (!isAdmin(req)) return next(new HttpError(401, 'Bu işlem için yönetici girişi gerekli.'));
  next();
}
