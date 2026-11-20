import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerNmapTools } from "./recon/nmap.js";

/**
 * Security quarantine. The previous registration exposed dozens of active
 * scanning, exploitation, cloud and direct-fetch tools with unbounded targets.
 * Keep them compiled in the source tree for review, but do NOT register them
 * until each has independently verified authorization, SSRF and target gates.
 *
 * Only two fixed-argument Nmap tools are available, both bound to the
 * operator's literal IPv4 allowlist at schema and handler level.
 * With no explicit SECURITY_ADDON_ALLOWED_TARGET_IPS, both reject all calls.
 */
export function registerAllSecurityTools(server: McpServer): void {
  registerNmapTools(server);
}
