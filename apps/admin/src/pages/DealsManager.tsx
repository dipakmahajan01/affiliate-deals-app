import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Deal, PaginatedResponse } from '@deals/types';
import { api } from '../api/client';

export default function DealsManager() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data } = useQuery<PaginatedResponse<Deal>>({
    queryKey: ['admin', 'deals', page],
    queryFn: () => api.get(`/admin/deals?page=${page}&limit=50`).then((r) => r.data),
  });

  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/admin/deals/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'deals'] }),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Deals Manager</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Clicks</th>
              <th className="px-4 py-3 text-center">Active</th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((deal) => (
              <tr key={deal._id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 max-w-xs truncate">{deal.product_title}</td>
                <td className="px-4 py-3 font-medium">₹{deal.price}</td>
                <td className="px-4 py-3">{deal.source}</td>
                <td className="px-4 py-3">{deal.category}</td>
                <td className="px-4 py-3 text-right">{deal.clicks}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggle.mutate({ id: deal._id, is_active: !deal.is_active })}
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      deal.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {deal.is_active ? 'Active' : 'Off'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 mt-4 justify-end">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
          className="px-3 py-1 text-sm border rounded disabled:opacity-40">Prev</button>
        <span className="text-sm self-center">Page {page}</span>
        <button onClick={() => setPage((p) => p + 1)} disabled={!data?.hasMore}
          className="px-3 py-1 text-sm border rounded disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
