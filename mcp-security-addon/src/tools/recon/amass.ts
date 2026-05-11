import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TargetSchema, TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerAmassTools(server: McpServer): void {
  server.tool(
    "amass_enum",
    "Enumerate subdomains for a domain using Amass passive intelligence sources.",
    {
      domain: TargetSchema.describe("Root domain, e.g. example.com"),
      passive: z.boolean().default(true).describe("Passive only (no active DNS brute-forcing)"),
      timeout_sec: TimeoutSchema,
    },
    async ({ domain, passive, timeout_sec }) => {
      const args = ["enum", "-d", sanitizeArg(domain)];
      if (passive) args.push("-passive");
      const result = await runCommand("amass", args, { timeoutMs: timeout_sec * 1000 });
      return { content: [{ type: "text", text: formatResult("amass_enum", result) }] };
    }
  );
}
