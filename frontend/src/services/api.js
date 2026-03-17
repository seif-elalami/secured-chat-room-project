import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

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
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
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
};

export default api;
