# AGENTS.md

## Scope

This repository contains GitHub Copilot custom-agent definitions and MCP
integration documentation. There is no application build or service to run in
this checkout; validate agent frontmatter and tracked documentation.

## Important paths

- `.github/agents/*.agent.md`: Copilot agent profiles with YAML frontmatter
- `MCP_SETUP.md`: required external MCP setup and credential policy
- `README.md`: repository overview
- `AGENT_FILES.md5`: checksums of tracked documentation and agent files
- `.gitignore`: local credential exclusions; never bypass with `git add -f`

## Development checks

Run from repository root:

```sh
md5sum -c AGENT_FILES.md5
python3 -m unittest discover -s tests -p 'test_agent_integrity.py' -v
npx markdownlint-cli2 'AGENTS.md' 'README.md' 'MCP_SETUP.md' '.github/agents/*.agent.md'
```

The explicit hidden-directory glob is important: a generic `**/*.md` glob may
omit the `.github/agents` profiles. Existing Markdown lint warnings should be
reported and fixed separately, not silently treated as clean.

Each `.agent.md` must have YAML frontmatter delimited by `---`. Check
`name`, `description`, `target`, `tools`, `user-invocable` and
`disable-model-invocation` as applicable to the current profile schema.

`AGENT_FILES.md5` must contain only committed, existing files, never itself,
missing examples, local secrets or credentials. Regenerate tracked-file
checksums when the listed files change and verify them in CI.

## External MCP setup (not automatic)

Declaring `tools: ["*"]` does **not** install or authorize PrimusNEX MCP.
An administrator must separately configure the `mcp-primusnex-neu` server
(`https://mcp.primusnex.com/sse`) in the appropriate GitHub Copilot
repository/organization settings and supply
`COPILOT_MCP_PRIMUSNEX_TOKEN` through the platform's secret manager.
Follow `MCP_SETUP.md`; validate the actual tool list and permissions in the
running Copilot environment before using MCP-dependent operations.

## Security

Never commit, paste or log tokens, private keys, cookies or credentials.
Local files under `.mcp/`, including `.env.local` and
`mcp-config.local.json`, must remain untracked and ignored. Do not
weaken permissions or bypass repository protection, reviews, and approval
gates to make a tool work.
