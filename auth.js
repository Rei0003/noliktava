import crypto from 'node:crypto';
import { db } from './db.js';

export function requireLogin(req, res, next) {
  const user = req.session.userId
    ? db.prepare('SELECT id, username, full_name, role FROM users WHERE id = ? AND is_active = 1').get(req.session.userId)
    : null;

  if (!user) return res.redirect('/login');

  req.user = user;
  res.locals.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) return next();
    res.status(403).render('error', { message: 'Tev nav tiesību atvērt šo lapu.' });
  };
}

export function csrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;

  if (req.method === 'POST' && req.body?._csrf !== req.session.csrf) {
    return res.status(403).render('error', { message: 'Forma ir novecojusi. Atjauno lapu un mēģini vēlreiz.' });
  }
  next();
}
