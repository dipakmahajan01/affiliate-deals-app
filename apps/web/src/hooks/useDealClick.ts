import { useNavigate, useLocation } from 'react-router-dom';
import { trackClickAndRedirect } from '../api/client';
import { useAuthStore } from '../store/authStore';

export function useDealClick() {
  const navigate = useNavigate();
  const location = useLocation();

  return async function handleDealClick(
    id: string,
    collection: 'deals' | 'products' = 'deals'
  ) {
    const token = useAuthStore.getState().token;
    if (!token) {
      const next = encodeURIComponent(
        location.pathname + location.search + `#deal=${collection}:${id}`
      );
      navigate(`/login?next=${next}`, {
        state: { reason: 'Please sign in or create an account to grab this deal.' },
      });
      return;
    }
    await trackClickAndRedirect(id, collection);
  };
}
