import { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, User } from 'lucide-react';
import { AllowlistEntry } from '../types';

const API_BASE = '';

interface AllowlistTabProps {
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function AllowlistTab({ triggerToast }: AllowlistTabProps) {
  const [entries, setEntries] = useState<AllowlistEntry[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newEntry, setNewEntry] = useState({ telegramUserId: '', friendlyName: '', notes: '' });
  const [loading, setLoading] = useState(true);

  const fetchEntries = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/allowlist`);
      const data = await res.json();
      setEntries(data);
    } catch (err) {
      console.error('Failed to fetch allowlist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleCreate = async () => {
    if (!newEntry.telegramUserId || !newEntry.friendlyName) {
      triggerToast('Please fill required fields', 'error');
      return;
    }
    try {
      await fetch(`${API_BASE}/api/allowlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry),
      });
      triggerToast('User added to allowlist');
      setShowCreate(false);
      setNewEntry({ telegramUserId: '', friendlyName: '', notes: '' });
      fetchEntries();
    } catch (err) {
      triggerToast('Failed to add user', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this user from allowlist?')) return;
    try {
      await fetch(`${API_BASE}/api/allowlist/${id}`, { method: 'DELETE' });
      triggerToast('User removed from allowlist');
      fetchEntries();
    } catch (err) {
      triggerToast('Failed to remove user', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
        <div className="w-24 h-24 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center mb-6 animate-pulse">
          <Shield className="w-8 h-8 opacity-50" />
        </div>
        <p className="text-lg font-medium">Loading allowlist...</p>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <div className="flex justify-between items-center mb-6">
        <p className="text-zinc-400 text-sm">Telegram users allowed to interact with agents</p>
        <button 
          onClick={() => setShowCreate(true)}
          className="bg-white text-black px-6 py-3 rounded-full font-bold text-sm hover:bg-zinc-200 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-zinc-500 py-20">
          <Shield className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">No users in allowlist</p>
          <p className="text-sm">Add Telegram users to restrict agent access</p>
        </div>
      ) : (
        <div className="bg-black border border-zinc-800 rounded-[2.5rem] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left p-6 text-xs text-zinc-500 uppercase tracking-wider">User</th>
                <th className="text-left p-6 text-xs text-zinc-500 uppercase tracking-wider">Telegram ID</th>
                <th className="text-left p-6 text-xs text-zinc-500 uppercase tracking-wider">Notes</th>
                <th className="text-right p-6 text-xs text-zinc-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-zinc-400" />
                      </div>
                      <span className="font-bold">{entry.friendlyName}</span>
                    </div>
                  </td>
                  <td className="p-6 font-mono text-sm text-zinc-400">{entry.telegramUserId}</td>
                  <td className="p-6 text-sm text-zinc-500">{entry.notes || '-'}</td>
                  <td className="p-6 text-right">
                    <button 
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-[2.5rem] p-8">
            <h3 className="text-2xl font-bold mb-6">Add User to Allowlist</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Telegram User ID *</label>
                <input 
                  type="text" 
                  value={newEntry.telegramUserId}
                  onChange={e => setNewEntry({...newEntry, telegramUserId: e.target.value})}
                  placeholder="e.g. 123456789"
                  className="w-full bg-black border border-zinc-800 rounded-full px-6 py-3 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Friendly Name *</label>
                <input 
                  type="text" 
                  value={newEntry.friendlyName}
                  onChange={e => setNewEntry({...newEntry, friendlyName: e.target.value})}
                  placeholder="e.g. John Doe"
                  className="w-full bg-black border border-zinc-800 rounded-full px-6 py-3 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Notes</label>
                <input 
                  type="text" 
                  value={newEntry.notes}
                  onChange={e => setNewEntry({...newEntry, notes: e.target.value})}
                  placeholder="Optional notes"
                  className="w-full bg-black border border-zinc-800 rounded-full px-6 py-3 text-white"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 text-zinc-400 hover:text-white">Cancel</button>
              <button onClick={handleCreate} className="flex-1 bg-white text-black py-3 rounded-full font-bold">Add User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
