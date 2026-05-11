# PrimusNEX — GitHub Copilot Repository Instructions

This repository hosts the **PrimusNEX** custom Copilot agent profiles and plug-and-play MCP addons.

## Agents

Custom agents live in `.github/agents/`. Entry points:

| Agent | Use for |
|---|---|
| `primusnex-max-autonomy-orchestrator-v1` | Broad autonomous work — planning, delegation, verification |
| `primusnex-orchestrator-agent-v1` | Focused coordination, task graphs, multi-agent supervision |
| `codex-autonomous-loop-subagent` | Coding/implementation loop until success or hard blocker |
| `primusnex-research-agent-v1` | Research, documentation analysis, architecture comparison |
| `primusnex-reverse-engineering-agent-v1` | Codebase/RE analysis, dependency tracing, undocumented systems |
| `primusnex-parallel-execution-swarm-v1` | Safe parallel execution of independent shards |
| `security-pentest-agent` | Authorised penetration testing and security assessment |

## MCP addons

| Addon | Location | Tools |
|---|---|---|
| `mcp-security-addon` | `mcp-security-addon/` | 30+ recon, web, cloud, OSINT, analysis tools |

## Conventions

- **Never** commit `.mcp/.env.local` or `.mcp/mcp-config.local.json` — use `.gitignore` and the provided `.mcp/.env.example` template.
- Agent files follow the `<name>.agent.md` naming convention and include a `mcp-servers` block for auto-connecting to `mcp.primusnex.com`.
- All MCP addons use TypeScript, `@modelcontextprotocol/sdk`, Zod schemas, and safe `spawn`-based CLI execution.
- Run `npm run typecheck && npm run build` in any addon directory before committing.
- Security tools require **explicit written authorisation** from the target system owner before use.

## MCP server

The PrimusNEX MCP server is at `https://mcp.primusnex.com/sse` (SSE transport). Configure the bearer token via GitHub Copilot Agents secret `COPILOT_MCP_PRIMUSNEX_TOKEN`. See `MCP_SETUP.md` for full setup instructions.
