import express from 'express';
import cors from 'cors';
import { init, pool } from './db.js';
import { isAdmin } from './util.js';
import expenses from './routes/expenses.js';
import suggestions from './routes/suggestions.js';
import announcements from './routes/announcements.js';
import stats from './routes/stats.js';

const app = express();

const origins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim()).filter(Boolean);
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cors({ origin: origins.includes('*') ? true : origins }));
app.use(express.json({ limit: '64kb' }));
app.use(async (_req, _res, next) => {
  await init();
  next();
});

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.post('/api/auth/check', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Yönetici şifresi hatalı.' });
  res.json({ ok: true });
});

app.use('/api/expenses', expenses);
app.use('/api/suggestions', suggestions);
app.use('/api/announcements', announcements);
app.use('/api/stats', stats);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Bulunamadı.' }));

app.use((err, _req, res, _next) => {
  if (!err.expose) console.error(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Sunucu hatası.' });
});

export default app;
