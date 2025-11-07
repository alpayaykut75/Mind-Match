import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL 
  || process.env.EXPO_PUBLIC_BACKEND_URL 
  || 'https://friend-sync-1.preview.emergentagent.com';

console.log('API_URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

export const authAPI = {
  signup: (data: any) => api.post('/api/auth/signup', data),
  login: (data: any) => api.post('/api/auth/login', data),
};

export const userAPI = {
  login: (username: string, password: string) => api.post('/api/auth/login', { username, password }),
  signup: (username: string, password: string, bio?: string, age?: number, country?: string, avatar?: string) => 
    api.post('/api/auth/signup', { username, password, bio, age, country, avatar }),
  getMe: () => api.get('/api/users/me'),
  updateProfile: (data: any) => api.put('/api/users/profile', data),
  updateAvatar: (avatar: string) => api.put('/api/users/profile', { avatar }),
  markOnline: () => api.post('/api/users/online'),
  getOnlineUsers: () => api.get('/api/users/online'),
  getBadgeProgress: () => api.get('/api/badges/progress'),
  getLeaderboard: (period: string) => api.get(`/api/leaderboard/${period}`),
  searchUser: (username: string) => api.get(`/api/users/search/${username}`),
};

export const friendAPI = {
  sendRequest: (username: string) => api.post('/api/friends/request', { to_username: username }),
  getRequests: () => api.get('/api/friends/requests'),
  acceptRequest: (username: string) => api.post(`/api/friends/accept/${username}`),
  removeFriend: (username: string) => api.delete(`/api/friends/${username}`),
  getFriends: () => api.get('/api/friends/list'),
};

export const gameAPI = {
  createGame: (mode: string, opponentUsername?: string) => 
    api.post('/api/game/create', { mode, opponent_username: opponentUsername }),
  submitWord: (gameId: string, word: string) => 
    api.post(`/api/game/${gameId}/submit-word`, { word }),
  getGameStatus: (gameId: string) => 
    api.get(`/api/game/${gameId}/status`),
  getActiveGames: () => 
    api.get('/api/game/active'),
  abandonGame: (gameId: string) => 
    api.post(`/api/game/${gameId}/abandon`),
  sendGameInvite: (username: string) => 
    api.post('/api/game/invite', { to_username: username }),
  getGameInvites: () => 
    api.get('/api/game/invites'),
  acceptGameInvite: (inviteId: string) => 
    api.post(`/api/game/invite/${inviteId}/accept`),
  declineGameInvite: (inviteId: string) => 
    api.post(`/api/game/invite/${inviteId}/decline`),
};

export const chatAPI = {
  sendMessage: (username: string, message: string) => api.post('/api/chat/send', { to_username: username, message }),
  getChatHistory: (username: string) => api.get(`/api/chat/${username}`),
  getConversations: () => api.get('/api/chat/conversations'),
  getUnreadCount: () => api.get('/api/chat/unread-count'),
  getUnreadByUser: () => api.get('/api/chat/unread-by-user'),
};
