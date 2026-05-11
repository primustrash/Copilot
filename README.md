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
---

# Copilot Agent Launcher

An interactive Python tool to discover available GitHub Copilot models, configure
tools, and launch AI agents — locally via CLI or through cloud APIs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Copilot Agent Launcher                       │
├──────────┬──────────────┬──────────────┬────────────────────┤
│  GitHub  │    Models    │    Tools     │  Agent Runner      │
│  Client  │   Manager    │   Catalog    │  (CLI / Cloud)     │
├──────────┴──────────────┴──────────────┴────────────────────┤
│                     Configuration                            │
│               (YAML / Environment / CLI)                     │
└─────────────────────────────────────────────────────────────┘
```

| Component | File | Purpose |
|---|---|---|
| **GitHub Client** | `copilot_agent/github_client.py` | Authenticates with your GitHub token, queries the Copilot and Models APIs for available models. |
| **Models Manager** | `copilot_agent/models.py` | Lists, filters (by capability / source), and formats model information. |
| **Tools Catalog** | `copilot_agent/tools.py` | Curated set of tools the agent can call — each defined in OpenAI function-calling schema. |
| **Agent Runner** | `copilot_agent/agent.py` | Sends prompts + tool definitions to the model, executes tool calls locally, feeds results back. |
| **Configuration** | `copilot_agent/config.py` | Loads/saves YAML config; reads GitHub token from environment. |
| **CLI** | `copilot_agent/cli.py` | Interactive menu that ties everything together. |

---

## Quick Start

### 1. Prerequisites

- Python 3.9+
- A GitHub personal access token with Copilot access

### 2. Install

```bash
# Clone the repository
git clone https://github.com/primustrash/Copilot.git
cd Copilot

# Install dependencies
pip install -r requirements.txt

# Or install as a package
pip install -e .
```

### 3. Set your GitHub Token

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

### 4. Run

```bash
python -m copilot_agent
```

You will see an interactive menu:

```
==================================================
  Copilot Agent Launcher
==================================================
  Auth: ❌  |  Model: none  |  Tools: 0

  [1] 📖  Architecture overview
  [2] 🔑  Authenticate with GitHub
  [3] 🤖  Browse & select models
  [4] 🔧  Browse & select tools
  [5] ⚙️   Configure agent settings
  [6] 🚀  Launch agent
  [7] 💾  Save configuration
  [0] 🚪  Exit
```

---

## Available Models

The launcher queries GitHub for your accessible models. If the API is
unreachable it falls back to well-known models:

| Model | ID | Capabilities |
|---|---|---|
| GPT-4o | `gpt-4o` | chat, function_calling, vision |
| GPT-4o Mini | `gpt-4o-mini` | chat, function_calling |
| GPT-4.1 | `gpt-4.1` | chat, function_calling, vision |
| Claude Sonnet 4 | `claude-sonnet-4` | chat, function_calling |
| Claude 3.5 Haiku | `claude-haiku-3.5` | chat, function_calling |
| o3-mini | `o3-mini` | chat, function_calling |
| Gemini 2.0 Flash | `gemini-2.0-flash` | chat, function_calling, vision |

You can filter models by capability (`chat`, `vision`, `function_calling`)
or by source (`github-copilot`, `github-models`).

---

## Available Tools

Tools are actions the agent can call during a conversation. Each tool follows
the OpenAI function-calling schema so any compatible model can use it.

| Tool | Category | Download? | Description |
|---|---|---|---|
| **Shell Command Execution** | system | No | Run any shell command (builds, tests, git, etc.) |
| **File Reader** | filesystem | No | Read file contents from disk |
| **File Writer** | filesystem | No | Write/create files on disk |
| **Web Search** | web | No | Search the web for information |
| **Code Analyzer** | development | No | Static analysis for dependencies, complexity, patterns, security |
| **Git Operations** | version_control | No | git status, diff, log, commit, branch, checkout |
| **Python Executor** | development | No | Execute Python code in a subprocess |
| **Docker Manager** | infrastructure | Yes | Build, run, stop, and inspect Docker containers |

### Do I need to download tools?

Most tools use programs already on your machine (shell, git, Python) —
**no extra download needed**. Tools marked with **Yes** in the Download
column require their respective software to be installed first
(e.g. Docker Desktop for the Docker Manager).

---

## Configuration

Settings are stored in `configs/default.yaml`:

```yaml
github_token_env: GITHUB_TOKEN    # env var holding your token
default_model: null                # pre-selected model ID
default_tools: []                  # pre-selected tool names
agent:
  mode: cli                        # cli | cloud
  max_iterations: 10               # max tool rounds per message
  temperature: 0.7                 # 0.0 = deterministic, 2.0 = creative
  system_prompt: >
    You are a helpful coding assistant with access to tools.
```

You can edit this file directly or use menu option **[5]** to change
settings interactively, then **[7]** to save.

---

## How the Agent Works

1. **You type a prompt** in the CLI.
2. The prompt, along with tool definitions, is sent to the selected model
   via the GitHub Models inference API.
3. If the model wants to use a tool, it returns a `tool_calls` response.
4. The launcher **executes the tool locally** (e.g. runs a shell command)
   and sends the result back to the model.
5. Steps 3–4 repeat until the model produces a final text answer.

This gives you a **local agent** that leverages cloud models for reasoning
but executes actions on your own machine.

---

## Running Tests

```bash
pip install pytest
pytest tests/ -v
```

---

## License

MIT
---

# Copilot

OpenWrt-Firmware-Vorlage für die **Creality Box / WB01** als:

- sichere Cloud↔Heimnetz-Bridge,
- USB-Lokal/Cloud-Speicher-Connector,
- LuCI-konfigurierbares Gateway mit ACL, Mapping, Backup und Update-Optionen.

Einstieg: `wb01-firmware/README.md`