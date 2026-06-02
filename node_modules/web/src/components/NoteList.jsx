export default function NoteList({ notes, selectedNoteId, onSelectNote }) {
  return (
    <div className="notes-list">
      {notes.map((note) => (
        <div
          key={note.id}
          className={`note-item ${selectedNoteId === note.id ? 'active' : ''}`}
          onClick={() => onSelectNote(note.id)}
        >
          <span className="note-item-title">{note.title || 'Untitled'}</span>
          <span className="note-item-date">
            {new Date(note.updated_at).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}
