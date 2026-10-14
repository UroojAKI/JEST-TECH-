import axios from 'axios';
import { useAuthStore } from '@/store/auth';

const defaultApiUrl = typeof window !== 'undefined' ? '/api/v1' : 'http://localhost:4000/api/v1';
const API_URL = (typeof window !== 'undefined' && (process.env.NEXT_PUBLIC_API_URL === 'http://localhost:4000/api/v1' || !process.env.NEXT_PUBLIC_API_URL))
  ? '/api/v1'
  : (process.env.NEXT_PUBLIC_API_URL || defaultApiUrl);

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // Only attempt refresh for 401s on non-auth, non-retried requests
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      try {
        await api.post('/auth/refresh', {}, { withCredentials: true });
        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails, clear auth state
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login?reason=session_expired';
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
