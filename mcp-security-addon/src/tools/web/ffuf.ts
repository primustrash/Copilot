import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerFfufTools(server: McpServer): void {
  server.tool(
    "ffuf_fuzz",
    "Fuzz web applications with ffuf to discover hidden files, directories, parameters, and vhosts.",
    {
      url: z.string().url().describe("Target URL. Use FUZZ as the placeholder, e.g. https://example.com/FUZZ"),
      wordlist: z.string().describe("Path to the wordlist file"),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "HEAD"]).default("GET"),
      filter_status: z.string().default("404").describe("Comma-separated HTTP status codes to filter OUT"),
      filter_size: z.string().optional().describe("Filter responses by size (bytes), e.g. '0' to hide empty"),
      extensions: z.string().optional().describe("File extensions to append, e.g. '.php,.html,.txt'"),
      rate: z.number().int().min(1).max(5000).default(150).describe("Requests per second"),
      timeout_sec: TimeoutSchema,
    },
    async ({ url, wordlist, method, filter_status, filter_size, extensions, rate, timeout_sec }) => {
      const args = [
        "-u", sanitizeArg(url),
        "-w", sanitizeArg(wordlist),
        "-X", method,
        "-fc", sanitizeArg(filter_status),
        "-rate", String(rate),
        "-t", "50",
        "-timeout", String(timeout_sec),
        "-silent",
      ];
      if (filter_size) args.push("-fs", sanitizeArg(filter_size));
      if (extensions) args.push("-e", sanitizeArg(extensions));

      const result = await runCommand("ffuf", args, { timeoutMs: timeout_sec * 1000 + 5000 });
      return { content: [{ type: "text", text: formatResult("ffuf_fuzz", result) }] };
    }
  );
}
