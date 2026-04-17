import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const allowHandled401 = ['/auth/login', '/auth/change-password', '/auth/register', '/auth/me', '/auth/logout'].some((path) => requestUrl.includes(path));

    if (error.response?.status === 401 && !allowHandled401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
