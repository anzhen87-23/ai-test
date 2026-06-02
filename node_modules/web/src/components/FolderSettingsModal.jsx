import { useState } from 'react';

export default function FolderSettingsModal({ folder, onClose, onRename, onDelete }) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(folder.name);
  const [error, setError] = useState('');

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    try {
      await onRename(nameInput.trim());
      setEditingName(false);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete folder "${folder.name}"? Notes in this folder will become uncategorized.`)) return;
    try {
      await onDelete();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="team-modal-overlay" onClick={onClose}>
      <div className="team-modal" onClick={(e) => e.stopPropagation()}>
        <div className="team-modal-header">
          <h2>{folder.name} Settings</h2>
          <button className="team-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="team-modal-body">
          <div className="team-section">
            <label>Folder Name</label>
            {editingName ? (
              <div className="team-name-edit">
                <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
                <button className="btn-sm btn-save" onClick={handleSaveName}>Save</button>
                <button className="btn-sm btn-cancel" onClick={() => { setEditingName(false); setNameInput(folder.name); }}>Cancel</button>
              </div>
            ) : (
              <div className="team-name-display">
                <span>{folder.name}</span>
                <button className="btn-sm" onClick={() => setEditingName(true)}>Edit</button>
              </div>
            )}
          </div>

          <div className="team-section team-danger">
            <button className="btn-danger" onClick={handleDelete}>Delete Folder</button>
          </div>

          {error && <div className="team-modal-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
