const Router = require('@koa/router');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const auth = require('../middleware/auth');
const { parseMultipart } = require('../utils/multipart');

const router = new Router({ prefix: '/api/users' });

const AVATAR_DIR = path.resolve(__dirname, '../../../data/avatars');
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const findUser = db.prepare('SELECT avatar FROM users WHERE id = ?');
const updateAvatar = db.prepare('UPDATE users SET avatar = ? WHERE id = ?');

// ── Upload avatar ──
router.post('/me/avatar', auth, async (ctx) => {
  try {
    const files = await parseMultipart(ctx);
    if (!files || files.length === 0) {
      ctx.status = 400;
      ctx.body = { error: 'no file provided' };
      return;
    }

    const file = files[0];
    if (!ALLOWED.includes(file.mimeType)) {
      ctx.status = 400;
      ctx.body = { error: 'only png, jpg, gif, webp images allowed' };
      return;
    }

    const ext = path.extname(file.originalName) || '.png';
    const storedName = crypto.randomBytes(16).toString('hex') + ext;
    const filePath = path.join(AVATAR_DIR, storedName);

    // Delete old avatar file
    const old = findUser.get(ctx.state.userId);
    if (old?.avatar) {
      const oldFile = path.resolve(__dirname, '../../../data', old.avatar.replace('/api/avatars/', ''));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    fs.writeFileSync(filePath, file.buffer);
    updateAvatar.run(`/api/avatars/${storedName}`, ctx.state.userId);

    ctx.body = { avatar: `/api/avatars/${storedName}` };
  } catch (err) {
    console.error('Error uploading avatar:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Serve avatar files ──
const avatarServeRouter = new Router({ prefix: '/api/avatars' });

avatarServeRouter.get('/:filename', async (ctx) => {
  const filePath = path.join(AVATAR_DIR, ctx.params.filename);
  if (!fs.existsSync(filePath)) {
    ctx.status = 404;
    ctx.body = { error: 'not found' };
    return;
  }
  const ext = path.extname(filePath);
  const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
  ctx.type = mimeMap[ext] || 'application/octet-stream';
  ctx.body = fs.createReadStream(filePath);
});

module.exports = { routes: router, serve: avatarServeRouter };
