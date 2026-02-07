const express = require('express');
const db = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const CATEGORIES = {
  income: ['Oylik maosh', 'Freelance', 'Biznes', 'Investitsiya', 'Boshqa'],
  expense: ['Ovqat', 'Transport', 'Kommunal', 'Kiyim', 'Salomatlik', "Ta'lim", "Ko'ngilochar", 'Boshqa']
};

router.get('/', requireAuth, (req, res) => {
  const userId = req.session.userId;

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
      COALESCE(SUM(CASE WHEN type = 'income' AND payment_type = 'cash' THEN amount ELSE 0 END), 0) as cash_income,
      COALESCE(SUM(CASE WHEN type = 'expense' AND payment_type = 'cash' THEN amount ELSE 0 END), 0) as cash_expense,
      COALESCE(SUM(CASE WHEN type = 'income' AND payment_type = 'card' THEN amount ELSE 0 END), 0) as card_income,
      COALESCE(SUM(CASE WHEN type = 'expense' AND payment_type = 'card' THEN amount ELSE 0 END), 0) as card_expense
    FROM transactions WHERE user_id = ?
  `).get(userId);

  const monthTotals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as month_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as month_expense
    FROM transactions
    WHERE user_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
  `).get(userId);

  const recent = db.prepare(`
    SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 10
  `).all(userId);

  res.render('dashboard', { totals, monthTotals, recent });
});

router.get('/add', requireAuth, (req, res) => {
  res.render('add', { categories: CATEGORIES, error: null, editing: null });
});

router.post('/add', requireAuth, (req, res) => {
  const { type, category, payment_type, amount, description, date } = req.body;

  if (!type || !category || !payment_type || !amount || !date) {
    return res.render('add', { categories: CATEGORIES, error: 'Barcha majburiy maydonlarni to\'ldiring', editing: null });
  }

  if (parseFloat(amount) <= 0) {
    return res.render('add', { categories: CATEGORIES, error: 'Summa 0 dan katta bo\'lishi kerak', editing: null });
  }

  db.prepare(`
    INSERT INTO transactions (user_id, type, category, payment_type, amount, description, date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.session.userId, type, category, payment_type, parseFloat(amount), description || '', date);

  res.redirect('/');
});

router.get('/edit/:id', requireAuth, (req, res) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!tx) return res.redirect('/');
  res.render('add', { categories: CATEGORIES, error: null, editing: tx });
});

router.post('/edit/:id', requireAuth, (req, res) => {
  const { type, category, payment_type, amount, description, date } = req.body;

  if (!type || !category || !payment_type || !amount || !date) {
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    return res.render('add', { categories: CATEGORIES, error: 'Barcha majburiy maydonlarni to\'ldiring', editing: tx });
  }

  db.prepare(`
    UPDATE transactions SET type = ?, category = ?, payment_type = ?, amount = ?, description = ?, date = ?
    WHERE id = ? AND user_id = ?
  `).run(type, category, payment_type, parseFloat(amount), description || '', date, req.params.id, req.session.userId);

  res.redirect('/');
});

router.post('/delete/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  res.redirect('/');
});

module.exports = router;
