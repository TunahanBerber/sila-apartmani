import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

const MONTH = `date_trunc('month', CURRENT_DATE)`;

router.get('/', async (_req, res) => {
  const [summary, monthly, byCategory, upcoming, suggestionCounts, topSuggestions, announcements] = await Promise.all([
    query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE due_date >= ${MONTH} AND due_date < ${MONTH} + interval '1 month'), 0)::float AS month_total,
        COALESCE(SUM(amount) FILTER (WHERE due_date >= ${MONTH} AND due_date < ${MONTH} + interval '1 month' AND status = 'odendi'), 0)::float AS month_paid,
        COALESCE(SUM(amount) FILTER (WHERE due_date >= ${MONTH} - interval '1 month' AND due_date < ${MONTH}), 0)::float AS prev_month_total,
        COALESCE(SUM(amount) FILTER (WHERE status = 'bekliyor' AND due_date < CURRENT_DATE), 0)::float AS overdue_amount,
        COUNT(*) FILTER (WHERE status = 'bekliyor' AND due_date < CURRENT_DATE)::int AS overdue_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'bekliyor'), 0)::float AS pending_total,
        COUNT(*) FILTER (WHERE status = 'bekliyor')::int AS pending_count,
        COALESCE(SUM(amount) FILTER (WHERE due_date >= ${MONTH} - interval '11 months' AND due_date < ${MONTH} + interval '1 month'), 0)::float AS year_total
      FROM expenses`),
    query(`
      SELECT to_char(m, 'YYYY-MM') AS month,
             COALESCE(SUM(e.amount), 0)::float AS total,
             COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'odendi'), 0)::float AS paid
      FROM generate_series(${MONTH} - interval '11 months', ${MONTH}, interval '1 month') AS m
      LEFT JOIN expenses e ON e.due_date >= m AND e.due_date < m + interval '1 month'
      GROUP BY m ORDER BY m`),
    query(`
      SELECT category, SUM(amount)::float AS total, COUNT(*)::int AS count
      FROM expenses
      WHERE due_date >= ${MONTH} - interval '11 months' AND due_date < ${MONTH} + interval '1 month'
      GROUP BY category ORDER BY total DESC`),
    query(`
      SELECT *, (due_date < CURRENT_DATE) AS overdue FROM expenses
      WHERE status = 'bekliyor' ORDER BY due_date ASC, id ASC LIMIT 6`),
    query(`SELECT status, COUNT(*)::int AS count FROM suggestions GROUP BY status`),
    query(`
      SELECT s.id, s.title, s.status, s.category, COUNT(v.voter_id)::int AS votes
      FROM suggestions s LEFT JOIN suggestion_votes v ON v.suggestion_id = s.id
      WHERE s.status NOT IN ('tamamlandi', 'reddedildi')
      GROUP BY s.id ORDER BY votes DESC, s.created_at DESC LIMIT 4`),
    query(`SELECT * FROM announcements ORDER BY pinned DESC, created_at DESC LIMIT 3`),
  ]);

  const units = Math.max(1, Number(process.env.UNIT_COUNT) || 12);
  const s = summary.rows[0];

  res.json({
    units,
    summary: { ...s, per_unit: s.month_total / units },
    monthly: monthly.rows,
    byCategory: byCategory.rows,
    upcoming: upcoming.rows,
    suggestions: Object.fromEntries(suggestionCounts.rows.map((r) => [r.status, r.count])),
    topSuggestions: topSuggestions.rows,
    announcements: announcements.rows,
  });
});

export default router;
