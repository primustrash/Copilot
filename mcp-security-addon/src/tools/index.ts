import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Recon
import {
  registerNmapTools,
  registerMasscanTools,
  registerAmassTools,
  registerAssetfinderTools,
  registerHttpxTools,
  registerGoWitnessTools,
  registerKatanaTools,
  registerDnsTools,
  registerCrtshTools,
} from "./recon/index.js";

// Web
import {
  registerFfufTools,
  registerSqlmapTools,
  registerNucleiTools,
  registerWpscanTools,
  registerSslscanTools,
  registerHttpHeadersTools,
} from "./web/index.js";

// Cloud
import { registerScoutsuiteTools, registerKubectlTools } from "./cloud/index.js";

// OSINT
import { registerShodanTools, registerWaybackurlsTools } from "./osint/index.js";

// Analysis
import { registerMobsfTools } from "./analysis/index.js";

/** Register ALL security tools on the given MCP server instance. */
export function registerAllSecurityTools(server: McpServer): void {
  // ── Reconnaissance ──────────────────────────────────────────────────────────
  registerNmapTools(server);
  registerMasscanTools(server);
  registerAmassTools(server);
  registerAssetfinderTools(server);
  registerHttpxTools(server);
  registerGoWitnessTools(server);
  registerKatanaTools(server);
  registerDnsTools(server);
  registerCrtshTools(server);

  // ── Web Application Testing ──────────────────────────────────────────────────
  registerFfufTools(server);
  registerSqlmapTools(server);
  registerNucleiTools(server);
  registerWpscanTools(server);
  registerSslscanTools(server);
  registerHttpHeadersTools(server);

  // ── Cloud & Infrastructure ───────────────────────────────────────────────────
  registerScoutsuiteTools(server);
  registerKubectlTools(server);

  // ── OSINT ────────────────────────────────────────────────────────────────────
  registerShodanTools(server);
  registerWaybackurlsTools(server);

  // ── Mobile & Binary Analysis ─────────────────────────────────────────────────
  registerMobsfTools(server);
}
