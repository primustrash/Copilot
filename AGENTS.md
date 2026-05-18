# AGENTS.md

## Cursor Cloud specific instructions

### Repository overview

This is a **configuration-only repository** containing GitHub Copilot custom agent definitions (`.agent.md` files) and MCP server configuration for PrimusNEX. There is no application code, no build system, no test suites, and no services to run locally.

### Key files

- `.github/agents/*.agent.md` — 6 GitHub Copilot custom agent profile definitions with YAML frontmatter
- `.github/agents/1.md` — alternate/draft agent definition (not in `.agent.md` naming convention)
- `README.md` — top-level documentation
- `MCP_SETUP.md` — MCP server configuration and security instructions
- `AGENT_FILES.md5` — MD5 checksums (note: checksums may be stale relative to current file contents)

### Development workflow

Since this repo has no application code, "development" means editing the `.agent.md` files and documentation.

**Lint:** Run `markdownlint-cli2 "**/*.md"` to check markdown quality. The existing files have pre-existing lint warnings (mostly line-length MD013 and multiple-blank-lines MD012) that are part of the current state of the repo.

**Validate frontmatter:** Each `.agent.md` file must start with a YAML frontmatter block delimited by `---`. Required fields: `name`, `description`, `target`, `tools`, `user-invocable`, `disable-model-invocation`.

**Checksum verification:** Run `md5sum -c AGENT_FILES.md5` to verify file integrity. Note that some files listed in `AGENT_FILES.md5` are gitignored (`.mcp/.env.local`, `.mcp/mcp-config.local.json`) or not present in the repository (`.gitignore`, `.github/copilot/mcp-config.template.json`, `.vscode/mcp.example.json`).

### External dependencies

The agents depend on the remote MCP server at `https://mcp.primusnex.com/sse` (authenticated via `COPILOT_MCP_PRIMUSNEX_TOKEN`). This is an external service and cannot be tested locally.

### Security notes

- Never commit secrets or tokens to agent files — see `MCP_SETUP.md` for the security policy.
- Local secret files belong in `.mcp/` and are intentionally gitignored.
