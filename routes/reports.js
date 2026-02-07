const express = require('express');
const db = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/reports', requireAuth, (req, res) => {
  res.render('reports');
});

router.get('/api/reports', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const { period, start_date, end_date } = req.query;

  let dateFilter = '';
  let params = [userId];

  if (start_date && end_date) {
    dateFilter = 'AND date BETWEEN ? AND ?';
    params.push(start_date, end_date);
  } else if (period === 'daily') {
    dateFilter = "AND date = date('now')";
  } else if (period === 'monthly') {
    dateFilter = "AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')";
  } else if (period === 'yearly') {
    dateFilter = "AND strftime('%Y', date) = strftime('%Y', 'now')";
  }

  const transactions = db.prepare(`
    SELECT * FROM transactions WHERE user_id = ? ${dateFilter} ORDER BY date DESC, id DESC
  `).all(...params);

  const categoryStats = db.prepare(`
    SELECT category, type, SUM(amount) as total
    FROM transactions WHERE user_id = ? ${dateFilter}
    GROUP BY category, type
  `).all(...params);

  const monthlyStats = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
    FROM transactions WHERE user_id = ? ${dateFilter}
    GROUP BY month ORDER BY month
  `).all(...params);

  const paymentStats = db.prepare(`
    SELECT payment_type,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
    FROM transactions WHERE user_id = ? ${dateFilter}
    GROUP BY payment_type
  `).all(...params);

  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
    FROM transactions WHERE user_id = ? ${dateFilter}
  `).get(...params);

  res.json({ transactions, categoryStats, monthlyStats, paymentStats, summary });
});

module.exports = router;
