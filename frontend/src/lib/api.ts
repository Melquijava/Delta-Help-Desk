import axios from 'axios';
import { getStoredSession } from './auth-storage';
import { notifySessionExpired } from './auth-events';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const fallbackApiUrl = import.meta.env.PROD ? '/api' : 'http://localhost:3333/api';

export const api = axios.create({
  baseURL: configuredApiUrl || fallbackApiUrl
});

api.interceptors.request.use((config) => {
  const session = getStoredSession();

  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      notifySessionExpired();
    }

    return Promise.reject(error);
  }
);
