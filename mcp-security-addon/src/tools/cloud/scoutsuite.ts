import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerScoutsuiteTools(server: McpServer): void {
  server.tool(
    "scoutsuite_audit",
    "Run a ScoutSuite cloud security audit against an AWS, Azure, or GCP account. Requires pre-configured cloud credentials in the environment.",
    {
      provider: z.enum(["aws", "azure", "gcp"]).describe("Cloud provider to audit"),
      report_dir: z.string().default("/tmp/scoutsuite-report").describe("Directory for the HTML report"),
      timeout_sec: z.number().int().min(60).max(3600).default(600),
    },
    async ({ provider, report_dir, timeout_sec }) => {
      const args = ["-m", "scout", provider, "--no-browser", "--report-dir", sanitizeArg(report_dir)];
      const result = await runCommand("python3", args, { timeoutMs: timeout_sec * 1000 });
      return { content: [{ type: "text", text: formatResult("scoutsuite_audit", result) }] };
    }
  );
}
