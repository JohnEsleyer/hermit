import { useState, useEffect, useMemo } from 'react';
import { Cpu, MemoryStick, HardDrive, Network, Box, Activity } from 'lucide-react';
import { SystemMetrics } from '../types';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/metrics`);
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
      } finally {
        setLoading(false);
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

  const hermitUsage = useMemo(() => {
    const cpu = metrics.containers.reduce((sum, c) => sum + c.cpuPercent, 0);
    const memMB = metrics.containers.reduce((sum, c) => sum + c.memUsageMB, 0);
    return { cpu, memMB, count: metrics.containers.length };
  }, [metrics.containers]);

  const showSkeleton = loading || metrics.host.timestamp === 0;

  const metricCard = (title: string, icon: JSX.Element, body: JSX.Element) => (
    <div className="rounded-[2rem] p-6 border border-white/10 bg-gradient-to-br from-white/10 via-zinc-900/30 to-cyan-500/10 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <span className="text-zinc-300 text-sm lowercase flex items-center gap-2">{icon} {title}</span>
      <div className="mt-5">{body}</div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-5">
        {metricCard('host cpu', <Cpu className="w-5 h-5" />, showSkeleton ? <div className="h-16 rounded-xl bg-white/10 animate-pulse" /> : (
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tighter">{metrics.host.cpuPercent.toFixed(1)}</span><span className="text-xl font-bold text-zinc-500">%</span>
          </div>
        ))}

        {metricCard('host memory', <MemoryStick className="w-5 h-5" />, showSkeleton ? <div className="h-16 rounded-xl bg-white/10 animate-pulse" /> : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tighter">{formatBytes(metrics.host.memoryUsed)}</span><span className="text-xl font-bold text-zinc-500">gb</span>
            </div>
            <span className="text-xs text-zinc-400 mt-2 block">{formatBytes(metrics.host.memoryFree)} gb free</span>
          </>
        ))}

        {metricCard('storage', <HardDrive className="w-5 h-5" />, showSkeleton ? <div className="h-16 rounded-xl bg-white/10 animate-pulse" /> : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tighter">{formatBytes(metrics.host.diskUsed)}</span><span className="text-xl font-bold text-zinc-500">gb</span>
            </div>
            <span className="text-xs text-zinc-400 mt-2 block">of {formatBytes(metrics.host.diskTotal)} gb total</span>
          </>
        ))}

        {metricCard('hermit workload', <Activity className="w-5 h-5" />, showSkeleton ? <div className="h-16 rounded-xl bg-white/10 animate-pulse" /> : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tighter">{hermitUsage.cpu.toFixed(1)}</span><span className="text-lg font-bold text-zinc-500">cpu %</span>
            </div>
            <span className="text-xs text-zinc-400 mt-2 block">{hermitUsage.memMB.toFixed(0)} MB RAM across {hermitUsage.count} containers</span>
          </>
        ))}

        {metricCard('network', <Network className="w-5 h-5" />, showSkeleton ? <div className="h-16 rounded-xl bg-white/10 animate-pulse" /> : (
          <div className="mt-1 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">status</span>
              <span className={`${metrics.tunnelURL || metrics.domain ? 'text-emerald-300' : 'text-zinc-500'}`}>{metrics.domainMode ? 'Domain' : metrics.tunnelURL ? 'Tunnel Active' : 'Offline'}</span>
            </div>
            {metrics.tunnelURL && <div className="text-xs text-zinc-300 break-all">{metrics.tunnelURL}</div>}
            {metrics.domain && metrics.domainMode && <div className="text-xs text-zinc-300 break-all">https://{metrics.domain}</div>}
          </div>
        ))}
      </div>

      <h3 className="text-2xl font-bold mt-2 mb-2">Docker Containers</h3>
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
