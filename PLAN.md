# 安振-AI-笔记

## Context

安振-AI-笔记：基于 Koa (SQLite) 后端、React Web 前端和 React Native 移动应用的笔记应用。核心功能：认证、文件夹、块编辑器、全文搜索、附件管理。

## Architecture

Monorepo with npm workspaces. Three packages: `server`, `web`, `mobile`.

## Project Structure

```text
packages/
├── server/src/
│   ├── index.js          # Koa app, routes, middleware, static file serving
│   ├── db.js             # SQLite schema (users, folders, notes, blocks, attachments, FTS5)
│   ├── middleware/auth.js # JWT verification
│   └── routes/
│       ├── auth.js       # POST /register, /login
│       ├── folders.js    # CRUD /api/folders
│       ├── notes.js      # CRUD /api/notes + /api/notes/:id/blocks
│       ├── search.js     # GET /api/search?q=
│       └── attachments.js # upload/download/preview
├── web/src/
│   ├── main.jsx          # React entry
│   ├── App.jsx           # Auth flow + layout
│   ├── api.js            # API client (fetch + JWT)
│   └── components/
│       ├── Sidebar.jsx       # Folder tree + note list + search
│       ├── NoteEditor.jsx    # Title + BlockEditor + AttachmentSection
│       ├── BlockEditor.jsx   # Block list state, auto-save, slash menu
│       └── BlockTypes.jsx    # text, heading, bullet, todo, divider, image
└── mobile/
    ├── App.tsx             # Navigation + token management
    ├── src/api.ts          # API client
    └── src/screens/
        ├── LoginScreen.tsx     # Auth screen
        ├── NoteListScreen.tsx  # Folder + search + note list
        └── NoteEditorScreen.tsx # Block editor + attachments
```

## Database Schema

- **users**: id, email, password_hash
- **folders**: id, user_id, name, parent_id, order
- **notes**: id, user_id, folder_id, title, created_at, updated_at
- **blocks**: id, note_id, type(text|heading|bullet_list|todo|divider|image), content, order, parent_block_id
- **attachments**: id, note_id, original_name, stored_name, size, mime_type, created_at
- **notes_fts**: FTS5 virtual table for full-text search on title + content

## API Endpoints

| Method | Path | Auth | Body |
| :--- | :--- | :--- | :--- |
| POST | /api/auth/register | No | email, password |
| POST | /api/auth/login | No | email, password |
| GET/POST | /api/folders[/:id] | Yes | name |
| GET/POST/PUT/DELETE | /api/notes[/:id] | Yes | title, folderId |
| PUT | /api/notes/:id/blocks | Yes | blocks[] (bulk save) |
| GET | /api/search | Yes | q= (FTS5) |
| GET/POST/DELETE | /api/notes/:noteId/attachments[/:id] | Yes | multipart/form-data |
| GET | /api/attachments/:id | — | download (query token) |
| GET | /api/attachments/:id/preview | — | preview (query token) |

## Block Editor Design

- Each block renders as contentEditable div (web) or TextInput (mobile)
- Enter creates new block, Backspace on empty deletes block
- "/" at start opens slash command palette for block type selection
- Auto-save: debounce 500ms, PUT all blocks to server
- Keyboard navigation between blocks with arrow keys (web)
- IME composition tracking to handle Chinese input correctly (web)

## Implementation Order

### Phase 1: Server foundation

1. Root package.json + workspace setup
2. Server package.json, db.js with schema
3. Auth middleware (JWT)
4. Auth routes (register/login)
5. Folder routes
6. Note routes + block routes
7. Search route (FTS5)
8. Attachment routes (upload/download/preview)

### Phase 2: Web frontend

9. Vite + React setup, API client
10. App.jsx with auth flow
11. Sidebar + NoteList components
12. BlockTypes (individual block renderers)
13. BlockEditor (state, keyboard nav, auto-save)
14. NoteEditor + integration
15. CSS styling (red/yellow/blue theme)
16. Attachment section with preview modal

### Phase 3: Mobile

17. Expo setup, API client
18. Auth screens
19. Note list / editor screens
20. Sync features with web (title edit, upload, preview, download)

## Verification

- `npm run dev:server` → server starts on :3001, curl auth endpoints
- `npm run dev:web` → Vite on :5173, login → create note → edit blocks → auto-saves
- `npm start` (mobile) → Expo Dev Tools → login → create note → edit blocks
- End-to-end: register → login → create folder → create note → add blocks → search → upload attachment → preview
