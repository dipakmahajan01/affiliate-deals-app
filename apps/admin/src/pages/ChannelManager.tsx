import { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Channel } from '@deals/types';
import { api } from '../api/client';

type TgChannel = { username: string; title: string };
type Toast = { id: number; message: string; type: 'success' | 'error' };

let toastId = 0;

export default function ChannelManager() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pollingChannels, setPollingChannels] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const qc = useQueryClient();

  function addToast(message: string, type: 'success' | 'error') {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  const { data } = useQuery<{ data: Channel[] }>({
    queryKey: ['admin', 'channels'],
    queryFn: () => api.get('/channels').then((r) => r.data),
  });

  const { data: tgData, isFetching: tgLoading, refetch: fetchTg } = useQuery<{ data: TgChannel[] }>({
    queryKey: ['admin', 'telegram-channels'],
    queryFn: () => api.get('/admin/telegram-channels').then((r) => r.data),
    enabled: false,
  });

  const add = useMutation({
    mutationFn: () => api.post('/admin/channels', { channel_username: username, display_name: displayName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'channels'] });
      setUsername('');
      setDisplayName('');
      addToast('Channel added successfully', 'success');
    },
    onError: () => addToast('Failed to add channel', 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/channels/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'channels'] });
      addToast('Channel removed', 'success');
    },
    onError: () => addToast('Failed to remove channel', 'error'),
  });

  const importChannels = useMutation({
    mutationFn: (channels: TgChannel[]) => api.post('/admin/channels/import', { channels }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'channels'] });
      setShowImport(false);
      setSelected(new Set());
      addToast('Channels imported successfully', 'success');
    },
    onError: () => addToast('Failed to import channels', 'error'),
  });

  async function handlePoll(channelUsername: string) {
    setPollingChannels((prev) => new Set(prev).add(channelUsername));
    try {
      await api.post('/admin/poll', { channel_username: channelUsername });
      qc.invalidateQueries({ queryKey: ['admin', 'channels'] });
      addToast(`Polled ${channelUsername} successfully`, 'success');
    } catch {
      addToast(`Failed to poll ${channelUsername}`, 'error');
    } finally {
      setPollingChannels((prev) => {
        const next = new Set(prev);
        next.delete(channelUsername);
        return next;
      });
    }
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (username && displayName) add.mutate();
  }

  function openImport() {
    setShowImport(true);
    fetchTg();
  }

  function toggleSelect(username: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(username) ? next.delete(username) : next.add(username);
      return next;
    });
  }

  function handleImport() {
    const channels = (tgData?.data ?? []).filter((c) => selected.has(c.username));
    if (channels.length > 0) importChannels.mutate(channels);
  }

  const existingUsernames = new Set((data?.data ?? []).map((c) => c.channel_username));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Channel Manager</h1>

      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-sm text-white font-medium transition-all ${
              t.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}
          >
            {t.type === 'success' ? '✓' : '✗'} {t.message}
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4 flex gap-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@channel_username"
          className="border rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:ring-2 focus:ring-orange-400"
          required
        />
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display Name"
          className="border rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:ring-2 focus:ring-orange-400"
          required
        />
        <button type="submit" disabled={add.isPending} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {add.isPending ? 'Adding…' : 'Add Channel'}
        </button>
      </form>

      <div className="mb-6">
        <button
          onClick={openImport}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Import from Telegram
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Display Name</th>
              <th className="px-4 py-3">Last Polled</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((ch) => {
              const isPolling = pollingChannels.has(ch.channel_username);
              return (
                <tr key={ch._id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">@{ch.channel_username}</td>
                  <td className="px-4 py-3">{ch.display_name}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {ch.last_polled_at ? new Date(ch.last_polled_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right flex gap-2 justify-end items-center">
                    <button
                      onClick={() => handlePoll(ch.channel_username)}
                      disabled={isPolling}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {isPolling ? (
                        <>
                          <svg className="animate-spin h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Polling…
                        </>
                      ) : (
                        'Poll now'
                      )}
                    </button>
                    <button
                      onClick={() => remove.mutate(ch._id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Import Telegram Channels</h2>

            {tgLoading && <p className="text-sm text-gray-500">Fetching channels from Telegram...</p>}

            {!tgLoading && tgData && (
              <>
                <p className="text-xs text-gray-400 mb-3">
                  {tgData.data.length} channels found. Already-added channels are greyed out.
                </p>
                <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
                  {tgData.data.map((ch) => {
                    const alreadyAdded = existingUsernames.has(ch.username);
                    return (
                      <label
                        key={ch.username}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer hover:bg-gray-50 ${alreadyAdded ? 'opacity-40 pointer-events-none' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(ch.username)}
                          onChange={() => toggleSelect(ch.username)}
                          className="accent-blue-600"
                          disabled={alreadyAdded}
                        />
                        <span className="flex-1 font-medium">{ch.title}</span>
                        <span className="font-mono text-xs text-gray-400">@{ch.username}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowImport(false); setSelected(new Set()); }}
                className="text-sm text-gray-500 hover:underline"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selected.size === 0 || importChannels.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {importChannels.isPending ? 'Importing...' : `Import ${selected.size > 0 ? `(${selected.size})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
