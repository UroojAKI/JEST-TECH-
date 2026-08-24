import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const defaultApiUrl = typeof window !== 'undefined' ? '/api/v1' : 'http://localhost:4000/api/v1';
const API_URL = (typeof window !== 'undefined' && (process.env.NEXT_PUBLIC_API_URL === 'http://localhost:4000/api/v1' || !process.env.NEXT_PUBLIC_API_URL))
  ? '/api/v1'
  : (process.env.NEXT_PUBLIC_API_URL || defaultApiUrl);

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // HttpOnly cookies exchange
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('jest_access_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: AxiosError | null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

// Response Interceptor for 401 Automatic Token Refresh
apiClient.interceptors.response.use(
  (response) => {
    // Automatically unwrap the standard { success, data, meta } envelope
    // used by the NestJS API's global response interceptor
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
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
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
        const refreshRes = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        if (typeof window !== 'undefined' && refreshRes.data?.accessToken) {
          document.cookie = `access_token=${refreshRes.data.accessToken}; path=/; max-age=900; SameSite=Lax`;
          localStorage.setItem('jest_access_token', refreshRes.data.accessToken);
        }
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError);
        // Force redirect to login on refresh failure
        if (typeof window !== 'undefined') {
          window.location.href = '/login?reason=session_expired';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
