require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

// data papkasini yaratish (lokal rejim uchun)
if (!process.env.TURSO_DATABASE_URL) {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

const { getDb, initDb } = require('./database');

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

app.use(async (req, res, next) => {
  res.locals.user = null;
  if (req.session.userId) {
    const db = getDb();
    const result = await db.execute({ sql: 'SELECT id, name, email FROM users WHERE id = ?', args: [req.session.userId] });
    res.locals.user = result.rows[0] || null;
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

// Bazani yaratib, serverni ishga tushirish
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server ishga tushdi: http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Baza yaratishda xatolik:', err);
  process.exit(1);
});
