import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerWaybackurlsTools(server: McpServer): void {
  server.tool(
    "waybackurls_fetch",
    "Fetch all historical URLs for a domain from the Wayback Machine / Common Crawl via waybackurls.",
    {
      domain: z.string().min(3).describe("Domain to query, e.g. example.com"),
      no_subs: z.boolean().default(false).describe("Exclude subdomains"),
      timeout_sec: TimeoutSchema,
    },
    async ({ domain, no_subs, timeout_sec }) => {
      const args = no_subs ? ["-no-subs", sanitizeArg(domain)] : [sanitizeArg(domain)];
      const result = await runCommand("waybackurls", args, { timeoutMs: timeout_sec * 1000 });
      return { content: [{ type: "text", text: formatResult("waybackurls_fetch", result) }] };
    }
  );
}
