import { Agent } from '../types';
import { RefreshCw, Trash2, MessageSquare, Key, FileCode, History } from 'lucide-react';

interface AgentsTabProps {
  agents: Agent[];
  openModal: (modal: string, agent: Agent) => void;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  fetchAgents: () => void;
}

export function AgentsTab({ agents, openModal, triggerToast, fetchAgents }: AgentsTabProps) {
  const handleDelete = async (agent: Agent) => {
    if (!confirm(`Delete agent ${agent.name}?`)) return;
    try {
      await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
      triggerToast(`Agent ${agent.name} deleted`);
      fetchAgents();
    } catch (err) {
      triggerToast('Failed to delete agent', 'error');
    }
  };

  if (!agents || agents.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-zinc-500">
        <div className="w-24 h-24 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
        </div>
        <p className="text-lg font-medium">No agents deployed yet.</p>
        <p className="text-sm">Click "deploy new agent" to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {agents.map(agent => (
          <div key={agent.id} className="bg-zinc-950 border border-zinc-800 rounded-[2rem] overflow-hidden hover:border-zinc-700 transition-all duration-300 shadow-xl">
            {/* Banner */}
            <div className="h-20 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 relative">
              {agent.bannerUrl && (
                <img src={agent.bannerUrl} alt={`${agent.name} banner`} className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-black/30" />
            </div>

            {/* Content */}
            <div className="p-6 -mt-8 relative">
              {/* Profile Picture - hovering over banner */}
              <div className="absolute -top-2 left-6 w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center text-xl font-bold border-2 border-zinc-800 overflow-hidden shadow-lg shrink-0 z-10">
                {agent.profilePic ? (
                  <img src={agent.profilePic} alt={agent.name} className="w-full h-full object-cover" onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${agent.name}&background=111&color=fff`;
                  }} />
                ) : (
                  <span className="text-zinc-600">{agent.name.charAt(0).toUpperCase()}</span>
                )}
              </div>

              {/* Header info */}
              <div className="flex justify-between items-start mb-6 pt-2">
                <div className="flex-1 min-w-0 ml-20">
                  <h3 className="text-lg font-bold text-white truncate">{agent.name}</h3>
                  <p className="text-xs text-zinc-500 truncate">{agent.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  {agent.status === 'standby' ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-yellow-400" />
                      <span className="text-[10px] text-yellow-400 uppercase font-bold tracking-widest">Setting up</span>
                    </>
                  ) : (
                    <>
                      <span className={`w-2 h-2 rounded-full ${agent.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{agent.status}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Info Grid */}
              <div className="flex flex-col gap-3 mb-6 bg-black/40 p-4 rounded-xl border border-zinc-800/50">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] mb-1 font-bold">Provider</div>
                    <div className="text-xs text-zinc-400 font-mono truncate">{agent.provider || 'Not set'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] mb-1 font-bold">Model</div>
                    <div className="text-xs text-zinc-400 font-mono truncate">{agent.model || 'Not set'}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-auto flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => openModal('testConsole', agent)}
                  className="h-10 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Chat/Test
                </button>
                <button
                  onClick={() => openModal('skills', agent)}
                  className="h-10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-zinc-800"
                >
                  <Key className="w-3.5 h-3.5" /> Skills
                </button>
                <button
                  onClick={() => openModal('configure', agent)}
                  className="h-10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-zinc-800"
                >
                  <FileCode className="w-3.5 h-3.5" /> Configure
                </button>
                <button
                  onClick={() => openModal('logs', agent)}
                  className="h-10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-zinc-800"
                >
                  <History className="w-3.5 h-3.5" /> History
                </button>
              </div>
              <button
                onClick={() => handleDelete(agent)}
                className="w-full h-9 rounded-xl text-[10px] font-bold text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-all border border-red-500/10 flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <Trash2 className="w-3 h-3" /> Delete Agent
              </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
