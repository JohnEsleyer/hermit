import { useState, useEffect, useRef } from 'react';
import { X, History, MessageSquare, Bot, Cpu } from 'lucide-react';
import { Agent } from '../../types';

const API_BASE = '';

interface LogsModalProps {
  agent: Agent;
  onClose: () => void;
}

interface HistoryEntry {
  id: number;
  agent_id: number;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export function LogsModal({ agent, onClose }: LogsModalProps) {
  const [logs, setLogs] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/agents/${agent.id}/logs`);
        const data = await res.json();
        // Since we fetch with LIMIT 100 DESC, we reverse it to show in chronological order
        setLogs((data || []).reverse());
      } catch (err) {
        console.error('Failed to fetch logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [agent.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl h-[min(85vh,900px)] rounded-[2.5rem] relative flex flex-col shadow-2xl overflow-hidden">

        <div className="p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/30">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <History className="w-6 h-6 text-emerald-400" /> Chat History: {agent.name}
            </h2>
            <p className="text-sm text-zinc-500 mt-1 lowercase">Viewing last 100 interactions with users via Telegram</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 bg-zinc-800/50 hover:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all border border-zinc-700/50">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 bg-[#050505] p-8 overflow-y-auto flex flex-col gap-6" ref={scrollRef}>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-500">
              <div className="w-8 h-8 border-2 border-zinc-800 border-t-white rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Synchronizing history...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-4">
              <div className="w-16 h-16 rounded-full bg-zinc-900/50 flex items-center justify-center border border-zinc-800">
                <MessageSquare className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-lg font-medium lowercase">No interactions found yet</p>
            </div>
          ) : (
            logs.map(log => (
              <div key={log.id} className={`flex flex-col gap-2 max-w-[85%] animate-in slide-in-from-bottom-2 duration-300 ${log.role === 'user' ? 'self-start' : log.role === 'system' ? 'self-center w-full max-w-full' : 'self-end items-end'
                }`}>
                <div className="flex items-center gap-2 px-1">
                  {log.role === 'user' && <MessageSquare className="w-3 h-3 text-blue-400" />}
                  {log.role === 'assistant' && <Bot className="w-3 h-3 text-yellow-400" />}
                  {log.role === 'system' && <Cpu className="w-3 h-3 text-emerald-400" />}
                  <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                    {log.role === 'user' ? `User (${log.user_id})` : log.role} • {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <div className={`p-4 rounded-3xl border font-mono text-sm whitespace-pre-wrap ${log.role === 'user' ? 'bg-blue-950/20 border-blue-900/30 text-blue-100/90 rounded-tl-none' :
                    log.role === 'assistant' ? 'bg-yellow-950/20 border-yellow-900/30 text-yellow-100/90 rounded-tr-none' :
                      'bg-emerald-950/10 border-emerald-900/20 text-emerald-200/70 text-center text-xs italic'
                  }`}>
                  {log.content}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-zinc-900/20 border-t border-zinc-800 flex justify-center">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500/50 border border-blue-400"></div>
              <span className="text-[10px] uppercase font-bold text-zinc-500">User</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500/50 border border-yellow-400"></div>
              <span className="text-[10px] uppercase font-bold text-zinc-500">Agent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500/50 border border-emerald-400"></div>
              <span className="text-[10px] uppercase font-bold text-zinc-500">System</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

