import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spawn } from "node:child_process";
import { formatResult } from "../../util/exec.js";
import { TargetSchema, TimeoutSchema, sanitizeArg } from "../../util/validation.js";

const OUTPUT_LIMIT = 512 * 1024;

/** Run httpx with targets supplied via stdin — no shell interpolation. */
async function runHttpx(
  targets: string[],
  extraArgs: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("httpx", extraArgs, { timeout: timeoutMs });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let total = 0;
    proc.stdout.on("data", (chunk: Buffer) => {
      if (total < OUTPUT_LIMIT) { stdoutChunks.push(chunk); total += chunk.length; }
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      if (total < OUTPUT_LIMIT) { stderrChunks.push(chunk); total += chunk.length; }
    });
    proc.on("close", (exitCode) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf8").slice(0, OUTPUT_LIMIT),
        stderr: Buffer.concat(stderrChunks).toString("utf8").slice(0, OUTPUT_LIMIT),
        exitCode: exitCode ?? 1,
      });
    });
    proc.on("error", reject);
    // Write sanitized targets via stdin — no shell involvement
    proc.stdin.write(targets.map((t) => sanitizeArg(t)).join("\n") + "\n");
    proc.stdin.end();
  });
}

export function registerHttpxTools(server: McpServer): void {
  server.tool(
    "httpx_probe",
    "Probe a list of hosts or URLs with httpx to discover alive HTTP services, status codes, titles, and headers.",
    {
      targets: z.array(TargetSchema).min(1).max(500).describe("List of hosts/URLs to probe"),
      follow_redirects: z.boolean().default(true),
      timeout_sec: TimeoutSchema,
    },
    async ({ targets, follow_redirects, timeout_sec }) => {
      const args = ["-silent", "-status-code", "-title", "-tech-detect", "-timeout", String(timeout_sec)];
      if (follow_redirects) args.push("-follow-redirects");
      const result = await runHttpx(targets, args, timeout_sec * 1000 + 5000);
      return { content: [{ type: "text", text: formatResult("httpx_probe", result) }] };
    }
  );
}
