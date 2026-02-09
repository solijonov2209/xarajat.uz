const express = require('express');
const crypto = require('crypto');
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

// Parolni unutdim - sahifa
router.get('/forgot', guestOnly, (req, res) => {
  res.render('forgot', { error: null, success: null });
});

// Parolni unutdim - token yaratish
router.post('/forgot', guestOnly, async (req, res) => {
  const db = getDb();
  const { email } = req.body;

  if (!email) {
    return res.render('forgot', { error: 'Email manzilni kiriting', success: null });
  }

  const userResult = await db.execute({ sql: 'SELECT id, name FROM users WHERE email = ?', args: [email] });
  const user = userResult.rows[0];

  if (!user) {
    return res.render('forgot', { error: 'Bu email ro\'yxatdan o\'tmagan', success: null });
  }

  // Eski tokenlarni o'chirish
  await db.execute({ sql: 'DELETE FROM password_resets WHERE user_id = ?', args: [user.id] });

  // Yangi token yaratish (1 soat amal qiladi)
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await db.execute({
    sql: 'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
    args: [user.id, token, expiresAt]
  });

  const resetUrl = `${req.protocol}://${req.get('host')}/reset/${token}`;

  res.render('forgot', {
    error: null,
    success: `Assalomu alaykum, ${user.name}! Parolni tiklash havolasi tayyor. Quyidagi havola 1 soat amal qiladi:`
      + `<br><br><a href="${resetUrl}" style="color: var(--primary); word-break: break-all;">${resetUrl}</a>`
  });
});

// Parolni tiklash - sahifa
router.get('/reset/:token', guestOnly, async (req, res) => {
  const db = getDb();
  const { token } = req.params;

  const result = await db.execute({
    sql: 'SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > datetime(\'now\')',
    args: [token]
  });

  if (!result.rows[0]) {
    return res.render('reset', { error: 'Havola eskirgan yoki noto\'g\'ri. Qaytadan urinib ko\'ring.', success: null, token: '' });
  }

  res.render('reset', { error: null, success: null, token });
});

// Parolni tiklash - yangi parol saqlash
router.post('/reset/:token', guestOnly, async (req, res) => {
  const db = getDb();
  const { token } = req.params;
  const { password, password2 } = req.body;

  const result = await db.execute({
    sql: 'SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > datetime(\'now\')',
    args: [token]
  });
  const resetRecord = result.rows[0];

  if (!resetRecord) {
    return res.render('reset', { error: 'Havola eskirgan yoki noto\'g\'ri.', success: null, token: '' });
  }

  if (!password || password.length < 6) {
    return res.render('reset', { error: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak', success: null, token });
  }

  if (password !== password2) {
    return res.render('reset', { error: 'Parollar mos kelmaydi', success: null, token });
  }

  const hash = bcrypt.hashSync(password, 10);

  await db.execute({
    sql: 'UPDATE users SET password = ? WHERE id = ?',
    args: [hash, resetRecord.user_id]
  });

  await db.execute({
    sql: 'UPDATE password_resets SET used = 1 WHERE id = ?',
    args: [resetRecord.id]
  });

  res.render('reset', { error: null, success: 'Parol muvaffaqiyatli yangilandi! Endi tizimga kirishingiz mumkin.', token: '' });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
