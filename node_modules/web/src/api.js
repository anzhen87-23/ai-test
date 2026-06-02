const BASE = '';

function getToken() {
  return localStorage.getItem('token');
}

async function apiRequest(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const token = getToken();
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const auth = {
  register: (data) => apiRequest('POST', '/api/auth/register', data),
  login: (data) => apiRequest('POST', '/api/auth/login', data),
};

export const folders = {
  list: () => apiRequest('GET', '/api/folders'),
  create: (data) => apiRequest('POST', '/api/folders', data),
  update: (id, data) => apiRequest('PUT', `/api/folders/${id}`, data),
  remove: (id) => apiRequest('DELETE', `/api/folders/${id}`),
};

export const notes = {
  list: (folderId) => {
    const qs = folderId ? `?folderId=${folderId}` : '';
    return apiRequest('GET', `/api/notes${qs}`);
  },
  get: (id) => apiRequest('GET', `/api/notes/${id}`),
  create: (data) => apiRequest('POST', '/api/notes', data),
  update: (id, data) => apiRequest('PUT', `/api/notes/${id}`, data),
  remove: (id) => apiRequest('DELETE', `/api/notes/${id}`),
  saveBlocks: (noteId, blocks) => apiRequest('PUT', `/api/notes/${noteId}/blocks`, { blocks }),
};

export const search = {
  query: (q) => apiRequest('GET', `/api/search?q=${encodeURIComponent(q)}`),
};

export const attachments = {
  list: (noteId) => apiRequest('GET', `/api/notes/${noteId}/attachments`),
  upload: async (noteId, files) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append('file', file);
    }
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/notes/${noteId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || res.statusText);
    }
    return res.json();
  },
  remove: (noteId, id) => apiRequest('DELETE', `/api/notes/${noteId}/attachments/${id}`),
  downloadUrl: (id) => `/api/attachments/${id}?token=${encodeURIComponent(localStorage.getItem('token') || '')}`,
  previewUrl: (id) => `/api/attachments/${id}/preview?token=${encodeURIComponent(localStorage.getItem('token') || '')}`,
};

export const teams = {
  list: () => apiRequest('GET', '/api/teams'),
  create: (data) => apiRequest('POST', '/api/teams', data),
  get: (id) => apiRequest('GET', `/api/teams/${id}`),
  update: (id, data) => apiRequest('PUT', `/api/teams/${id}`, data),
  remove: (id) => apiRequest('DELETE', `/api/teams/${id}`),
  members: (id) => apiRequest('GET', `/api/teams/${id}/members`),
  addMember: (id, data) => apiRequest('POST', `/api/teams/${id}/members`, data),
  updateMember: (id, userId, data) => apiRequest('PUT', `/api/teams/${id}/members/${userId}`, data),
  removeMember: (id, userId) => apiRequest('DELETE', `/api/teams/${id}/members/${userId}`),
  notes: (id) => apiRequest('GET', `/api/teams/${id}/notes`),
  createNote: (id, data) => apiRequest('POST', `/api/teams/${id}/notes`, data),
  saveBlocks: (teamId, noteId, blocks) => apiRequest('PUT', `/api/teams/${teamId}/notes/${noteId}/blocks`, { blocks }),
};

export const users = {
  getProfile: () => apiRequest('GET', '/api/users/me'),
  updateProfile: (data) => apiRequest('PUT', '/api/users/me', data),
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    const res = await fetch('/api/users/me/avatar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || res.statusText);
    }
    return res.json();
  },
};
