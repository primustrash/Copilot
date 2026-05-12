# PrimusNEX GitHub Copilot Custom Agents

Place this `.github/agents/` directory at the root of your repository.

These files are intentionally named with the current Copilot custom-agent convention:

```text
.github/agents/<agent-name>.agent.md
```

`agent.md5` is not the Copilot custom-agent extension. If you require a `.md5` checksum file, generate it separately after editing the agent files.

## 🔗 Codex Marketplace

**NEW:** This repository now includes a comprehensive [Codex Plugin & Connector Marketplace](CODEX_MARKETPLACE.md) with **2,500+ connectors** across **50+ categories**!

### What's Included?
- 🔗 Meta-MCP servers and aggregators
- 🎨 Art, design, and creative tools
- ☁️ Cloud platforms and infrastructure
- 🤖 AI coding agents and assistants
- 🗄️ Databases and data platforms
- 💰 Finance, crypto, and payment systems
- 🌐 Social media and communication
- 🛠️ Developer tools and utilities
- ...and 42 more categories!

### Quick Access
- **Browse**: [CODEX_MARKETPLACE.md](CODEX_MARKETPLACE.md)
- **Install**: Add marketplace source to Codex
- **API**: [marketplace.json](marketplace.json)

```bash
codex plugin marketplace add \
  "https://raw.githubusercontent.com/primustrash/Copilot/main/marketplace.json"
```

## MCP integration

Each agent uses:

```yaml
tools: ["*"]
```

This lets the agent use built-in Copilot tools and any repository/profile MCP tools you add later. Add your MCP server configuration either in repository settings or inside the YAML frontmatter of the relevant `.agent.md` file.

Do not place API keys directly in agent prompts. Use GitHub Copilot Agents secrets/variables, repository/organization secrets, or your cloud provider secret manager.

## Suggested main entry points

- `primusnex-max-autonomy-orchestrator-v1` — primary agent for broad autonomous work
- `primusnex-orchestrator-agent-v1` — focused planning/delegation coordinator
- `codex-autonomous-loop-subagent` — coding/autonomous execution worker
- `primusnex-research-agent-v1` — research and documentation analysis
- `primusnex-reverse-engineering-agent-v1` — codebase/reverse-engineering analysis
- `primusnex-parallel-execution-swarm-v1` — safe parallel execution coordinator

## MCP configuration

The agents are configured for the `mcp-primusnex-neu` SSE MCP server through their YAML frontmatter. Runtime authentication should use the GitHub Copilot Agents secret `COPILOT_MCP_PRIMUSNEX_TOKEN`.

Local secret files are stored under `.mcp/` and are intentionally ignored by Git. See `MCP_SETUP.md`.

