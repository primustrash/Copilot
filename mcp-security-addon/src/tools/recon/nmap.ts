import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult } from "../../util/exec.js";
import { TargetSchema, PortListSchema, TimeoutSchema } from "../../util/validation.js";

export function registerNmapTools(server: McpServer): void {
  server.tool(
    "nmap_scan",
    "Bounded TCP service detection against one pre-authorized literal IPv4 address only",
    {
      target: TargetSchema,
      ports: PortListSchema.optional(),
      scan_type: z.enum(["sT", "sV"]).default("sT"),
      timeout_sec: TimeoutSchema,
    },
    async ({ target, ports, scan_type, timeout_sec }) => {
      if (!TargetSchema.safeParse(target).success) {
        return { isError: true, content: [{ type: "text" as const, text: "Target not authorized" }] };
      }
      const args = ["-n", "-Pn", "-" + scan_type];
      if (ports) args.push("-p", ports);
      args.push("--host-timeout", String(timeout_sec) + "s", "--", target);
      const result = await runCommand("nmap", args, {
        timeoutMs: timeout_sec * 1000 + 5000,
      });
      return { content: [{ type: "text" as const, text: formatResult("nmap_scan", result) }] };
    }
  );

  server.tool(
    "nmap_discovery",
    "Bounded reachability discovery for one approved literal IPv4 address (no CIDR sweep)",
    {
      target: TargetSchema,
      timeout_sec: TimeoutSchema,
    },
    async ({ target, timeout_sec }) => {
      if (!TargetSchema.safeParse(target).success) {
        return { isError: true, content: [{ type: "text" as const, text: "Target not authorized" }] };
      }
      const result = await runCommand("nmap",
        ["-n", "-sn", "--host-timeout", String(timeout_sec) + "s", "--", target],
        { timeoutMs: timeout_sec * 1000 + 5000 });
      return { content: [{ type: "text" as const, text: formatResult("nmap_discovery", result) }] };
    }
  );
}
