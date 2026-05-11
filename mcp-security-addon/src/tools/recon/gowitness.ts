import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TargetSchema, TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerGoWitnessTools(server: McpServer): void {
  server.tool(
    "gowitness_screenshot",
    "Take a screenshot of a web page using gowitness and return the path to the saved image.",
    {
      url: z.string().url().describe("URL to screenshot, e.g. https://example.com"),
      output_dir: z.string().default("/tmp/gowitness").describe("Directory to store screenshots"),
      timeout_sec: TimeoutSchema,
    },
    async ({ url, output_dir, timeout_sec }) => {
      const args = ["single", "--url", sanitizeArg(url), "--screenshot-path", sanitizeArg(output_dir)];
      const result = await runCommand("gowitness", args, { timeoutMs: timeout_sec * 1000 });
      return { content: [{ type: "text", text: formatResult("gowitness_screenshot", result) }] };
    }
  );

  server.tool(
    "gowitness_scan",
    "Screenshot multiple URLs from a file using gowitness.",
    {
      url_file: z.string().describe("Path to a file containing one URL per line"),
      output_dir: z.string().default("/tmp/gowitness"),
      timeout_sec: TimeoutSchema,
    },
    async ({ url_file, output_dir, timeout_sec }) => {
      const args = ["file", "-f", sanitizeArg(url_file), "--screenshot-path", sanitizeArg(output_dir)];
      const result = await runCommand("gowitness", args, { timeoutMs: timeout_sec * 1000 });
      return { content: [{ type: "text", text: formatResult("gowitness_scan", result) }] };
    }
  );
}
