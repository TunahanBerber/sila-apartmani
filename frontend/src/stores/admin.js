import { reactive } from 'vue';

const KEY = 'sila-admin-token';

function read() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export const admin = reactive({
  token: read(),
  get isAdmin() {
    return Boolean(this.token);
  },
  login(token) {
    this.token = token;
    try {
      localStorage.setItem(KEY, token);
    } catch {}
  },
  logout() {
    this.token = '';
    try {
      localStorage.removeItem(KEY);
    } catch {}
  },
});
