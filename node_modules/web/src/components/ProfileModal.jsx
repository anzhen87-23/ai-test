import { useState, useEffect, useRef } from 'react';
import { users } from '../api';

export default function ProfileModal({ user, onClose, onUpdate }) {
  const fileInputRef = useRef(null);
  const [displayName, setDisplayName] = useState(user?.displayName || user?.display_name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.display_name || '');
      setAvatar(user.avatar || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const { user: updated } = await users.updateProfile({
        displayName: displayName.trim() || null,
        avatar: avatar.trim() || null,
        email: email.trim() || null,
      });
      setSuccess(true);
      const { user: refreshed } = await users.getProfile();
      onUpdate(refreshed);
      setTimeout(() => onClose(), 600);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      if (!currentPassword) throw new Error('Current password is required');
      if (!newPassword) throw new Error('New password is required');
      if (newPassword.length < 8) throw new Error('Password must be at least 8 characters');
      if (newPassword !== confirmPassword) throw new Error('Passwords do not match');
      const { user: updated } = await users.updateProfile({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
      const { user: refreshed } = await users.getProfile();
      onUpdate(refreshed);
      setTimeout(() => onClose(), 600);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const getInitials = () => {
    if (displayName) return displayName.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return '?';
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { avatar: avatarUrl } = await users.uploadAvatar(file);
      setAvatar(avatarUrl);
      setSuccess(true);
      const { user: updated } = await users.getProfile();
      onUpdate(updated);
      setTimeout(() => onClose(), 600);
    } catch (err) {
      setError(err.message);
    }
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2>个人设置</h2>
          <button className="profile-modal-close" onClick={onClose}>&times;</button>
        </div>

        {/* Avatar + name preview */}
        <div className="profile-modal-avatar">
          <div className="profile-avatar-wrapper">
            <div className="profile-avatar-click" onClick={handleAvatarClick}>
              {avatar ? (
                <img className="profile-avatar-img" src={avatar} alt="avatar" />
              ) : (
                <div className="profile-avatar-circle">{getInitials()}</div>
              )}
              {uploading && <div className="profile-avatar-overlay">上传中...</div>}
              {!uploading && <div className="profile-avatar-hint">&#x270E;</div>}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarUpload}
            />
          </div>
          <div className="profile-modal-name">
            <span className="profile-display-name">{displayName || '未设置昵称'}</span>
            <span className="profile-email">{email}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="profile-tabs">
          <button className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>基本资料</button>
          <button className={`profile-tab ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>安全设置</button>
        </div>

        <div className="profile-modal-body">
          {error && <div className="profile-error">{error}</div>}
          {success && <div className="profile-success">已保存成功</div>}

          {activeTab === 'profile' && (
            <div className="profile-section">
              <div className="profile-field">
                <label>昵称</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="profile-field">
                <label>邮箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button className="profile-save-btn" onClick={handleSaveProfile} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="profile-section">
              <div className="profile-field">
                <label>当前密码</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="profile-field">
                <label>新密码</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="profile-field">
                <label>确认新密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button className="profile-save-btn" onClick={handleChangePassword} disabled={saving}>
                {saving ? '保存中...' : '修改密码'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
