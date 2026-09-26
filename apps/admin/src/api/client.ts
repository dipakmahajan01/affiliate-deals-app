import axios from 'axios';
import { useAuthStore } from '../store/auth';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://dealsapi-production.up.railway.app/v1';

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
