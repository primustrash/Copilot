import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerWpscanTools(server: McpServer): void {
  server.tool(
    "wpscan",
    "Scan a WordPress site for known vulnerabilities, outdated plugins, themes, and user enumeration.",
    {
      url: z.string().url().describe("WordPress site URL"),
      enumerate: z.string().default("vp,vt,u").describe("Enumeration flags: vp=vulnerable plugins, vt=vulnerable themes, u=users, ap=all plugins"),
      api_token: z.string().optional().describe("WPScan API token for vulnerability database lookups"),
      timeout_sec: TimeoutSchema,
    },
    async ({ url, enumerate, api_token, timeout_sec }) => {
      const args = ["--url", sanitizeArg(url), "--enumerate", sanitizeArg(enumerate), "--format", "cli"];
      if (api_token) args.push("--api-token", sanitizeArg(api_token));

      const result = await runCommand("wpscan", args, { timeoutMs: timeout_sec * 1000 });
      return { content: [{ type: "text", text: formatResult("wpscan", result) }] };
    }
  );
}
