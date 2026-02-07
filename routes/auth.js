const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { guestOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/login', guestOnly, (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', guestOnly, (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.render('login', { error: 'Email yoki parol noto\'g\'ri' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.render('login', { error: 'Email yoki parol noto\'g\'ri' });
  }

  req.session.userId = user.id;
  res.redirect('/');
});

router.get('/register', guestOnly, (req, res) => {
  res.render('register', { error: null });
});

router.post('/register', guestOnly, (req, res) => {
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

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.render('register', { error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name, email, hash);

  req.session.userId = result.lastInsertRowid;
  res.redirect('/');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
