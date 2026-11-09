import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../auth.js';
import { checkText, checkPattern } from '../validate.js';

const router = Router();
router.use(requireRole('admin'));

function showPage(req, res, form, errors = []) {
  const locations = db.prepare(`
    SELECT l.*, COUNT(p.id) AS items FROM locations l
    LEFT JOIN placements p ON p.location_id = l.id
    GROUP BY l.id ORDER BY l.code`).all();
  res.render('locations', { locations, form, errors });
}

router.get('/', (req, res) => {
  const editing = req.query.edit ? db.prepare('SELECT * FROM locations WHERE id = ?').get(req.query.edit) : null;
  showPage(req, res, editing ?? { id: null, code: '', zone: '' });
});

function readForm(req) {
  const errors = [];
  const form = {
    id: req.params.id ? Number(req.params.id) : null,
    code: checkText(errors, req.body.code, 'Kods', 2, 20).toUpperCase(),
    zone: checkText(errors, req.body.zone, 'Zona', 1, 40),
  };
  checkPattern(errors, form.code, /^[A-Z0-9-]+$/, 'Kodā drīkst būt tikai latīņu burti, cipari un - (piem., A-01-03).');
  if (db.prepare('SELECT id FROM locations WHERE code = ? AND id <> ?').get(form.code, form.id ?? 0)) {
    errors.push('Šāds vietas kods jau eksistē.');
  }
  return { form, errors };
}

router.post('/', (req, res) => {
  const { form, errors } = readForm(req);
  if (errors.length) return showPage(req, res, form, errors);
  db.prepare('INSERT INTO locations (code, zone) VALUES (?, ?)').run(form.code, form.zone);
  req.session.message = 'Vieta pievienota.';
  res.redirect('/locations');
});

router.post('/:id', (req, res) => {
  const { form, errors } = readForm(req);
  if (errors.length) return showPage(req, res, form, errors);
  db.prepare('UPDATE locations SET code = ?, zone = ? WHERE id = ?').run(form.code, form.zone, form.id);
  req.session.message = 'Vieta saglabāta.';
  res.redirect('/locations');
});

router.post('/:id/delete', (req, res) => {
  if (db.prepare('SELECT id FROM placements WHERE location_id = ?').get(req.params.id)) {
    req.session.message = 'Vietu nevar dzēst, jo tajā ir preces.';
  } else {
    db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.id);
    req.session.message = 'Vieta dzēsta.';
  }
  res.redirect('/locations');
});

export default router;
