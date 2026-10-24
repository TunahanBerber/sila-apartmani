import { admin } from './stores/admin.js';

const BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api`;

let cachedVoter;
export function voterId() {
  if (cachedVoter) return cachedVoter;
  try {
    cachedVoter = localStorage.getItem('sila-voter');
    if (!cachedVoter) {
      cachedVoter = crypto.randomUUID();
      localStorage.setItem('sila-voter', cachedVoter);
    }
  } catch {
    cachedVoter = crypto.randomUUID();
  }
  return cachedVoter;
}

async function request(path, { method = 'GET', body, params, token } = {}) {
  const url = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }

  const headers = { 'x-voter-id': voterId() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const adminToken = token ?? admin.token;
  if (adminToken) headers['x-admin-token'] = adminToken;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw Object.assign(new Error('Sunucuya ulaşılamadı. İnternet bağlantınızı ya da API adresini kontrol edin.'), { network: true });
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !token) admin.logout();
    throw Object.assign(new Error(data?.error || 'İşlem başarısız oldu.'), { status: res.status });
  }
  return data;
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body, opts) => request(path, { method: 'POST', body: body ?? {}, ...opts }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body: body ?? {} }),
  del: (path) => request(path, { method: 'DELETE' }),
};
