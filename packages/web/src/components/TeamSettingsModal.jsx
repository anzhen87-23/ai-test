import { useState } from 'react';

export default function TeamSettingsModal({ team, members, userRole, onClose, onUpdate, onDelete, onAddMember, onUpdateRole, onRemoveMember }) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(team.name);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [error, setError] = useState('');

  const isManager = userRole === 'admin';

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    try {
      await onUpdate(nameInput.trim());
      setEditingName(false);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddMember = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await onAddMember(inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const roleLabels = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };

  return (
    <div className="team-modal-overlay" onClick={onClose}>
      <div className="team-modal" onClick={(e) => e.stopPropagation()}>
        <div className="team-modal-header">
          <h2>{team.name} Settings</h2>
          <button className="team-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="team-modal-body">
          {/* Team name */}
          <div className="team-section">
            <label>Team Name</label>
            {editingName ? (
              <div className="team-name-edit">
                <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
                <button className="btn-sm btn-save" onClick={handleSaveName}>Save</button>
                <button className="btn-sm btn-cancel" onClick={() => { setEditingName(false); setNameInput(team.name); }}>Cancel</button>
              </div>
            ) : (
              <div className="team-name-display">
                <span>{team.name}</span>
                {isManager && (
                  <button className="btn-sm" onClick={() => setEditingName(true)}>Edit</button>
                )}
              </div>
            )}
          </div>

          {/* Members */}
          <div className="team-section">
            <label>Members ({members.length})</label>
            <div className="members-list">
              {members.map((m) => (
                <div key={m.id} className="member-item">
                  <span className="member-email">{m.email}</span>
                  {isManager ? (
                    <>
                      {m.id !== members.find(x => x.role === 'admin')?.id ? (
                        <div className="member-role-select">
                          <select value={m.role} onChange={(e) => onUpdateRole(m.id, e.target.value)}>
                            <option value="admin">Admin</option>
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button className="btn-remove" onClick={() => onRemoveMember(m.id)}>&times;</button>
                        </div>
                      ) : (
                        <span className="member-role-badge">{roleLabels[m.role]}</span>
                      )}
                    </>
                  ) : (
                    <span className="member-role-badge">{roleLabels[m.role]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Invite */}
          {isManager && (
            <div className="team-section">
              <label>Invite Member</label>
              <div className="invite-form">
                <input
                  type="email"
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="btn-sm btn-invite" onClick={handleAddMember}>Invite</button>
              </div>
            </div>
          )}

          {/* Delete team */}
          {isManager && (
            <div className="team-section team-danger">
              <button className="btn-danger" onClick={onDelete}>Delete Team</button>
            </div>
          )}

          {error && <div className="team-modal-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
