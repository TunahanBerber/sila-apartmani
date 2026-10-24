import { Router } from 'express';
import { query } from '../db.js';
import { HttpError, id, oneOf, requireAdmin, text } from '../util.js';

const router = Router();

const STATUSES = ['yeni', 'inceleniyor', 'onaylandi', 'tamamlandi', 'reddedildi'];
const CATEGORIES = ['genel', 'guvenlik', 'temizlik', 'peyzaj', 'enerji', 'sosyal', 'teknik'];

function voterId(req) {
  const v = req.get('x-voter-id');
  return typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : null;
}

const SELECT = `
  SELECT s.*,
         COUNT(v.voter_id)::int AS votes,
         COALESCE(BOOL_OR(v.voter_id = $1), false) AS voted
  FROM suggestions s
  LEFT JOIN suggestion_votes v ON v.suggestion_id = s.id`;

router.get('/', async (req, res) => {
  const params = [voterId(req)];
  let where = '';
  if (STATUSES.includes(req.query.status)) {
    params.push(req.query.status);
    where = `WHERE s.status = $2`;
  }
  const order = req.query.sort === 'new' ? 's.created_at DESC' : 'votes DESC, s.created_at DESC';
  const { rows } = await query(`${SELECT} ${where} GROUP BY s.id ORDER BY ${order} LIMIT 300`, params);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const b = req.body || {};
  const { rows } = await query(
    `INSERT INTO suggestions (title, description, author, apartment_no, category)
     VALUES ($1, $2, $3, $4, $5) RETURNING *, 0 AS votes, false AS voted`,
    [
      text(b.title, { name: 'Başlık', max: 120, required: true }),
      text(b.description, { name: 'Açıklama', max: 2000, required: true }),
      text(b.author, { name: 'İsim', max: 60 }),
      text(b.apartment_no, { name: 'Daire no', max: 10 }),
      oneOf(b.category, CATEGORIES, 'genel'),
    ],
  );
  res.status(201).json(rows[0]);
});

router.post('/:id/vote', async (req, res) => {
  const voter = voterId(req);
  if (!voter) throw new HttpError(400, 'Oy kimliği bulunamadı.');
  const suggestionId = id(req.params.id);

  const removed = await query('DELETE FROM suggestion_votes WHERE suggestion_id = $1 AND voter_id = $2', [suggestionId, voter]);
  if (!removed.rowCount) {
    const exists = await query('SELECT 1 FROM suggestions WHERE id = $1', [suggestionId]);
    if (!exists.rowCount) throw new HttpError(404, 'Öneri bulunamadı.');
    await query('INSERT INTO suggestion_votes (suggestion_id, voter_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [suggestionId, voter]);
  }
  const { rows } = await query('SELECT COUNT(*)::int AS votes FROM suggestion_votes WHERE suggestion_id = $1', [suggestionId]);
  res.json({ votes: rows[0].votes, voted: !removed.rowCount });
});

router.patch('/:id', requireAdmin, async (req, res) => {
  const b = req.body || {};
  const { rows } = await query(
    `UPDATE suggestions SET status = $1, admin_note = $2, updated_at = now() WHERE id = $3 RETURNING id`,
    [oneOf(b.status, STATUSES, 'yeni'), text(b.admin_note, { name: 'Yönetici notu', max: 500 }), id(req.params.id)],
  );
  if (!rows[0]) throw new HttpError(404, 'Öneri bulunamadı.');
  const full = await query(`${SELECT} WHERE s.id = $2 GROUP BY s.id`, [voterId(req), rows[0].id]);
  res.json(full.rows[0]);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const { rowCount } = await query('DELETE FROM suggestions WHERE id = $1', [id(req.params.id)]);
  if (!rowCount) throw new HttpError(404, 'Öneri bulunamadı.');
  res.status(204).end();
});

export default router;
