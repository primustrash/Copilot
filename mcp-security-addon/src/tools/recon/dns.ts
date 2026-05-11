import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TargetSchema, TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerDnsTools(server: McpServer): void {
  server.tool(
    "dns_lookup",
    "Perform DNS lookups (A, AAAA, MX, TXT, NS, CNAME) for a hostname.",
    {
      host: TargetSchema.describe("Hostname to query"),
      record_types: z
        .array(z.enum(["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA", "PTR"]))
        .default(["A", "MX", "TXT"])
        .describe("DNS record types to query"),
      timeout_sec: TimeoutSchema,
    },
    async ({ host, record_types, timeout_sec }) => {
      const outputs: string[] = [];
      for (const type of record_types) {
        const result = await runCommand("dig", ["+short", sanitizeArg(host), type], {
          timeoutMs: timeout_sec * 1000,
        });
        outputs.push(`[${type}]\n${result.stdout.trim() || "(no records)"}`);
      }
      return { content: [{ type: "text", text: outputs.join("\n\n") }] };
    }
  );

  server.tool(
    "dns_bulk_check",
    "Check which hosts from a list resolve in DNS (useful for alive-subdomain filtering).",
    {
      hosts: z.array(TargetSchema).min(1).max(1000),
      timeout_sec: TimeoutSchema,
    },
    async ({ hosts, timeout_sec }) => {
      const results: string[] = [];
      const concurrency = 20;
      const chunks: string[][] = [];
      for (let i = 0; i < hosts.length; i += concurrency) {
        chunks.push(hosts.slice(i, i + concurrency));
      }
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async (host) => {
            const r = await runCommand("dig", ["+short", sanitizeArg(host), "A"], {
              timeoutMs: 5000,
            });
            const resolved = r.stdout.trim();
            results.push(resolved ? `LIVE  ${host} → ${resolved}` : `DEAD  ${host}`);
          })
        );
      }
      return { content: [{ type: "text", text: results.join("\n") }] };
    }
  );
}
