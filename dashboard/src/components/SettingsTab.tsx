import { useState, useEffect } from 'react';
import { Globe, Key, RefreshCw } from 'lucide-react';

const API_BASE = '';

interface SettingsTabProps {
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function SettingsTab({ triggerToast }: SettingsTabProps) {
  const [mode, setMode] = useState<'tunnel' | 'domain'>('tunnel');
  const [settings, setSettings] = useState({
    domainMode: false,
    domain: '',
    tunnelURL: '',
    tunnelHealthy: false,
    timezone: 'Asia/Manila',
    hasLLMKey: false,
  });
  const [saving, setSaving] = useState(false);
  const [apiKeys, setApiKeys] = useState({
    openrouterKey: '',
    openaiKey: '',
    anthropicKey: '',
    geminiKey: '',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/settings`);
        const data = await res.json();
        setSettings(data);
        setMode(data.domainMode ? 'domain' : 'tunnel');
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainMode: mode === 'domain' ? 'true' : 'false',
          domain: settings.domain,
          ...apiKeys,
          timezone: settings.timezone,
        }),
      });
      triggerToast('Settings saved successfully');
    } catch (err) {
      triggerToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const refreshTunnel = async () => {
    triggerToast('Refreshing tunnel...', 'info');
  };

  return (
    <div className="flex-1 flex flex-col gap-8 max-w-4xl">
      <div className="bg-black border border-zinc-800 rounded-[2.5rem] p-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><Globe className="w-6 h-6" /> Public URL Configuration</h2>
        
        <div className="flex gap-4 mb-8">
          <button onClick={() => setMode('tunnel')} className={`px-6 py-3 rounded-full font-bold text-sm transition-all ${mode === 'tunnel' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}>Cloudflare Tunnel</button>
          <button onClick={() => setMode('domain')} className={`px-6 py-3 rounded-full font-bold text-sm transition-all ${mode === 'domain' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}>Custom Domain</button>
        </div>

        {mode === 'tunnel' ? (
          <div className="space-y-4 animate-in fade-in">
            <p className="text-sm text-zinc-400">The system automatically orchestrates cloudflared CLI to create a tunnel URL for the dashboard and agents.</p>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Current Tunnel URL</div>
                <div className="font-mono text-emerald-400">{settings.tunnelURL || 'No tunnel active'}</div>
              </div>
              <button onClick={refreshTunnel} className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Refresh Tunnel
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-2">
              <div className={`w-2 h-2 rounded-full ${settings.tunnelHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'}`}></div>
              Tunnel health check: {settings.tunnelHealthy ? 'OK' : 'Disconnected'}
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in">
            <p className="text-sm text-zinc-400">Use your own domain or subdomain. The system will automatically configure Let's Encrypt for HTTPS.</p>
            <div>
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Base Domain</label>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={settings.domain}
                  onChange={e => setSettings({...settings, domain: e.target.value})}
                  placeholder="e.g. mydomain.com" 
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-zinc-600" 
                />
                <button className="bg-white text-black px-6 py-3 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-colors">Verify & Save</button>
              </div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mt-4">
              <div className="text-sm text-zinc-300 mb-2">DNS Configuration Instructions:</div>
              <ul className="text-xs text-zinc-500 list-disc list-inside space-y-1">
                <li>Point an A record for your domain to this server's IP address.</li>
                <li>Point a Wildcard A record (*.mydomain.com) for agent apps.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="bg-black border border-zinc-800 rounded-[2.5rem] p-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><Key className="w-6 h-6" /> API Keys</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">OpenRouter API Key (Free Models)</label>
            <input 
              type="password" 
              value={apiKeys.openrouterKey}
              onChange={e => setApiKeys({...apiKeys, openrouterKey: e.target.value})}
              placeholder="sk-or-..." 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-zinc-600" 
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">OpenAI API Key</label>
            <input 
              type="password" 
              value={apiKeys.openaiKey}
              onChange={e => setApiKeys({...apiKeys, openaiKey: e.target.value})}
              placeholder="sk-..." 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-zinc-600" 
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Anthropic API Key</label>
            <input 
              type="password" 
              value={apiKeys.anthropicKey}
              onChange={e => setApiKeys({...apiKeys, anthropicKey: e.target.value})}
              placeholder="sk-ant-..." 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-zinc-600" 
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Gemini API Key</label>
            <input 
              type="password" 
              value={apiKeys.geminiKey}
              onChange={e => setApiKeys({...apiKeys, geminiKey: e.target.value})}
              placeholder="AIza..." 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-zinc-600" 
            />
          </div>
          <div className="flex justify-end mt-4">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="bg-white text-black px-6 py-3 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Keys'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-black border border-zinc-800 rounded-[2.5rem] p-8">
        <h2 className="text-2xl font-bold mb-6">Time Zone</h2>
        <div>
          <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">System Time Zone</label>
          <select 
            value={settings.timezone}
            onChange={e => setSettings({...settings, timezone: e.target.value})}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-zinc-600"
          >
            <option value="Asia/Manila">Asia/Manila (PHT)</option>
            <option value="America/New_York">America/New York (EST)</option>
            <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
