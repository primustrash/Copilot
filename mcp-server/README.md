# MCP Plug-and-Play Server 🚀

A complete, production-ready **Model Context Protocol (MCP) server** for Linux with **all tool categories** pre-implemented, ready for direct use on Ubuntu 22.04/24.04 LTS.

## ⚡ Quickstart (3 commands)

```bash
git clone https://github.com/primustrash/Copilot.git
cd Copilot/mcp-server
sudo bash setup.sh
```

The setup script automatically installs all dependencies, configures services, and starts the server.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Nginx (SSL Proxy)                          │
│                      Port 80/443                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    MCP Server (Node.js)                         │
│                      Port 3000                                  │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ API Key  │  │  OAuth 2.0   │  │    Rate Limiter          │  │
│  │  Auth    │  │   Auth       │  │    (200 req/min)         │  │
│  └──────────┘  └──────────────┘  └──────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Tool Registry                         │   │
│  │  agent  workflow  memory  filesystem  desktop  audio     │   │
│  │  mouse  keyboard  apps    browser     shell    ai        │   │
│  │  monitoring  security  infra  repo  code  git  github   │   │
│  │  workspace  ide  ci  review  docs                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   SSE    │  │  Streamable  │  │       JSON-RPC           │  │
│  │Transport │  │    HTTP      │  │       REST API           │  │
│  └──────────┘  └──────────────┘  └──────────────────────────┘  │
└──────────┬────────────────┬───────────────────────┬────────────┘
           │                │                       │
┌──────────▼──┐  ┌──────────▼──┐  ┌────────────────▼────────────┐
│   Redis     │  │  PostgreSQL  │  │    Qdrant (Vector DB)       │
│ Cache/Pub   │  │  Goals/Tasks │  │    Semantic Search          │
└─────────────┘  └─────────────┘  └─────────────────────────────┘
```

---

## 📦 Installation

### Prerequisites
- Ubuntu 22.04 or 24.04 LTS
- Root or sudo access
- Internet connection

### One-liner install
```bash
curl -fsSL https://raw.githubusercontent.com/primustrash/Copilot/main/mcp-server/install.sh | sudo bash
```

### Manual install
```bash
git clone https://github.com/primustrash/Copilot.git
cd Copilot/mcp-server
sudo bash setup.sh
```

### Docker only
```bash
cp .env.example .env
# Edit .env with your API keys
docker compose up -d
```

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check (no auth) |
| `/mcp/info` | GET | Server information |
| `/mcp/tools` | GET | List all tools |
| `/mcp/tools/call` | POST | Execute a tool |
| `/mcp/stream` | POST | Streamable HTTP tool call |
| `/mcp/sse` | GET | Server-Sent Events stream |
| `/mcp/categories` | GET | List tool categories |
| `/mcp/resources` | GET | List resources |
| `/mcp/prompts` | GET | List prompts |
| `/auth/oauth` | GET | Start OAuth flow |
| `/auth/callback` | GET | OAuth callback |

---

## 🔐 Authentication

### API Key (recommended)
```bash
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"tool": "get_app_status", "input": {}}'
```

### Bearer Token
```bash
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Authorization: Bearer your-api-key" \
  -d '{"tool": "list_agents", "input": {}}'
```

### Basic Auth
```bash
curl -X POST http://localhost:3000/mcp/tools/call \
  -u "api-key:your-api-key" \
  -d '{"tool": "list_agents", "input": {}}'
```

### OAuth 2.0
1. GET `/auth/oauth` → returns `auth_url`
2. User authenticates at auth_url
3. Callback to `/auth/callback` returns JWT `mcp_token`
4. Use `mcp_token` as Bearer token

### Auth-Metadaten / Methoden
- `GET /auth/methods` → aktive Auth-Varianten, Header und Remote-MCP-Profile
- `GET /.well-known/oauth-authorization-server` → OAuth-Metadaten

### Remote MCP Profile
- PrimusNex-Endpunkte können lokal über `.env` aktiviert werden:
  - `PRIMUSNEX_MCP_URL`
  - `PRIMUSNEX_API_KEY_HEADER`
  - `PRIMUSNEX_OAUTH_AUTH_URL`
  - `PRIMUSNEX_OAUTH_TOKEN_URL`
  - `PRIMUSNEX_OAUTH_CLIENT_ID`
  - `PRIMUSNEX_OAUTH_CLIENT_SECRET`
- Zugangsdaten werden bewusst **nicht** im Repository gespeichert.

---

## 🛠️ Tool Categories & Examples

### 1. Agent Discovery & Routing

```json
// Register an agent
{"tool": "register_agent", "input": {"id": "agent-1", "name": "Code Agent", "capabilities": ["code", "git"]}}

// List agents
{"tool": "list_agents", "input": {"status": "active"}}

// Send message to agent
{"tool": "send_message", "input": {"to_agent_id": "agent-1", "message": "Start task"}}

// Decompose a goal into tasks
{"tool": "decompose_goal", "input": {"goal": "Build a REST API", "max_tasks": 5}}
```

### 2. Goal & Workflow Orchestration

```json
// Create a goal
{"tool": "create_goal", "input": {"title": "Implement feature X", "description": "Add user auth"}}

// Make a plan
{"tool": "planner.make_plan", "input": {"goal": "Build authentication system"}}

// Schedule a task
{"tool": "scheduler.run_at", "input": {"task": "backup_database", "run_at": "2024-01-01T02:00:00Z"}}

// Request human approval
{"tool": "request_approval", "input": {"task_id": "task-123", "description": "Delete production data"}}
```

### 3. Shared Memory & Knowledge

```json
// Store in memory
{"tool": "memory.store", "input": {"key": "project_config", "value": {"name": "my-app"}}}

// Semantic search
{"tool": "semantic_search", "input": {"query": "authentication implementation", "top_k": 5}}

// Add insight
{"tool": "add_insight", "input": {"content": "Use JWT for stateless auth", "tags": ["auth", "security"]}}

// Create session
{"tool": "create_session", "input": {"session_id": "coding-session-1"}}
```

### 4. File & Project Operations

```json
// Read a file
{"tool": "read_file", "input": {"path": "/home/user/project/src/index.ts"}}

// Write a file
{"tool": "write_file", "input": {"path": "/tmp/test.txt", "content": "Hello World"}}

// Search files
{"tool": "search_files", "input": {"directory": "/home/user/project", "pattern": "*.ts", "content_search": "function"}}

// Summarize project
{"tool": "summarize_project", "input": {"path": "/home/user/project"}}
```

### 5. Desktop & UI Perception

```json
// Take screenshot
{"tool": "screen.screenshot", "input": {"output_path": "/tmp/screen.png"}}

// OCR text from screen
{"tool": "screen.ocr", "input": {"image_path": "/tmp/screen.png"}}

// List windows
{"tool": "screen.list_windows", "input": {}}

// Get active window
{"tool": "screen.get_active_window", "input": {}}
```

### 6. Shell, Processes & System

```json
// Run shell command
{"tool": "shell.run", "input": {"command": "ls -la /home", "cwd": "/home"}}

// Run tests
{"tool": "shell.run_tests", "input": {"cwd": "/home/user/project", "command": "npm test"}}

// SSH execute
{"tool": "ssh_exec", "input": {"host": "192.168.1.100", "command": "uptime", "username": "ubuntu"}}

// Get metrics
{"tool": "get_metrics", "input": {}}
```

### 7. Git Operations

```json
// Git status
{"tool": "git.status", "input": {"cwd": "/home/user/project"}}

// Create branch
{"tool": "git.create_branch", "input": {"cwd": "/home/user/project", "branch": "feature/auth"}}

// Commit
{"tool": "git.commit", "input": {"cwd": "/home/user/project", "message": "feat: add authentication"}}

// Push
{"tool": "git.push", "input": {"cwd": "/home/user/project", "remote": "origin", "branch": "feature/auth"}}
```

### 8. GitHub API

```json
// Create PR
{"tool": "github.create_pull_request", "input": {
  "owner": "myorg", "repo": "myrepo",
  "title": "Add authentication", "head": "feature/auth", "base": "main"
}}

// List issues
{"tool": "github.list_issues", "input": {"owner": "myorg", "repo": "myrepo", "state": "open"}}

// Get workflow status
{"tool": "github.get_workflow_status", "input": {"owner": "myorg", "repo": "myrepo", "run_id": 12345}}
```

### 9. Code Operations

```json
// Edit file
{"tool": "code.edit_file", "input": {
  "path": "/home/user/project/src/auth.ts",
  "old_str": "return null;",
  "new_str": "return token;"
}}

// Find security issues
{"tool": "code.find_security_issues", "input": {"path": "/home/user/project/src/api.ts"}}

// Generate tests
{"tool": "code.generate_tests", "input": {"path": "/home/user/project/src/utils.ts", "framework": "jest"}}
```

### 10. Security & Approval

```json
// Check policy
{"tool": "policy.get", "input": {"policy_name": "allowed_paths"}}

// Scan for secrets
{"tool": "security.scan_secrets", "input": {"path": "/home/user/project"}}

// Request approval for dangerous action
{"tool": "approval.request", "input": {
  "action": "delete_database", "description": "Delete all user data", "risk_level": "critical"
}}
```

### 11. Monitoring & Telemetry

```json
// Get audit log
{"tool": "get_audit_log", "input": {"limit": 50}}

// Get top tools
{"tool": "get_top_tools", "input": {"limit": 10}}

// Check budget
{"tool": "budget.check", "input": {}}

// Classify risk
{"tool": "risk.classify", "input": {"action": "rm -rf /var/data"}}
```

---

## ⚙️ Configuration

### Environment Variables (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_PORT` | Server port | `3000` |
| `MCP_HOST` | Server host | `0.0.0.0` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `POSTGRES_URL` | PostgreSQL connection URL | - |
| `QDRANT_URL` | Qdrant vector DB URL | `http://localhost:6333` |
| `API_KEY_SECRET` | API key for authentication | **required** |
| `JWT_SECRET` | JWT signing secret | **required** |
| `OPENAI_API_KEY` | OpenAI API key | optional |
| `ANTHROPIC_API_KEY` | Anthropic API key | optional |
| `GITHUB_TOKEN` | GitHub personal access token | optional |
| `SSH_KEY_PATH` | Path to SSH private key | `~/.ssh/id_rsa` |
| `ALLOWED_PATHS` | Comma-separated allowed filesystem paths | `/tmp` |
| `ALLOWED_DOMAINS` | Comma-separated allowed network domains | `localhost` |
| `KILL_SWITCH_ENABLED` | Enable kill switch feature | `false` |
| `BUDGET_MAX_TOKENS_PER_HOUR` | Max AI tokens per hour | `100000` |

### MCP Config (config/mcp.config.json)

Configure which tool categories are enabled, transport options, and auth settings.

### Security Policies (config/policies.json)

Define allowed paths, blocked commands, rate limits, and approval requirements.

---

## 🔒 Security

### Sandbox
All shell commands run through the sandbox module which:
- Validates commands against a blocklist
- Enforces path restrictions
- Sets timeouts
- Limits output size

### API Key Authentication
- API keys are validated on every request
- Keys can be rotated without restart
- All requests are audit logged

### Kill Switch
Emergency stop mechanism:
```bash
curl -X POST http://localhost:3000/admin/kill-switch \
  -H "X-Kill-Switch-Token: your-token" \
  -d '{"action": "enable"}'
```

### Rate Limiting
- Default: 200 requests per minute per IP
- Configurable via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`

---

## 🐳 Docker Services

| Service | Port | Description |
|---------|------|-------------|
| `mcp-server` | 3000 | Main MCP server |
| `redis` | 6379 | Cache, sessions, pub/sub |
| `postgres` | 5432 | Goals, tasks, audit logs |
| `qdrant` | 6333 | Vector search |
| `nginx` | 80/443 | Reverse proxy with SSL |
| `playwright-server` | 3001 | Browser automation |

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f mcp-server

# Stop all services
docker compose down

# Status
docker compose ps
```

---

## 🔧 Service Management

```bash
# systemd
systemctl status mcp-server
systemctl restart mcp-server
systemctl stop mcp-server
journalctl -u mcp-server -f

# Health check
bash scripts/healthcheck.sh

# Backup
bash scripts/backup.sh

# Update
bash scripts/update.sh
```

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Lint
npm run lint

# Type check
npm run typecheck
```

---

## 📝 Adding Custom Tools

```typescript
import { registerTool } from './registry';
import { z } from 'zod';

registerTool({
  name: 'my_custom_tool',
  description: 'Does something useful',
  category: 'custom',
  schema: z.object({
    input: z.string(),
    count: z.number().optional(),
  }),
  handler: async (input) => {
    const { input: text, count = 1 } = input as { input: string; count?: number };
    return { result: text.repeat(count) };
  },
});
```

Then import it in `src/index.ts`.

---

## 📊 Complete Tool List

Over **150 tools** across 24 categories. See [config/tools.json](config/tools.json) for the complete list.

| Category | Tool Count | Key Tools |
|----------|-----------|-----------|
| Agent | 34 | register_agent, decompose_goal, create_handover |
| Workflow | 30 | create_goal, planner.make_plan, autopilot.start |
| Memory | 27 | semantic_search, upsert_memory, memory.store |
| Filesystem | 22 | read_file, write_file, search_files, fs.* |
| Desktop | 11 | screen.screenshot, screen.ocr, screen.list_windows |
| Audio | 9 | audio.transcribe, audio.start_capture |
| Mouse | 11 | mouse.click, mouse.drag, mouse.scroll |
| Keyboard | 9 | keyboard.type, clipboard.get, clipboard.set |
| Apps | 13 | apps.launch, windows.focus, windows.resize |
| Browser | 17 | browser.open, browser.click, browser.screenshot |
| Shell | 22 | shell.run, ssh_exec, vps_ssh_execute |
| AI | 6 | code_complete, code_review, list_models |
| Monitoring | 9 | get_audit_log, risk.classify, budget.check |
| Security | 16 | security.scan_secrets, approval.request |
| Infra | 6 | tools/list, prompts/get, run_prompt |
| Repo | 14 | repo.clone, repo.search, repo.detect_stack |
| Code | 27 | code.edit_file, code.generate_tests |
| Git | 21 | git.status, git.commit, git.create_worktree |
| GitHub | 16 | github.create_pr, github.run_workflow |
| Workspace | 10 | workspace.create, workspace.create_sandbox |
| IDE | 11 | ide.open_file, ide.show_diff, ide.apply_suggestion |
| CI | 7 | ci.run_tests, ci.get_status, ci.retry_job |
| Review | 8 | review.create_summary, review.prepare_pr_description |
| Docs | 8 | docs.generate_docs, docs.generate_changelog |

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-tool`
3. Add tool in appropriate `src/tools/category/index.ts`
4. Import in `src/index.ts`
5. Submit PR

---

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.
