import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';

const router = Router();

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  handler: (req, res) => res.status(429).render('login', { error: 'Pārāk daudz mēģinājumu. Pamēģini pēc 15 minūtēm.', username: '' }),
});

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('login', { error: null, username: '' });
});

router.post('/login', loginLimit, (req, res) => {
  const username = String(req.body.username ?? '').trim();
  const password = String(req.body.password ?? '');

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).render('login', { error: 'Nepareizs lietotājvārds vai parole.', username });
  }

  req.session.regenerate(() => {
    req.session.userId = user.id;
    res.redirect('/');
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

export default router;
