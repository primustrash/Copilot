import { z } from 'zod';
import { registerTool } from '../../registry';
import { runSandboxed, validatePath } from '../../utils/sandbox';
import { logger } from '../../utils/logger';
import { config } from '../../utils/config';


/** Fixed, non-shell read-only catalog; models never construct executable strings. */
const READ_ONLY_COMMANDS: Record<string, [string, string[]]> = {
  'ps aux': ['ps', ['aux']],
  'df -h': ['df', ['-h']],
  'free -m': ['free', ['-m']],
};
async function readOnlyCommand(command: string, cwd = '/tmp', timeout = 10000) {
  const selected = Object.prototype.hasOwnProperty.call(READ_ONLY_COMMANDS, command)
    ? READ_ONLY_COMMANDS[command] : undefined;
  if (!selected) throw new Error('Unapproved shell command: only read-only typed commands are accepted');
  return runSandboxed(selected[0], selected[1], {
    cwd: validatePath(cwd), timeout: Math.min(Math.max(timeout, 1), 10000),
  });
}
function requireIsolatedWrite(name: string): never {
  // The old execFile implementation offered neither a real authorization gate
  // nor OS confinement. Do not silently run privileged operations as a model.
  throw new Error(name + ' is disabled until a scoped approval and isolated worker are installed');
}

registerTool({
  name: 'shell.run',
  description: 'Execute a fixed read-only system information command',
  category: 'shell',
  schema: z.object({
    command: z.enum(['ps aux', 'df -h', 'free -m']),
    cwd: z.string().optional(),
    timeout: z.number().int().min(1).max(10000).optional(),
  }),
  handler: async (input) => {
    const { command, cwd = '/tmp', timeout = 10000 } = input as { command: string; cwd?: string; timeout?: number };
    const result = await readOnlyCommand(command, cwd, timeout);
    return { stdout: result.stdout, stderr: result.stderr, exit_code: result.exitCode };
  },
});
registerTool({
  name: 'shell.run_sandboxed',
  description: 'Read-only command catalog; not a generic shell sandbox',
  category: 'shell',
  schema: z.object({ command: z.enum(['ps aux', 'df -h', 'free -m']) }),
  handler: async (input) => {
    const { command } = input as { command: string };
    const result = await readOnlyCommand(command);
    return { stdout: result.stdout, stderr: result.stderr, exit_code: result.exitCode, sandboxed: false };
  },
});
registerTool({
  name: 'shell.run_tests',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('shell.run_tests'),
});
registerTool({
  name: 'shell.run_linter',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('shell.run_linter'),
});
registerTool({
  name: 'shell.run_formatter',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('shell.run_formatter'),
});
registerTool({
  name: 'shell.run_typecheck',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('shell.run_typecheck'),
});
registerTool({
  name: 'shell.run_build',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('shell.run_build'),
});
registerTool({
  name: 'shell.run_dev_server',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('shell.run_dev_server'),
});
registerTool({
  name: 'shell.stop_process',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('shell.stop_process'),
});
registerTool({
  name: 'shell.get_output',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('shell.get_output'),
});
registerTool({
  name: 'shell.get_exit_code',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('shell.get_exit_code'),
});
registerTool({
  name: 'process.list',
  description: 'List running processes with a literal substring filter (no shell)',
  category: 'shell',
  schema: z.object({ filter: z.string().max(160).optional() }),
  handler: async (input) => {
    const { filter } = input as { filter?: string };
    const result = await readOnlyCommand('ps aux');
    if (result.exitCode !== 0) throw new Error('Process listing failed');
    const lines = result.stdout.trim().split('\n').slice(1)
      .filter(line => !filter || line.includes(filter)).slice(0, 200);
    return { processes: lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return { user: parts[0], pid: parts[1], cpu: parts[2], mem: parts[3], command: parts.slice(10).join(' ') };
    }), count: lines.length };
  },
});
registerTool({
  name: 'process.kill',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('process.kill'),
});
registerTool({
  name: 'env.get',
  description: 'Return only explicitly allowlisted non-secret metadata',
  category: 'shell',
  schema: z.object({ key: z.enum(['PATH', 'LANG', 'NODE_ENV']).optional() }),
  handler: async (input) => {
    const { key } = input as { key?: string };
    const allowed = ['PATH', 'LANG', 'NODE_ENV'] as const;
    if (key && !allowed.includes(key as typeof allowed[number])) throw new Error('Environment key not allowed');
    if (key) return { key, value: process.env[key] || null };
    const env: Record<string, string | undefined> = {};
    for (const name of allowed) env[name] = process.env[name];
    return { env };
  },
});
registerTool({
  name: 'env.set',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('env.set'),
});
registerTool({
  name: 'cron.create',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('cron.create'),
});
registerTool({
  name: 'logs.tail',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('logs.tail'),
});
registerTool({
  name: 'package.install',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('package.install'),
});
registerTool({
  name: 'run_shell',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('run_shell'),
});
registerTool({
  name: 'service_status',
  description: 'Get the status of a systemd service',
  category: 'shell',
  schema: z.object({ service: z.string() }),
  handler: async (input) => {
    const { service } = input as { service: string };
    const result = await runSandboxed('systemctl', ['is-active', service], { timeout: 10000, cwd: '/tmp' });
    return { service, status: result.stdout.trim(), active: result.exitCode === 0 };
  },
});

registerTool({
  name: 'service_restart',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('service_restart'),
});
registerTool({
  name: 'ssh_exec',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('ssh_exec'),
});
registerTool({
  name: 'vps_ssh_execute',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('vps_ssh_execute'),
});
registerTool({
  name: 'trigger_pipeline',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('trigger_pipeline'),
});
registerTool({
  name: 'tail_logs',
  description: 'Requires scoped high-impact authorization and isolated worker (fail closed)',
  category: 'shell',
  schema: z.object({}).passthrough(),
  handler: async () => requireIsolatedWrite('tail_logs'),
});
registerTool({
  name: 'get_metrics',
  description: 'Get system metrics',
  category: 'shell',
  schema: z.object({}),
  handler: async () => {
    const [cpu, mem, disk] = await Promise.all([
      runSandboxed('top', ['-bn1'], { timeout: 5000, cwd: '/tmp' }),
      runSandboxed('free', ['-m'], { timeout: 5000, cwd: '/tmp' }),
      runSandboxed('df', ['-h', '/'], { timeout: 5000, cwd: '/tmp' }),
    ]);
    return {
      cpu_usage: (cpu.stdout.split('\n').find(line => line.includes('Cpu(s)')) || '').slice(0, 160),
      memory: mem.stdout,
      disk: disk.stdout,
      timestamp: new Date().toISOString(),
    };
  },
});
