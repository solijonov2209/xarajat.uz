const express = require('express');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const CATEGORIES = {
  income: ['Oylik maosh', 'Freelance', 'Biznes', 'Investitsiya', 'Boshqa'],
  expense: ['Ovqat', 'Transport', 'Kommunal', 'Kiyim', 'Salomatlik', "Ta'lim", "Ko'ngilochar", 'Boshqa']
};

router.get('/', requireAuth, async (req, res) => {
  const db = getDb();
  const userId = req.session.userId;

  const totalsResult = await db.execute({
    sql: `SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
      COALESCE(SUM(CASE WHEN type = 'income' AND payment_type = 'cash' THEN amount ELSE 0 END), 0) as cash_income,
      COALESCE(SUM(CASE WHEN type = 'expense' AND payment_type = 'cash' THEN amount ELSE 0 END), 0) as cash_expense,
      COALESCE(SUM(CASE WHEN type = 'income' AND payment_type = 'card' THEN amount ELSE 0 END), 0) as card_income,
      COALESCE(SUM(CASE WHEN type = 'expense' AND payment_type = 'card' THEN amount ELSE 0 END), 0) as card_expense
    FROM transactions WHERE user_id = ?`,
    args: [userId]
  });
  const totals = totalsResult.rows[0];

  const monthResult = await db.execute({
    sql: `SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as month_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as month_expense
    FROM transactions
    WHERE user_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')`,
    args: [userId]
  });
  const monthTotals = monthResult.rows[0];

  const recentResult = await db.execute({
    sql: 'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 10',
    args: [userId]
  });
  const recent = recentResult.rows;

  res.render('dashboard', { totals, monthTotals, recent });
});

router.get('/add', requireAuth, (req, res) => {
  res.render('add', { categories: CATEGORIES, error: null, editing: null });
});

router.post('/add', requireAuth, async (req, res) => {
  const db = getDb();
  const { type, category, payment_type, amount, description, date } = req.body;

  if (!type || !category || !payment_type || !amount || !date) {
    return res.render('add', { categories: CATEGORIES, error: 'Barcha majburiy maydonlarni to\'ldiring', editing: null });
  }

  if (parseFloat(amount) <= 0) {
    return res.render('add', { categories: CATEGORIES, error: 'Summa 0 dan katta bo\'lishi kerak', editing: null });
  }

  await db.execute({
    sql: 'INSERT INTO transactions (user_id, type, category, payment_type, amount, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [req.session.userId, type, category, payment_type, parseFloat(amount), description || '', date]
  });

  res.redirect('/');
});

router.get('/edit/:id', requireAuth, async (req, res) => {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.session.userId]
  });
  const tx = result.rows[0];
  if (!tx) return res.redirect('/');
  res.render('add', { categories: CATEGORIES, error: null, editing: tx });
});

router.post('/edit/:id', requireAuth, async (req, res) => {
  const db = getDb();
  const { type, category, payment_type, amount, description, date } = req.body;

  if (!type || !category || !payment_type || !amount || !date) {
    const result = await db.execute({
      sql: 'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      args: [req.params.id, req.session.userId]
    });
    return res.render('add', { categories: CATEGORIES, error: 'Barcha majburiy maydonlarni to\'ldiring', editing: result.rows[0] });
  }

  await db.execute({
    sql: 'UPDATE transactions SET type = ?, category = ?, payment_type = ?, amount = ?, description = ?, date = ? WHERE id = ? AND user_id = ?',
    args: [type, category, payment_type, parseFloat(amount), description || '', date, req.params.id, req.session.userId]
  });

  res.redirect('/');
});

router.post('/delete/:id', requireAuth, async (req, res) => {
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM transactions WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.session.userId]
  });
  res.redirect('/');
});

module.exports = router;
