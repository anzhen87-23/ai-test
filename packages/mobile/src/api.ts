export const BASE_URL = __DEV__ ? 'http://localhost:3001' : '';

async function apiRequest(method: string, path: string, body?: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest('POST', '/api/auth/login', { email, password }),
  register: (email: string, password: string) =>
    apiRequest('POST', '/api/auth/register', { email, password }),
};

export const foldersApi = {
  list: (token: string) => apiRequest('GET', '/api/folders', undefined, token),
  create: (name: string, token: string) =>
    apiRequest('POST', '/api/folders', { name }, token),
  update: (id: number, data: { name: string }, token: string) =>
    apiRequest('PUT', `/api/folders/${id}`, data, token),
  remove: (id: number, token: string) =>
    apiRequest('DELETE', `/api/folders/${id}`, undefined, token),
};

export const notesApi = {
  list: (token: string, folderId?: number) => {
    const qs = folderId ? `?folderId=${folderId}` : '';
    return apiRequest('GET', `/api/notes${qs}`, undefined, token);
  },
  get: (id: number, token: string) => apiRequest('GET', `/api/notes/${id}`, undefined, token),
  create: (data: { title?: string; folderId?: number | null }, token: string) =>
    apiRequest('POST', '/api/notes', data, token),
  update: (id: number, data: { title?: string; folderId?: number }, token: string) =>
    apiRequest('PUT', `/api/notes/${id}`, data, token),
  remove: (id: number, token: string) =>
    apiRequest('DELETE', `/api/notes/${id}`, undefined, token),
  saveBlocks: (noteId: number, blocks: object[], token: string) =>
    apiRequest('PUT', `/api/notes/${noteId}/blocks`, { blocks }, token),
};

export const searchApi = {
  query: (q: string, token: string) =>
    apiRequest('GET', `/api/search?q=${encodeURIComponent(q)}`, undefined, token),
};

export const attachmentsApi = {
  list: (noteId: number, token: string) =>
    apiRequest('GET', `/api/notes/${noteId}/attachments`, undefined, token),
  upload: async (noteId: number, files: File[], token: string) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append('file', file);
    }
    const res = await fetch(`${BASE_URL}/api/notes/${noteId}/attachments`, {
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
  remove: (noteId: number, id: number, token: string) =>
    apiRequest('DELETE', `/api/notes/${noteId}/attachments/${id}`, undefined, token),
  downloadUrl: (id: number, token: string) =>
    `${BASE_URL}/api/attachments/${id}?token=${encodeURIComponent(token)}`,
  previewUrl: (id: number, token: string) =>
    `${BASE_URL}/api/attachments/${id}/preview?token=${encodeURIComponent(token)}`,
};

export const teamsApi = {
  list: (token: string) => apiRequest('GET', '/api/teams', undefined, token),
  create: (name: string, token: string) => apiRequest('POST', '/api/teams', { name }, token),
  get: (id: number, token: string) => apiRequest('GET', `/api/teams/${id}`, undefined, token),
  update: (id: number, name: string, token: string) => apiRequest('PUT', `/api/teams/${id}`, { name }, token),
  remove: (id: number, token: string) => apiRequest('DELETE', `/api/teams/${id}`, undefined, token),
  members: (id: number, token: string) => apiRequest('GET', `/api/teams/${id}/members`, undefined, token),
  addMember: (id: number, email: string, role: string, token: string) =>
    apiRequest('POST', `/api/teams/${id}/members`, { email, role }, token),
  updateMember: (id: number, userId: number, role: string, token: string) =>
    apiRequest('PUT', `/api/teams/${id}/members/${userId}`, { role }, token),
  removeMember: (id: number, userId: number, token: string) =>
    apiRequest('DELETE', `/api/teams/${id}/members/${userId}`, undefined, token),
  notes: (id: number, token: string) => apiRequest('GET', `/api/teams/${id}/notes`, undefined, token),
  createNote: (id: number, title: string, token: string) =>
    apiRequest('POST', `/api/teams/${id}/notes`, { title }, token),
  saveBlocks: (teamId: number, noteId: number, blocks: object[], token: string) =>
    apiRequest('PUT', `/api/teams/${teamId}/notes/${noteId}/blocks`, { blocks }, token),
};

export const usersApi = {
  getProfile: (token: string) => apiRequest('GET', '/api/users/me', undefined, token),
  updateProfile: (data: { displayName?: string; avatar?: string; email?: string; currentPassword?: string; newPassword?: string }, token: string) =>
    apiRequest('PUT', '/api/users/me', data, token),
  uploadAvatar: async (uri: string, token: string) => {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'avatar.jpg';
    const ext = filename.split('.').pop() || 'jpg';
    const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
    formData.append('file', { uri, name: filename, type: mimeMap[ext] || 'image/jpeg' } as any);
    const res = await fetch(`${BASE_URL}/api/users/me/avatar`, {
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
