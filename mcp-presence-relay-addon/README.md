# mcp-presence-relay-addon

Plug-and-play Addon für MCP-Server, um Teilnehmer/Clients sichtbar zu machen und stabile Befehlsübertragung zwischen Teilnehmern zu ermöglichen.

## Was das Addon bietet

- Automatischer Presence-Sweep alle 15 Minuten (konfigurierbar)
- Manueller Ping-Sweep für alle bekannten Teilnehmer
- Teilnehmer-Registry inkl. Metadaten (`browser`, `cli`, `desktopapp`, `mobile`, ...)
- Command-Queue mit TTL, Delivery-Status, Ack/Fail und Status-Abfrage
- MCP-Tool-Registrierung über `registerMCPTools()`

## Schnellstart

```ts
import { PresenceRelayAddon } from "mcp-presence-relay-addon";

const addon = new PresenceRelayAddon({
  heartbeatIntervalMs: 15 * 60 * 1000,
});

addon.start();
addon.registerMCPTools(server, "presence_relay");
```

## Registrierte Tools

- `presence_relay.register_client`
- `presence_relay.heartbeat`
- `presence_relay.list_participants`
- `presence_relay.ping_all`
- `presence_relay.send_command`
- `presence_relay.fetch_pending_commands`
- `presence_relay.ack_command`
- `presence_relay.command_status`

## Bestehende Lösungen (wenn verteilter Betrieb nötig ist)

Für Multi-Node/Cluster-Betrieb können später bestehende Lösungen unterlegt werden:

- Redis Streams / PubSub (Queue + Presence-Verteilung)
- NATS (leichtgewichtiges Messaging mit Ack-Patterns)
- MQTT Broker (IoT/Device-lastige Topologien)

Diese Basis-Implementierung ist absichtlich ohne externe Infrastruktur gehalten und kann direkt eingebaut werden.
