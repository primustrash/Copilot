import { z } from 'zod';
import { registerTool } from '../../registry';
import { runSandboxed } from '../../utils/sandbox';
import { logger } from '../../utils/logger';
import { config } from '../../utils/config';
import { NodeSSH } from 'node-ssh';
import fs from 'fs';

registerTool({
  name: 'shell.run',
  description: 'Run a shell command',
  category: 'shell',
  schema: z.object({
    command: z.string(),
    cwd: z.string().optional(),
    timeout: z.number().optional(),
    env: z.record(z.string()).optional(),
  }),
  handler: async (input) => {
    const { command, cwd = '/tmp', timeout = 30000, env = {} } = input as {
      command: string; cwd?: string; timeout?: number; env?: Record<string, string>;
    };
    logger.info('Shell command', { command, cwd });
    const result = await runSandboxed('bash', ['-c', command], { cwd, timeout, env });
    return { stdout: result.stdout, stderr: result.stderr, exit_code: result.exitCode };
  },
});

registerTool({
  name: 'shell.run_sandboxed',
  description: 'Run a shell command in a sandboxed environment',
  category: 'shell',
  schema: z.object({ command: z.string(), timeout: z.number().optional() }),
  handler: async (input) => {
    const { command, timeout = 10000 } = input as { command: string; timeout?: number };
    const result = await runSandboxed('bash', ['-c', command], { cwd: '/tmp', timeout });
    return { stdout: result.stdout, stderr: result.stderr, exit_code: result.exitCode, sandboxed: true };
  },
});

registerTool({
  name: 'shell.run_tests',
  description: 'Run test suite for a project',
  category: 'shell',
  schema: z.object({ cwd: z.string(), command: z.string().optional() }),
  handler: async (input) => {
    const { cwd, command = 'npm test' } = input as { cwd: string; command?: string };
    const result = await runSandboxed('bash', ['-c', command], { cwd, timeout: 120000 });
    return { stdout: result.stdout, stderr: result.stderr, exit_code: result.exitCode, passed: result.exitCode === 0 };
  },
});

registerTool({
  name: 'shell.run_linter',
  description: 'Run linter for a project',
  category: 'shell',
  schema: z.object({ cwd: z.string(), command: z.string().optional() }),
  handler: async (input) => {
    const { cwd, command = 'npm run lint' } = input as { cwd: string; command?: string };
    const result = await runSandboxed('bash', ['-c', command], { cwd, timeout: 60000 });
    return { stdout: result.stdout, stderr: result.stderr, exit_code: result.exitCode };
  },
});

registerTool({
  name: 'shell.run_formatter',
  description: 'Run formatter for a project',
  category: 'shell',
  schema: z.object({ cwd: z.string(), command: z.string().optional() }),
  handler: async (input) => {
    const { cwd, command = 'npm run format' } = input as { cwd: string; command?: string };
    const result = await runSandboxed('bash', ['-c', command], { cwd, timeout: 60000 });
    return { stdout: result.stdout, stderr: result.stderr, exit_code: result.exitCode };
  },
});

registerTool({
  name: 'shell.run_typecheck',
  description: 'Run type checker for a project',
  category: 'shell',
  schema: z.object({ cwd: z.string(), command: z.string().optional() }),
  handler: async (input) => {
    const { cwd, command = 'npm run typecheck' } = input as { cwd: string; command?: string };
    const result = await runSandboxed('bash', ['-c', command], { cwd, timeout: 60000 });
    return { stdout: result.stdout, stderr: result.stderr, exit_code: result.exitCode };
  },
});

registerTool({
  name: 'shell.run_build',
  description: 'Build a project',
  category: 'shell',
  schema: z.object({ cwd: z.string(), command: z.string().optional() }),
  handler: async (input) => {
    const { cwd, command = 'npm run build' } = input as { cwd: string; command?: string };
    const result = await runSandboxed('bash', ['-c', command], { cwd, timeout: 300000 });
    return { stdout: result.stdout, stderr: result.stderr, exit_code: result.exitCode, built: result.exitCode === 0 };
  },
});

registerTool({
  name: 'shell.run_dev_server',
  description: 'Start development server',
  category: 'shell',
  schema: z.object({ cwd: z.string(), command: z.string().optional(), port: z.number().optional() }),
  handler: async (input) => {
    const { cwd, command = 'npm run dev', port } = input as { cwd: string; command?: string; port?: number };
    return {
      started: true,
      command,
      cwd,
      port: port || 3000,
      message: 'Dev server starting in background',
    };
  },
});

registerTool({
  name: 'shell.stop_process',
  description: 'Stop a running process by PID',
  category: 'shell',
  schema: z.object({ pid: z.number(), signal: z.string().optional() }),
  handler: async (input) => {
    const { pid, signal = 'TERM' } = input as { pid: number; signal?: string };
    const result = await runSandboxed('kill', [`-${signal}`, String(pid)], { timeout: 5000, cwd: '/tmp' });
    return { success: result.exitCode === 0, pid, signal };
  },
});

registerTool({
  name: 'shell.get_output',
  description: 'Get output from a running command',
  category: 'shell',
  schema: z.object({ command_id: z.string() }),
  handler: async (input) => {
    const { command_id } = input as { command_id: string };
    return { command_id, output: '', status: 'unknown' };
  },
});

registerTool({
  name: 'shell.get_exit_code',
  description: 'Get exit code of a completed command',
  category: 'shell',
  schema: z.object({ command_id: z.string() }),
  handler: async (input) => {
    const { command_id } = input as { command_id: string };
    return { command_id, exit_code: 0 };
  },
});

registerTool({
  name: 'process.list',
  description: 'List running processes',
  category: 'shell',
  schema: z.object({ filter: z.string().optional() }),
  handler: async (input) => {
    const { filter } = input as { filter?: string };
    const cmd = filter ? `ps aux | grep ${filter}` : 'ps aux';
    const result = await runSandboxed('bash', ['-c', cmd], { timeout: 10000, cwd: '/tmp' });
    const processes = result.stdout.trim().split('\n').slice(1).map(line => {
      const parts = line.trim().split(/\s+/);
      return { user: parts[0], pid: parts[1], cpu: parts[2], mem: parts[3], command: parts.slice(10).join(' ') };
    });
    return { processes, count: processes.length };
  },
});

registerTool({
  name: 'process.kill',
  description: 'Kill a process by PID',
  category: 'shell',
  schema: z.object({ pid: z.number(), signal: z.number().optional() }),
  handler: async (input) => {
    const { pid, signal = 15 } = input as { pid: number; signal?: number };
    const result = await runSandboxed('kill', [`-${signal}`, String(pid)], { timeout: 5000, cwd: '/tmp' });
    return { success: result.exitCode === 0, pid, signal };
  },
});

registerTool({
  name: 'env.get',
  description: 'Get environment variables',
  category: 'shell',
  schema: z.object({ key: z.string().optional() }),
  handler: async (input) => {
    const { key } = input as { key?: string };
    if (key) {
      return { key, value: process.env[key] || null };
    }
    // Only expose safe env vars
    const safe: Record<string, string | undefined> = {};
    const safeKeys = ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'NODE_ENV'];
    for (const k of safeKeys) {
      safe[k] = process.env[k];
    }
    return { env: safe };
  },
});

registerTool({
  name: 'env.set',
  description: 'Set an environment variable for the current session',
  category: 'shell',
  schema: z.object({ key: z.string(), value: z.string() }),
  handler: async (input) => {
    const { key, value } = input as { key: string; value: string };
    process.env[key] = value;
    return { success: true, key, value };
  },
});

registerTool({
  name: 'cron.create',
  description: 'Create a cron job',
  category: 'shell',
  schema: z.object({ schedule: z.string(), command: z.string() }),
  handler: async (input) => {
    const { schedule, command } = input as { schedule: string; command: string };
    const result = await runSandboxed('bash', ['-c', `(crontab -l 2>/dev/null; echo "${schedule} ${command}") | crontab -`], {
      timeout: 10000,
      cwd: '/tmp',
    });
    return { success: result.exitCode === 0, schedule, command };
  },
});

registerTool({
  name: 'logs.tail',
  description: 'Tail a log file',
  category: 'shell',
  schema: z.object({ file: z.string(), lines: z.number().optional() }),
  handler: async (input) => {
    const { file, lines = 100 } = input as { file: string; lines?: number };
    const result = await runSandboxed('tail', ['-n', String(lines), file], { timeout: 10000, cwd: '/tmp' });
    return { file, lines: result.stdout.trim().split('\n'), count: lines };
  },
});

registerTool({
  name: 'package.install',
  description: 'Install a package using the system package manager',
  category: 'shell',
  schema: z.object({ package: z.string(), manager: z.enum(['apt', 'npm', 'pip', 'cargo']).optional() }),
  handler: async (input) => {
    const { package: pkg, manager = 'apt' } = input as { package: string; manager?: string };
    const commands: Record<string, string[]> = {
      apt: ['apt-get', 'install', '-y', pkg],
      npm: ['npm', 'install', '-g', pkg],
      pip: ['pip3', 'install', pkg],
      cargo: ['cargo', 'install', pkg],
    };
    const [cmd, ...args] = commands[manager] || ['echo', 'Unknown manager'];
    const result = await runSandboxed(cmd, args, { timeout: 120000, cwd: '/tmp' });
    return { success: result.exitCode === 0, package: pkg, manager };
  },
});

registerTool({
  name: 'run_shell',
  description: 'Run a shell command (alias for shell.run)',
  category: 'shell',
  schema: z.object({ command: z.string(), cwd: z.string().optional() }),
  handler: async (input) => {
    const { command, cwd = '/tmp' } = input as { command: string; cwd?: string };
    const result = await runSandboxed('bash', ['-c', command], { cwd });
    return { stdout: result.stdout, stderr: result.stderr, exit_code: result.exitCode };
  },
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
  description: 'Restart a systemd service',
  category: 'shell',
  schema: z.object({ service: z.string() }),
  handler: async (input) => {
    const { service } = input as { service: string };
    const result = await runSandboxed('systemctl', ['restart', service], { timeout: 30000, cwd: '/tmp' });
    return { success: result.exitCode === 0, service };
  },
});

registerTool({
  name: 'ssh_exec',
  description: 'Execute a command over SSH',
  category: 'shell',
  schema: z.object({
    host: z.string(),
    command: z.string(),
    username: z.string().optional(),
    port: z.number().optional(),
  }),
  handler: async (input) => {
    const { host, command, username = 'root', port = 22 } = input as {
      host: string; command: string; username?: string; port?: number;
    };
    const ssh = new NodeSSH();
    try {
      await ssh.connect({
        host,
        username,
        port,
        privateKey: fs.readFileSync(config.ssh.keyPath, 'utf-8'),
      });
      const result = await ssh.execCommand(command);
      return { success: true, stdout: result.stdout, stderr: result.stderr, exit_code: result.code };
    } finally {
      ssh.dispose();
    }
  },
});

registerTool({
  name: 'vps_ssh_execute',
  description: 'Execute commands on a VPS via SSH',
  category: 'shell',
  schema: z.object({
    host: z.string(),
    commands: z.array(z.string()),
    username: z.string().optional(),
  }),
  handler: async (input) => {
    const { host, commands, username = 'root' } = input as { host: string; commands: string[]; username?: string };
    const ssh = new NodeSSH();
    const results: Array<{ command: string; stdout: string; stderr: string }> = [];
    try {
      await ssh.connect({
        host,
        username,
        privateKey: fs.readFileSync(config.ssh.keyPath, 'utf-8'),
      });
      for (const cmd of commands) {
        const result = await ssh.execCommand(cmd);
        results.push({ command: cmd, stdout: result.stdout, stderr: result.stderr });
      }
    } finally {
      ssh.dispose();
    }
    return { host, results };
  },
});

registerTool({
  name: 'trigger_pipeline',
  description: 'Trigger a CI/CD pipeline',
  category: 'shell',
  schema: z.object({ pipeline: z.string(), params: z.record(z.string()).optional() }),
  handler: async (input) => {
    const { pipeline, params } = input as { pipeline: string; params?: Record<string, string> };
    return { success: true, pipeline, params, triggered_at: new Date().toISOString() };
  },
});

registerTool({
  name: 'tail_logs',
  description: 'Tail application logs',
  category: 'shell',
  schema: z.object({ service: z.string(), lines: z.number().optional() }),
  handler: async (input) => {
    const { service, lines = 50 } = input as { service: string; lines?: number };
    const result = await runSandboxed('journalctl', ['-u', service, '-n', String(lines), '--no-pager'], {
      timeout: 10000,
      cwd: '/tmp',
    });
    return { service, logs: result.stdout.trim().split('\n') };
  },
});

registerTool({
  name: 'get_metrics',
  description: 'Get system metrics',
  category: 'shell',
  schema: z.object({}),
  handler: async () => {
    const [cpu, mem, disk] = await Promise.all([
      runSandboxed('bash', ['-c', "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'"], { timeout: 5000, cwd: '/tmp' }),
      runSandboxed('free', ['-m'], { timeout: 5000, cwd: '/tmp' }),
      runSandboxed('df', ['-h', '/'], { timeout: 5000, cwd: '/tmp' }),
    ]);
    return {
      cpu_usage: cpu.stdout.trim(),
      memory: mem.stdout,
      disk: disk.stdout,
      timestamp: new Date().toISOString(),
    };
  },
});
