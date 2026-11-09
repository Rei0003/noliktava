import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../auth.js';
import { checkText, checkNumber } from '../validate.js';

const router = Router();
router.use(requireRole('admin', 'darbinieks'));

const NEXT_STATUS = {
  'Jauns': ['Apstrādē', 'Atcelts'],
  'Apstrādē': ['Nosūtīts', 'Atcelts'],
  'Nosūtīts': ['Piegādāts'],
  'Piegādāts': [],
  'Atcelts': [],
};

function showPage(req, res, form, errors = []) {
  const orders = db.prepare(`
    SELECT o.*, p.sku, p.name AS product_name FROM orders o
    JOIN products p ON p.id = o.product_id ORDER BY o.id DESC`).all();
  const products = db.prepare('SELECT id, sku, name, quantity FROM products ORDER BY name').all();
  res.render('orders', { orders, products, form, errors, NEXT_STATUS });
}

router.get('/', (req, res) => {
  showPage(req, res, { customer: '', product_id: '', quantity: 1 });
});

router.post('/', (req, res) => {
  const errors = [];
  const form = {
    customer: checkText(errors, req.body.customer, 'Klients', 2, 100),
    product_id: Number(req.body.product_id),
    quantity: checkNumber(errors, req.body.quantity, 'Daudzums', 1, 100000),
  };
  if (!db.prepare('SELECT id FROM products WHERE id = ?').get(form.product_id)) errors.push('Izvēlies preci.');
  if (errors.length) return showPage(req, res, form, errors);

  db.prepare('INSERT INTO orders (customer, product_id, quantity, created_by) VALUES (?, ?, ?, ?)')
    .run(form.customer, form.product_id, form.quantity, req.user.full_name);
  req.session.message = 'Pasūtījums izveidots.';
  res.redirect('/orders');
});

router.post('/:id/status', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  const newStatus = req.body.status;

  if (!order || !NEXT_STATUS[order.status].includes(newStatus)) {
    req.session.message = 'Šādu statusa maiņu nevar veikt.';
    return res.redirect('/orders');
  }

  if (newStatus === 'Nosūtīts') {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(order.product_id);
    if (product.quantity < order.quantity) {
      req.session.message = `Nepietiek preču: noliktavā ir ${product.quantity}, vajag ${order.quantity}.`;
      return res.redirect('/orders');
    }
    db.prepare('UPDATE products SET quantity = quantity - ? WHERE id = ?').run(order.quantity, order.product_id);
  }

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, order.id);
  req.session.message = `Pasūtījuma #${order.id} statuss: ${newStatus}.`;
  res.redirect('/orders');
});

router.post('/:id/delete', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (order && ['Jauns', 'Atcelts'].includes(order.status)) {
    db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
    req.session.message = 'Pasūtījums dzēsts.';
  } else {
    req.session.message = 'Dzēst var tikai jaunus vai atceltus pasūtījumus.';
  }
  res.redirect('/orders');
});

export default router;
