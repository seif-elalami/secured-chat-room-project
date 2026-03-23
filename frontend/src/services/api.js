import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const isLikelyJwt = (value) =>
  typeof value === 'string' && value.split('.').length === 3;

const clearStoredSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token && isLikelyJwt(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (token) {
      clearStoredSession();
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    if (
      status === 401 &&
      (message === 'Invalid token format' ||
        message === 'Token has expired. Please log in again.' ||
        message === 'Authentication failed' ||
        message === 'Authorization header missing or invalid')
    ) {
      clearStoredSession();
    }

    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
};

export const userAPI = {
  getMe: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },

  updateMe: async (updates) => {
    const response = await api.put('/users/me', updates);
    return response.data;
  },

  deleteMe: async () => {
    const response = await api.delete('/users/me');
    return response.data;
  },

  getById: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  getByUsername: async (username) => {
    const response = await api.get(`/users/lookup/username/${username}`);
    return response.data;
  },

  searchUsers: async (query) => {
    const response = await api.get('/users/search', { params: { q: query } });
    return response.data;
  },

  getBlocked: async () => {
    const response = await api.get('/users/blocked');
    return response.data;
  },

  blockById: async (userId) => {
    const response = await api.put(`/users/block/${userId}`);
    return response.data;
  },

  unblockById: async (userId) => {
    const response = await api.put(`/users/unblock/${userId}`);
    return response.data;
  },
};

export const roomAPI = {
  getRooms: async () => {
    const response = await api.get('/rooms');
    return response.data;
  },

  getRoomById: async (roomId) => {
    const response = await api.get(`/rooms/${roomId}`);
    return response.data;
  },

  getRoleInfo: async (roomId) => {
    const response = await api.get(`/rooms/${roomId}/user-role`);
    return response.data;
  },

  createGroupRoom: async (payload) => {
    const response = await api.post('/rooms', payload);
    return response.data;
  },

  createDirectRoom: async (payload) => {
    const response = await api.post('/rooms/direct', payload);
    return response.data;
  },

  addMember: async (roomId, userId) => {
    const response = await api.post(`/rooms/${roomId}/members`, { userId });
    return response.data;
  },

  removeMember: async (roomId, userId) => {
    const response = await api.delete(`/rooms/${roomId}/members/${userId}`);
    return response.data;
  },

  promoteMember: async (roomId, payload) => {
    const response = await api.post(`/rooms/${roomId}/promote`, payload);
    return response.data;
  },

  demoteMember: async (roomId, targetUserId) => {
    const response = await api.post(`/rooms/${roomId}/demote`, { targetUserId });
    return response.data;
  },

  updateSettings: async (roomId, payload) => {
    const response = await api.put(`/rooms/${roomId}/settings`, payload);
    return response.data;
  },

  getStatistics: async (roomId) => {
    const response = await api.get(`/rooms/${roomId}/statistics`);
    return response.data;
  },

  generateInvite: async (roomId) => {
    const response = await api.post(`/rooms/${roomId}/invite`);
    return response.data;
  },

  getInvite: async (roomId) => {
    const response = await api.get(`/rooms/${roomId}/invite`);
    return response.data;
  },

  revokeInvite: async (roomId) => {
    const response = await api.delete(`/rooms/${roomId}/invite`);
    return response.data;
  },

  joinInvite: async (inviteCode) => {
    const response = await api.post(`/rooms/join/${inviteCode}`);
    return response.data;
  },

  deleteRoom: async (roomId) => {
    const response = await api.delete(`/rooms/${roomId}`);
    return response.data;
  },
};

export const messageAPI = {
  getMessages: async (roomId) => {
    const response = await api.get(`/messages/${roomId}`);
    return response.data;
  },

  sendMessage: async (payload) => {
    const response = await api.post('/messages/send', payload);
    return response.data;
  },

  editMessage: async (messageId, content) => {
    const response = await api.put(`/messages/${messageId}`, { content });
    return response.data;
  },

  deleteMessage: async (messageId) => {
    const response = await api.delete(`/messages/${messageId}`);
    return response.data;
  },

  getPinnedMessages: async (roomId) => {
    const response = await api.get(`/messages/${roomId}/pinned`);
    return response.data;
  },

  toggleReaction: async (messageId, emoji) => {
    const response = await api.post(`/messages/${messageId}/react`, { emoji });
    return response.data;
  },

  pinMessage: async (messageId) => {
    const response = await api.post(`/messages/${messageId}/pin`);
    return response.data;
  },

  getUnreadCount: async (roomId) => {
    const response = await api.get(`/messages/room/${roomId}/unread`);
    return response.data;
  },

  markReadBatch: async (messageIds) => {
    const response = await api.post('/messages/read-batch', { messageIds });
    return response.data;
  },

  getMessageReaders: async (messageId) => {
    const response = await api.get(`/messages/${messageId}/read-receipts`);
    return response.data;
  },

  uploadMedia: async (roomId, formData) => {
    formData.append('roomId', roomId);
    const response = await api.post('/messages/send', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  deleteMedia: async (messageId, mediaId) => {
    const response = await api.delete(`/messages/${messageId}/media/${mediaId}`);
    return response.data;
  },
};

export const mediaAPI = {
  uploadToGallery: async (formData) => {
    const response = await api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  getRoomImages: async (roomId, params = {}) => {
    const response = await api.get(`/media/chats/${roomId}/media`, { params });
    return response.data;
  },
  deleteMedia: async (mediaId) => {
    const response = await api.delete(`/media/${mediaId}`);
    return response.data;
  }
};

export const noteAPI = {
  getNotes: async (queryParams = '') => {
    const response = await api.get(`/notes${queryParams}`);
    return response.data;
  },

  getNoteById: async (noteId) => {
    const response = await api.get(`/notes/${noteId}`);
    return response.data;
  },

  createNote: async (payload) => {
    const response = await api.post('/notes', payload);
    return response.data;
  },

  updateNote: async (noteId, payload) => {
    const response = await api.put(`/notes/${noteId}`, payload);
    return response.data;
  },

  deleteNote: async (noteId) => {
    const response = await api.delete(`/notes/${noteId}`);
    return response.data;
  },

  restoreNote: async (noteId) => {
    const response = await api.post(`/notes/${noteId}/restore`);
    return response.data;
  },

  togglePin: async (noteId) => {
    const response = await api.post(`/notes/${noteId}/pin`);
    return response.data;
  },

  toggleFavorite: async (noteId) => {
    const response = await api.post(`/notes/${noteId}/favorite`);
    return response.data;
  },

  syncNotes: async (payload) => {
    const response = await api.get('/notes/sync', { params: payload });
    return response.data;
  }
};

export const assignmentAPI = {
  createAssignment: async (formData) => {
    const response = await api.post('/assignments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  getAssignments: async (roomId) => {
    const url = roomId ? `/assignments?roomId=${roomId}` : '/assignments';
    const response = await api.get(url);
    return response.data;
  },

  getAssignmentById: async (assignmentId) => {
    const response = await api.get(`/assignments/${assignmentId}`);
    return response.data;
  },

  submitAssignment: async (assignmentId, formData) => {
    const response = await api.post(`/assignments/${assignmentId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  gradeSubmission: async (assignmentId, studentId, payload) => {
    const response = await api.put(`/assignments/${assignmentId}/grade/${studentId}`, payload);
    return response.data;
  },

  deleteAssignment: async (assignmentId) => {
    const response = await api.delete(`/assignments/${assignmentId}`);
    return response.data;
  }
};

export default api;
