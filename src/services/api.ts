import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: (
    import.meta.env.VITE_API_BASE_URL ||
    'http://127.0.0.1:8000'
  ).replace(/\/+$/, ''),
  timeout: 30000,
});

export function apiErrorMessage(
  error: unknown,
  fallback = 'An unexpected error occurred.'
): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      detail?: unknown;
      message?: unknown;
      error?: unknown;
    }>;

    // Network / no response
    if (!axiosError.response) {
      if (axiosError.code === 'ECONNABORTED') {
        return 'The request timed out. Please try again.';
      }
      if (
        axiosError.code === 'ERR_NETWORK' ||
        axiosError.message === 'Network Error'
      ) {
        return 'Cannot connect to the server. Check that the backend is running and the API URL is correct.';
      }
      return 'Cannot connect to the server. Check your API URL and connection.';
    }

    const data = axiosError.response.data;

    if (typeof data === 'string' && data.trim()) {
      return data;
    }

    if (data && typeof data === 'object') {
      if (typeof data.message === 'string' && data.message.trim()) {
        return data.message;
      }

      if (typeof data.error === 'string' && data.error.trim()) {
        return data.error;
      }

      if (typeof data.detail === 'string' && data.detail.trim()) {
        return data.detail;
      }

      if (Array.isArray(data.detail)) {
        const messages = data.detail.map((item: unknown) => {
          if (typeof item === 'string') return item;

          if (item && typeof item === 'object') {
            const issue = item as {
              msg?: string;
              loc?: unknown[];
            };

            const field = Array.isArray(issue.loc)
              ? issue.loc.filter((part) => part !== 'body').join('.')
              : '';

            const message = issue.msg || 'Invalid input';

            return field ? `${field}: ${message}` : message;
          }

          return String(item);
        });

        if (messages.length) {
          return messages.join('; ');
        }
      }
    }

    return axiosError.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

// ---------------------------------------------------------
// Request interceptor
// ---------------------------------------------------------
api.interceptors.request.use(
  (config) => {
    // Auth token
    if (typeof window !== 'undefined') {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('access_token');

      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
      }
    }

    // CRITICAL: when sending FormData, remove Content-Type
    // so the browser can set multipart/form-data; boundary=...
    if (config.data instanceof FormData) {
      // Axios v1 uses AxiosHeaders
      if (config.headers && typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
      } else if (config.headers) {
        delete (config.headers as any)['Content-Type'];
        delete (config.headers as any)['content-type'];
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------
// Response interceptor
// ---------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined'
    ) {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      localStorage.removeItem('admin');

      window.dispatchEvent(new Event('user_session_expired'));
    }

    return Promise.reject(error);
  }
);

export { api };
export default api;