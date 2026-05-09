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

// Hardcoded safe PATH (never derived from environment)
const SAFE_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

// Hardcoded, fully-qualified paths for each allowed command.
// Using a closed Map prevents user input from influencing the executable path.
const COMMAND_PATHS: Readonly<Record<string, string>> = {
  bash:       '/bin/bash',
  sh:         '/bin/sh',
  python3:    '/usr/bin/python3',
  python:     '/usr/bin/python',
  node:       '/usr/bin/node',
  npm:        '/usr/bin/npm',
  npx:        '/usr/bin/npx',
  git:        '/usr/bin/git',
  curl:       '/usr/bin/curl',
  wget:       '/usr/bin/wget',
  grep:       '/bin/grep',
  find:       '/usr/bin/find',
  ls:         '/bin/ls',
  cat:        '/bin/cat',
  head:       '/usr/bin/head',
  tail:       '/usr/bin/tail',
  diff:       '/usr/bin/diff',
  patch:      '/usr/bin/patch',
  sed:        '/bin/sed',
  awk:        '/usr/bin/awk',
  wc:         '/usr/bin/wc',
  sort:       '/usr/bin/sort',
  uniq:       '/usr/bin/uniq',
  kill:       '/bin/kill',
  ps:         '/bin/ps',
  df:         '/bin/df',
  free:       '/usr/bin/free',
  top:        '/usr/bin/top',
  mkdir:      '/bin/mkdir',
  cp:         '/bin/cp',
  mv:         '/bin/mv',
  rm:         '/bin/rm',
  chmod:      '/bin/chmod',
  chown:      '/bin/chown',
  tar:        '/bin/tar',
  gzip:       '/bin/gzip',
  gunzip:     '/bin/gunzip',
  ssh:        '/usr/bin/ssh',
  scp:        '/usr/bin/scp',
  rsync:      '/usr/bin/rsync',
  'apt-get':  '/usr/bin/apt-get',
  pip3:       '/usr/bin/pip3',
  pip:        '/usr/bin/pip',
  xdotool:    '/usr/bin/xdotool',
  xclip:      '/usr/bin/xclip',
  scrot:      '/usr/bin/scrot',
  wmctrl:     '/usr/bin/wmctrl',
  xdpyinfo:   '/usr/bin/xdpyinfo',
  ffmpeg:     '/usr/bin/ffmpeg',
  sox:        '/usr/bin/sox',
  arecord:    '/usr/bin/arecord',
  aplay:      '/usr/bin/aplay',
  tesseract:  '/usr/bin/tesseract',
  tsc:        '/usr/bin/tsc',
  go:         '/usr/bin/go',
  cargo:      '/usr/bin/cargo',
  rustc:      '/usr/bin/rustc',
  java:       '/usr/bin/java',
  javac:      '/usr/bin/javac',
  mvn:        '/usr/bin/mvn',
  gradle:     '/usr/bin/gradle',
  pytest:     '/usr/bin/pytest',
  ruff:       '/usr/local/bin/ruff',
  mypy:       '/usr/local/bin/mypy',
  pyright:    '/usr/local/bin/pyright',
  crontab:    '/usr/bin/crontab',
  journalctl: '/usr/bin/journalctl',
  systemctl:  '/usr/bin/systemctl',
  docker:     '/usr/bin/docker',
};

const BLOCKED_PATTERNS = [
  'rm -rf /',
  'mkfs',
  'dd if=/dev/zero',
  ':(){ :|:& };:',
];

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

  // Validate command against the hardcoded allowlist and get its fixed path
  const baseName = path.basename(command);
  const fixedPath = COMMAND_PATHS[baseName];
  if (!fixedPath) {
    throw new Error(`Command not in allowlist: ${command}`);
  }

  if (!isCommandSafe(`${command} ${args.join(' ')}`)) {
    throw new Error(`Command blocked by sandbox policy: ${command}`);
  }

  logger.debug('sandbox_exec', { command: fixedPath, args, cwd });

  // Use the fixed, hardcoded path - never user input
  try {
    const result = await Promise.race([
      execFileAsync(fixedPath, args, {
        cwd,
        // Use only safe, hardcoded PATH - never inherit from process.env
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
