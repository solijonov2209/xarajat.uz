const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');
const { guestOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/login', guestOnly, (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', guestOnly, async (req, res) => {
  const db = getDb();
  const { email, password } = req.body;

  const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
  const user = result.rows[0];

  if (!user) {
    return res.render('login', { error: 'Email yoki parol noto\'g\'ri' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.render('login', { error: 'Email yoki parol noto\'g\'ri' });
  }

  req.session.userId = Number(user.id);
  res.redirect('/');
});

router.get('/register', guestOnly, (req, res) => {
  res.render('register', { error: null });
});

router.post('/register', guestOnly, async (req, res) => {
  const db = getDb();
  const { name, email, password, password2 } = req.body;

  if (!name || !email || !password) {
    return res.render('register', { error: 'Barcha maydonlarni to\'ldiring' });
  }

  if (password.length < 6) {
    return res.render('register', { error: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' });
  }

  if (password !== password2) {
    return res.render('register', { error: 'Parollar mos kelmaydi' });
  }

  const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
  if (existing.rows[0]) {
    return res.render('register', { error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = await db.execute({
    sql: 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    args: [name, email, hash]
  });

  req.session.userId = Number(result.lastInsertRowid);
  res.redirect('/');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
