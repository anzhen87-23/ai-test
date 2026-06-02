const Router = require('@koa/router');
const db = require('../db');
const { getNoteTeamId, checkTeamNoteAccess, ROLES } = require('../middleware/teamAuth');

const router = new Router({ prefix: '/api/notes' });

// ── Prepared Statements ──
const listStmt = db.prepare(`
  SELECT n.id, n.title, n.folder_id, n.team_id, n.created_at, n.updated_at,
         COUNT(b.id) as block_count, COALESCE(SUM(LENGTH(COALESCE(b.content, ''))), 0) as word_count
  FROM notes n LEFT JOIN blocks b ON n.id = b.note_id
  WHERE n.user_id = :user_id AND n.team_id IS NULL
  GROUP BY n.id
  ORDER BY n.updated_at DESC
`);
const findById = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ? AND team_id IS NULL');
const findByIdAny = db.prepare('SELECT * FROM notes WHERE id = ?');
const insertStmt = db.prepare('INSERT INTO notes (user_id, title, folder_id) VALUES (?, ?, ?)');
const updateTitleStmt = db.prepare('UPDATE notes SET title = COALESCE(?, title), folder_id = COALESCE(?, folder_id), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND team_id IS NULL');
const deleteStmt = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ? AND team_id IS NULL');

const getBlocksStmt = db.prepare('SELECT * FROM blocks WHERE note_id = ? ORDER BY "order"');
const deleteBlocksStmt = db.prepare('DELETE FROM blocks WHERE note_id = ?');
const insertBlockStmt = db.prepare('INSERT INTO blocks (note_id, type, content, "order", parent_block_id) VALUES (?, ?, ?, ?, ?)');
const updateBlockStmt = db.prepare('UPDATE blocks SET type = COALESCE(?, type), content = COALESCE(?, content), "order" = COALESCE(?, "order"), parent_block_id = COALESCE(?, parent_block_id) WHERE id = ? AND note_id = ?');
const deleteBlockStmt = db.prepare('DELETE FROM blocks WHERE id = ? AND note_id = ?');
const findBlockById = db.prepare('SELECT * FROM blocks WHERE id = ?');

/**
 * Find a note by ID. Checks personal notes first, then team notes.
 * Returns { note, isTeam, role } or null.
 */
function findNoteWithTeamAccess(noteId, userId) {
  // Check personal note first
  const personalNote = findById.get(noteId, userId);
  if (personalNote) return { note: personalNote, isTeam: false, role: null };

  // Check if it's a team note and user has access
  const note = findByIdAny.get(noteId);
  if (!note || !note.team_id) return null;

  const role = checkTeamNoteAccess(noteId, userId);
  if (!role) return null;

  return { note, isTeam: true, role };
}

// ── Block routes (MUST be registered before /:id routes to avoid routing conflicts) ──

router.put('/:id/blocks', async (ctx) => {
  try {
    const access = findNoteWithTeamAccess(Number(ctx.params.id), ctx.state.userId);
    if (!access) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }
    if (access.isTeam && ROLES[access.role] < ROLES.editor) {
      ctx.status = 403;
      ctx.body = { error: 'insufficient permissions' };
      return;
    }
    const note = access.note;

    const { blocks } = ctx.request.body;
    if (!Array.isArray(blocks)) {
      ctx.status = 400;
      ctx.body = { error: 'blocks array required' };
      return;
    }

    const saveBlocks = db.transaction(() => {
      deleteBlocksStmt.run(note.id);
      for (const b of blocks) {
        insertBlockStmt.run(note.id, b.type || 'text', b.content || '', b.order || 0, b.parentBlockId || null);
      }
    });
    saveBlocks();

    const savedBlocks = getBlocksStmt.all(note.id);
    ctx.body = { blocks: savedBlocks };
  } catch (err) {
    console.error('Error saving blocks:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

router.post('/:id/blocks', async (ctx) => {
  try {
    const access = findNoteWithTeamAccess(Number(ctx.params.id), ctx.state.userId);
    if (!access) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }
    if (access.isTeam && ROLES[access.role] < ROLES.editor) {
      ctx.status = 403;
      ctx.body = { error: 'insufficient permissions' };
      return;
    }
    const note = access.note;

    const { type, content, order, parentBlockId } = ctx.request.body;
    const result = insertBlockStmt.run(note.id, type || 'text', content || '', order || 0, parentBlockId || null);
    const block = findBlockById.get(result.lastInsertRowid);
    ctx.status = 201;
    ctx.body = { block };
  } catch (err) {
    console.error('Error inserting block:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

router.patch('/:noteId/blocks/:blockId', async (ctx) => {
  try {
    const access = findNoteWithTeamAccess(Number(ctx.params.noteId), ctx.state.userId);
    if (!access) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }
    if (access.isTeam && ROLES[access.role] < ROLES.editor) {
      ctx.status = 403;
      ctx.body = { error: 'insufficient permissions' };
      return;
    }
    const note = access.note;

    const { type, content, order, parentBlockId } = ctx.request.body;
    updateBlockStmt.run(type, content, order, parentBlockId, Number(ctx.params.blockId), note.id);
    const block = findBlockById.get(ctx.params.blockId);
    ctx.body = { block };
  } catch (err) {
    console.error('Error updating block:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

router.delete('/:noteId/blocks/:blockId', async (ctx) => {
  try {
    const access = findNoteWithTeamAccess(Number(ctx.params.noteId), ctx.state.userId);
    if (!access) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }
    if (access.isTeam && ROLES[access.role] < ROLES.editor) {
      ctx.status = 403;
      ctx.body = { error: 'insufficient permissions' };
      return;
    }
    const note = access.note;

    const result = deleteBlockStmt.run(Number(ctx.params.blockId), note.id);
    if (result.changes === 0) {
      ctx.status = 404;
      ctx.body = { error: 'block not found' };
      return;
    }
    ctx.status = 204;
  } catch (err) {
    console.error('Error deleting block:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Note CRUD routes ──

router.get('/', async (ctx) => {
  try {
    const folderId = ctx.query.folderId || null;
    const notes = listStmt.all({ user_id: ctx.state.userId, folder_id: folderId });
    ctx.body = { notes };
  } catch (err) {
    console.error('Error listing notes:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

router.get('/:id', async (ctx) => {
  try {
    const access = findNoteWithTeamAccess(Number(ctx.params.id), ctx.state.userId);
    if (!access) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }
    const note = access.note;
    const blocks = getBlocksStmt.all(note.id);
    ctx.body = { note: { ...note, blocks } };
  } catch (err) {
    console.error('Error getting note:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

router.post('/', async (ctx) => {
  try {
    const { title, folderId, blocks } = ctx.request.body;
    const result = insertStmt.run(ctx.state.userId, title || 'Untitled', folderId || null);
    const noteId = Number(result.lastInsertRowid);

    if (blocks && blocks.length > 0) {
      const insertMany = db.transaction((blks) => {
        for (const b of blks) {
          insertBlockStmt.run(noteId, b.type || 'text', b.content || '', b.order || 0, b.parentBlockId || null);
        }
      });
      insertMany(blocks);
    }

    const note = findById.get(noteId, ctx.state.userId);
    const noteBlocks = getBlocksStmt.all(noteId);
    ctx.status = 201;
    ctx.body = { note: { ...note, blocks: noteBlocks } };
  } catch (err) {
    console.error('Error creating note:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

router.put('/:id', async (ctx) => {
  try {
    const access = findNoteWithTeamAccess(Number(ctx.params.id), ctx.state.userId);
    if (!access) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }
    if (access.isTeam && ROLES[access.role] < ROLES.editor) {
      ctx.status = 403;
      ctx.body = { error: 'insufficient permissions' };
      return;
    }
    const note = access.note;
    const { title, folderId } = ctx.request.body;
    if (access.isTeam) {
      // For team notes, only title can be updated (folder_id doesn't apply)
      db.prepare('UPDATE notes SET title = COALESCE(?, title), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(title, note.id);
    } else {
      updateTitleStmt.run(title, folderId, note.id, ctx.state.userId);
    }
    const updated = findByIdAny.get(note.id);
    ctx.body = { note: updated };
  } catch (err) {
    console.error('Error updating note:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

router.delete('/:id', async (ctx) => {
  try {
    const access = findNoteWithTeamAccess(Number(ctx.params.id), ctx.state.userId);
    if (!access) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }
    if (access.isTeam && ROLES[access.role] < ROLES.editor) {
      ctx.status = 403;
      ctx.body = { error: 'insufficient permissions' };
      return;
    }
    const note = access.note;
    const result = access.isTeam
      ? db.prepare('DELETE FROM notes WHERE id = ? AND team_id = ?').run(note.id, note.team_id)
      : deleteStmt.run(note.id, ctx.state.userId);
    if (result.changes === 0) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }
    ctx.status = 204;
  } catch (err) {
    console.error('Error deleting note:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

module.exports = router;
