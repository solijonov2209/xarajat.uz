require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

// data papkasini yaratish (agar yo'q bo'lsa)
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = require('./database');

const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

if (isProduction) {
  app.set('trust proxy', 1);
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-dev-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: isProduction,
    httpOnly: true
  }
}));

app.use((req, res, next) => {
  res.locals.user = null;
  if (req.session.userId) {
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.session.userId);
    res.locals.user = user;
  }
  next();
});

app.use('/', authRoutes);
app.use('/', transactionRoutes);
app.use('/', reportRoutes);

// 404 sahifa
app.use((req, res) => {
  res.status(404).render('404');
});

// Xatoliklarni ushlash
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Serverda xatolik yuz berdi');
});

app.listen(PORT, () => {
  console.log(`Server ishga tushdi: http://localhost:${PORT}`);
});
