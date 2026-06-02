const Router = require('@koa/router');
const db = require('../db');
const { getTeamRole, requireTeamRole } = require('../middleware/teamAuth');

const router = new Router({ prefix: '/api/teams' });

// ── Prepared Statements ──
const findTeam = db.prepare('SELECT * FROM teams WHERE id = ?');
const listTeamNotes = db.prepare(`
  SELECT n.id, n.title, n.folder_id, n.team_id, n.created_at, n.updated_at,
         COUNT(b.id) as block_count, COALESCE(SUM(LENGTH(COALESCE(b.content, ''))), 0) as word_count
  FROM notes n LEFT JOIN blocks b ON n.id = b.note_id
  WHERE n.team_id = ?
  GROUP BY n.id
  ORDER BY n.updated_at DESC
`);
const findById = db.prepare('SELECT * FROM notes WHERE id = ? AND team_id = ?');
const insertNote = db.prepare('INSERT INTO notes (user_id, team_id, title) VALUES (?, ?, ?)');
const updateNote = db.prepare(
  'UPDATE notes SET title = COALESCE(?, title), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND team_id = ?'
);
const deleteNote = db.prepare('DELETE FROM notes WHERE id = ? AND team_id = ?');

const getBlocksStmt = db.prepare('SELECT * FROM blocks WHERE note_id = ? ORDER BY "order"');
const deleteBlocksStmt = db.prepare('DELETE FROM blocks WHERE note_id = ?');
const insertBlockStmt = db.prepare('INSERT INTO blocks (note_id, type, content, "order", parent_block_id) VALUES (?, ?, ?, ?, ?)');
const findBlockById = db.prepare('SELECT * FROM blocks WHERE id = ?');

// ── List team notes (all members) ──
router.get('/:id/notes', requireTeamRole('viewer'), async (ctx) => {
  try {
    const teamId = Number(ctx.params.id);
    const notes = listTeamNotes.all(teamId);
    ctx.body = { notes };
  } catch (err) {
    console.error('Error listing team notes:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Get team note detail ──
router.get('/:teamId/notes/:noteId', requireTeamRole('viewer'), async (ctx) => {
  try {
    const teamId = Number(ctx.params.teamId);
    const noteId = Number(ctx.params.noteId);
    const note = findById.get(noteId, teamId);
    if (!note) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }
    const blocks = getBlocksStmt.all(note.id);
    ctx.body = { note: { ...note, blocks } };
  } catch (err) {
    console.error('Error getting team note:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Create team note (admin/editor) ──
router.post('/:id/notes', requireTeamRole('editor'), async (ctx) => {
  try {
    const teamId = Number(ctx.params.id);
    const { title } = ctx.request.body;
    const result = insertNote.run(ctx.state.userId, teamId, title || 'Untitled');
    const noteId = Number(result.lastInsertRowid);
    const note = findById.get(noteId, teamId);
    ctx.status = 201;
    ctx.body = { note: { ...note, blocks: [] } };
  } catch (err) {
    console.error('Error creating team note:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Update team note (admin/editor) ──
router.put('/:teamId/notes/:noteId', requireTeamRole('editor'), async (ctx) => {
  try {
    const teamId = Number(ctx.params.teamId);
    const noteId = Number(ctx.params.noteId);
    const { title } = ctx.request.body;
    const existing = findById.get(noteId, teamId);
    if (!existing) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }
    updateNote.run(title || null, noteId, teamId);
    const note = findById.get(noteId, teamId);
    ctx.body = { note };
  } catch (err) {
    console.error('Error updating team note:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Delete team note (admin/editor) ──
router.delete('/:teamId/notes/:noteId', requireTeamRole('editor'), async (ctx) => {
  try {
    const teamId = Number(ctx.params.teamId);
    const noteId = Number(ctx.params.noteId);
    const result = deleteNote.run(noteId, teamId);
    if (result.changes === 0) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }
    ctx.status = 204;
  } catch (err) {
    console.error('Error deleting team note:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ── Save team note blocks (admin/editor) ──
router.put('/:teamId/notes/:noteId/blocks', requireTeamRole('editor'), async (ctx) => {
  try {
    const teamId = Number(ctx.params.teamId);
    const noteId = Number(ctx.params.noteId);
    const note = findById.get(noteId, teamId);
    if (!note) {
      ctx.status = 404;
      ctx.body = { error: 'note not found' };
      return;
    }

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
    console.error('Error saving team note blocks:', err);
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

module.exports = router;
