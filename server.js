const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./database');

const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'xarajat-uz-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
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

app.listen(PORT, () => {
  console.log(`Server ishga tushdi: http://localhost:${PORT}`);
});
