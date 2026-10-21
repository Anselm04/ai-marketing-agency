import axios from 'axios';

const BUSINESS_STORAGE_KEY = 'trillionai-marketing-business-id';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

function isBusinessScopedPath(url = '') {
  return url === '/campaigns'
    || url === '/products'
    || url === '/products/marketing'
    || /^\/products\/portfolio\/[^/]+\/activate$/.test(url)
    || url === '/crm/leads'
    || /^\/crm\/leads\/[^/]+$/.test(url)
    || url === '/content'
    || /^\/content\/[^/]+$/.test(url);
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const businessId = localStorage.getItem(BUSINESS_STORAGE_KEY);
  if (businessId && isBusinessScopedPath(config.url)) {
    const method = String(config.method || 'get').toLowerCase();
    if (method === 'get') {
      config.params = { ...(config.params || {}), businessId };
    } else if (config.data instanceof FormData) {
      if (!config.data.has('businessId')) config.data.append('businessId', businessId);
    } else if (config.data && typeof config.data === 'object') {
      config.data = { ...config.data, businessId };
    } else {
      config.data = { businessId };
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    if (
      error.response?.status === 402
      && error.response?.data?.code === 'marketing_entitlement_required'
      && !window.location.pathname.startsWith('/dashboard/billing')
    ) {
      window.location.href = '/dashboard/billing?access=required';
    }
    return Promise.reject(error);
  }
);

export default api;
