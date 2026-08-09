import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor: attach auth token and request ID
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Add request ID for tracing
    config.headers['X-Request-ID'] = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle auth errors, retry on transient failures
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 401 Unauthorized: clear token and redirect
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // 429 Rate Limit: retry after delay
    if (error.response?.status === 429 && !originalRequest._retry) {
      originalRequest._retry = true;
      const delay = parseInt(error.response.headers['retry-after'], 10) || 2000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return api(originalRequest);
    }

    // 502/503/504 Gateway errors: retry once with exponential backoff
    if ([502, 503, 504].includes(error.response?.status) && !originalRequest._retry) {
      originalRequest._retry = true;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return api(originalRequest);
    }

    // Network errors: retry once
    if (!error.response && !originalRequest._retry) {
      originalRequest._retry = true;
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default api;
