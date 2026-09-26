import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://dealsapi-production.up.railway.app/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach JWT to every request if the user is logged in
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function trackClickAndRedirect(
  id: string,
  collection: 'deals' | 'products' = 'deals',
  platform = 'web'
): Promise<void> {
  const { data } = await api.post(`/${collection}/${id}/click`, { platform });
  window.open(data.affiliateUrl, '_blank', 'noopener,noreferrer');
}
