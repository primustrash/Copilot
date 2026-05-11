import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerSqlmapTools(server: McpServer): void {
  server.tool(
    "sqlmap_test",
    "Test a URL or request for SQL injection vulnerabilities using sqlmap. ⚠️ Only use against targets you have explicit authorisation to test.",
    {
      url: z.string().url().describe("Target URL, e.g. https://example.com/page?id=1"),
      data: z.string().optional().describe("POST data string, e.g. 'user=foo&pass=bar'"),
      level: z.number().int().min(1).max(5).default(1).describe("Test level (1–5, higher = more thorough)"),
      risk: z.number().int().min(1).max(3).default(1).describe("Risk level (1–3, higher = more invasive)"),
      dbms: z.string().optional().describe("Force DBMS, e.g. 'mysql', 'postgresql'"),
      dump: z.boolean().default(false).describe("Dump database contents after injection found"),
      batch: z.boolean().default(true).describe("Never ask for user input"),
      tamper: z.string().optional().describe("Comma-separated tamper script names for WAF evasion"),
      timeout_sec: TimeoutSchema,
    },
    async ({ url, data, level, risk, dbms, dump, batch, tamper, timeout_sec }) => {
      const args = ["-u", sanitizeArg(url), "--level", String(level), "--risk", String(risk)];
      if (data) args.push("--data", sanitizeArg(data));
      if (dbms) args.push("--dbms", sanitizeArg(dbms));
      if (dump) args.push("--dump");
      if (batch) args.push("--batch");
      if (tamper) args.push("--tamper", sanitizeArg(tamper));
      args.push("--timeout", String(timeout_sec));

      const result = await runCommand("sqlmap", args, { timeoutMs: timeout_sec * 1000 + 10000 });
      return { content: [{ type: "text", text: formatResult("sqlmap_test", result) }] };
    }
  );
}
