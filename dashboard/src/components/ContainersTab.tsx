import { useState, useEffect } from 'react';
import { Box, Terminal, Trash2, HardDrive } from 'lucide-react';
import { ContainerItem } from '../types';

const API_BASE = '';

interface ContainersTabProps {
  openModal: (modal: string, data: any) => void;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function ContainersTab({ openModal, triggerToast }: ContainersTabProps) {
  const [containers, setContainers] = useState<ContainerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContainers = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/containers`);
        const data = await res.json();
        setContainers(data);
      } catch (err) {
        console.error('Failed to fetch containers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContainers();
    const interval = setInterval(fetchContainers, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
        <div className="w-24 h-24 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center mb-6 animate-pulse">
          <Box className="w-8 h-8 opacity-50" />
        </div>
        <p className="text-lg font-medium">Loading containers...</p>
      </div>
    );
  }

  if (containers.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
        <div className="w-24 h-24 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center mb-6">
          <Box className="w-8 h-8 opacity-50" />
        </div>
        <p className="text-lg font-medium">No containers running</p>
        <p className="text-sm">Deploy an agent to create containers</p>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {containers.map(container => (
          <div key={container.id} className="bg-black border border-zinc-800 rounded-[2.5rem] p-8 flex flex-col">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-2xl font-black border border-zinc-800">
                {container.agentName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold">{container.agentName}</h3>
                <div className="text-xs text-zinc-500 font-mono mt-1">{container.id}</div>
              </div>
              <div className="ml-auto px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-zinc-900 text-emerald-400 border border-zinc-800/50 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                {container.status}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-8 bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">CPU</div>
                <div className="font-mono text-sm">{container.cpu.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Memory</div>
                <div className="font-mono text-sm">{container.memory.toFixed(0)} MB</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Uptime</div>
                <div className="font-mono text-sm">{container.uptime || '--'}</div>
              </div>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-3">
              <button onClick={() => openModal('workspace', container)} className="bg-zinc-900 hover:bg-white hover:text-black text-white rounded-full py-3.5 text-xs font-bold transition-all flex items-center justify-center gap-2">
                <HardDrive className="w-4 h-4" /> Workspace
              </button>
              <button onClick={() => triggerToast('Container deleted')} className="bg-red-950/30 hover:bg-red-900/50 text-red-400 rounded-full py-3.5 text-xs font-bold transition-all flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
