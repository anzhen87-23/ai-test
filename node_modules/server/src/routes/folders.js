const Router = require('@koa/router');
const db = require('../db');

const router = new Router({ prefix: '/api/folders' });

const listStmt = db.prepare('SELECT * FROM folders WHERE user_id = ? ORDER BY "order"');
const findById = db.prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?');
const insertStmt = db.prepare(
  'INSERT INTO folders (user_id, name, parent_id, "order") VALUES (?, ?, ?, COALESCE((SELECT MAX("order") + 1 FROM folders WHERE user_id = ? AND parent_id IS ?), 0))'
);
const updateStmt = db.prepare('UPDATE folders SET name = COALESCE(?, name), parent_id = COALESCE(?, parent_id), "order" = COALESCE(?, "order") WHERE id = ? AND user_id = ?');
const deleteStmt = db.prepare('DELETE FROM folders WHERE id = ? AND user_id = ?');

router.get('/', (ctx) => {
  const folders = listStmt.all(ctx.state.userId);
  ctx.body = { folders };
});

router.post('/', (ctx) => {
  const { name, parentId } = ctx.request.body;
  const result = insertStmt.run(ctx.state.userId, name || 'Untitled', parentId || null, ctx.state.userId, parentId || null);
  const folder = findById.get(result.lastInsertRowid, ctx.state.userId);
  ctx.status = 201;
  ctx.body = { folder };
});

router.put('/:id', (ctx) => {
  const { id } = ctx.params;
  const { name, parentId, order } = ctx.request.body;
  const existing = findById.get(id, ctx.state.userId);
  if (!existing) {
    ctx.status = 404;
    ctx.body = { error: 'folder not found' };
    return;
  }
  updateStmt.run(name, parentId, order, id, ctx.state.userId);
  const folder = findById.get(id, ctx.state.userId);
  ctx.body = { folder };
});

router.delete('/:id', (ctx) => {
  const { id } = ctx.params;
  const result = deleteStmt.run(id, ctx.state.userId);
  if (result.changes === 0) {
    ctx.status = 404;
    ctx.body = { error: 'folder not found' };
    return;
  }
  ctx.status = 204;
});

module.exports = router;
