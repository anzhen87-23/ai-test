const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/dev.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Untitled',
    parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'Untitled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('text', 'heading', 'bullet_list', 'todo', 'divider', 'image')),
    content TEXT DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    parent_block_id INTEGER REFERENCES blocks(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
  CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
  CREATE INDEX IF NOT EXISTS idx_blocks_note ON blocks(note_id);
  CREATE INDEX IF NOT EXISTS idx_blocks_order ON blocks(note_id, "order");
  CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);

  -- Full-text search for notes (title + block content)
  CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title,
    content,
    content_rowid=id,
    tokenize='unicode61'
  );

  -- Populate FTS table from existing data
  INSERT OR IGNORE INTO notes_fts(rowid, title, content)
    SELECT n.id, n.title, GROUP_CONCAT(b.content, ' ')
    FROM notes n
    LEFT JOIN blocks b ON b.note_id = n.id
    GROUP BY n.id;

  -- Triggers to keep FTS table in sync
  CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, content)
      SELECT NEW.id, NEW.title, COALESCE(GROUP_CONCAT(b.content, ' '), '')
      FROM blocks b WHERE b.note_id = NEW.id;
  END;

  CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE ON notes BEGIN
    UPDATE notes_fts SET title = NEW.title WHERE rowid = NEW.id;
  END;

  CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
    DELETE FROM notes_fts WHERE rowid = OLD.id;
  END;

  CREATE TRIGGER IF NOT EXISTS blocks_fts_insert AFTER INSERT ON blocks BEGIN
    UPDATE notes_fts SET content = (
      SELECT COALESCE(GROUP_CONCAT(b2.content, ' '), '')
      FROM blocks b2 WHERE b2.note_id = NEW.note_id
    ) WHERE rowid = NEW.note_id;
  END;

  CREATE TRIGGER IF NOT EXISTS blocks_fts_update AFTER UPDATE ON blocks BEGIN
    UPDATE notes_fts SET content = (
      SELECT COALESCE(GROUP_CONCAT(b2.content, ' '), '')
      FROM blocks b2 WHERE b2.note_id = NEW.note_id
    ) WHERE rowid = NEW.note_id;
  END;

  CREATE TRIGGER IF NOT EXISTS blocks_fts_delete AFTER DELETE ON blocks BEGIN
    UPDATE notes_fts SET content = (
      SELECT COALESCE(GROUP_CONCAT(b2.content, ' '), '')
      FROM blocks b2 WHERE b2.note_id = OLD.note_id
    ) WHERE rowid = OLD.note_id;
  END;

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime_type TEXT DEFAULT 'application/octet-stream',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_attachments_note ON attachments(note_id);

  -- Teams
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    creator_user_id INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_teams_creator ON teams(creator_user_id);

  -- Team members
  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
  CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
`);

// Add profile columns to users if they don't exist
try {
  db.prepare('SELECT team_id FROM notes LIMIT 0').run();
} catch {
  db.exec('ALTER TABLE notes ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE');
}
try {
  db.prepare('SELECT display_name FROM users LIMIT 0').run();
} catch {
  db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
}
try {
  db.prepare('SELECT avatar FROM users LIMIT 0').run();
} catch {
  db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');
}

module.exports = db;
