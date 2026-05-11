import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runCommand, formatResult, DEFAULT_TIMEOUT_MS } from "../../util/exec.js";
import { TargetSchema, PortListSchema, TimeoutSchema, buildFlags, sanitizeArg } from "../../util/validation.js";

export function registerNmapTools(server: McpServer): void {
  server.tool(
    "nmap_scan",
    "Run an Nmap scan against a host or network range. Supports service version detection, OS fingerprinting, and script scanning.",
    {
      target: TargetSchema.describe("Host, IP, or CIDR to scan (e.g. 192.168.1.0/24)"),
      ports: PortListSchema.optional().describe("Ports to scan, e.g. '22,80,443' or '1-1024'"),
      scan_type: z.enum(["SV", "A", "sS", "sT", "sU"]).default("SV").describe("Scan type: SV=version, A=aggressive, sS=SYN, sT=TCP, sU=UDP"),
      scripts: z.string().optional().describe("Comma-separated Nmap NSE script names, e.g. 'http-title,ssl-cert'"),
      timeout_sec: TimeoutSchema,
      output_xml: z.boolean().default(false).describe("Emit raw XML output instead of normal text"),
    },
    async ({ target, ports, scan_type, scripts, timeout_sec, output_xml }) => {
      const args = ["-" + scan_type];
      if (ports) args.push("-p", sanitizeArg(ports));
      if (scripts) args.push("--script", sanitizeArg(scripts));
      if (output_xml) args.push("-oX", "-");
      args.push("--host-timeout", `${timeout_sec}s`, sanitizeArg(target));

      const result = await runCommand("nmap", args, { timeoutMs: timeout_sec * 1000 + 5000 });
      return { content: [{ type: "text", text: formatResult("nmap", result) }] };
    }
  );

  server.tool(
    "nmap_discovery",
    "Run a fast host-discovery sweep (ping scan) over a network range.",
    {
      target: TargetSchema.describe("CIDR range, e.g. 10.0.0.0/24"),
      timeout_sec: TimeoutSchema,
    },
    async ({ target, timeout_sec }) => {
      const result = await runCommand("nmap", ["-sn", "--host-timeout", `${timeout_sec}s`, sanitizeArg(target)], {
        timeoutMs: timeout_sec * 1000 + 5000,
      });
      return { content: [{ type: "text", text: formatResult("nmap_discovery", result) }] };
    }
  );

  server.tool(
    "nmap_banner_grab",
    "Grab service banners from open ports using Nmap banner scripts.",
    {
      target: TargetSchema,
      ports: PortListSchema.optional(),
      timeout_sec: TimeoutSchema,
    },
    async ({ target, ports, timeout_sec }) => {
      const args = ["--script", "banner"];
      if (ports) args.push("-p", sanitizeArg(ports));
      args.push("--host-timeout", `${timeout_sec}s`, sanitizeArg(target));
      const result = await runCommand("nmap", args, { timeoutMs: timeout_sec * 1000 + 5000 });
      return { content: [{ type: "text", text: formatResult("nmap_banner_grab", result) }] };
    }
  );

  server.tool(
    "nmap_smb_enum",
    "Enumerate SMB shares, users, and OS information using Nmap SMB scripts.",
    {
      target: TargetSchema,
      timeout_sec: TimeoutSchema,
    },
    async ({ target, timeout_sec }) => {
      const args = [
        "--script", "smb-enum-shares,smb-enum-users,smb-os-discovery",
        "-p", "139,445",
        "--host-timeout", `${timeout_sec}s`,
        sanitizeArg(target),
      ];
      const result = await runCommand("nmap", args, { timeoutMs: timeout_sec * 1000 + 5000 });
      return { content: [{ type: "text", text: formatResult("nmap_smb_enum", result) }] };
    }
  );
}
