import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerKatanaTools(server: McpServer): void {
  server.tool(
    "katana_crawl",
    "Crawl a web application using Katana to discover endpoints, forms, and JavaScript-rendered pages.",
    {
      url: z.string().url().describe("Seed URL to start crawling from"),
      depth: z.number().int().min(1).max(10).default(3).describe("Crawl depth"),
      js_crawl: z.boolean().default(true).describe("Enable JavaScript parsing for single-page apps"),
      timeout_sec: TimeoutSchema,
    },
    async ({ url, depth, js_crawl, timeout_sec }) => {
      const args = ["-u", sanitizeArg(url), "-d", String(depth), "-silent"];
      if (js_crawl) args.push("-jc");
      args.push("-timeout", String(timeout_sec));
      const result = await runCommand("katana", args, { timeoutMs: timeout_sec * 1000 + 5000 });
      return { content: [{ type: "text", text: formatResult("katana_crawl", result) }] };
    }
  );
}
