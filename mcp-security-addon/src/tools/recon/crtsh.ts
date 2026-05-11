import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TargetSchema, TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerCrtshTools(server: McpServer): void {
  server.tool(
    "crtsh_enum",
    "Query crt.sh Certificate Transparency logs to discover subdomains for a domain.",
    {
      domain: TargetSchema.describe("Root domain, e.g. example.com"),
      timeout_sec: TimeoutSchema,
    },
    async ({ domain, timeout_sec }) => {
      const url = `https://crt.sh/?q=%25.${encodeURIComponent(sanitizeArg(domain))}&output=json`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout_sec * 1000);
      try {
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) {
          return { content: [{ type: "text", text: `crt.sh returned HTTP ${resp.status}` }] };
        }
        const data = (await resp.json()) as Array<{ name_value: string }>;
        const subdomains = [
          ...new Set(
            data.flatMap((e) => e.name_value.split("\n").map((s: string) => s.trim()))
          ),
        ]
          .filter((s) => s.endsWith(domain))
          .sort();
        return {
          content: [
            {
              type: "text",
              text: subdomains.length
                ? `Found ${subdomains.length} subdomains:\n${subdomains.join("\n")}`
                : "No subdomains found in crt.sh",
            },
          ],
        };
      } finally {
        clearTimeout(timer);
      }
    }
  );
}
