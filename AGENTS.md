# AGENTS.md

## Cursor Cloud specific instructions

### Repository overview

This is a **configuration-only repository** — it contains GitHub Copilot custom agent profiles (`.github/agents/*.agent.md`) and MCP server setup documentation. There is no application code, no package manager, no build system, no automated tests, and no runnable services.

### What's in the repo

| Path | Purpose |
|---|---|
| `.github/agents/*.agent.md` | 6 Copilot custom agent profiles with YAML frontmatter |
| `.github/agents/1.md` | Earlier draft of the codex subagent (not `.agent.md` naming) |
| `README.md` | Repo overview and agent entry points |
| `MCP_SETUP.md` | MCP server configuration guide |
| `AGENT_FILES.md5` | MD5 checksums (stale — see note below) |

### Validation commands

Since there are no dependencies or build steps, the closest equivalent to lint/test is:

- **YAML frontmatter validation**: `python3 -c "import yaml; ..."` on each `.agent.md` file to check the frontmatter parses correctly.
- **MD5 integrity check**: Compare `AGENT_FILES.md5` against current files with `md5sum`. Note: the checksums are currently out of date relative to the committed agent files, and several files listed in the checksum manifest (`.gitignore`, `.mcp/*`, `.vscode/*`, `.github/copilot/*`) are not present in the repository.

### Known gaps

- No `.gitignore` is committed despite being referenced in `README.md` and `AGENT_FILES.md5`.
- The `.mcp/` directory, `.vscode/mcp.example.json`, and `.github/copilot/mcp-config.template.json` are referenced in documentation but missing from the repo.
- `AGENT_FILES.md5` checksums do not match the current agent files.

### MCP server

The agents connect to an external SSE MCP server at `https://mcp.primusnex.com/sse`. Authentication uses the secret `COPILOT_MCP_PRIMUSNEX_TOKEN`. This server is remote — nothing to start locally.
