import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { logger } from './logger';

const execFileAsync = promisify(execFile);

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

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_OUTPUT = 1024 * 1024; // 1 MB

// Hardcoded safe PATH (never derived from environment to prevent injection)
const SAFE_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

// Hardcoded directories to resolve commands from (same as SAFE_PATH)
const SAFE_DIRS = [
  '/usr/local/sbin', '/usr/local/bin', '/usr/sbin',
  '/usr/bin', '/sbin', '/bin',
];

// Allowlist of permitted base command names
const ALLOWED_COMMANDS = new Set([
  'bash', 'sh', 'python3', 'python', 'node', 'npm', 'npx',
  'git', 'curl', 'wget', 'grep', 'find', 'ls', 'cat', 'head', 'tail',
  'diff', 'patch', 'sed', 'awk', 'wc', 'sort', 'uniq',
  'systemctl', 'journalctl', 'docker', 'kill', 'ps', 'free', 'df', 'top',
  'mkdir', 'cp', 'mv', 'rm', 'chmod', 'chown', 'tar', 'gzip', 'gunzip',
  'crontab', 'ssh', 'scp', 'rsync', 'apt-get', 'pip3', 'pip', 'cargo',
  'xdotool', 'xclip', 'scrot', 'wmctrl', 'xdpyinfo',
  'ffmpeg', 'sox', 'arecord', 'aplay', 'tesseract',
  'black', 'prettier', 'eslint', 'tsc',
]);

const BLOCKED_PATTERNS = [
  'rm -rf /',
  'mkfs',
  'dd if=/dev/zero',
  ':(){ :|:& };:',
];

/**
 * Resolve command to full path using only safe, hardcoded directories.
 * Never uses process.env.PATH.
 */
function resolveCommandPath(command: string): string {
  // If it's already an absolute path, validate it's within safe dirs
  if (path.isAbsolute(command)) {
    const inSafeDir = SAFE_DIRS.some(dir => command.startsWith(dir + '/'));
    if (!inSafeDir) {
      throw new Error(`Absolute command path not in safe directories: ${command}`);
    }
    if (!fs.existsSync(command)) {
      throw new Error(`Command not found: ${command}`);
    }
    return command;
  }

  // Search in safe dirs only
  const baseName = path.basename(command);
  for (const dir of SAFE_DIRS) {
    const fullPath = path.join(dir, baseName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Fall back to command name (let execFile resolve it without shell)
  return command;
}

function isCommandAllowed(command: string): boolean {
  const base = path.basename(command);
  return ALLOWED_COMMANDS.has(base);
}

function isCommandSafe(fullCommand: string): boolean {
  const lower = fullCommand.toLowerCase();
  for (const blocked of BLOCKED_PATTERNS) {
    if (lower.includes(blocked)) {
      return false;
    }
  }
  return true;
}

function isPathAllowed(filePath: string): boolean {
  const normalizedPath = path.resolve(filePath);
  const allowedPaths = config.security.allowedPaths;
  return allowedPaths.some(allowed => normalizedPath.startsWith(allowed));
}

export async function runSandboxed(
  command: string,
  args: string[],
  options: SandboxOptions = {}
): Promise<SandboxResult> {
  const {
    timeout = DEFAULT_TIMEOUT,
    cwd = '/tmp',
    env = {},
  } = options;

  // Validate command against allowlist
  if (!isCommandAllowed(command)) {
    throw new Error(`Command not in allowlist: ${command}`);
  }

  if (!isCommandSafe(`${command} ${args.join(' ')}`)) {
    throw new Error(`Command blocked by sandbox policy: ${command}`);
  }

  // Resolve to full path using safe, hardcoded directories only
  const resolvedCommand = resolveCommandPath(command);

  logger.debug('sandbox_exec', { command: resolvedCommand, args, cwd });

  try {
    const result = await Promise.race([
      execFileAsync(resolvedCommand, args, {
        cwd,
        // Use only safe, hardcoded PATH - never inherit from environment
        env: { ...env, PATH: SAFE_PATH, HOME: process.env.HOME || '/root' },
        maxBuffer: DEFAULT_MAX_OUTPUT,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), timeout)
      ),
    ]);

    return {
      stdout: (result as { stdout: string }).stdout || '',
      stderr: (result as { stderr: string }).stderr || '',
      exitCode: 0,
      timedOut: false,
    };
  } catch (err: unknown) {
    const error = err as { message?: string; stdout?: string; stderr?: string; code?: number };
    if (error.message === 'TIMEOUT') {
      return { stdout: '', stderr: 'Command timed out', exitCode: -1, timedOut: true };
    }
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || '',
      exitCode: typeof error.code === 'number' ? error.code : 1,
      timedOut: false,
    };
  }
}

export function validatePath(filePath: string): string {
  const normalized = path.resolve(filePath);
  if (!isPathAllowed(normalized)) {
    throw new Error(`Path not allowed by security policy: ${filePath}`);
  }
  return normalized;
}

export function createSandboxDir(name: string): string {
  const sandboxDir = path.join(config.workspace.sandboxRoot, name);
  fs.mkdirSync(sandboxDir, { recursive: true });
  return sandboxDir;
}

export function cleanupSandboxDir(sandboxPath: string): void {
  try {
    fs.rmSync(sandboxPath, { recursive: true, force: true });
  } catch (err) {
    logger.warn('Failed to cleanup sandbox dir', { sandboxPath, err });
  }
}
