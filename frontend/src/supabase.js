import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('VITE_SUPABASE_URL ve VITE_SUPABASE_PUBLISHABLE_KEY tanımlı olmalı (frontend/.env.example).');
}

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sila-auth' },
});
