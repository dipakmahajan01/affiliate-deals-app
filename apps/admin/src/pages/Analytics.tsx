import { useQuery } from '@tanstack/react-query';
import type { AdminStats } from '@deals/types';
import { api } from '../api/client';

export default function Analytics() {
  const { data } = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    refetchInterval: 60_000,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Clicks" value={data?.total_clicks} />
        <StatCard label="Total Views" value={data?.total_views} />
        <StatCard label="Clicks Today" value={data?.clicks_today} />
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-semibold mb-4">Top Performing Deals</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b text-xs uppercase">
              <th className="pb-2">#</th>
              <th className="pb-2">Product</th>
              <th className="pb-2 text-right">Clicks</th>
              <th className="pb-2 text-right">Views</th>
              <th className="pb-2 text-right">CTR</th>
            </tr>
          </thead>
          <tbody>
            {(data?.top_deals ?? []).map((deal, i) => {
              const ctr = deal.views ? ((deal.clicks / deal.views) * 100).toFixed(1) : '—';
              return (
                <tr key={deal._id} className="border-b last:border-0">
                  <td className="py-2 text-gray-400">{i + 1}</td>
                  <td className="py-2 truncate max-w-xs">{deal.product_title}</td>
                  <td className="py-2 text-right font-medium text-orange-500">{deal.clicks}</td>
                  <td className="py-2 text-right text-gray-500">{deal.views}</td>
                  <td className="py-2 text-right text-gray-500">{ctr}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-1 text-orange-500">{value?.toLocaleString() ?? '—'}</p>
    </div>
  );
}
