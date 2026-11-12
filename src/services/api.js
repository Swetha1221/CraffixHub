import axios from 'axios';
import { dispatchLocalRequest } from './localRouter';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  adapter: async (config) => {
    try {
      const result = await dispatchLocalRequest(config);
      return {
        data: result.data,
        status: result.status || 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    } catch (err) {
      const status = err.statusCode || 500;
      const error = new axios.AxiosError(
        err.message || 'Request failed',
        'ERR_BAD_REQUEST',
        config,
        null,
        {
          data: { success: false, message: err.message || 'Request failed' },
          status,
          statusText: 'Error',
          headers: {},
          config,
        }
      );
      throw error;
    }
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cfx_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('cfx_access_token');
      localStorage.removeItem('cfx_refresh_token');
      localStorage.removeItem('cfx_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
