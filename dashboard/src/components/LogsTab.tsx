import { useState, useEffect, useMemo } from 'react';
import { FileText, Server, Bot, Box, Network, RefreshCw, Search, ChevronDown, ChevronRight, User, Terminal, Globe, Container, File, ArrowRight, Send, Play, Pause, XCircle, CheckCircle, AlertCircle, Folder, Download } from 'lucide-react';

const API_BASE = '';

interface LogEntry {
  id: number;
  agent_id: number;
  agent_name: string;
  agent_pic: string;
  user_id: string;
  action: string;
  details: string;
  created_at: string;
}

type LogCategory = 'all' | 'system' | 'agent' | 'docker' | 'network';

const CATEGORY_COLORS = {
  system: { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300' },
  agent: { text: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', badge: 'bg-yellow-500/20 text-yellow-300' },
  docker: { text: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10', badge: 'bg-blue-500/20 text-blue-300' },
  network: { text: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10', badge: 'bg-purple-500/20 text-purple-300' },
};

function getCategoryFromAction(action: string): LogCategory {
  if (!action) return 'system';
  if (action.startsWith('system')) return 'system';
  if (action.startsWith('agent') || action.startsWith('telegram') || action.startsWith('llm')) return 'agent';
  if (action.startsWith('docker') || action.startsWith('container')) return 'docker';
  if (action.startsWith('tunnel') || action.startsWith('network') || action.startsWith('llm_request')) return 'network';
  return 'system';
}

function getCategoryColor(action: string) {
  const category = getCategoryFromAction(action);
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.system;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function ProfilePic({ src, name, size = 'md' }: { src?: string; name?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  const initial = name ? name.charAt(0).toUpperCase() : '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Agent'}
        className={`${sizeClasses[size]} rounded-lg object-cover bg-zinc-700`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center font-bold text-zinc-300`}>
      {initial}
    </div>
  );
}

function AgentLogItem({ log, isExpanded, onToggle }: { log: LogEntry; isExpanded: boolean; onToggle: () => void }) {
  const colors = getCategoryColor(log.action);
  const isTruncated = log.details && log.details.length > 150;

  return (
    <div
      className={`p-4 rounded-2xl border ${colors.border} ${colors.bg} transition-all ${isExpanded ? 'ring-1 ring-white/20' : ''}`}
    >
      <div className="flex items-start gap-3">
        <ProfilePic src={log.agent_pic} name={log.agent_name} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm">{log.agent_name || 'Unknown Agent'}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${colors.badge}`}>
                {log.action}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isTruncated && (
                <button
                  onClick={onToggle}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  ) : (
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  )}
                </button>
              )}
              <span className="text-[10px] opacity-50 font-mono">
                {formatTime(log.created_at)}
              </span>
            </div>
          </div>
          <div className={`text-sm text-zinc-300 whitespace-pre-wrap ${!isExpanded ? 'line-clamp-3' : ''}`} style={!isExpanded ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}}>
            {log.details}
          </div>
          {log.user_id && (
            <div className="text-[10px] opacity-50 flex items-center gap-1 mt-2">
              <User className="w-3 h-3" />
              User: {log.user_id}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SystemLogItem({ log, isExpanded, onToggle }: { log: LogEntry; isExpanded: boolean; onToggle: () => void }) {
  const colors = getCategoryColor(log.action);
  const isTruncated = log.details && log.details.length > 150;

  const isFileTransfer = log.action === 'action_give';
  const fileMatch = log.details ? log.details.match(/File: (.+)/) : null;
  const filename = fileMatch ? fileMatch[1] : null;

  return (
    <div
      className={`p-4 rounded-2xl border ${colors.border} ${colors.bg} transition-all ${isExpanded ? 'ring-1 ring-white/20' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1">
          {isFileTransfer ? (
            <>
              <ProfilePic src={log.agent_pic} name={log.agent_name} size="sm" />
              <ArrowRight className="w-3 h-3 text-zinc-500" />
              <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center">
                <File className="w-3 h-3 text-blue-400" />
              </div>
              <ArrowRight className="w-3 h-3 text-zinc-500" />
              <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="#229ED9"/>
                </svg>
              </div>
            </>
          ) : (
            <Server className="w-5 h-5 text-emerald-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {isFileTransfer ? (
                <span className="text-sm">
                  <span className="font-semibold text-white">{log.agent_name || 'Agent'}</span>
                  <span className="text-zinc-400"> sending file to </span>
                  <span className="font-semibold text-blue-400">Telegram {log.user_id}</span>
                </span>
              ) : (
                <>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${colors.text}`}>
                    {log.action}
                  </span>
                  {log.agent_id > 0 && (
                    <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-800/50 text-zinc-400">
                      Agent: {log.agent_name || log.agent_id}
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isTruncated && (
                <button
                  onClick={onToggle}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  ) : (
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  )}
                </button>
              )}
              <span className="text-[10px] opacity-50 font-mono">
                {formatTime(log.created_at)}
              </span>
            </div>
          </div>
          {isFileTransfer && filename ? (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <File className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-zinc-300 font-mono">{filename}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-500" />
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="#229ED9"/>
                </svg>
                <span className="text-sm text-blue-400 font-mono">{log.user_id}</span>
              </div>
            </div>
          ) : (
            <div className={`text-sm font-mono text-zinc-300 whitespace-pre-wrap ${!isExpanded ? 'line-clamp-3' : ''}`} style={!isExpanded ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}}>
              {log.details}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DockerLogItem({ log, isExpanded, onToggle }: { log: LogEntry; isExpanded: boolean; onToggle: () => void }) {
  const colors = getCategoryColor(log.action);
  const isTruncated = log.details && log.details.length > 150;

  const getDockerIcon = () => {
    if (log.action.includes('start') && !log.action.includes('fail')) return <Play className="w-4 h-4 text-emerald-400" />;
    if (log.action.includes('stop')) return <Pause className="w-4 h-4 text-yellow-400" />;
    if (log.action.includes('fail') || log.action.includes('error')) return <XCircle className="w-4 h-4 text-red-400" />;
    if (log.action.includes('delete') || log.action.includes('remove')) return <XCircle className="w-4 h-4 text-red-400" />;
    if (log.action.includes('create')) return <CheckCircle className="w-4 h-4 text-blue-400" />;
    if (log.action.includes('reset')) return <RefreshCw className="w-4 h-4 text-purple-400" />;
    return <Container className="w-4 h-4 text-blue-400" />;
  };

  const getStatusText = () => {
    if (log.action.includes('container_created') || log.action === 'docker.container_start') return 'started';
    if (log.action.includes('container_stopped')) return 'stopped';
    if (log.action.includes('container_start_failed') || log.action.includes('container_creation_failed')) return 'failed to start';
    if (log.action.includes('container_deleted')) return 'deleted';
    if (log.action.includes('container_reset')) return 'reset';
    if (log.action.includes('container_reset_failed')) return 'reset failed';
    return '';
  };

  const status = getStatusText();

  return (
    <div
      className={`p-4 rounded-2xl border ${colors.border} ${colors.bg} transition-all ${isExpanded ? 'ring-1 ring-white/20' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
          {getDockerIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm">{log.agent_name || 'Container'}</span>
              {status && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  status === 'started' || status === 'created' ? 'bg-emerald-500/20 text-emerald-300' :
                  status === 'stopped' ? 'bg-yellow-500/20 text-yellow-300' :
                  status.includes('fail') || status === 'deleted' ? 'bg-red-500/20 text-red-300' :
                  'bg-blue-500/20 text-blue-300'
                }`}>
                  {status}
                </span>
              )}
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${colors.badge}`}>
                Docker
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isTruncated && (
                <button
                  onClick={onToggle}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  ) : (
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  )}
                </button>
              )}
              <span className="text-[10px] opacity-50 font-mono">
                {formatTime(log.created_at)}
              </span>
            </div>
          </div>
          <div className={`text-sm font-mono text-zinc-300 whitespace-pre-wrap ${!isExpanded ? 'line-clamp-3' : ''}`} style={!isExpanded ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}}>
            {log.details}
          </div>
          {log.agent_id > 0 && (
            <div className="text-[10px] opacity-50 flex items-center gap-1 mt-2">
              <Bot className="w-3 h-3" />
              Agent: {log.agent_name || log.agent_id}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NetworkLogItem({ log, isExpanded, onToggle }: { log: LogEntry; isExpanded: boolean; onToggle: () => void }) {
  const colors = getCategoryColor(log.action);
  const isTruncated = log.details && log.details.length > 150;

  const parseNetworkLog = () => {
    const details = log.details || '';
    const providerMatch = details.match(/Provider: ([^,]+)/);
    const modelMatch = details.match(/Model: ([^,]+)/);
    const messagesMatch = details.match(/Messages: (\d+)/);
    
    return {
      provider: providerMatch ? providerMatch[1] : null,
      model: modelMatch ? modelMatch[1] : null,
      messages: messagesMatch ? messagesMatch[1] : null,
      raw: details,
    };
  };

  const network = parseNetworkLog();

  return (
    <div
      className={`p-4 rounded-2xl border ${colors.border} ${colors.bg} transition-all ${isExpanded ? 'ring-1 ring-white/20' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
          <Globe className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase font-bold tracking-wider ${colors.text}`}>
                {log.action.includes('llm_request') ? 'LLM Request' : 'Network'}
              </span>
              {log.agent_id > 0 && (
                <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-800/50 text-zinc-400">
                  Agent: {log.agent_name || log.agent_id}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isTruncated && (
                <button
                  onClick={onToggle}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  ) : (
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  )}
                </button>
              )}
              <span className="text-[10px] opacity-50 font-mono">
                {formatTime(log.created_at)}
              </span>
            </div>
          </div>
          {network.provider || network.model ? (
            <div className="space-y-2 mt-1">
              <div className="flex flex-wrap gap-2">
                {network.provider && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <Server className="w-3 h-3 text-purple-400" />
                    <span className="text-xs text-purple-300 font-mono">{network.provider}</span>
                  </div>
                )}
                {network.model && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
                    <Bot className="w-3 h-3 text-zinc-400" />
                    <span className="text-xs text-zinc-300 font-mono">{network.model}</span>
                  </div>
                )}
                {network.messages && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
                    <FileText className="w-3 h-3 text-zinc-400" />
                    <span className="text-xs text-zinc-300 font-mono">{network.messages} messages</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={`text-sm font-mono text-zinc-300 whitespace-pre-wrap ${!isExpanded ? 'line-clamp-3' : ''}`} style={!isExpanded ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}}>
              {log.details}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogItem({ log, isExpanded, onToggle }: { log: LogEntry; isExpanded: boolean; onToggle: () => void }) {
  const category = getCategoryFromAction(log.action);

  switch (category) {
    case 'agent':
      return <AgentLogItem log={log} isExpanded={isExpanded} onToggle={onToggle} />;
    case 'docker':
      return <DockerLogItem log={log} isExpanded={isExpanded} onToggle={onToggle} />;
    case 'network':
      return <NetworkLogItem log={log} isExpanded={isExpanded} onToggle={onToggle} />;
    case 'system':
    default:
      return <SystemLogItem log={log} isExpanded={isExpanded} onToggle={onToggle} />;
  }
}

export function LogsTab() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<LogCategory>('all');
  const [search, setSearch] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/logs?category=${category}&limit=200`);
      const data = await res.json();
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [category]);

  const categories: { id: LogCategory; name: string; icon: typeof FileText }[] = [
    { id: 'all', name: 'All', icon: FileText },
    { id: 'system', name: 'System', icon: Server },
    { id: 'agent', name: 'Agent', icon: Bot },
    { id: 'docker', name: 'Docker', icon: Box },
    { id: 'network', name: 'Network', icon: Network },
  ];

  const filteredLogs = useMemo(() => {
    let result = logs.filter(log => log.details && log.details.trim() !== '' && log.details.toLowerCase() !== 'no details');
    
    if (search) {
      result = result.filter(log => 
        (log.action?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (log.details?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (log.user_id?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (log.agent_name?.toLowerCase() || '').includes(search.toLowerCase())
      );
    }
    
    return result;
  }, [logs, search]);

  const groupedLogs = useMemo(() => {
    const groups: { [key: string]: LogEntry[] } = {};
    
    filteredLogs.forEach(log => {
      const dateKey = formatDate(log.created_at);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });
    
    return groups;
  }, [filteredLogs]);

  const toggleExpand = (id: number) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const dateGroupOrder = ['Today', 'Yesterday'];
  const sortedDateKeys = Object.keys(groupedLogs).sort((a, b) => {
    const aIndex = dateGroupOrder.indexOf(a);
    const bIndex = dateGroupOrder.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return new Date(groupedLogs[b][0].created_at).getTime() - new Date(groupedLogs[a][0].created_at).getTime();
  });

  return (
    <div className="flex-1 flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2 bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800">
          {categories.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  category === cat.id
                    ? 'bg-white text-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.name}
              </button>
            );
          })}
        </div>
        
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md bg-zinc-900/50 border border-zinc-800 rounded-full px-10 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-600"
          />
        </div>

        <button
          onClick={fetchLogs}
          className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-20">
          <div className="w-16 h-16 rounded-full border border-zinc-800 flex items-center justify-center mb-6 animate-spin">
            <RefreshCw className="w-5 h-5 opacity-20" />
          </div>
          <p className="text-sm font-medium tracking-tight text-zinc-400">Loading logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-20 bg-zinc-900/20 border border-dashed border-zinc-800 rounded-[2.5rem]">
          <FileText className="w-10 h-10 mb-4 opacity-10" />
          <p className="text-lg font-bold text-white">No logs found</p>
          <p className="text-sm">Logs will appear here as events occur</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {sortedDateKeys.map(dateKey => (
            <div key={dateKey}>
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 sticky top-0 bg-zinc-950/90 backdrop-blur py-2 z-10">
                {dateKey}
              </h3>
              <div className="space-y-2">
                {groupedLogs[dateKey].map(log => (
                  <LogItem
                    key={log.id}
                    log={log}
                    isExpanded={expandedLogs.has(log.id)}
                    onToggle={() => toggleExpand(log.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-zinc-500 text-center">
        Showing {filteredLogs.length} logs • Auto-refreshes every 5s
      </div>
    </div>
  );
}
