import axios from 'axios';
import { getToken } from './tokenService';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const apiBaseUrl = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:3000' : '');

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

// Interceptor to attach Authorization Bearer token & ensure x-xsrf-token is sent
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (typeof document !== 'undefined' && document.cookie) {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    if (match) {
      config.headers['x-xsrf-token'] = decodeURIComponent(match[1]);
    }
  }
  return config;
});

export default api;
