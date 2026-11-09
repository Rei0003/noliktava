import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import crypto from 'node:crypto';
import { db } from './db.js';
import { requireLogin, csrf } from './auth.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import productRoutes from './routes/products.js';
import locationRoutes from './routes/locations.js';
import orderRoutes from './routes/orders.js';
import placementRoutes from './routes/placements.js';
import reportRoutes from './routes/reports.js';

const app = express();

app.set('view engine', 'ejs');
app.use(helmet());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 },
}));

app.use((req, res, next) => {
  res.locals.message = req.session.message;
  delete req.session.message;
  res.locals.user = null;
  res.locals.path = req.path;
  next();
});

app.use(csrf);

app.use(authRoutes);
app.use(requireLogin);

app.get('/', (req, res) => {
  const stats = {
    products: db.prepare('SELECT COUNT(*) AS n FROM products').get().n,
    lowStock: db.prepare('SELECT COUNT(*) AS n FROM products WHERE quantity <= min_quantity').get().n,
    openOrders: db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('Jauns', 'Apstrādē')").get().n,
    problems: db.prepare("SELECT COUNT(*) AS n FROM placements WHERE condition <> 'Labs'").get().n,
  };
  res.render('home', { stats });
});

app.use('/users', userRoutes);
app.use('/products', productRoutes);
app.use('/locations', locationRoutes);
app.use('/orders', orderRoutes);
app.use('/placements', placementRoutes);
app.use('/reports', reportRoutes);

app.use((req, res) => res.status(404).render('error', { message: 'Lapa nav atrasta.' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: 'Notika kļūda. Mēģini vēlreiz.' });
});

app.listen(3000, () => console.log('Noliktava darbojas: http://localhost:3000'));
