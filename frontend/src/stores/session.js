import { reactive } from 'vue';
import { api } from '../api.js';
import { supabase } from '../supabase.js';

// Oturum: herkes e-posta + şifre ile girer. Sakinlerden ilk girişte daire bilgisi alınır;
// yöneticilerden alınmaz.
export const session = reactive({
  ready: false,
  user: null,
  resident: null, // { apartment_no, full_name }
  isAdmin: false,
  get needsProfile() {
    return Boolean(this.user && !this.resident && !this.isAdmin);
  },
});

async function refresh() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;
  if (!user) {
    Object.assign(session, { user: null, resident: null, isAdmin: false, ready: true });
    return;
  }
  try {
    const [isAdmin, resident] = await Promise.all([api.isAdmin(), api.myResident()]);
    Object.assign(session, { user, resident, isAdmin, ready: true });
  } catch {
    Object.assign(session, { user, resident: null, isAdmin: false, ready: true });
  }
}

export async function signIn(email, password) {
  await api.signIn(email, password);
  await refresh();
}

export async function register(email, password) {
  await api.register({ email, password });
  await signIn(email, password);
}

export async function saveProfile(profile) {
  const r = await api.saveProfile(profile);
  session.resident = { apartment_no: r.apartment_no, full_name: r.full_name };
}

export async function signOut() {
  await api.signOut();
  await refresh();
}

refresh();
// Auth olayının içinde başka Supabase çağrısı yapmak kilitlenmeye yol açtığı için ertelenir.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') setTimeout(refresh);
});
