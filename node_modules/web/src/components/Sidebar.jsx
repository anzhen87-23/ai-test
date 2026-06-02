import { useState } from 'react';

function FolderTree({ folders, parentId, depth, selectedFolderId, onSelectFolder }) {
  const children = folders.filter((f) => (f.parent_id || null) === (parentId || null));
  if (children.length === 0 && depth === 0) return null;

  const colors = ['var(--yellow)', 'var(--blue)', 'var(--red)'];

  return children.map((folder, idx) => (
    <div key={folder.id} className="folder-group">
      <div
        className={`folder-header ${selectedFolderId === folder.id ? 'active' : ''}`}
        style={{ paddingLeft: depth * 16 }}
        onClick={() => onSelectFolder(folder.id)}
      >
        <span className="folder-icon" style={{ color: colors[idx % 3] }}>&#x1F4C1;</span>
        <span className="folder-name">{folder.name}</span>
      </div>
      {folders.some((f) => f.parent_id === folder.id) && (
        <FolderTree
          folders={folders}
          parentId={folder.id}
          depth={depth + 1}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
        />
      )}
    </div>
  ));
}

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
      className={`note-item ${selectedNoteId === note.id ? 'active' : ''}`}
      onClick={() => onSelectNote(note.id)}
    >
      <span className="note-icon" style={{ color: colors[idx % 3] }}>&#x1F4C4;</span>
      <div className="note-item-content">
        <span className="note-item-title" dangerouslySetInnerHTML={{ __html: note.title || 'Untitled' }} />
        {note.snippet && (
          <span className="note-item-snippet" dangerouslySetInnerHTML={{ __html: note.snippet }} />
        )}
        <span className="note-item-date">
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

function TeamSettingsModal({ team, members, userRole, onClose, onUpdate, onDelete, onAddMember, onUpdateRole, onRemoveMember }) {
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

export default function Sidebar({
  user, folders, teams, notes, selectedFolderId, selectedTeamId, selectedNoteId, searchQuery, searchResults,
  userTeamRole,
  onSelectNote, onSelectFolder, onSelectTeam, onCreateNote, onCreateFolder, onCreateTeam, onDeleteNote, onLogout, onSearchChange,
  onTeamUpdate, onTeamDelete, onAddTeamMember, onUpdateMemberRole, onRemoveTeamMember, teamMembers,
}) {
  const [teamSettingsOpen, setTeamSettingsOpen] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState({});

  const isSearching = searchQuery.length > 0;
  const displayedNotes = isSearching
    ? searchResults
    : selectedTeamId
      ? notes
      : selectedFolderId
        ? notes.filter((n) => n.folder_id === selectedFolderId)
        : notes;

  const toggleTeam = (id) => {
    setExpandedTeams((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openTeamSettings = (e, team) => {
    e.stopPropagation();
    setTeamSettingsOpen(team);
  };

  const roleLabels = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };
  const roleBadgeClass = { admin: 'team-role-badge team-role-admin', editor: 'team-role-badge team-role-editor', viewer: 'team-role-badge team-role-viewer' };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="app-title">安振-AI-笔记</h1>
        <div className="sidebar-actions">
          <button className="icon-btn icon-btn-team" title="New Team" onClick={onCreateTeam}>👥+</button>
          <button className="icon-btn icon-btn-folder" title="New Folder" onClick={onCreateFolder}>📁+</button>
          <button className="icon-btn icon-btn-note" title="New Note" onClick={onCreateNote}>📝+</button>
          <button className="icon-btn icon-btn-logout" title="Logout" onClick={onLogout}>退出</button>
        </div>
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <nav className="sidebar-nav">
        {/* Teams section */}
        {teams.length > 0 && (
          <div className="teams-section">
            <h3 className="teams-section-title">Teams</h3>
            {teams.map((team) => (
              <div key={team.id} className="team-group">
                <div
                  className={`team-header ${selectedTeamId === team.id ? 'active' : ''}`}
                  onClick={() => { toggleTeam(team.id); onSelectTeam(team.id); }}
                >
                  <span className="team-icon">&#x1F465;</span>
                  <span className="team-name">{team.name}</span>
                  <span className={roleBadgeClass[team.role]}>{roleLabels[team.role]}</span>
                  {team.role === 'admin' && (
                    <button className="team-settings-btn" onClick={(e) => openTeamSettings(e, team)}>&#x2699;</button>
                  )}
                </div>
                {expandedTeams[team.id] && teamMembers.length > 0 && selectedTeamId === team.id && (
                  <div className="team-members-preview">
                    {teamMembers.map((m) => (
                      <span key={m.id} className="team-member-chip">
                        {m.email.split('@')[0]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Folders section */}
        <div className="folders-section">
          <h3 className="folders-section-title">Folders</h3>
          <FolderTree
            folders={folders}
            parentId={null}
            depth={0}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
          />
        </div>
      </nav>

      <div className="notes-section">
        <h3 className="notes-section-title">
          {isSearching ? 'Search Results' : selectedTeamId ? getTeamName(teams, selectedTeamId) : selectedFolderId ? getFolderName(folders, selectedFolderId) : 'Notes'}
        </h3>
        <div className="notes-list">
          {isSearching ? (
            <SearchResults results={displayedNotes} selectedNoteId={selectedNoteId} onSelectNote={onSelectNote} />
          ) : (
            displayedNotes.map((note, idx) => {
              const colors = ['var(--blue)', 'var(--red)', 'var(--yellow)'];
              return (
                <div
                  key={note.id}
                  className={`note-item ${selectedNoteId === note.id ? 'active' : ''}`}
                  onClick={() => onSelectNote(note.id)}
                >
                  <span className="note-icon" style={{ color: colors[idx % 3] }}>&#x1F4C4;</span>
                  <div className="note-item-content">
                    <span className="note-item-title">{note.title || 'Untitled'}</span>
                    <span className="note-item-date">
                      {getWordCount(note)} 字 · {new Date(note.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    className="note-delete-btn"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
                  >
                    &times;
                  </button>
                </div>
              );
            })
          )}
          {displayedNotes.length === 0 && (
            <p className="empty-notes">
              {isSearching ? 'No matching notes' : selectedTeamId ? 'No notes in this team' : selectedFolderId ? 'No notes in this folder' : 'No notes yet'}
            </p>
          )}
        </div>
      </div>

      {/* Team Settings Modal */}
      {teamSettingsOpen && (
        <TeamSettingsModal
          team={teamSettingsOpen}
          members={teamMembers}
          userRole={userTeamRole}
          onClose={() => setTeamSettingsOpen(false)}
          onUpdate={onTeamUpdate}
          onDelete={onTeamDelete}
          onAddMember={onAddTeamMember}
          onUpdateRole={onUpdateMemberRole}
          onRemoveMember={onRemoveTeamMember}
        />
      )}
    </aside>
  );
}
