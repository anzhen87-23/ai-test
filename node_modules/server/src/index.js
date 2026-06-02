const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const Router = require('@koa/router');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const folderRoutes = require('./routes/folders');
const noteRoutes = require('./routes/notes');
const searchRoutes = require('./routes/search');
const { routes: attachmentRoutes, download: attachmentDownload, preview: attachmentPreview } = require('./routes/attachments');
const teamRoutes = require('./routes/teams');
const teamNotesRoutes = require('./routes/teamNotes');
const userRoutes = require('./routes/users');
const { routes: avatarRoutes, serve: avatarServe } = require('./routes/userAvatar');

// Initialize database (runs schema creation)
require('./db');

const app = new Koa();
const router = new Router();

// Static file middleware: serve built web app
const webDist = path.resolve(__dirname, '../../web/dist');
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

app.use(async (ctx, next) => {
  // Skip static serving for /api routes
  if (ctx.path.startsWith('/api')) {
    return next();
  }
  const filePath = path.join(webDist, ctx.path === '/' ? 'index.html' : ctx.path);
  const ext = path.extname(filePath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    ctx.type = mimeTypes[ext] || 'application/octet-stream';
    ctx.body = fs.createReadStream(filePath);
    return;
  }
  // Fallback: serve index.html for SPA client-side routing
  if (!ctx.path.startsWith('/api') && !ext) {
    const indexFile = path.join(webDist, 'index.html');
    if (fs.existsSync(indexFile)) {
      ctx.type = 'text/html';
      ctx.body = fs.createReadStream(indexFile);
      return;
    }
  }
  return next();
});

app.use(cors());
app.use(bodyParser());

// Debug middleware: log every request
app.use(async (ctx, next) => {
  console.log(`[REQ] ${ctx.method} ${ctx.path}`);
  console.log('  Headers:', JSON.stringify({
    contentType: ctx.headers['content-type'],
    auth: ctx.headers.authorization ? 'Bearer xxx' : 'none',
  }));
  await next();
  console.log(`[RES] ${ctx.status} ${ctx.method} ${ctx.path}`);
  if (ctx.status >= 400) {
    console.log('  Error:', JSON.stringify(ctx.body));
  }
});

// Public routes
router.use(authRoutes.routes());

// Attachment download & preview — self-authenticate via query token, must be before authMiddleware
router.use(attachmentDownload.routes());
router.use(attachmentPreview.routes());

// Avatar serve — public, must be before authMiddleware
router.use(avatarServe.routes());

// Protected routes
router.use(authMiddleware);
router.use(teamRoutes.routes());
router.use(teamNotesRoutes.routes());
router.use(folderRoutes.routes());
router.use(noteRoutes.routes());
router.use(searchRoutes.routes());
router.use(attachmentRoutes.routes());
router.use(userRoutes.routes());
router.use(avatarRoutes.routes());

app.use(router.routes());
app.use(router.allowedMethods());

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
