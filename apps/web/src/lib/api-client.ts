import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const defaultApiUrl =
  typeof window !== 'undefined' ? '/api/v1' : 'http://localhost:4000/api/v1';
const API_URL =
  typeof window !== 'undefined' &&
  (process.env.NEXT_PUBLIC_API_URL === 'http://localhost:4000/api/v1' ||
    !process.env.NEXT_PUBLIC_API_URL)
    ? '/api/v1'
    : process.env.NEXT_PUBLIC_API_URL || defaultApiUrl;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Read a cookie value by name from document.cookie (browser-only). */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

/** Generate a RFC 4122-compliant v4 UUID for correlation IDs. */
function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
      .join('')
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  }
  return 'corr-' + Date.now().toString(36);
}

// ── Client ───────────────────────────────────────────────────────────────────

/**
 * EPIC-04: Unified authoritative API client.
 *
 * Features:
 * - HttpOnly cookie-based authentication (no token exposure to JS)
 * - Automatic 401 → silent refresh token rotation with request queue
 * - CSRF double-submit cookie (X-CSRF-Token header on mutating requests)
 * - Correlation ID header on every request (X-Correlation-ID)
 * - 30-second request timeout
 */
export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: correlation ID + CSRF ────────────────────────────

const STATE_MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Attach a unique correlation ID to every outbound request for tracing.
  config.headers['X-Correlation-ID'] = generateCorrelationId();

  // CSRF double-submit: attach the csrf_token cookie value as a header for all
  // state-mutating requests. The backend guard validates this to prevent CSRF.
  const method = (config.method ?? 'get').toLowerCase();
  if (STATE_MUTATING_METHODS.has(method)) {
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  return config;
});

// ── Response interceptor: unwrap envelope + 401 refresh ──────────────────

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
    // Transparently unwrap the standard { success: true, data: ..., meta: ... } envelope.
    if (
      response.data &&
      typeof response.data === 'object' &&
      'success' in response.data &&
      'data' in response.data
    ) {
      const payload = response.data.data;
      if (
        payload &&
        typeof payload === 'object' &&
        !Array.isArray(payload) &&
        payload.meta &&
        typeof payload.meta === 'object' &&
        ('total' in payload.meta || 'totalPages' in payload.meta)
      ) {
        response.data = {
          ...payload,
          total: payload.meta.total ?? (Array.isArray(payload.data) ? payload.data.length : 0),
          totalPages: payload.meta.totalPages ?? 1,
          page: payload.meta.page ?? 1,
          limit: payload.meta.limit ?? 25,
        };
      } else {
        response.data = payload;
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only attempt refresh for 401s on non-auth, non-retried requests.
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
      // Queue concurrent requests until the in-flight refresh completes.
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => apiClient(originalRequest))
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // The server rotates and sets both HttpOnly cookies on successful refresh.
      // The response body intentionally does not expose either token to JS.
      await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
      processQueue(null);
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError as AxiosError);
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login?reason=session_expired';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
