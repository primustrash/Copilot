import { exec as execCb, spawn } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Maximum bytes kept from a tool's stdout/stderr. */
const OUTPUT_LIMIT = 512 * 1024; // 512 KB

/** Default command timeout (ms). */
export const DEFAULT_TIMEOUT_MS = 120_000; // 2 min

/**
 * Run a shell command and return combined output.
 * Throws if the process exits non-zero AND stderr is non-empty.
 */
export async function runCommand(
  cmd: string,
  args: string[],
  opts: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}
): Promise<ExecResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      env: { ...process.env, ...opts.env },
      timeout: timeoutMs,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let totalOut = 0;

    proc.stdout.on("data", (chunk: Buffer) => {
      if (totalOut < OUTPUT_LIMIT) {
        stdoutChunks.push(chunk);
        totalOut += chunk.length;
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      if (totalOut < OUTPUT_LIMIT) {
        stderrChunks.push(chunk);
        totalOut += chunk.length;
      }
    });

    proc.on("close", (exitCode) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf8").slice(0, OUTPUT_LIMIT),
        stderr: Buffer.concat(stderrChunks).toString("utf8").slice(0, OUTPUT_LIMIT),
        exitCode: exitCode ?? 1,
      });
    });

    proc.on("error", reject);
  });
}

/**
 * Check whether a CLI tool is available in PATH.
 * Uses spawn instead of a shell to avoid injection risks.
 */
export async function toolAvailable(name: string): Promise<boolean> {
  // Only allow simple alphanumeric tool names with hyphens/underscores
  if (!/^[\w-]+$/.test(name)) return false;
  try {
    const result = await runCommand("which", [name], { timeoutMs: 5000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/** Format a result from a security tool into a human-readable string. */
export function formatResult(tool: string, result: ExecResult): string {
  const lines: string[] = [`=== ${tool} ===`];
  if (result.stdout.trim()) lines.push(result.stdout.trim());
  if (result.stderr.trim()) lines.push(`[stderr]\n${result.stderr.trim()}`);
  lines.push(`[exit code: ${result.exitCode}]`);
  return lines.join("\n\n");
}
