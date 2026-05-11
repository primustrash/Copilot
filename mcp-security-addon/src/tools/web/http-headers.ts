import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TimeoutSchema, sanitizeArg } from "../../util/validation.js";

const SECURITY_HEADERS = [
  "Strict-Transport-Security",
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "X-XSS-Protection",
  "Access-Control-Allow-Origin",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Embedder-Policy",
];

export function registerHttpHeadersTools(server: McpServer): void {
  server.tool(
    "http_headers_security",
    "Analyse the HTTP security headers of a URL against OWASP best practices.",
    {
      url: z.string().url().describe("URL to check, e.g. https://example.com"),
      timeout_sec: TimeoutSchema,
    },
    async ({ url, timeout_sec }) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout_sec * 1000);
      try {
        const resp = await fetch(sanitizeArg(url), {
          method: "HEAD",
          redirect: "follow",
          signal: controller.signal,
        });

        const lines: string[] = [`URL: ${url}`, `Status: ${resp.status} ${resp.statusText}`, ""];
        const present: string[] = [];
        const missing: string[] = [];

        for (const header of SECURITY_HEADERS) {
          const val = resp.headers.get(header);
          if (val) {
            present.push(`  ✅ ${header}: ${val}`);
          } else {
            missing.push(`  ❌ ${header}: MISSING`);
          }
        }

        lines.push("=== Present Security Headers ===", ...present);
        lines.push("", "=== Missing Security Headers ===", ...missing);
        lines.push("", `Score: ${present.length}/${SECURITY_HEADERS.length} headers present`);

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } finally {
        clearTimeout(timer);
      }
    }
  );

  server.tool(
    "arjun_param_discover",
    "Discover hidden HTTP parameters for a URL using Arjun.",
    {
      url: z.string().url(),
      method: z.enum(["GET", "POST"]).default("GET"),
      timeout_sec: TimeoutSchema,
    },
    async ({ url, method, timeout_sec }) => {
      const { runCommand, formatResult } = await import("../../util/exec.js");
      const args = ["-u", sanitizeArg(url), "-m", method];
      const result = await runCommand("arjun", args, { timeoutMs: timeout_sec * 1000 });
      return { content: [{ type: "text", text: formatResult("arjun_param_discover", result) }] };
    }
  );
}
