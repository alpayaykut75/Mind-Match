import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL 
  || process.env.EXPO_PUBLIC_BACKEND_URL 
  || 'https://mindlink-social.preview.emergentagent.com';

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
  getMe: () => api.get('/api/users/me'),
  getOnlineUsers: () => api.get('/api/users/online'),
  searchUser: (username: string) => api.get(`/api/users/search/${username}`),
  updateProfile: (data: any) => api.put('/api/users/profile', data),
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
};
