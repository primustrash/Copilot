import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TimeoutSchema, TargetSchema, sanitizeArg } from "../../util/validation.js";

export function registerShodanTools(server: McpServer): void {
  server.tool(
    "shodan_host_lookup",
    "Look up a host in Shodan to discover open ports, services, and vulnerabilities. Requires SHODAN_API_KEY environment variable.",
    {
      host: TargetSchema.describe("IP address or hostname to look up"),
      timeout_sec: TimeoutSchema,
    },
    async ({ host, timeout_sec }) => {
      const apiKey = process.env.SHODAN_API_KEY;
      if (!apiKey) {
        return { content: [{ type: "text", text: "SHODAN_API_KEY environment variable is not set" }] };
      }
      const url = `https://api.shodan.io/shodan/host/${encodeURIComponent(sanitizeArg(host))}?key=${apiKey}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout_sec * 1000);
      try {
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) return { content: [{ type: "text", text: `Shodan API error: HTTP ${resp.status}` }] };
        const data = await resp.json() as Record<string, unknown>;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } finally {
        clearTimeout(timer);
      }
    }
  );

  server.tool(
    "shodan_search",
    "Search Shodan for hosts matching a query string. Requires SHODAN_API_KEY environment variable.",
    {
      query: z.string().min(2).describe("Shodan search query, e.g. 'apache port:80 country:DE'"),
      page: z.number().int().min(1).max(100).default(1),
      timeout_sec: TimeoutSchema,
    },
    async ({ query, page, timeout_sec }) => {
      const apiKey = process.env.SHODAN_API_KEY;
      if (!apiKey) {
        return { content: [{ type: "text", text: "SHODAN_API_KEY environment variable is not set" }] };
      }
      const url = `https://api.shodan.io/shodan/host/search?key=${apiKey}&query=${encodeURIComponent(query)}&page=${page}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout_sec * 1000);
      try {
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) return { content: [{ type: "text", text: `Shodan API error: HTTP ${resp.status}` }] };
        const data = await resp.json() as Record<string, unknown>;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } finally {
        clearTimeout(timer);
      }
    }
  );
}
