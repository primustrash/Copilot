# mcp-security-addon

> **Plug-and-play MCP security extension** — 30+ offensive and defensive security tools exposed over the [Model Context Protocol](https://modelcontextprotocol.io/), ready to bolt onto any MCP-compatible AI agent or IDE.

---

## Overview

`mcp-security-addon` aggregates the best ideas and tool integrations from the open-source security-MCP ecosystem into one clean, sorted, production-ready TypeScript addon:

| Source project | Capabilities brought in |
|---|---|
| [cyproxio/mcp-for-security](https://github.com/cyproxio/mcp-for-security) | nmap, masscan, ffuf, httpx, katana, nuclei, sqlmap, sslscan, gowitness, amass, assetfinder, wpscan, waybackurls, crtsh, arjun |
| [ManuelBerrueta/hacking-buddy-mcp](https://github.com/ManuelBerrueta/hacking-buddy-mcp) | masscan variations, nmap, SMB enum, sqlmap, kubectl, DNS bulk check |
| [GH05TCREW/pentestagent](https://github.com/GH05TCREW/pentestagent) | Task/agent orchestration patterns |
| [0x4m4/hexstrike-ai](https://github.com/0x4m4/hexstrike-ai) | Broad tool coverage inspiration |
| [usestrix/strix](https://github.com/usestrix/strix) | Vulnerability class coverage, skill organisation model |
| [sqlmapproject/sqlmap](https://github.com/sqlmapproject/sqlmap) | sqlmap CLI integration |
| [MorDavid/awesome-cyber-security-mcp](https://github.com/MorDavid/awesome-cyber-security-mcp) | Shodan, MobSF, cloud audit reference |
| [KeygraphHQ/shannon](https://github.com/KeygraphHQ/shannon) | Web audit patterns |
| [RedHatInsights/insights-mcp](https://github.com/RedHatInsights/insights-mcp) | CVE/vulnerability management model |
| [illegal-instruction-co/processhacker-mcp](https://github.com/illegal-instruction-co/processhacker-mcp) | Safety guardrail patterns (rate limiting, audit log) |

Research-only references (not integrated, used for threat modelling of MCP attack surfaces):
- [cmpxchg16/mcp-ethical-hacking](https://github.com/cmpxchg16/mcp-ethical-hacking)
- [tristanhausermannpernet/mcp-hacking](https://github.com/tristanhausermannpernet/mcp-hacking)
- [appsecco/vulnerable-mcp-servers-lab](https://github.com/appsecco/vulnerable-mcp-servers-lab)

---

## Tool catalogue

### 🔍 Reconnaissance
| Tool name | Description |
|---|---|
| `nmap_scan` | Service/OS fingerprinting with full NSE script support |
| `nmap_discovery` | Fast ping-sweep host discovery |
| `nmap_banner_grab` | Service banner grabbing |
| `nmap_smb_enum` | SMB shares, users, and OS detection |
| `masscan_full` | All-port fast scan |
| `masscan_ports` | Targeted port list scan |
| `masscan_top_ports` | Top-N ports fast scan |
| `amass_enum` | Passive subdomain enumeration |
| `assetfinder_enum` | Passive subdomain discovery |
| `httpx_probe` | HTTP alive-host probing with tech detection |
| `gowitness_screenshot` | Single-URL web screenshot |
| `gowitness_scan` | Bulk web screenshot from file |
| `katana_crawl` | JavaScript-aware web crawler |
| `dns_lookup` | Multi-record DNS lookup |
| `dns_bulk_check` | Bulk subdomain DNS resolution |
| `crtsh_enum` | Certificate Transparency subdomain discovery |

### 🌐 Web Application Testing
| Tool name | Description |
|---|---|
| `ffuf_fuzz` | Directory, file, and parameter fuzzing |
| `sqlmap_test` | SQL injection detection and exploitation |
| `nuclei_scan` | Template-based vulnerability scanning |
| `wpscan` | WordPress vulnerability assessment |
| `sslscan` | SSL/TLS configuration analysis |
| `http_headers_security` | OWASP security header audit |
| `arjun_param_discover` | Hidden HTTP parameter discovery |

### ☁️ Cloud & Infrastructure
| Tool name | Description |
|---|---|
| `scoutsuite_audit` | AWS/Azure/GCP configuration audit |
| `kubectl_enum` | Kubernetes resource enumeration |
| `kubectl_rbac_audit` | Kubernetes RBAC permission audit |

### 🕵️ OSINT
| Tool name | Description |
|---|---|
| `shodan_host_lookup` | Shodan host intelligence lookup |
| `shodan_search` | Shodan search query |
| `waybackurls_fetch` | Historical URL discovery via Wayback Machine |

### 📱 Mobile & Binary Analysis
| Tool name | Description |
|---|---|
| `mobsf_upload_analyze` | MobSF static analysis for APK/IPA files |

---

## Quick Start

### Option A — stdio (recommended for local IDE/agent integration)

```bash
cd mcp-security-addon
npm install
npm run build
node dist/index.js
```

Add to your MCP client config (e.g. VS Code `settings.json` or `mcp.json`):

```json
{
  "mcpServers": {
    "security": {
      "command": "node",
      "args": ["/path/to/mcp-security-addon/dist/index.js"],
      "env": {
        "SHODAN_API_KEY": "${SHODAN_API_KEY}",
        "MOBSF_API_KEY": "${MOBSF_API_KEY}"
      }
    }
  }
}
```

### Option B — Docker (all tools bundled)

```bash
cd mcp-security-addon
npm run build

# Build and run
docker compose -f docker/docker-compose.yml up -d mcp-security-addon

# With MobSF side-car
docker compose -f docker/docker-compose.yml --profile mobsf up -d
```

### Option C — Add to an existing PrimusNEX MCP server

Import and call `registerAllSecurityTools` in your existing server `src/index.ts`:

```ts
import { registerAllSecurityTools } from "./path/to/mcp-security-addon/src/tools/index.js";

// ... after creating your McpServer instance:
registerAllSecurityTools(server);
```

---

## Prerequisites

The following CLI tools must be in `$PATH` for the corresponding tools to work. Install only what you need:

| Tool | Install |
|---|---|
| `nmap` | `apt install nmap` |
| `masscan` | `apt install masscan` |
| `amass` | `go install github.com/owasp-amass/amass/v4/...@latest` |
| `assetfinder` | `go install github.com/tomnomnom/assetfinder@latest` |
| `httpx` | `go install github.com/projectdiscovery/httpx/cmd/httpx@latest` |
| `katana` | `go install github.com/projectdiscovery/katana/cmd/katana@latest` |
| `gowitness` | `go install github.com/sensepost/gowitness@latest` |
| `ffuf` | `go install github.com/projectdiscovery/ffuf/v2@latest` |
| `nuclei` | `go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest` |
| `sqlmap` | `pip install sqlmap` |
| `wpscan` | `gem install wpscan` |
| `sslscan` | `apt install sslscan` |
| `arjun` | `pip install arjun` |
| `waybackurls` | `go install github.com/tomnomnom/waybackurls@latest` |
| `kubectl` | [docs.kubernetes.io](https://kubernetes.io/docs/tasks/tools/) |
| `python3 -m scout` | `pip install scoutsuite` |

Tools that use only HTTP (`crtsh_enum`, `shodan_*`, `http_headers_security`) have no CLI dependency.

---

## Environment Variables

| Variable | Used by | Description |
|---|---|---|
| `SHODAN_API_KEY` | `shodan_*` | Shodan API key |
| `MOBSF_URL` | `mobsf_*` | MobSF server URL (default: `http://localhost:8000`) |
| `MOBSF_API_KEY` | `mobsf_*` | MobSF REST API key |

---

## Agent Integration

The addon ships a ready-to-use Copilot agent profile at `.github/agents/security-pentest-agent.agent.md`. This agent:

- Follows a disciplined 5-phase pentest methodology
- Requires explicit written authorisation before engaging any target
- Maps each phase to the correct tools
- Generates structured findings with CVSS scoring

---

## Security & Ethics

> **Warning** — These tools are designed for **authorised security testing only**.  
> Unauthorised use against systems you do not own or have explicit permission to test is illegal in most jurisdictions.

- Always obtain written authorisation (scope, rules of engagement, NDA).
- Start with passive, read-only recon before any active scanning.
- Never run destructive or exfiltration tools (`sqlmap --dump`, masscan at max rate) without explicit scope permission.
- Handle all discovered data in accordance with your engagement's confidentiality rules.
- Report critical findings to the system owner immediately.

---

## Development

```bash
npm install        # install deps
npm run typecheck  # TypeScript type checking
npm run build      # compile to dist/
npm run dev        # watch mode
```

---

## Architecture

```
mcp-security-addon/
├── src/
│   ├── index.ts                   # MCP server entry point (stdio transport)
│   ├── tools/
│   │   ├── index.ts               # registerAllSecurityTools() aggregator
│   │   ├── recon/                 # nmap, masscan, amass, assetfinder, httpx,
│   │   │                          #   gowitness, katana, dns, crtsh
│   │   ├── web/                   # ffuf, sqlmap, nuclei, wpscan, sslscan,
│   │   │                          #   http-headers (arjun)
│   │   ├── cloud/                 # scoutsuite, kubectl
│   │   ├── osint/                 # shodan, waybackurls
│   │   └── analysis/              # mobsf
│   └── util/
│       ├── exec.ts                # Safe CLI execution helper
│       └── validation.ts          # Zod schemas + input sanitisation
├── docker/
│   ├── Dockerfile                 # Kali Linux base with all tools bundled
│   └── docker-compose.yml         # Addon + optional MobSF side-car
└── .github/agents/
    └── security-pentest-agent.agent.md   # Copilot agent profile
```
