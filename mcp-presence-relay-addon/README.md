# MCP Remote Orchestrator Addon

Plug-and-play Addon für MCP-Server, das Teilnehmer-Discovery, Heartbeat-Status, sichere Task-Übertragung, Approval-Flow und Policy-Steuerung kombiniert.

## Kernziele

- Teilnehmer erkennen (Desktop, CLI, Browser, Mobile, Codex, Agenten)
- Status zuverlässig melden (15-Minuten-Heartbeat + manueller Ping)
- Befehle sicher als strukturierte Intents übertragen (keine offene Remote-Shell)
- Ausführung mit Status/Progress/Logs/Ergebnis rückmelden
- Sicherheit erzwingen (Rollen, Allowlist, Approval, Audit)

## Was implementiert ist

- In-Memory Registry für Teilnehmer inkl. Runtime-, Location- und Capability-Metadaten
- Statusmodell: `online`, `stale`, `degraded`, `offline`, `blocked`, `busy`
- 15-Minuten Sweep (konfigurierbar) + manueller Ping (einzeln/Broadcast)
- Command Queue mit TTL, Delivery, Running/Progress, Completion, Cancellation
- Approval-System (`pending/approved/rejected/expired`) für riskante Aktionen
- Policy Engine mit:
  - Intent-Allowlist / Blocklist
  - Rollenbasierter Intent-Freigabe
  - Risikoabhängiger Approval-Pflicht
  - optionaler Workspace-Allowlist
- Audit-Events für wichtige Aktionen

## MCP Tool-Schnittstelle

### Produkt-/Client-Tools

- `participants.list`
- `participants.get`
- `participants.ping`
- `participants.capabilities`
- `commands.send`
- `commands.status`
- `commands.cancel`
- `commands.logs`
- `approvals.request`
- `approvals.resolve`
- `policies.list`
- `policies.update`

### Agent-Runtime-Tools

- `participants.register`
- `participants.heartbeat`
- `commands.fetch`
- `commands.start`
- `commands.progress`
- `commands.complete`

### Legacy-Kompatibilität

Die bisherigen Toolnamen bleiben als Alias verfügbar:

- `presence_relay.register_client`
- `presence_relay.heartbeat`
- `presence_relay.list_participants`
- `presence_relay.ping_all`
- `presence_relay.send_command`
- `presence_relay.fetch_pending_commands`
- `presence_relay.ack_command`
- `presence_relay.command_status`

## Schnellstart

```ts
import { MCPRemoteOrchestrator } from "mcp-presence-relay-addon";

const orchestrator = new MCPRemoteOrchestrator({
  heartbeatIntervalMs: 15 * 60 * 1000,
});

orchestrator.start();
orchestrator.registerMCPTools(server); // registriert participants.*, commands.*, approvals.*, policies.*
```

Optional mit Prefix:

```ts
orchestrator.registerMCPTools(server, "remote");
// -> remote.participants.list, remote.commands.send, ...
```

## Sicherheitsprinzipien

- Keine freie Shell als Default; nur strukturierte `intent`-basierte Tasks
- Blockierte Intents werden hart abgelehnt
- Rollen prüfen send/cancel/policy/approval Aktionen
- Risk-Level kann Approval erzwingen (`high`, `critical`)
- Workspace-Zugriff kann per Allowlist eingeschränkt werden

## Grenzen (MVP-Stand)

- Persistenz ist aktuell In-Memory (kein PostgreSQL/Redis/NATS integriert)
- Device-Agent-Prozess ist nicht Teil dieses Pakets, aber über Agent-Tools vorbereitet
- Für echten Multi-Node-Betrieb empfiehlt sich externe Queue/DB (z. B. Redis + PostgreSQL)

