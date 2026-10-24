import { Router } from 'express';
import { query } from '../db.js';
import { HttpError, id, oneOf, requireAdmin, text } from '../util.js';

const router = Router();

function parseBody(b = {}) {
  return [
    text(b.title, { name: 'Başlık', max: 120, required: true }),
    text(b.body, { name: 'İçerik', max: 3000, required: true }),
    oneOf(b.priority, ['normal', 'onemli'], 'normal'),
    Boolean(b.pinned),
  ];
}

router.get('/', async (_req, res) => {
  const { rows } = await query('SELECT * FROM announcements ORDER BY pinned DESC, created_at DESC LIMIT 200');
  res.json(rows);
});

router.post('/', requireAdmin, async (req, res) => {
  const { rows } = await query(
    'INSERT INTO announcements (title, body, priority, pinned) VALUES ($1, $2, $3, $4) RETURNING *',
    parseBody(req.body),
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { rows } = await query(
    'UPDATE announcements SET title = $1, body = $2, priority = $3, pinned = $4 WHERE id = $5 RETURNING *',
    [...parseBody(req.body), id(req.params.id)],
  );
  if (!rows[0]) throw new HttpError(404, 'Duyuru bulunamadı.');
  res.json(rows[0]);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const { rowCount } = await query('DELETE FROM announcements WHERE id = $1', [id(req.params.id)]);
  if (!rowCount) throw new HttpError(404, 'Duyuru bulunamadı.');
  res.status(204).end();
});

export default router;
