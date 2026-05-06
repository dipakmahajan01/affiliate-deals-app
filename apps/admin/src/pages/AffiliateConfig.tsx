import { useState, useEffect, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AffiliateConfig as AffConfig } from '@deals/types';
import { api } from '../api/client';

export default function AffiliateConfig() {
  const [amazonTag, setAmazonTag] = useState('');
  const [flipkartId, setFlipkartId] = useState('');
  const [myntraSuffix, setMyntraSuffix] = useState('');
  const qc = useQueryClient();

  const { data } = useQuery<AffConfig>({
    queryKey: ['admin', 'affiliate-config'],
    queryFn: () => api.get('/admin/affiliate-config').then((r) => r.data),
  });

  useEffect(() => {
    if (data) {
      setAmazonTag(data.amazon_tag ?? '');
      setFlipkartId(data.flipkart_affid ?? '');
      setMyntraSuffix(data.myntra_affiliate_suffix ?? '');
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api.patch('/admin/affiliate-config', {
        amazon_tag: amazonTag,
        flipkart_affid: flipkartId,
        myntra_affiliate_suffix: myntraSuffix,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'affiliate-config'] }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Affiliate Config</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-lg flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium mb-1">Amazon Associates Tag</label>
          <input
            value={amazonTag}
            onChange={(e) => setAmazonTag(e.target.value)}
            placeholder="yourtag-21"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400"
          />
          <p className="text-xs text-gray-400 mt-1">Appended as ?tag=yourtag-21 to all Amazon URLs</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Flipkart Affiliate ID</label>
          <input
            value={flipkartId}
            onChange={(e) => setFlipkartId(e.target.value)}
            placeholder="youraffid"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400"
          />
          <p className="text-xs text-gray-400 mt-1">Appended as ?affid=youraffid to all Flipkart URLs</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Myntra URL suffix (optional)</label>
          <input
            value={myntraSuffix}
            onChange={(e) => setMyntraSuffix(e.target.value)}
            placeholder="utm_source=…&utm_medium=…"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400"
          />
          <p className="text-xs text-gray-400 mt-1">
            Appended to resolved myntra.com product URLs. Leave empty to keep incoming short links (e.g. myntr.in)
            when messages use them.
          </p>
        </div>

        <button
          type="submit"
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded-lg"
        >
          {save.isPending ? 'Saving…' : 'Save Config'}
        </button>

        {save.isSuccess && <p className="text-green-600 text-sm">Saved successfully.</p>}
      </form>
    </div>
  );
}
