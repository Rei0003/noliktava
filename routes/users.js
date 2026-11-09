import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireRole } from '../auth.js';
import { checkText, checkPattern, checkChoice } from '../validate.js';

const router = Router();
router.use(requireRole('admin'));

const ROLES = ['admin', 'darbinieks', 'kartotajs'];

function showPage(req, res, form, errors = []) {
  const users = db.prepare('SELECT id, username, full_name, role, is_active FROM users ORDER BY role, username').all();
  res.render('users', { users, form, errors, roles: ROLES });
}

function emptyForm() {
  return { id: null, username: '', full_name: '', role: 'darbinieks', is_active: 1 };
}

router.get('/', (req, res) => {
  const editing = req.query.edit ? db.prepare('SELECT * FROM users WHERE id = ?').get(req.query.edit) : null;
  showPage(req, res, editing ?? emptyForm());
});

function readForm(req, isNew) {
  const errors = [];
  const form = {
    id: req.params.id ? Number(req.params.id) : null,
    username: checkText(errors, req.body.username, 'Lietotājvārds', 3, 30),
    full_name: checkText(errors, req.body.full_name, 'Vārds, uzvārds', 2, 80),
    role: checkChoice(errors, req.body.role, ROLES, 'Loma'),
    is_active: req.body.is_active ? 1 : 0,
  };
  checkPattern(errors, form.username, /^[a-zA-Z0-9._-]+$/, 'Lietotājvārdā drīkst būt tikai latīņu burti, cipari, punkts, _ un -.');

  const password = String(req.body.password ?? '');
  if (isNew || password) {
    if (password.length < 8 || password.length > 72) errors.push('Parolei jābūt 8–72 simbolus garai.');
    else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) errors.push('Parolē jābūt vismaz vienam burtam un vienam ciparam.');
  }

  const taken = db.prepare('SELECT id FROM users WHERE username = ? AND id <> ?').get(form.username, form.id ?? 0);
  if (taken) errors.push('Šāds lietotājvārds jau eksistē.');

  return { form, password, errors };
}

const activeAdmins = () => db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1").get().n;

router.post('/', (req, res) => {
  const { form, password, errors } = readForm(req, true);
  if (errors.length) return showPage(req, res, form, errors);

  db.prepare('INSERT INTO users (username, full_name, password, role, is_active) VALUES (?, ?, ?, ?, ?)')
    .run(form.username, form.full_name, bcrypt.hashSync(password, 12), form.role, form.is_active);
  req.session.message = 'Lietotājs izveidots.';
  res.redirect('/users');
});

router.post('/:id', (req, res) => {
  const { form, password, errors } = readForm(req, false);
  const old = db.prepare('SELECT * FROM users WHERE id = ?').get(form.id);
  if (!old) return res.redirect('/users');

  if (old.id === req.user.id && (form.role !== 'admin' || !form.is_active)) {
    errors.push('Tu nevari mainīt savu lomu vai bloķēt pats sevi.');
  } else if (old.role === 'admin' && old.is_active && (form.role !== 'admin' || !form.is_active) && activeAdmins() <= 1) {
    errors.push('Sistēmā jāpaliek vismaz vienam aktīvam administratoram.');
  }
  if (errors.length) return showPage(req, res, form, errors);

  const hash = password ? bcrypt.hashSync(password, 12) : old.password;
  db.prepare('UPDATE users SET username = ?, full_name = ?, role = ?, is_active = ?, password = ? WHERE id = ?')
    .run(form.username, form.full_name, form.role, form.is_active, hash, form.id);
  req.session.message = 'Lietotājs saglabāts.';
  res.redirect('/users');
});

router.post('/:id/delete', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.redirect('/users');

  if (user.id === req.user.id) {
    req.session.message = 'Tu nevari dzēst savu kontu.';
  } else if (user.role === 'admin' && user.is_active && activeAdmins() <= 1) {
    req.session.message = 'Nevar dzēst pēdējo administratoru.';
  } else {
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    req.session.message = 'Lietotājs dzēsts.';
  }
  res.redirect('/users');
});

export default router;
