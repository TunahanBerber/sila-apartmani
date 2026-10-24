import { supabase } from './supabase.js';

const NEEDS_ADMIN = 'Bu işlem için yönetici girişi gerekli.';

// Supabase / PostgREST hatalarını kullanıcıya gösterilecek Türkçe mesajlara çevirir.
function friendly(error) {
  const msg = error?.message || '';
  if (/fetch|network|Load failed/i.test(msg)) {
    return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
  }
  switch (error?.code) {
    case '42501':
      return /row-level security/i.test(msg) ? NEEDS_ADMIN : msg;
    case 'P0001':
    case 'P0002':
      return msg;
    case '23514':
    case '22001':
      return 'Girilen bilgiler geçersiz. Zorunlu alanları ve uzunlukları kontrol edin.';
    case '22P02':
    case '22007':
    case '22008':
      return 'Tutar ya da tarih geçerli değil.';
  }
  return 'İşlem başarısız oldu.';
}

async function run(promise) {
  let result;
  try {
    result = await promise;
  } catch (e) {
    throw new Error(friendly(e));
  }
  if (result.error) throw Object.assign(new Error(friendly(result.error)), { code: result.error.code });
  return result.data;
}

// Güncelleme/silme RLS'e takılırsa Postgres hata vermez, sadece 0 satır döner.
function one(rows, notFound) {
  if (!rows?.length) throw new Error(notFound);
  return rows[0];
}

const clean = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

function required(value, name) {
  const v = clean(value);
  if (!v) throw new Error(`${name} zorunludur.`);
  return v;
}

function expenseRow(b) {
  const amount = Number(b.amount);
  if (b.amount === '' || !Number.isFinite(amount) || amount < 0) throw new Error('Tutar geçerli bir sayı olmalıdır.');
  return {
    title: required(b.title, 'Başlık'),
    category: clean(b.category) || 'diger',
    amount: Math.round(amount * 100) / 100,
    due_date: required(b.due_date, 'Son ödeme tarihi'),
    status: b.status === 'odendi' ? 'odendi' : 'bekliyor',
    vendor: clean(b.vendor),
    recurring: b.recurring || 'none',
    notes: clean(b.notes),
  };
}

function announcementRow(b) {
  return {
    title: required(b.title, 'Başlık'),
    body: required(b.body, 'İçerik'),
    priority: b.priority === 'onemli' ? 'onemli' : 'normal',
    pinned: Boolean(b.pinned),
  };
}

function nextMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

export const api = {
  stats: () => run(supabase.rpc('get_stats')),

  expenses: {
    list({ month, category, status } = {}) {
      let q = supabase.from('expenses_view').select('*');
      if (month) q = q.gte('due_date', `${month}-01`).lt('due_date', nextMonth(month));
      if (category) q = q.eq('category', category);
      if (status === 'gecikti') q = q.eq('overdue', true);
      else if (status) q = q.eq('status', status);
      return run(q.order('due_date', { ascending: false }).order('id', { ascending: false }).limit(500));
    },
    create: (body) => run(supabase.from('expenses').insert(expenseRow(body)).select()).then((r) => one(r, NEEDS_ADMIN)),
    update: (id, body) =>
      run(supabase.from('expenses').update(expenseRow(body)).eq('id', id).select()).then((r) => one(r, NEEDS_ADMIN)),
    togglePaid: (id) => run(supabase.rpc('toggle_expense_paid', { p_id: id })),
    remove: (id) => run(supabase.from('expenses').delete().eq('id', id).select('id')).then((r) => one(r, NEEDS_ADMIN)),
  },

  suggestions: {
    list: ({ sort, status } = {}) => run(supabase.rpc('list_suggestions', { p_sort: sort, p_status: status || null })),
    async create(b) {
      // Ad ve daire no veritabanında sakin kaydından doldurulur.
      const row = {
        title: required(b.title, 'Başlık'),
        description: required(b.description, 'Açıklama'),
        category: b.category || 'genel',
      };
      const rows = await run(supabase.from('suggestions').insert(row).select());
      return { ...rows[0], votes: 0, voted: false };
    },
    vote: (id) => run(supabase.rpc('toggle_vote', { p_id: id })),
    update: (id, { status, admin_note }) =>
      run(supabase.from('suggestions').update({ status, admin_note: clean(admin_note) }).eq('id', id).select()).then((r) =>
        one(r, NEEDS_ADMIN),
      ),
    remove: (id) => run(supabase.from('suggestions').delete().eq('id', id).select('id')).then((r) => one(r, NEEDS_ADMIN)),
  },

  announcements: {
    list: () =>
      run(
        supabase
          .from('announcements')
          .select('*')
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(200),
      ),
    create: (body) =>
      run(supabase.from('announcements').insert(announcementRow(body)).select()).then((r) => one(r, NEEDS_ADMIN)),
    update: (id, body) =>
      run(supabase.from('announcements').update(announcementRow(body)).eq('id', id).select()).then((r) =>
        one(r, NEEDS_ADMIN),
      ),
    remove: (id) => run(supabase.from('announcements').delete().eq('id', id).select('id')).then((r) => one(r, NEEDS_ADMIN)),
  },

  dues: {
    // Bir yılın tüm ödemeleri: [{ apartment_no, month: 'YYYY-MM-01', amount, paid_at }]
    list: (year) =>
      run(
        supabase
          .from('dues_payments')
          .select('apartment_no, month, amount, paid_at')
          .gte('month', `${year}-01-01`)
          .lte('month', `${year}-12-01`),
      ),
    toggle: (apartment_no, month) => run(supabase.rpc('toggle_due', { p_apartment_no: apartment_no, p_month: month })),
    settings: () => run(supabase.from('app_settings').select('unit_count, dues_amount').single()),
    setAmount(amount) {
      const n = Number(amount);
      if (amount === '' || !Number.isFinite(n) || n < 0) throw new Error('Aidat tutarı geçerli bir sayı olmalıdır.');
      return run(
        supabase.from('app_settings').update({ dues_amount: Math.round(n * 100) / 100 }).eq('id', true).select(),
      ).then((r) => one(r, NEEDS_ADMIN));
    },
  },

  residents: {
    list: () => run(supabase.rpc('list_residents')),
    review: (userId, status) => run(supabase.rpc('review_resident', { p_user_id: userId, p_status: status })),
  },

  // Herkes e-posta + şifre ile girer; daire bilgisi ilk girişte saveProfile ile alınır.
  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email: String(email).trim(), password });
    if (error) {
      throw new Error(/invalid/i.test(error.message) ? 'E-posta ya da şifre hatalı.' : friendly(error));
    }
  },
  async register({ email, password }) {
    const { error } = await supabase.functions.invoke('register', { body: { email: String(email).trim(), password } });
    if (error) {
      const body = await error.context?.json?.().catch(() => null);
      throw new Error(body?.error || friendly(error));
    }
  },
  saveProfile: ({ apartment_no, full_name }) =>
    run(supabase.rpc('save_profile', { p_apartment_no: Number(apartment_no), p_full_name: full_name })),
  unitCount: () =>
    run(supabase.from('app_settings').select('unit_count').single()).then((r) => r.unit_count),
  myResident: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return run(
      supabase.from('residents').select('apartment_no, full_name, status').eq('user_id', data.user.id).maybeSingle(),
    );
  },
  isAdmin: () => run(supabase.rpc('is_admin')),
  signOut: () => supabase.auth.signOut(),
};
