# PrimusNEX GitHub Copilot Custom Agents

Place this `.github/agents/` directory at the root of your repository.

These files are intentionally named with the current Copilot custom-agent convention:

```text
.github/agents/<agent-name>.agent.md
```

`agent.md5` is not the Copilot custom-agent extension. If you require a `.md5` checksum file, generate it separately after editing the agent files.

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

## Useful Git Commands

### Clone the repository
To download this repository for the first time:
```bash
git clone https://github.com/primustrash/Copilot.git
```

### Pull the latest changes
To update your local copy with the latest changes from the remote repository:
```bash
git pull
```

Or, to be explicit about the remote and branch:
```bash
git pull origin main
```

### Other common commands
```bash
# Check the status of your local changes
git status

# Add files to the staging area
git add .

# Commit your changes
git commit -m "Your commit message"

# Push your changes to the remote repository
git push
```
