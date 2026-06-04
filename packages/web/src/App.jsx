import { useState, useEffect, useCallback } from 'react';
import { auth, folders as foldersApi, notes as notesApi, teams as teamsApi, search as searchApi, users as usersApi } from './api';
import NavSidebar from './components/NavSidebar';
import NotesListPanel from './components/NotesListPanel';
import NoteEditor from './components/NoteEditor';
import TeamSettingsModal from './components/TeamSettingsModal';
import FolderSettingsModal from './components/FolderSettingsModal';
import ProfileModal from './components/ProfileModal';

function AuthForm({ mode, onSubmit, onSwitch }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await (mode === 'login' ? auth.login : auth.register)({ email, password });
      if (data.token) localStorage.setItem('token', data.token);
      onSubmit(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2 className="auth-logo">安振-AI-笔记</h2>
        <p className="auth-mode-title">{mode === 'login' ? 'Sign In' : 'Create Account'}</p>
        {error && <div className="auth-error">{error}</div>}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        <button type="submit">{mode === 'login' ? 'Sign In' : 'Sign Up'}</button>
        <p className="auth-switch">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button type="button" className="link-btn" onClick={onSwitch}>
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </form>
      {/* ICP Footer */}
      <footer className="auth-footer">
        <div className="icp-content">
          <span>安振的个人网站</span>
          <span className="icp-divider">|</span>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">京ICP备2026030842号-1</a>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [folders, setFolders] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [userTeamRole, setUserTeamRole] = useState(null);
  const [teamSettingsTeam, setTeamSettingsTeam] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [folderSettingsFolder, setFolderSettingsFolder] = useState(null);

  // Debounced server-side search
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { notes } = await searchApi.query(searchQuery);
        setSearchResults(notes);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ id: payload.sub, email: payload.email });
      } catch {
        localStorage.removeItem('token');
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [f, n, t] = await Promise.all([
        foldersApi.list(),
        notesApi.list(),
        teamsApi.list(),
      ]);
      setFolders(f.folders);
      setNotes(n.notes);
      setTeams(t.teams);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { user: p } = await usersApi.getProfile();
      setUserProfile(p);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const loadTeamMembers = useCallback(async (teamId) => {
    if (!teamId) {
      setTeamMembers([]);
      setUserTeamRole(null);
      return;
    }
    try {
      const { team, members } = await teamsApi.get(teamId);
      setTeamMembers(members);
      setUserTeamRole(members.find(m => m.id === user.id)?.role || null);
    } catch (err) {
      console.error('Failed to load team members:', err);
    }
  }, [user]);

  useEffect(() => {
    loadTeamMembers(selectedTeamId);
  }, [selectedTeamId, loadTeamMembers]);

  const handleLogin = (data) => {
    setUser(data.user);
    localStorage.setItem('token', data.token);
  };

  const handleLogout = () => {
    if (!confirm('Are you sure you want to sign out?')) return;
    localStorage.removeItem('token');
    setUser(null);
    setSelectedNoteId(null);
    setSelectedFolderId(null);
    setSelectedTeamId(null);
    setFolders([]);
    setNotes([]);
    setTeams([]);
    setSearchQuery('');
    setSearchResults([]);
    setUserProfile(null);
    setProfileOpen(false);
  };

  const handleCreateNote = async () => {
    try {
      if (selectedTeamId) {
        // Team note
        const { note } = await teamsApi.createNote(selectedTeamId, { title: 'Untitled' });
        setNotes((prev) => [note, ...prev]);
        setSelectedNoteId(note.id);
      } else {
        const { note } = await notesApi.create({ title: 'Untitled', folderId: selectedFolderId });
        setNotes((prev) => [note, ...prev]);
        setSelectedNoteId(note.id);
      }
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const handleCreateFolder = async () => {
    const name = prompt('Folder name:');
    if (!name) return;
    try {
      const { folder } = await foldersApi.create({ name });
      setFolders((prev) => [...prev, folder]);
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const handleCreateTeam = async () => {
    const name = prompt('Team name:');
    if (!name) return;
    try {
      const { team } = await teamsApi.create({ name });
      setTeams((prev) => [team, ...prev]);
      setSelectedTeamId(team.id);
      setSelectedFolderId(null);
    } catch (err) {
      console.error('Failed to create team:', err);
    }
  };

  const handleSelectNote = (id) => setSelectedNoteId(id);

  const handleSelectFolder = (id) => {
    setSelectedTeamId(null);
    setSelectedFolderId((prev) => prev === id ? null : id);
    setSelectedNoteId(null);
    setFolderSettingsFolder(null);
  };

  const handleFolderSettingsOpen = (e, folder) => {
    e.stopPropagation();
    setFolderSettingsFolder((prev) => prev?.id === folder.id ? null : folder);
  };

  const handleSelectTeam = (id) => {
    setSelectedTeamId(id);
    setSelectedFolderId(null);
    setSelectedNoteId(null);
    // Load team notes
    if (id) {
      teamsApi.notes(id).then(({ notes }) => setNotes(notes)).catch(() => {});
    } else {
      notesApi.list().then(({ notes }) => setNotes(notes)).catch(() => {});
    }
  };

  const handleDeleteNote = async (id) => {
    if (!confirm('Delete this note?')) return;
    try {
      if (selectedTeamId) {
        await teamsApi.remove(selectedTeamId, id);
      } else {
        await notesApi.remove(id);
      }
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteId === id) setSelectedNoteId(null);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleTeamUpdate = async (name) => {
    try {
      await teamsApi.update(selectedTeamId, { name });
      setTeams((prev) => prev.map(t => t.id === selectedTeamId ? { ...t, name } : t));
    } catch (err) {
      console.error('Failed to update team:', err);
      throw err;
    }
  };

  const handleTeamDelete = async () => {
    if (!confirm('Delete this team? All team notes will be deleted.')) return;
    try {
      await teamsApi.remove(selectedTeamId);
      setTeams((prev) => prev.filter(t => t.id !== selectedTeamId));
      setSelectedTeamId(null);
      setNotes([]);
      setTeamMembers([]);
    } catch (err) {
      console.error('Failed to delete team:', err);
      throw err;
    }
  };

  const handleAddTeamMember = async (email, role) => {
    try {
      const { member } = await teamsApi.addMember(selectedTeamId, { email, role });
      setTeamMembers((prev) => [...prev, member]);
    } catch (err) {
      console.error('Failed to add member:', err);
      throw err;
    }
  };

  const handleUpdateMemberRole = async (userId, role) => {
    try {
      const { member } = await teamsApi.updateMember(selectedTeamId, userId, { role });
      setTeamMembers((prev) => prev.map(m => m.id === userId ? member : m));
    } catch (err) {
      console.error('Failed to update role:', err);
      throw err;
    }
  };

  const handleRemoveTeamMember = async (userId) => {
    if (!confirm('Remove this member?')) return;
    try {
      await teamsApi.removeMember(selectedTeamId, userId);
      setTeamMembers((prev) => prev.filter(m => m.id !== userId));
    } catch (err) {
      console.error('Failed to remove member:', err);
      throw err;
    }
  };

  const handleTeamSettingsOpen = (e, team) => {
    e.stopPropagation();
    setTeamSettingsTeam(team);
  };

  if (!user) {
    return <AuthForm mode={authMode} onSubmit={handleLogin} onSwitch={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} />;
  }

  return (
    <div className="app-layout">
      {/* Panel 1: Nav Sidebar (Teams + Folders) */}
      <NavSidebar
        folders={folders}
        teams={teams}
        selectedFolderId={selectedFolderId}
        selectedTeamId={selectedTeamId}
        searchQuery={searchQuery}
        userProfile={userProfile}
        onSelectFolder={handleSelectFolder}
        onSelectTeam={handleSelectTeam}
        onCreateFolder={handleCreateFolder}
        onCreateTeam={handleCreateTeam}
        onSearchChange={setSearchQuery}
        onTeamSettingsOpen={handleTeamSettingsOpen}
        onFolderSettingsOpen={handleFolderSettingsOpen}
        userTeamRole={userTeamRole}
        onProfileOpen={() => setProfileOpen(true)}
        onLogout={handleLogout}
      />

      {/* Folder Settings Modal */}
      {folderSettingsFolder && (
        <FolderSettingsModal
          folder={folderSettingsFolder}
          onClose={() => setFolderSettingsFolder(null)}
          onRename={async (name) => {
            await foldersApi.update(folderSettingsFolder.id, { name });
            setFolders((prev) => prev.map(f => f.id === folderSettingsFolder.id ? { ...f, name } : f));
            setFolderSettingsFolder(null);
          }}
          onDelete={async () => {
            await foldersApi.remove(folderSettingsFolder.id);
            setFolders((prev) => prev.filter(f => f.id !== folderSettingsFolder.id));
            if (selectedFolderId === folderSettingsFolder.id) setSelectedFolderId(null);
            setFolderSettingsFolder(null);
          }}
        />
      )}

      {/* Panel 2: Notes List */}
      <NotesListPanel
        folders={folders}
        teams={teams}
        notes={notes}
        selectedFolderId={selectedFolderId}
        selectedTeamId={selectedTeamId}
        selectedNoteId={selectedNoteId}
        searchQuery={searchQuery}
        searchResults={searchResults}
        onSelectNote={handleSelectNote}
        onCreateNote={handleCreateNote}
        onDeleteNote={handleDeleteNote}
      />

      {/* Panel 3: Note Editor / Empty State */}
      <div className="main-content">
        {selectedNoteId ? (
          <NoteEditor noteId={selectedNoteId} teamId={selectedTeamId} />
        ) : (
          <div className="empty-state">
            <h2>选择一篇笔记或创建新笔记</h2>
            <button className="primary-btn" onClick={handleCreateNote}>+ 新建笔记</button>
          </div>
        )}
      </div>

      {/* Team Settings Modal */}
      {teamSettingsTeam && (
        <TeamSettingsModal
          team={teamSettingsTeam}
          members={teamMembers}
          userRole={userTeamRole}
          onClose={() => setTeamSettingsTeam(null)}
          onUpdate={handleTeamUpdate}
          onDelete={handleTeamDelete}
          onAddMember={handleAddTeamMember}
          onUpdateRole={handleUpdateMemberRole}
          onRemoveMember={handleRemoveTeamMember}
        />
      )}

      {/* Profile Modal */}
      {profileOpen && userProfile && (
        <ProfileModal
          user={userProfile}
          onClose={() => setProfileOpen(false)}
          onUpdate={(updated) => setUserProfile(updated)}
        />
      )}
    </div>
  );
}
