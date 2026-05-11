import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TargetSchema, TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerAssetfinderTools(server: McpServer): void {
  server.tool(
    "assetfinder_enum",
    "Passively enumerate subdomains for a domain using assetfinder.",
    {
      domain: TargetSchema.describe("Root domain, e.g. example.com"),
      subs_only: TargetSchema.optional().describe("Restrict output to subdomains of this root domain"),
      timeout_sec: TimeoutSchema,
    },
    async ({ domain, subs_only, timeout_sec }) => {
      const args = subs_only ? ["--subs-only", sanitizeArg(domain)] : [sanitizeArg(domain)];
      const result = await runCommand("assetfinder", args, { timeoutMs: timeout_sec * 1000 });
      return { content: [{ type: "text", text: formatResult("assetfinder_enum", result) }] };
    }
  );
}
