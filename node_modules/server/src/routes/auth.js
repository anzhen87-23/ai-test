const Router = require('@koa/router');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = new Router({ prefix: '/api/auth' });

const insertUser = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?');

router.post('/register', async (ctx) => {
  const { email, password } = ctx.request.body;
  if (!email || !password) {
    ctx.status = 400;
    ctx.body = { error: 'email and password are required' };
    return;
  }
  if (password.length < 8) {
    ctx.status = 400;
    ctx.body = { error: 'password must be at least 8 characters' };
    return;
  }

  const existing = findByEmail.get(email);
  if (existing) {
    ctx.status = 409;
    ctx.body = { error: 'email already registered' };
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const result = insertUser.run(email, hash);

  ctx.status = 201;
  ctx.body = { user: { id: result.lastInsertRowid, email } };
});

router.post('/login', async (ctx) => {
  const { email, password } = ctx.request.body;
  if (!email || !password) {
    ctx.status = 400;
    ctx.body = { error: 'email and password are required' };
    return;
  }

  const user = findByEmail.get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    ctx.status = 401;
    ctx.body = { error: 'invalid credentials' };
    return;
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  );

  ctx.body = { token, user: { id: user.id, email: user.email } };
});

module.exports = router;
