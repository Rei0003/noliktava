import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../auth.js';
import { checkText, checkNumber, checkPattern } from '../validate.js';

const router = Router();

function showPage(req, res, form, errors = []) {
  const products = db.prepare(`
    SELECT p.*, COALESCE((SELECT SUM(quantity) FROM placements WHERE product_id = p.id), 0) AS placed
    FROM products p ORDER BY p.name`).all();
  res.render('products', { products, form, errors });
}

const emptyForm = () => ({ id: null, sku: '', name: '', quantity: 0, min_quantity: 0, price: 0 });

router.get('/', (req, res) => {
  const editing = req.query.edit ? db.prepare('SELECT * FROM products WHERE id = ?').get(req.query.edit) : null;
  showPage(req, res, editing ?? emptyForm());
});

function readForm(req) {
  const errors = [];
  const form = {
    id: req.params.id ? Number(req.params.id) : null,
    sku: checkText(errors, req.body.sku, 'Artikuls', 2, 30).toUpperCase(),
    name: checkText(errors, req.body.name, 'Nosaukums', 2, 100),
    quantity: checkNumber(errors, req.body.quantity, 'Daudzums', 0, 1000000),
    min_quantity: checkNumber(errors, req.body.min_quantity, 'Minimālais atlikums', 0, 1000000),
    price: checkNumber(errors, req.body.price, 'Cena', 0, 1000000, true),
  };
  checkPattern(errors, form.sku, /^[A-Z0-9-]+$/, 'Artikulā drīkst būt tikai latīņu burti, cipari un -.');
  if (db.prepare('SELECT id FROM products WHERE sku = ? AND id <> ?').get(form.sku, form.id ?? 0)) {
    errors.push('Prece ar šādu artikulu jau eksistē.');
  }
  return { form, errors };
}

router.post('/', requireRole('admin', 'darbinieks'), (req, res) => {
  const { form, errors } = readForm(req);
  if (errors.length) return showPage(req, res, form, errors);

  db.prepare('INSERT INTO products (sku, name, quantity, min_quantity, price) VALUES (?, ?, ?, ?, ?)')
    .run(form.sku, form.name, form.quantity, form.min_quantity, form.price);
  req.session.message = 'Prece pievienota.';
  res.redirect('/products');
});

router.post('/:id', requireRole('admin', 'darbinieks'), (req, res) => {
  const { form, errors } = readForm(req);
  if (errors.length) return showPage(req, res, form, errors);

  db.prepare('UPDATE products SET sku = ?, name = ?, quantity = ?, min_quantity = ?, price = ? WHERE id = ?')
    .run(form.sku, form.name, form.quantity, form.min_quantity, form.price, form.id);
  req.session.message = 'Prece saglabāta.';
  res.redirect('/products');
});

router.post('/:id/delete', requireRole('admin'), (req, res) => {
  const usedInOrders = db.prepare('SELECT id FROM orders WHERE product_id = ?').get(req.params.id);
  if (usedInOrders) {
    req.session.message = 'Preci nevar dzēst, jo tā ir pasūtījumos.';
  } else {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    req.session.message = 'Prece dzēsta.';
  }
  res.redirect('/products');
});

export default router;
