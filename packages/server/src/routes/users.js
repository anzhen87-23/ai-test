const Router = require('@koa/router');
const bcrypt = require('bcrypt');
const db = require('../db');
const auth = require('../middleware/auth');

const router = new Router({ prefix: '/api/users' });

const findByEmail = db.prepare('SELECT id, email, display_name, avatar, created_at FROM users WHERE id = ?');
const findWithPassword = db.prepare('SELECT * FROM users WHERE id = ?');
const updateProfile = db.prepare('UPDATE users SET display_name = COALESCE(?, display_name), avatar = COALESCE(?, avatar) WHERE id = ?');
const updateEmail = db.prepare('UPDATE users SET email = ? WHERE id = ?');
const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
const checkEmailExists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?');

// ── Get current user profile ──
router.get('/me', auth, async (ctx) => {
  try {
    const user = findByEmail.get(ctx.state.userId);
    if (!user) {
      ctx.status = 404;
      ctx.body = { error: 'user not found' };
      return;
    }
    ctx.body = { user };
  } catch (err) {
    console.error('Error getting user profile:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Update current user profile ──
router.put('/me', auth, async (ctx) => {
  try {
    const { displayName, avatar, email, currentPassword, newPassword } = ctx.request.body;
    const user = findWithPassword.get(ctx.state.userId);
    if (!user) {
      ctx.status = 404;
      ctx.body = { error: 'user not found' };
      return;
    }

    // Change email
    if (email && email !== user.email) {
      if (checkEmailExists.get(email, ctx.state.userId)) {
        ctx.status = 409;
        ctx.body = { error: 'email already in use' };
        return;
      }
      updateEmail.run(email, ctx.state.userId);
    }

    // Change password
    if (newPassword) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password_hash))) {
        ctx.status = 400;
        ctx.body = { error: 'current password is incorrect' };
        return;
      }
      if (newPassword.length < 8) {
        ctx.status = 400;
        ctx.body = { error: 'password must be at least 8 characters' };
        return;
      }
      const hash = await bcrypt.hash(newPassword, 12);
      updatePassword.run(hash, ctx.state.userId);
    }

    // Update profile fields
    const getProfileBefore = db.prepare('SELECT display_name, avatar FROM users WHERE id = ?');
    const before = getProfileBefore.get(ctx.state.userId);
    const finalDisplayName = displayName !== undefined ? displayName : before?.display_name;
    const finalAvatar = avatar !== undefined ? avatar : before?.avatar;
    updateProfile.run(finalDisplayName, finalAvatar, ctx.state.userId);

    const updated = findByEmail.get(ctx.state.userId);
    ctx.body = { user: updated };
  } catch (err) {
    console.error('Error updating user profile:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

module.exports = router;
