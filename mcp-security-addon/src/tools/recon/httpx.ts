import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TargetSchema, TimeoutSchema, UrlSchema, sanitizeArg } from "../../util/validation.js";

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
      const input = targets.map(sanitizeArg).join("\n");
      const args = ["-silent", "-status-code", "-title", "-tech-detect"];
      if (follow_redirects) args.push("-follow-redirects");
      args.push("-timeout", String(timeout_sec));

      // Pipe target list via stdin using echo
      const result = await runCommand("bash", [
        "-c",
        `printf '%s\n' ${targets.map((t) => `'${sanitizeArg(t)}'`).join(" ")} | httpx ${args.join(" ")}`,
      ], { timeoutMs: timeout_sec * 1000 + 5000 });

      return { content: [{ type: "text", text: formatResult("httpx_probe", result) }] };
    }
  );
}
