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

const BLOCKED_COMMANDS = [
  'rm -rf /',
  'mkfs',
  'dd if=/dev/zero',
  'fork bomb',
  ':(){ :|:& };:',
];

function isCommandSafe(command: string): boolean {
  const lower = command.toLowerCase();
  for (const blocked of BLOCKED_COMMANDS) {
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

  if (!isCommandSafe(`${command} ${args.join(' ')}`)) {
    throw new Error(`Command blocked by sandbox policy: ${command}`);
  }

  logger.debug('sandbox_exec', { command, args, cwd });

  try {
    const result = await Promise.race([
      execFileAsync(command, args, {
        cwd,
        env: { ...process.env, ...env, PATH: process.env.PATH },
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
