import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../auth.js';
import { checkText, checkNumber, checkChoice } from '../validate.js';

const router = Router();
router.use(requireRole('admin', 'kartotajs'));

const CONDITIONS = ['Labs', 'Jāpārbauda', 'Bojāts'];

function showPage(req, res, form, errors = []) {
  const placements = db.prepare(`
    SELECT pl.*, p.sku, p.name AS product_name, l.code, l.zone FROM placements pl
    JOIN products p ON p.id = pl.product_id
    JOIN locations l ON l.id = pl.location_id
    ORDER BY l.code, p.name`).all();
  const products = db.prepare('SELECT id, sku, name FROM products ORDER BY name').all();
  const locations = db.prepare('SELECT id, code, zone FROM locations ORDER BY code').all();
  res.render('placements', { placements, products, locations, conditions: CONDITIONS, form, errors });
}

const emptyForm = () => ({ id: null, product_id: '', location_id: '', quantity: 0, condition: 'Labs', note: '' });

router.get('/', (req, res) => {
  const editing = req.query.edit ? db.prepare('SELECT * FROM placements WHERE id = ?').get(req.query.edit) : null;
  showPage(req, res, editing ? { ...editing, note: '' } : emptyForm());
});

function readForm(req) {
  const errors = [];
  const form = {
    id: req.params.id ? Number(req.params.id) : null,
    product_id: Number(req.body.product_id),
    location_id: Number(req.body.location_id),
    quantity: checkNumber(errors, req.body.quantity, 'Daudzums', 0, 1000000),
    condition: checkChoice(errors, req.body.condition, CONDITIONS, 'Stāvoklis'),
    note: checkText(errors, req.body.note, 'Piezīme', 0, 200),
  };
  if (!db.prepare('SELECT id FROM products WHERE id = ?').get(form.product_id)) errors.push('Izvēlies preci.');
  if (!db.prepare('SELECT id FROM locations WHERE id = ?').get(form.location_id)) errors.push('Izvēlies vietu.');

  const duplicate = db.prepare('SELECT id FROM placements WHERE product_id = ? AND location_id = ? AND id <> ?')
    .get(form.product_id, form.location_id, form.id ?? 0);
  if (duplicate) errors.push('Šī prece šajā vietā jau ir reģistrēta - atjauno esošo ierakstu.');
  return { form, errors };
}

router.post('/', (req, res) => {
  const { form, errors } = readForm(req);
  if (errors.length) return showPage(req, res, form, errors);

  db.prepare('INSERT INTO placements (product_id, location_id, quantity, condition, note, updated_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(form.product_id, form.location_id, form.quantity, form.condition, form.note, req.user.full_name);
  req.session.message = 'Izvietojums reģistrēts.';
  res.redirect('/placements');
});

router.post('/:id', (req, res) => {
  const { form, errors } = readForm(req);
  if (errors.length) return showPage(req, res, form, errors);

  db.prepare(`UPDATE placements SET product_id = ?, location_id = ?, quantity = ?, condition = ?, note = ?,
              updated_by = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`)
    .run(form.product_id, form.location_id, form.quantity, form.condition, form.note, req.user.full_name, form.id);
  req.session.message = 'Izvietojums atjaunināts.';
  res.redirect('/placements');
});

router.post('/:id/delete', (req, res) => {
  db.prepare('DELETE FROM placements WHERE id = ?').run(req.params.id);
  req.session.message = 'Prece izņemta no vietas.';
  res.redirect('/placements');
});

export default router;
