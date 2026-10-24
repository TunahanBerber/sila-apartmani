// Sakin kaydı: e-posta + şifre ile hesap açar. E-posta doğrulaması beklenmeden
// hesap hemen kullanılabilir; daire bilgisi ilk girişte save_profile() ile alınır.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Desteklenmeyen istek.' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Geçersiz istek.' });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return reply(400, { error: 'Geçerli bir e-posta adresi girin.' });
  }
  if (password.length < 6 || password.length > 72) return reply(400, { error: 'Şifre en az 6 karakter olmalıdır.' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return reply(409, { error: 'Bu e-posta ile zaten bir hesap var. Giriş yapın.' });
    }
    if (/password/i.test(error.message)) {
      return reply(400, { error: 'Şifre çok zayıf. Daha uzun bir şifre seçin.' });
    }
    console.error(error);
    return reply(500, { error: 'Kayıt oluşturulamadı.' });
  }

  return reply(201, { ok: true });
});
