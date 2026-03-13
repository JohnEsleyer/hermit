import { useState } from 'react';
import { X, Settings2 } from 'lucide-react';
import { Agent } from '../../types';

const API_BASE = '';

interface ConfigureModalProps {
  agent: Agent;
  onClose: () => void;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function ConfigureModal({ agent, onClose, triggerToast }: ConfigureModalProps) {
  const [formData, setFormData] = useState({
    name: agent.name,
    role: agent.role,
    personality: agent.personality || '',
    provider: agent.provider || 'openrouter',
  });

  const handleSave = async () => {
    try {
      await fetch(`${API_BASE}/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      triggerToast('Agent configuration saved');
      onClose();
    } catch (err) {
      triggerToast('Failed to save', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-in fade-in duration-300">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-[3.5rem] p-12 relative flex flex-col shadow-2xl">
        <button onClick={onClose} className="absolute top-10 right-10 w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-500 hover:text-white transition-all">
          <X className="w-6 h-6" />
        </button>
        
        <h2 className="text-3xl font-black text-white mb-2 flex items-center gap-3 lowercase">
          <Settings2 className="w-8 h-8" /> configure {agent.name}
        </h2>
        <p className="text-zinc-500 text-sm lowercase mb-10 border-b border-zinc-800 pb-8">update agent settings and connections</p>
        
        <div className="space-y-6 flex-1">
          <div>
            <label className="block text-sm text-zinc-400 mb-2 ml-4">Agent Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-full px-8 py-4 text-white outline-none focus:border-zinc-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2 ml-4">Role</label>
            <input type="text" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-full px-8 py-4 text-white outline-none focus:border-zinc-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2 ml-4">Personality</label>
            <input type="text" value={formData.personality} onChange={e => setFormData({...formData, personality: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-full px-8 py-4 text-white outline-none focus:border-zinc-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2 ml-4">LLM Provider</label>
            <select value={formData.provider} onChange={e => setFormData({...formData, provider: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-full px-8 py-4 text-white outline-none focus:border-zinc-500 transition-colors appearance-none">
              <option value="openrouter">OpenRouter (Free Models Only)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-10 mt-auto">
          <button onClick={handleSave} className="bg-white text-black px-10 py-4 rounded-full font-bold hover:bg-zinc-200 transition-colors">save changes</button>
        </div>
      </div>
    </div>
  );
}
