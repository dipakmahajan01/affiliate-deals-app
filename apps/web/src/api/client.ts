import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({
  baseURL: '/v1',
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
