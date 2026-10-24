import { Router } from 'express';
import { query } from '../db.js';
import { HttpError, id, isoDate, oneOf, requireAdmin, text } from '../util.js';

const router = Router();

const SELECT = `SELECT *, (status = 'bekliyor' AND due_date < CURRENT_DATE) AS overdue FROM expenses`;
const nextDue = (t) => `(${t}.due_date + CASE ${t}.recurring WHEN 'yearly' THEN interval '1 year' ELSE interval '1 month' END)::date`;

function parseBody(body = {}) {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e10) {
    throw new HttpError(400, 'Tutar geçerli bir sayı olmalıdır.');
  }
  const status = oneOf(body.status, ['bekliyor', 'odendi'], 'bekliyor');
  return {
    title: text(body.title, { name: 'Başlık', max: 120, required: true }),
    category: text(body.category, { name: 'Kategori', max: 40 }) || 'diger',
    amount: Math.round(amount * 100) / 100,
    due_date: isoDate(body.due_date, 'Son ödeme tarihi'),
    status,
    paid_at: status === 'odendi' ? (body.paid_at ? isoDate(body.paid_at, 'Ödeme tarihi') : null) : null,
    vendor: text(body.vendor, { name: 'Firma', max: 120 }),
    recurring: oneOf(body.recurring, ['none', 'monthly', 'yearly'], 'none'),
    notes: text(body.notes, { name: 'Not', max: 1000 }),
  };
}

router.get('/', async (req, res) => {
  const where = [];
  const params = [];
  const { month, category, status } = req.query;

  if (typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
    params.push(`${month}-01`);
    where.push(`due_date >= $${params.length}::date AND due_date < ($${params.length}::date + interval '1 month')`);
  }
  if (typeof category === 'string' && category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (status === 'gecikti') where.push(`status = 'bekliyor' AND due_date < CURRENT_DATE`);
  else if (status === 'bekliyor' || status === 'odendi') {
    params.push(status);
    where.push(`status = $${params.length}`);
  }

  const sql = `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY due_date DESC, id DESC LIMIT 500`;
  const { rows } = await query(sql, params);
  res.json(rows);
});

router.post('/', requireAdmin, async (req, res) => {
  const e = parseBody(req.body);
  const { rows } = await query(
    `INSERT INTO expenses (title, category, amount, due_date, status, paid_at, vendor, recurring, notes)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 = 'odendi' THEN COALESCE($6::date, CURRENT_DATE) END, $7, $8, $9)
     RETURNING *, (status = 'bekliyor' AND due_date < CURRENT_DATE) AS overdue`,
    [e.title, e.category, e.amount, e.due_date, e.status, e.paid_at, e.vendor, e.recurring, e.notes],
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', requireAdmin, async (req, res) => {
  const e = parseBody(req.body);
  const { rows } = await query(
    `UPDATE expenses SET title = $1, category = $2, amount = $3, due_date = $4, status = $5,
       paid_at = CASE WHEN $5 = 'odendi' THEN COALESCE($6::date, paid_at, CURRENT_DATE) END,
       vendor = $7, recurring = $8, notes = $9
     WHERE id = $10
     RETURNING *, (status = 'bekliyor' AND due_date < CURRENT_DATE) AS overdue`,
    [e.title, e.category, e.amount, e.due_date, e.status, e.paid_at, e.vendor, e.recurring, e.notes, id(req.params.id)],
  );
  if (!rows[0]) throw new HttpError(404, 'Gider bulunamadı.');
  res.json(rows[0]);
});

// Ödendi <-> bekliyor geçişi. Tekrarlayan bir gider ödendiğinde sonraki dönemin kaydı otomatik açılır.
router.patch('/:id/pay', requireAdmin, async (req, res) => {
  const expenseId = id(req.params.id);
  const { rows } = await query(
    `UPDATE expenses
     SET status = CASE status WHEN 'odendi' THEN 'bekliyor' ELSE 'odendi' END,
         paid_at = CASE status WHEN 'odendi' THEN NULL ELSE CURRENT_DATE END
     WHERE id = $1
     RETURNING *, (status = 'bekliyor' AND due_date < CURRENT_DATE) AS overdue`,
    [expenseId],
  );
  const expense = rows[0];
  if (!expense) throw new HttpError(404, 'Gider bulunamadı.');

  let next = null;
  if (expense.status === 'odendi' && expense.recurring !== 'none') {
    const created = await query(
      `INSERT INTO expenses (title, category, amount, due_date, status, vendor, recurring)
       SELECT title, category, amount, ${nextDue('e')}, 'bekliyor', vendor, recurring
       FROM expenses e
       WHERE id = $1 AND NOT EXISTS (
         SELECT 1 FROM expenses x
         WHERE x.title = e.title AND x.category = e.category AND x.due_date = ${nextDue('e')}
       )
       RETURNING *`,
      [expenseId],
    );
    next = created.rows[0] || null;
  }
  res.json({ expense, next });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const { rowCount } = await query('DELETE FROM expenses WHERE id = $1', [id(req.params.id)]);
  if (!rowCount) throw new HttpError(404, 'Gider bulunamadı.');
  res.status(204).end();
});

export default router;
