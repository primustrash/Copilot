#!/usr/bin/env node
/**
 * mcp-security-addon
 *
 * A plug-and-play MCP security extension that exposes 30+ offensive and
 * defensive security tools over the Model Context Protocol.
 *
 * Transport: stdio (default) or SSE via MCP_TRANSPORT=sse + MCP_PORT env vars.
 *
 * Inspired by and combining tools from:
 *   - cyproxio/mcp-for-security
 *   - ManuelBerrueta/hacking-buddy-mcp
 *   - GH05TCREW/pentestagent
 *   - 0x4m4/hexstrike-ai
 *   - usestrix/strix
 *   - sqlmapproject/sqlmap
 *   - KeygraphHQ/shannon
 *   - MorDavid/awesome-cyber-security-mcp
 *   - RedHatInsights/insights-mcp
 *   - illegal-instruction-co/processhacker-mcp
 *   - cmpxchg16/mcp-ethical-hacking (research/reference only)
 *   - tristanhausermannpernet/mcp-hacking (research/reference only)
 *   - appsecco/vulnerable-mcp-servers-lab (research/reference only)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllSecurityTools } from "./tools/index.js";

const SERVER_NAME = "mcp-security-addon";
const SERVER_VERSION = "1.0.0";

async function main(): Promise<void> {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerAllSecurityTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is reserved for MCP JSON-RPC messages)
  process.stderr.write(
    `[${SERVER_NAME}] MCP security addon started (stdio transport)\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[${SERVER_NAME}] Fatal: ${err}\n`);
  process.exit(1);
});
