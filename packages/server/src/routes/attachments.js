const Router = require('@koa/router');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { parseMultipart } = require('../utils/multipart');

const router = new Router({ prefix: '/api/notes/:noteId/attachments' });

const findById = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?');
const listStmt = db.prepare('SELECT * FROM attachments WHERE note_id = ? ORDER BY created_at DESC');
const insertStmt = db.prepare(
  'INSERT INTO attachments (note_id, original_name, stored_name, size, mime_type) VALUES (?, ?, ?, ?, ?)'
);
const findByIdStmt = db.prepare('SELECT * FROM attachments WHERE id = ? AND note_id = ?');
const deleteStmt = db.prepare('DELETE FROM attachments WHERE id = ? AND note_id = ?');

const UPLOAD_DIR = path.resolve(__dirname, '../../../data/attachments');

router.get('/', async (ctx) => {
  try {
    const note = findById.get(Number(ctx.params.noteId), ctx.state.userId);
    if (!note) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }
    const attachments = listStmt.all(note.id);
    ctx.body = { attachments };
  } catch (err) {
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

router.post('/', async (ctx) => {
  try {
    const note = findById.get(Number(ctx.params.noteId), ctx.state.userId);
    if (!note) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }

    const files = await parseMultipart(ctx);
    if (!files || files.length === 0) {
      ctx.status = 400;
      ctx.body = { error: 'no file provided' };
      return;
    }

    const uploaded = [];
    for (const file of files) {
      const ext = path.extname(file.originalName);
      const storedName = crypto.randomBytes(16).toString('hex') + ext;
      const filePath = path.join(UPLOAD_DIR, storedName);

      fs.writeFileSync(filePath, file.buffer);

      const result = insertStmt.run(note.id, file.originalName, storedName, file.buffer.length, file.mimeType);
      uploaded.push(findByIdStmt.get(result.lastInsertRowid, note.id));
    }

    ctx.status = 201;
    ctx.body = { attachments: uploaded };
  } catch (err) {
    console.error('Error uploading attachment:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

router.delete('/:attachmentId', async (ctx) => {
  try {
    const note = findById.get(Number(ctx.params.noteId), ctx.state.userId);
    if (!note) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }

    const attachment = findByIdStmt.get(Number(ctx.params.attachmentId), note.id);
    if (!attachment) {
      ctx.status = 404;
      ctx.body = { error: 'attachment not found' };
      return;
    }

    const filePath = path.join(UPLOAD_DIR, attachment.stored_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    deleteStmt.run(Number(ctx.params.attachmentId), note.id);
    ctx.status = 204;
  } catch (err) {
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// Download route — must be registered on the notes router prefix
const downloadRouter = new Router({ prefix: '/api/attachments' });

const findAttachment = db.prepare('SELECT * FROM attachments WHERE id = ?');
const findAttachmentNote = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?');

downloadRouter.get('/:id', async (ctx) => {
  try {
    const token = ctx.query.token || ctx.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      ctx.status = 401;
      ctx.body = { error: 'unauthorized' };
      return;
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    } catch {
      ctx.status = 401;
      ctx.body = { error: 'invalid token' };
      return;
    }

    const attachment = findAttachment.get(Number(ctx.params.id));
    if (!attachment) {
      ctx.status = 404;
      ctx.body = { error: 'attachment not found' };
      return;
    }

    const note = findAttachmentNote.get(attachment.note_id, payload.sub);
    if (!note) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }

    const filePath = path.join(UPLOAD_DIR, attachment.stored_name);
    if (!fs.existsSync(filePath)) {
      ctx.status = 404;
      ctx.body = { error: 'file not found' };
      return;
    }

    ctx.set('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.original_name)}"`);
    ctx.type = attachment.mime_type || 'application/octet-stream';
    ctx.body = fs.createReadStream(filePath);
  } catch (err) {
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// Preview endpoint — serves files inline for browser preview
const previewRouter = new Router({ prefix: '/api/attachments' });

previewRouter.get('/:id/preview', async (ctx) => {
  try {
    const token = ctx.query.token || ctx.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      ctx.status = 401;
      ctx.body = { error: 'unauthorized' };
      return;
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    } catch {
      ctx.status = 401;
      ctx.body = { error: 'invalid token' };
      return;
    }

    const attachment = findAttachment.get(Number(ctx.params.id));
    if (!attachment) {
      ctx.status = 404;
      ctx.body = { error: 'attachment not found' };
      return;
    }

    const note = findAttachmentNote.get(attachment.note_id, payload.sub);
    if (!note) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }

    const filePath = path.join(UPLOAD_DIR, attachment.stored_name);
    if (!fs.existsSync(filePath)) {
      ctx.status = 404;
      ctx.body = { error: 'file not found' };
      return;
    }

    ctx.set('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.original_name)}"`);
    ctx.type = attachment.mime_type || 'application/octet-stream';
    ctx.body = fs.createReadStream(filePath);
  } catch (err) {
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

module.exports = { routes: router, download: downloadRouter, preview: previewRouter };
