# PrimusNEX MCP setup for GitHub Copilot agents

This package configures the PrimusNEX MCP server for the custom Copilot agents in `.github/agents/`.

## Server

- Name: `mcp-primusnex-neu`
- Type: `sse`
- URL: `https://mcp.primusnex.com/sse`
- Tools: `*`
- Secret name for GitHub Copilot Cloud Agent: `COPILOT_MCP_PRIMUSNEX_TOKEN`

## Files

| File | Purpose | Commit? |
|---|---|---:|
| `.github/agents/*.agent.md` | Custom agent profiles with MCP server frontmatter | Yes |
| `.github/copilot/mcp-config.template.json` | Safe JSON template for GitHub repository settings | Yes |
| `.mcp/.env.example` | Safe local template | Yes |
| `.mcp/.env.local` | Local API secret file with real token | No |
| `.mcp/mcp-config.local.json` | Local MCP config with real token | No |
| `.gitignore` | Prevents local secrets from being committed | Yes |

## GitHub Cloud Agent setup

1. Add an Agents secret or variable named `COPILOT_MCP_PRIMUSNEX_TOKEN`.
2. Use the token value from `.mcp/.env.local`.
3. In repository settings, configure Copilot Cloud Agent MCP using `.github/copilot/mcp-config.template.json`, or rely on the `mcp-servers` block already embedded in each `.agent.md` profile.
4. Validate that the MCP server starts and exposes tools in the Copilot Cloud Agent logs.

## Security rules

- Never commit `.mcp/.env.local` or `.mcp/mcp-config.local.json`.
- Never paste the bearer token into `.agent.md`, `AGENTS.md`, README files, issues, PRs, logs, or prompts.
- Use read-only MCP tools first.
- Require human approval before production, destructive, release, deployment, paid, quota-changing, or external-message actions.
