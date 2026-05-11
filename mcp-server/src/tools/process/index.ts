import { z } from 'zod';
import os from 'os';
import { registerTool } from '../../registry';
import { runSandboxed } from '../../utils/sandbox';
import { logger } from '../../utils/logger';

registerTool({
  name: 'proc.list',
  description: 'List running system processes',
  category: 'process',
  schema: z.object({
    filter: z.string().optional(),
    limit: z.number().optional(),
  }),
  handler: async (input) => {
    const { filter, limit = 50 } = input as { filter?: string; limit?: number };
    const result = await runSandboxed('ps', ['aux', '--no-header'], { cwd: '/tmp', timeout: 15000 });

    const lines = result.stdout.trim().split('\n').filter(Boolean);
    const processes = lines.slice(0, 500).map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        user: parts[0],
        pid: parseInt(parts[1], 10),
        cpu: parseFloat(parts[2]),
        mem: parseFloat(parts[3]),
        vsz: parseInt(parts[4], 10),
        rss: parseInt(parts[5], 10),
        stat: parts[7],
        command: parts.slice(10).join(' '),
      };
    }).filter(p => !filter || p.command.includes(filter) || String(p.pid) === filter);

    return {
      processes: processes.slice(0, limit),
      total: processes.length,
      truncated: processes.length > limit,
    };
  },
});

registerTool({
  name: 'proc.find',
  description: 'Find processes by name',
  category: 'process',
  schema: z.object({ name: z.string() }),
  handler: async (input) => {
    const { name } = input as { name: string };
    const result = await runSandboxed('ps', ['aux', '--no-header'], { cwd: '/tmp', timeout: 15000 });

    const processes = result.stdout
      .trim()
      .split('\n')
      .filter(l => l.toLowerCase().includes(name.toLowerCase()))
      .map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          user: parts[0],
          pid: parseInt(parts[1], 10),
          cpu: parseFloat(parts[2]),
          mem: parseFloat(parts[3]),
          command: parts.slice(10).join(' '),
        };
      });

    return { name, processes, count: processes.length };
  },
});

registerTool({
  name: 'proc.info',
  description: 'Get information about the current Node.js process',
  category: 'process',
  schema: z.object({}),
  handler: async () => {
    const memUsage = process.memoryUsage();
    return {
      pid: process.pid,
      ppid: process.ppid,
      uptime_seconds: process.uptime(),
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      memory: {
        rss_mb: Math.round(memUsage.rss / 1024 / 1024),
        heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
        external_mb: Math.round(memUsage.external / 1024 / 1024),
      },
      cpu_usage: process.cpuUsage(),
    };
  },
});

registerTool({
  name: 'proc.kill',
  description: 'Send a signal to a process by PID',
  category: 'process',
  schema: z.object({
    pid: z.number(),
    signal: z.enum(['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGHUP', 'SIGUSR1', 'SIGUSR2']).optional(),
  }),
  handler: async (input) => {
    const { pid, signal = 'SIGTERM' } = input as { pid: number; signal?: NodeJS.Signals };

    if (pid <= 1 || pid === process.pid) {
      throw new Error(`Cannot kill PID ${pid}: protected process`);
    }

    try {
      process.kill(pid, signal);
      logger.info('proc.kill', { pid, signal });
      return { success: true, pid, signal };
    } catch (err) {
      throw new Error(`Failed to send ${signal} to PID ${pid}: ${(err as Error).message}`);
    }
  },
});

registerTool({
  name: 'system.metrics',
  description: 'Get real-time system resource usage (CPU, memory, disk, network)',
  category: 'process',
  schema: z.object({}),
  handler: async () => {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const loadAvg = os.loadavg();

    const diskResult = await runSandboxed('df', ['-h', '--output=source,size,used,avail,pcent,target', '-x', 'tmpfs', '-x', 'devtmpfs'], {
      cwd: '/tmp',
      timeout: 10000,
    });

    const diskLines = diskResult.stdout.trim().split('\n').slice(1).map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        available: parts[3],
        use_percent: parts[4],
        mount: parts[5],
      };
    }).filter(d => d.filesystem && !d.filesystem.startsWith('overlay'));

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      kernel: os.release(),
      uptime_seconds: os.uptime(),
      load_avg: { '1m': loadAvg[0], '5m': loadAvg[1], '15m': loadAvg[2] },
      memory: {
        total_mb: Math.round(totalMem / 1024 / 1024),
        free_mb: Math.round(freeMem / 1024 / 1024),
        used_mb: Math.round((totalMem - freeMem) / 1024 / 1024),
        usage_percent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || 'unknown',
        speed_mhz: cpus[0]?.speed || 0,
      },
      disk: diskLines,
    };
  },
});

registerTool({
  name: 'system.env',
  description: 'Inspect non-sensitive environment variables for the MCP server process',
  category: 'process',
  schema: z.object({ filter: z.string().optional() }),
  handler: async (input) => {
    const { filter } = input as { filter?: string };

    // Redact any variable whose name contains sensitive keywords
    const SENSITIVE = /key|secret|password|token|credential|private|passwd|auth/i;
    const env: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (SENSITIVE.test(key)) {
        env[key] = '***REDACTED***';
      } else if (!filter || key.toLowerCase().includes(filter.toLowerCase())) {
        env[key] = value || '';
      }
    }

    return { env, count: Object.keys(env).length };
  },
});
