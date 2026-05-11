import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerNucleiTools(server: McpServer): void {
  server.tool(
    "nuclei_scan",
    "Run Nuclei template-based vulnerability scanner against a target URL or host.",
    {
      target: z.string().describe("URL or host to scan, e.g. https://example.com"),
      templates: z.string().optional().describe("Comma-separated template tags or paths, e.g. 'cve,xss,sqli'"),
      severity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
      exclude_tags: z.string().optional().describe("Tags to exclude, e.g. 'dos,intrusive'"),
      rate: z.number().int().min(1).max(500).default(150),
      timeout_sec: TimeoutSchema,
    },
    async ({ target, templates, severity, exclude_tags, rate, timeout_sec }) => {
      const args = ["-u", sanitizeArg(target), "-rate-limit", String(rate), "-silent", "-nc"];
      if (templates) args.push("-t", sanitizeArg(templates));
      if (severity) args.push("-severity", severity);
      if (exclude_tags) args.push("-etags", sanitizeArg(exclude_tags));
      args.push("-timeout", String(timeout_sec));

      const result = await runCommand("nuclei", args, { timeoutMs: timeout_sec * 1000 + 10000 });
      return { content: [{ type: "text", text: formatResult("nuclei_scan", result) }] };
    }
  );
}
