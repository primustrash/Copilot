import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TimeoutSchema, TargetSchema, sanitizeArg } from "../../util/validation.js";

export function registerSslscanTools(server: McpServer): void {
  server.tool(
    "sslscan",
    "Analyse the SSL/TLS configuration of a host, including protocol support, cipher suites, and certificate details.",
    {
      host: TargetSchema.describe("Host[:port] to scan, e.g. example.com or example.com:8443"),
      timeout_sec: TimeoutSchema,
    },
    async ({ host, timeout_sec }) => {
      const args = ["--no-colour", sanitizeArg(host)];
      const result = await runCommand("sslscan", args, { timeoutMs: timeout_sec * 1000 });
      return { content: [{ type: "text", text: formatResult("sslscan", result) }] };
    }
  );
}
