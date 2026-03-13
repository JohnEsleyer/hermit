import { useState, useEffect } from 'react';
import { Cpu, MemoryStick, HardDrive, Network, Box } from 'lucide-react';
import { SystemMetrics, ContainerStats } from '../types';

const API_BASE = '';

export function HealthTab() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    host: {
      cpuPercent: 0,
      memoryUsed: 0,
      memoryTotal: 0,
      memoryFree: 0,
      diskUsed: 0,
      diskTotal: 0,
      diskFree: 0,
      memoryPercent: 0,
      diskPercent: 0,
      timestamp: 0
    },
    containers: []
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/metrics`);
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(1);
  };

  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-black border border-zinc-800 rounded-[2.5rem] p-8">
          <span className="text-zinc-500 text-sm lowercase flex items-center gap-2"><Cpu className="w-5 h-5" /> host cpu</span>
          <div className="mt-8 flex items-baseline gap-2">
            <span className="text-6xl font-black tracking-tighter">{metrics.host.cpuPercent.toFixed(1)}</span><span className="text-xl font-bold text-zinc-600">%</span>
          </div>
        </div>
        <div className="bg-black border border-zinc-800 rounded-[2.5rem] p-8">
          <span className="text-zinc-500 text-sm lowercase flex items-center gap-2"><MemoryStick className="w-5 h-5" /> host memory</span>
          <div className="mt-8 flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-black tracking-tighter">{formatBytes(metrics.host.memoryUsed)}</span><span className="text-xl font-bold text-zinc-600">gb</span>
            </div>
            <span className="text-sm text-zinc-500 mt-2">of {formatBytes(metrics.host.memoryTotal)} gb total</span>
          </div>
        </div>
        <div className="bg-black border border-zinc-800 rounded-[2.5rem] p-8">
          <span className="text-zinc-500 text-sm lowercase flex items-center gap-2"><HardDrive className="w-5 h-5" /> storage</span>
          <div className="mt-8 flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-black tracking-tighter">{formatBytes(metrics.host.diskUsed)}</span><span className="text-xl font-bold text-zinc-600">gb</span>
            </div>
            <span className="text-sm text-zinc-500 mt-2">{formatBytes(metrics.host.diskFree)} gb free</span>
          </div>
        </div>
        <div className="bg-black border border-zinc-800 rounded-[2.5rem] p-8">
          <span className="text-zinc-500 text-sm lowercase flex items-center gap-2"><Network className="w-5 h-5" /> network</span>
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 text-sm">Status</span>
              <span className={`font-mono ${metrics.tunnelURL || metrics.domain ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {metrics.domainMode ? 'Domain' : metrics.tunnelURL ? 'Tunnel Active' : 'Offline'}
              </span>
            </div>
            {metrics.tunnelURL && (
              <div className="text-xs text-zinc-400 break-all">{metrics.tunnelURL}</div>
            )}
            {metrics.domain && metrics.domainMode && (
              <div className="text-xs text-zinc-400 break-all">https://{metrics.domain}</div>
            )}
          </div>
        </div>
      </div>

      <h3 className="text-2xl font-bold mt-4 mb-2">Docker Containers</h3>
      {metrics.containers.length === 0 ? (
        <div className="bg-black border border-zinc-800 rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-zinc-500">
          <Box className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">No containers running</p>
          <p className="text-sm">Deploy an agent to start containers</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {metrics.containers.map((container, idx) => (
            <div key={idx} className="bg-black border border-zinc-800 rounded-3xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center">
                  <Box className="w-6 h-6 text-zinc-400" />
                </div>
                <div>
                  <h4 className="font-bold">{container.name}</h4>
                  <span className="text-xs text-emerald-400">running</span>
                </div>
              </div>
              <div className="flex gap-8 text-right">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">cpu</div>
                  <div className="font-mono">{container.cpuPercent.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">mem</div>
                  <div className="font-mono">{container.memUsageMB.toFixed(0)} MB</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
