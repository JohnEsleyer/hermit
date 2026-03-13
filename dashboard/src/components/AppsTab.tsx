import { LayoutGrid, ExternalLink, Trash2 } from 'lucide-react';
import { Agent } from '../types';

interface AppsTabProps {
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  agents: Agent[];
}

export function AppsTab({ triggerToast, agents }: AppsTabProps) {
  const runningAgents = agents.filter(a => a.status === 'running');

  if (runningAgents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
        <div className="w-24 h-24 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center mb-6">
          <LayoutGrid className="w-8 h-8 opacity-50" />
        </div>
        <p className="text-lg font-medium">No apps published yet.</p>
        <p className="text-sm">Deploy an agent to start building apps.</p>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {runningAgents.map(agent => (
          <div key={agent.id} className="bg-black border border-zinc-800 rounded-[2.5rem] p-8 flex flex-col group hover:border-zinc-700 transition-colors">
            <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800">
              <LayoutGrid className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight mb-2">{agent.name} Apps</h3>
            <p className="text-sm text-zinc-500 mb-6">Published by <span className="text-zinc-300">{agent.name}</span></p>
            
            {agent.tunnelUrl ? (
              <>
                <div className="bg-zinc-950 rounded-xl p-3 mb-8 border border-zinc-800/50 flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-500 truncate mr-4">{agent.tunnelUrl}/apps/</span>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-3">
                  <button onClick={() => window.open(agent.tunnelUrl, '_blank')} className="bg-white text-black hover:bg-zinc-200 rounded-full py-3.5 text-xs font-bold transition-all flex items-center justify-center gap-2">
                    <ExternalLink className="w-4 h-4" /> Open URL
                  </button>
                  <button onClick={() => triggerToast(`Apps for ${agent.name}`)} className="bg-zinc-900 hover:bg-red-950/50 hover:text-red-400 text-white rounded-full py-3.5 text-xs font-bold transition-all flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-auto">
                <p className="text-sm text-zinc-500">No public URL available</p>
                <p className="text-xs text-zinc-600 mt-1">Agent needs a tunnel or domain to publish apps</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
