import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TargetSchema, PortListSchema, TimeoutSchema, sanitizeArg } from "../../util/validation.js";

export function registerMasscanTools(server: McpServer): void {
  server.tool(
    "masscan_full",
    "Run a fast Masscan scan over all 65535 ports on a target or CIDR range.",
    {
      target: TargetSchema.describe("IP or CIDR to scan, e.g. 10.0.0.0/24"),
      rate: z.number().int().min(100).max(1000000).default(10000).describe("Packets per second"),
      timeout_sec: TimeoutSchema,
    },
    async ({ target, rate, timeout_sec }) => {
      const args = ["-p0-65535", "--rate", String(rate), sanitizeArg(target)];
      const result = await runCommand("masscan", args, { timeoutMs: timeout_sec * 1000 });
      return { content: [{ type: "text", text: formatResult("masscan_full", result) }] };
    }
  );

  server.tool(
    "masscan_ports",
    "Masscan scan on a specific list of ports.",
    {
      target: TargetSchema,
      ports: PortListSchema.describe("Ports to scan, e.g. '22,80,443,8080'"),
      rate: z.number().int().min(100).max(1000000).default(10000),
      timeout_sec: TimeoutSchema,
    },
    async ({ target, ports, rate, timeout_sec }) => {
      const args = ["-p", sanitizeArg(ports), "--rate", String(rate), sanitizeArg(target)];
      const result = await runCommand("masscan", args, { timeoutMs: timeout_sec * 1000 });
      return { content: [{ type: "text", text: formatResult("masscan_ports", result) }] };
    }
  );

  server.tool(
    "masscan_top_ports",
    "Masscan scan on the top N common ports.",
    {
      target: TargetSchema,
      top: z.number().int().min(10).max(1000).default(100).describe("How many top ports to scan"),
      rate: z.number().int().min(100).max(1000000).default(10000),
      timeout_sec: TimeoutSchema,
    },
    async ({ target, top, rate, timeout_sec }) => {
      // Top ports approximation — masscan supports --top-ports flag
      const args = ["--top-ports", String(top), "--rate", String(rate), sanitizeArg(target)];
      const result = await runCommand("masscan", args, { timeoutMs: timeout_sec * 1000 });
      return { content: [{ type: "text", text: formatResult("masscan_top_ports", result) }] };
    }
  );
}
