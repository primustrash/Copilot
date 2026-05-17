# AGENTS.md

## Repository overview

This is a **configuration-only** repository containing GitHub Copilot custom agent definitions (`.github/agents/*.agent.md`) and MCP server configuration for the PrimusNEX agent suite. There is no source code, no build system, no package manager, and no runnable services.

## Cursor Cloud specific instructions

- **No dependencies to install.** The update script is a no-op (`true`). There are no packages, lockfiles, or build steps.
- **No services to start.** The repository contains only Markdown agent definition files with YAML frontmatter, documentation, and a checksum file.
- **Validation:** The closest equivalent to a "test" is verifying file integrity with `md5sum -c AGENT_FILES.md5`. Note that the checksum file references files (`.mcp/`, `.gitignore`, `.vscode/`, `.github/copilot/`) that may not be present in every clone — only `.github/agents/*.agent.md`, `README.md`, and `MCP_SETUP.md` are guaranteed to exist.
- **Agent file format:** Each `.agent.md` file uses YAML frontmatter (`---` delimited) with fields `name`, `description`, `target: github-copilot`, `tools: ["*"]`, followed by Markdown prompt content. Edits must preserve valid YAML frontmatter.
- **Secrets:** The MCP server token (`COPILOT_MCP_PRIMUSNEX_TOKEN`) is for GitHub Copilot Cloud Agent runtime only; it is not needed for local development or Cursor Cloud sessions.
