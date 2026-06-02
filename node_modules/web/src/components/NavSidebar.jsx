import { useState } from 'react';

function FolderTree({ folders, parentId, depth, selectedFolderId, onSelectFolder, onFolderSettings }) {
  const children = folders.filter((f) => (f.parent_id || null) === (parentId || null));
  if (children.length === 0 && depth === 0) return null;

  const colors = ['var(--yellow)', 'var(--blue)', 'var(--red)'];

  return children.map((folder, idx) => (
    <div key={folder.id} className="nav-folder-group">
      <div
        className={`nav-folder-header ${selectedFolderId === folder.id ? 'active' : ''}`}
        style={{ paddingLeft: depth * 16 + 12 }}
      >
        <span className="nav-folder-icon" style={{ color: colors[idx % 3] }} onClick={() => onSelectFolder(folder.id)}>&#x1F4C1;</span>
        <span className="nav-folder-name" onClick={() => onSelectFolder(folder.id)}>{folder.name}</span>
        <button className="nav-folder-settings-btn" onClick={(e) => onFolderSettings(e, folder)}>&#x2699;</button>
      </div>
      {folders.some((f) => f.parent_id === folder.id) && (
        <FolderTree
          folders={folders}
          parentId={folder.id}
          depth={depth + 1}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
          onFolderSettings={onFolderSettings}
        />
      )}
    </div>
  ));
}

export default function NavSidebar({
  folders, teams, selectedFolderId, selectedTeamId, searchQuery, userProfile,
  onSelectFolder, onSelectTeam, onCreateFolder, onCreateTeam, onSearchChange,
  onTeamSettingsOpen, onFolderSettingsOpen, userTeamRole, onProfileOpen, onLogout,
}) {
  const [expandedTeams, setExpandedTeams] = useState({});

  const toggleTeam = (id) => {
    setExpandedTeams((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const roleLabels = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };
  const roleBadgeClass = { admin: 'team-role-badge team-role-admin', editor: 'team-role-badge team-role-editor', viewer: 'team-role-badge team-role-viewer' };

  return (
    <div className="nav-sidebar">
      {/* Header with action buttons */}
      <div className="nav-header">
        <h1 className="nav-logo">安振-AI-笔记</h1>
        <div className="nav-actions">
          <button className="nav-btn nav-btn-team" title="New Team" onClick={onCreateTeam}>👥</button>
          <button className="nav-btn nav-btn-folder" title="New Folder" onClick={onCreateFolder}>📁</button>
        </div>
      </div>

      {/* Search */}
      <div className="nav-search">
        <input
          type="text"
          placeholder="搜索笔记..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Navigation */}
      <nav className="nav-content">
        {/* All Notes */}
        <div
          className={`nav-item ${!selectedTeamId && !selectedFolderId ? 'active' : ''}`}
          onClick={() => { onSelectTeam(null); onSelectFolder(null); }}
        >
          <span className="nav-item-icon">&#x1F4DD;</span>
          <span className="nav-item-label">全部笔记</span>
        </div>

        {/* Teams */}
        {teams.length > 0 && (
          <div className="nav-section">
            <div className="nav-section-label">团队</div>
            {teams.map((team) => (
              <div key={team.id} className="nav-team-group">
                <div
                  className={`nav-team-header ${selectedTeamId === team.id ? 'active' : ''}`}
                  onClick={() => { toggleTeam(team.id); onSelectTeam(team.id); }}
                >
                  <span className="nav-team-icon">&#x1F465;</span>
                  <span className="nav-team-name">{team.name}</span>
                  <span className={roleBadgeClass[team.role]}>{roleLabels[team.role]}</span>
                  {team.role === 'admin' && (
                    <button className="nav-team-settings-btn" onClick={(e) => onTeamSettingsOpen(e, team)}>&#x2699;</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Folders */}
        {folders.length > 0 && (
          <div className="nav-section">
            <div className="nav-section-label">文件夹</div>
            <FolderTree
              folders={folders}
              parentId={null}
              depth={0}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              onFolderSettings={onFolderSettingsOpen}
            />
          </div>
        )}
      </nav>

      {/* User profile bar at bottom */}
      <div className="nav-user-bar">
        <div className="nav-user-info" onClick={onProfileOpen}>
          {userProfile?.avatar ? (
            <img className="nav-user-avatar-img" src={userProfile.avatar} alt="avatar" />
          ) : (
            <div className="nav-user-avatar">{userProfile?.display_name?.charAt(0)?.toUpperCase() || userProfile?.email?.charAt(0)?.toUpperCase() || '?'}</div>
          )}
          <div className="nav-user-text">
            <span className="nav-user-name">{userProfile?.display_name || '未设置昵称'}</span>
            <span className="nav-user-email">{userProfile?.email}</span>
          </div>
        </div>
        <button className="nav-logout-btn" title="Logout" onClick={onLogout}>&#x23FB;</button>
      </div>
    </div>
  );
}
