import { reactive } from 'vue';
import { api } from '../api.js';
import { supabase } from '../supabase.js';

export const admin = reactive({
  isAdmin: false,
  email: '',
  async login(email, password) {
    await api.signIn(email, password);
    await refresh();
  },
  async logout() {
    await api.signOut();
  },
});

async function refresh() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user || user.is_anonymous) {
    admin.isAdmin = false;
    admin.email = '';
    return;
  }
  try {
    admin.isAdmin = await api.isAdmin();
    admin.email = admin.isAdmin ? user.email : '';
  } catch {
    admin.isAdmin = false;
  }
}

refresh();
// Auth olayının içinde başka Supabase çağrısı yapmak kilitlenmeye yol açtığı için ertelenir.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') setTimeout(refresh);
});
