import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { logger } from './logger';

export interface SandboxOptions {
  timeout?: number;
  maxOutputBytes?: number;
  allowedPaths?: string[];
  allowedCommands?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

const SAFE_PATH = '/usr/bin:/bin';
const COMMAND_PATHS: Readonly<Record<string, string>> = {
  ps: '/bin/ps',
  df: '/bin/df',
  free: '/usr/bin/free',
  top: '/usr/bin/top',
  node: '/usr/bin/node',
  npm: '/usr/bin/npm',
  python3: '/usr/bin/python3',
  git: '/usr/bin/git',
  bash: '/bin/bash',
  sh: '/bin/sh',
};

const BWRAP = '/usr/bin/bwrap';
const PRLIMIT = '/usr/bin/prlimit';
const READ_ONLY: Readonly<Record<string, string[]>> = {
  'ps': ['aux'],
  'df': ['-h', '/'],
  'free': ['-m'],
  'top': ['-bn1'],
};
const MAX_OUTPUT = 128 * 1024;
const MAX_TIMEOUT_MS = 120000;

function canonical(target: string): string {
  const absolute = path.resolve(target);
  try { return fs.realpathSync(absolute); }
  catch {
    const parent = fs.realpathSync(path.dirname(absolute));
    return path.join(parent, path.basename(absolute));
  }
}

function insideRoot(target: string, root: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}

export function validatePath(filePath: string): string {
  const target = canonical(filePath);
  const allowed = config.security.allowedPaths
    .map(root => { try { return canonical(root); } catch { return ''; } })
    .filter(Boolean);
  if (!allowed.some(root => insideRoot(target, root))) {
    throw new Error('Path is outside approved roots');
  }
  return target;
}

function isPassiveCommand(cmd: string, args: string[]): boolean {
  const expected = READ_ONLY[cmd];
  return Boolean(expected && expected.length === args.length &&
    expected.every((value, index) => value === args[index]));
}

function isolatedCommand(binary: string, args: string[], cwd: string): [string, string[]] {
  if (!fs.existsSync(BWRAP) || !fs.existsSync(PRLIMIT)) {
    throw new Error('OS sandbox unavailable; execution denied (bubblewrap/prlimit required)');
  }
  const root = canonical(config.workspace.root);
  if (!insideRoot(cwd, root)) {
    throw new Error('Untrusted execution requires a workspace under WORKSPACE_ROOT');
  }
  const bwrapArgs = [
    '--unshare-all', '--die-with-parent', '--new-session',
    '--clearenv', '--setenv', 'PATH', SAFE_PATH, '--setenv', 'HOME', '/tmp',
    '--tmpfs', '/tmp', '--dev', '/dev', '--proc', '/proc', '--dir', '/etc',
  ];
  for (const dir of ['/usr', '/bin', '/lib', '/lib64']) {
    if (fs.existsSync(dir)) bwrapArgs.push('--ro-bind', dir, dir);
  }
  let prefix = '';
  for (const segment of cwd.split('/').filter(Boolean).slice(0, -1)) {
    prefix += '/' + segment;
    bwrapArgs.push('--dir', prefix);
  }
  bwrapArgs.push('--bind', cwd, cwd, '--chdir', cwd, '--');
  bwrapArgs.push(PRLIMIT, '--as=1073741824', '--cpu=25', '--fsize=16777216',
    '--nofile=128', '--nproc=32', '--core=0', '--', binary, ...args);
  return [BWRAP, bwrapArgs];
}

function executeBounded(executable: string, args: string[], cwd: string, timeout: number, limit: number): Promise<SandboxResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(executable, args, {
      cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: SAFE_PATH, HOME: '/tmp', LANG: 'C', NODE_ENV: 'production' },
    });
    let stdout = '';
    let stderr = '';
    let size = 0;
    let timedOut = false;
    let exceeded = false;
    let settled = false;
    const terminateGroup = () => {
      if (!proc.pid) return;
      try { process.kill(-proc.pid, 'SIGKILL'); }
      catch { try { proc.kill('SIGKILL'); } catch { /* already finished */ } }
    };
    const timer = setTimeout(() => { timedOut = true; terminateGroup(); }, timeout);
    const capture = (part: 'stdout' | 'stderr', chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) { exceeded = true; terminateGroup(); return; }
      if (part === 'stdout') stdout += chunk.toString('utf8');
      else stderr += chunk.toString('utf8');
    };
    proc.stdout?.on('data', (chunk: Buffer) => capture('stdout', chunk));
    proc.stderr?.on('data', (chunk: Buffer) => capture('stderr', chunk));
    proc.on('error', (error) => {
      if (!settled) { settled = true; clearTimeout(timer); reject(error); }
    });
    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout, stderr: exceeded ? 'Output limit exceeded' : stderr,
        exitCode: timedOut || exceeded ? -1 : (code ?? 1), timedOut,
      });
    });
  });
}

export async function runSandboxed(command: string, args: string[], options: SandboxOptions = {}): Promise<SandboxResult> {
  if (!Array.isArray(args) || !args.every(a => typeof a === 'string')) throw new Error('Typed argv required');
  const executable = COMMAND_PATHS[command];
  if (!Object.prototype.hasOwnProperty.call(COMMAND_PATHS, command) || !executable) {
    throw new Error('Executable is not in the fixed allowlist');
  }
  const timeout = Math.max(1, Math.min(options.timeout ?? 30000, MAX_TIMEOUT_MS));
  const limit = Math.max(1, Math.min(options.maxOutputBytes ?? MAX_OUTPUT, MAX_OUTPUT));
  const cwd = validatePath(options.cwd ?? '/tmp');
  const passive = isPassiveCommand(command, args);
  if (passive) return executeBounded(executable, args, cwd, timeout, limit);

  // No generic model-provided shell or executable path. Only dedicated, explicitly
  // permitted worker tools may request OS-confined execution after operator enablement.
  if (process.env.MCP_ISOLATED_EXEC_ENABLED !== 'true' ||
      !options.allowedCommands?.includes(command)) {
    throw new Error('Privileged command is not approved for the isolated worker');
  }
  if ((command === 'bash' || command === 'sh') && args.includes('-c')) {
    throw new Error('Shell-string execution is prohibited');
  }
  const [wrapped, wrappedArgs] = isolatedCommand(executable, args, cwd);
  logger.info('isolated_exec', { command, cwd, isolated: true });
  return executeBounded(wrapped, wrappedArgs, cwd, timeout, limit);
}

export function createSandboxDir(name: string): string {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) throw new Error('Invalid sandbox name');
  const base = validatePath(config.workspace.sandboxRoot);
  const target = path.join(base, name);
  if (!insideRoot(target, base)) throw new Error('Sandbox path denied');
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  return target;
}

export function cleanupSandboxDir(sandboxPath: string): void {
  const base = validatePath(config.workspace.sandboxRoot);
  const target = canonical(sandboxPath);
  if (target === base || !insideRoot(target, base)) throw new Error('Sandbox delete denied');
  fs.rmSync(target, { recursive: true, force: true });
}
