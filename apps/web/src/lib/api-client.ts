import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const defaultApiUrl = typeof window !== 'undefined' ? '/api/v1' : 'http://localhost:4000/api/v1';
const API_URL =
  typeof window !== 'undefined' &&
  (process.env.NEXT_PUBLIC_API_URL === 'http://localhost:4000/api/v1' || !process.env.NEXT_PUBLIC_API_URL)
    ? '/api/v1'
    : process.env.NEXT_PUBLIC_API_URL || defaultApiUrl;

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Authentication is cookie-based. Access/refresh tokens are HttpOnly and must
// never be copied into localStorage or manually injected into Authorization.

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null) => {
  failedQueue.forEach((promise) => {
    if (error) promise.reject(error);
    else promise.resolve();
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    if (
      response.data &&
      typeof response.data === 'object' &&
      'success' in response.data &&
      'data' in response.data
    ) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => apiClient(originalRequest))
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // The server rotates and sets both HttpOnly cookies. The response body
      // intentionally does not expose either token to browser JavaScript.
      await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
      processQueue(null);
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError as AxiosError);
      if (typeof window !== 'undefined') {
        window.location.href = '/login?reason=session_expired';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
