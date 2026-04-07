import { useQuery } from '@tanstack/react-query';
import type { AdminStats } from '@deals/types';
import { api } from '../api/client';

export default function Dashboard() {
  const { data } = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const cards = [
    { label: 'Total Deals', value: data?.total_deals ?? '—' },
    { label: 'Active Deals', value: data?.active_deals ?? '—' },
    { label: 'Total Clicks', value: data?.total_clicks ?? '—' },
    { label: 'Clicks Today', value: data?.clicks_today ?? '—' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-3xl font-bold mt-1 text-orange-500">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-semibold mb-4">Top Deals</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-2">Product</th>
              <th className="pb-2 text-right">Clicks</th>
              <th className="pb-2 text-right">Views</th>
            </tr>
          </thead>
          <tbody>
            {(data?.top_deals ?? []).map((deal) => (
              <tr key={deal._id} className="border-b last:border-0">
                <td className="py-2 truncate max-w-xs">{deal.product_title}</td>
                <td className="py-2 text-right font-medium">{deal.clicks}</td>
                <td className="py-2 text-right text-gray-500">{deal.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
