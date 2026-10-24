import pg from 'pg';
import { schema } from './schema.js';
import { seed } from './seed.js';

// NUMERIC -> number, DATE -> 'YYYY-MM-DD' (saat dilimi kaymasını önler)
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(1082, (v) => v);

// Vercel + Neon entegrasyonu DATABASE_URL (veya POSTGRES_URL) değişkenini otomatik ekler.
export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgres://sila:sila_secret@localhost:5432/sila',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_MAX) || (process.env.VERCEL ? 3 : 10),
});

export const query = (text, params) => pool.query(text, params);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function connectWithRetry() {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (attempt >= 15) throw err;
      console.log(`Veritabanı bekleniyor (${attempt}/15)…`);
      await wait(2000);
    }
  }
}

async function migrate() {
  await connectWithRetry();
  // Aynı anda açılan birden çok sunucusuz örnek şemayı/örnek veriyi çift yüklemesin.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(732001)');
    await client.query(schema);
    if (process.env.SEED !== 'false') {
      const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM expenses');
      if (rows[0].n === 0) {
        await seed(client);
        console.log('Örnek veriler yüklendi.');
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Sunucusuz ortamda her soğuk başlangıçta bir kez çalışır.
let ready;
export function init() {
  ready ??= migrate().catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}
