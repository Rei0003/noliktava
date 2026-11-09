import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const role = req.user.role;
  const report = {};

  if (role === 'admin' || role === 'darbinieks') {
    report.totals = db.prepare(`
      SELECT COUNT(*) AS products, COALESCE(SUM(quantity), 0) AS units, COALESCE(SUM(quantity * price), 0) AS value
      FROM products`).get();
    report.lowStock = db.prepare('SELECT * FROM products WHERE quantity <= min_quantity ORDER BY name').all();
    report.ordersByStatus = db.prepare('SELECT status, COUNT(*) AS count FROM orders GROUP BY status').all();
  }

  if (role === 'admin' || role === 'kartotajs') {
    report.placements = db.prepare(`
      SELECT l.code, l.zone, p.sku, p.name, pl.quantity, pl.condition, pl.note FROM placements pl
      JOIN products p ON p.id = pl.product_id JOIN locations l ON l.id = pl.location_id
      ORDER BY l.code`).all();
    report.notPlaced = db.prepare(`
      SELECT p.sku, p.name, p.quantity, COALESCE(SUM(pl.quantity), 0) AS placed
      FROM products p LEFT JOIN placements pl ON pl.product_id = p.id
      GROUP BY p.id HAVING placed <> p.quantity ORDER BY p.name`).all();
  }

  res.render('reports', { report });
});

router.get('/export', (req, res) => {
  const rows = db.prepare(`
    SELECT p.sku, p.name, p.quantity, l.code, pl.quantity AS placed, pl.condition
    FROM products p
    LEFT JOIN placements pl ON pl.product_id = p.id
    LEFT JOIN locations l ON l.id = pl.location_id
    ORDER BY p.name, l.code`).all();

  const cell = (value) => {
    let text = String(value ?? '');
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };

  const lines = [['Artikuls', 'Prece', 'Atlikums', 'Vieta', 'Vietā', 'Stāvoklis']];
  for (const r of rows) lines.push([r.sku, r.name, r.quantity, r.code, r.placed, r.condition]);
  const csv = '\uFEFF' + lines.map((line) => line.map(cell).join(';')).join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="noliktava.csv"');
  res.send(csv);
});

export default router;
