const Router = require('@koa/router');
const db = require('../db');

const router = new Router({ prefix: '/api/search' });

const searchStmt = db.prepare(`
  SELECT DISTINCT n.id, n.title, n.folder_id, n.team_id, n.updated_at,
    snippet(notes_fts, 1, '<mark>', '</mark>', '...', 20) as snippet,
    COALESCE((SELECT SUM(LENGTH(COALESCE(b.content, ''))) FROM blocks b WHERE b.note_id = n.id), 0) as word_count
  FROM notes n
  JOIN notes_fts ON notes_fts.rowid = n.id
  WHERE n.user_id = ? AND notes_fts MATCH ?
  ORDER BY n.updated_at DESC
  LIMIT 50
`);

const teamSearchStmt = db.prepare(`
  SELECT DISTINCT n.id, n.title, n.team_id, n.updated_at,
    snippet(notes_fts, 1, '<mark>', '</mark>', '...', 20) as snippet,
    COALESCE((SELECT SUM(LENGTH(COALESCE(b.content, ''))) FROM blocks b WHERE b.note_id = n.id), 0) as word_count
  FROM notes n
  JOIN notes_fts ON notes_fts.rowid = n.id
  JOIN team_members tm ON tm.team_id = n.team_id
  WHERE tm.user_id = ? AND notes_fts MATCH ?
  ORDER BY n.updated_at DESC
  LIMIT 50
`);

router.get('/', async (ctx) => {
  const { q } = ctx.query;
  if (!q || !q.trim()) {
    ctx.body = { notes: [] };
    return;
  }
  // Escape FTS5 special characters and build query
  const escaped = q.trim().replace(/([":*])/g, '');
  const ftsQuery = `"${escaped}"*`;

  let personalNotes = [];
  try {
    personalNotes = searchStmt.all(ctx.state.userId, ftsQuery);
  } catch {
    // Fallback: simple LIKE search if FTS5 query is malformed
    personalNotes = db.prepare(`
      SELECT DISTINCT n.id, n.title, n.folder_id, n.team_id, n.updated_at, '' as snippet
      FROM notes n
      LEFT JOIN blocks b ON b.note_id = n.id
      WHERE n.user_id = ? AND (n.title LIKE ? OR b.content LIKE ?)
      ORDER BY n.updated_at DESC
      LIMIT 50
    `).all(ctx.state.userId, `%${escaped}%`, `%${escaped}%`);
  }

  let teamNotes = [];
  try {
    teamNotes = teamSearchStmt.all(ctx.state.userId, ftsQuery);
  } catch {
    teamNotes = db.prepare(`
      SELECT DISTINCT n.id, n.title, n.team_id, n.updated_at, '' as snippet
      FROM notes n
      LEFT JOIN blocks b ON b.note_id = n.id
      JOIN team_members tm ON tm.team_id = n.team_id
      WHERE tm.user_id = ? AND (n.title LIKE ? OR b.content LIKE ?)
      ORDER BY n.updated_at DESC
      LIMIT 50
    `).all(ctx.state.userId, `%${escaped}%`, `%${escaped}%`);
  }

  const allNotes = [...personalNotes, ...teamNotes]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 50);

  ctx.body = { notes: allNotes };
});

module.exports = router;
