function getWordCount(note) {
  if (note.word_count !== undefined) return note.word_count;
  if (!note.blocks || note.blocks.length === 0) return 0;
  return note.blocks.reduce((sum, b) => sum + (b.content || '').length, 0);
}

function SearchResults({ results, selectedNoteId, onSelectNote }) {
  if (results.length === 0) return null;
  const colors = ['var(--blue)', 'var(--red)', 'var(--yellow)'];
  return results.map((note, idx) => (
    <div
      key={note.id}
      className={`notes-list-item ${selectedNoteId === note.id ? 'active' : ''}`}
      onClick={() => onSelectNote(note.id)}
    >
      <div className="notes-list-item-content">
        <div className="notes-list-item-top">
          <span className="notes-list-item-title" dangerouslySetInnerHTML={{ __html: note.title || 'Untitled' }} />
          <button
            className="notes-list-delete-btn"
            title="Delete"
            onClick={(e) => { e.stopPropagation(); }}
          >
            &times;
          </button>
        </div>
        {note.snippet && (
          <span className="notes-list-item-snippet" dangerouslySetInnerHTML={{ __html: note.snippet }} />
        )}
        <span className="notes-list-item-date">
          {getWordCount(note)} 字 · {new Date(note.updated_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  ));
}

function getFolderName(folders, id) {
  return folders.find((f) => f.id === id)?.name || 'Folder';
}

function getTeamName(teams, id) {
  return teams.find((t) => t.id === id)?.name || 'Team';
}

export default function NotesListPanel({
  folders, teams, notes, selectedFolderId, selectedTeamId, selectedNoteId,
  searchQuery, searchResults,
  onSelectNote, onCreateNote, onDeleteNote,
}) {
  const isSearching = searchQuery.length > 0;
  const displayedNotes = isSearching
    ? searchResults
    : selectedTeamId
      ? notes
      : selectedFolderId
        ? notes.filter((n) => n.folder_id === selectedFolderId)
        : notes;

  return (
    <div className="notes-list-panel">
      {/* Header */}
      <div className="notes-list-header">
        <h3 className="notes-list-title">
          {isSearching ? '搜索结果' : selectedTeamId ? getTeamName(teams, selectedTeamId) : selectedFolderId ? getFolderName(folders, selectedFolderId) : '全部笔记'}
        </h3>
        <button className="notes-list-create-btn" onClick={onCreateNote}>+ 新建</button>
      </div>

      {/* Notes */}
      <div className="notes-list-scroll">
        {isSearching ? (
          <SearchResults results={displayedNotes} selectedNoteId={selectedNoteId} onSelectNote={onSelectNote} />
        ) : (
          displayedNotes.map((note, idx) => {
            const colors = ['var(--blue)', 'var(--red)', 'var(--yellow)'];
            return (
              <div
                key={note.id}
                className={`notes-list-item ${selectedNoteId === note.id ? 'active' : ''}`}
                onClick={() => onSelectNote(note.id)}
              >
                <div className="notes-list-item-content">
                  <div className="notes-list-item-top">
                    <span className="notes-list-item-title">{note.title || 'Untitled'}</span>
                    <button
                      className="notes-list-delete-btn"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
                    >
                      &times;
                    </button>
                  </div>
                  <span className="notes-list-item-date">
                    {getWordCount(note)} 字 · {new Date(note.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })
        )}
        {displayedNotes.length === 0 && (
          <p className="notes-list-empty">
            {isSearching ? '没有找到匹配的笔记' : selectedTeamId ? '该团队没有笔记' : selectedFolderId ? '该文件夹没有笔记' : '还没有笔记'}
          </p>
        )}
      </div>
    </div>
  );
}
