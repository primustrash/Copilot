import { randomUUID } from "node:crypto";
import {
  AckCommandInput,
  ClientPresence,
  FetchPendingCommandsInput,
  ListParticipantsInput,
  MCPServerAdapter,
  PresenceRelayOptions,
  RegisterOrUpdateClientInput,
  RelayCommand,
  SendCommandInput,
} from "./types";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export class PresenceRelayAddon {
  private readonly clients = new Map<string, ClientPresence>();
  private readonly commands = new Map<string, RelayCommand>();
  private readonly perClientQueue = new Map<string, string[]>();
  private readonly heartbeatIntervalMs: number;
  private readonly offlineAfterMs: number;
  private readonly commandTtlMs: number;
  private readonly maxQueuePerClient: number;
  private readonly onPresenceSweep?: (snapshot: ClientPresence[]) => void;
  private timer?: NodeJS.Timeout;

  constructor(options: PresenceRelayOptions = {}) {
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? FIFTEEN_MINUTES;
    this.offlineAfterMs = options.offlineAfterMs ?? Math.max(this.heartbeatIntervalMs + 60_000, 20 * 60 * 1000);
    this.commandTtlMs = options.commandTtlMs ?? 30 * 60 * 1000;
    this.maxQueuePerClient = options.maxQueuePerClient ?? 500;
    this.onPresenceSweep = options.onPresenceSweep;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.scanPresence();
      this.expireCommands();
    }, this.heartbeatIntervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  registerOrUpdateClient(input: RegisterOrUpdateClientInput): ClientPresence {
    const now = Date.now();
    const existing = this.clients.get(input.id);

    const next: ClientPresence = {
      ...(existing ?? {
        id: input.id,
        firstSeenAt: now,
      }),
      ...input,
      firstSeenAt: existing?.firstSeenAt ?? now,
      lastSeenAt: now,
      isOnline: true,
    };

    this.clients.set(input.id, next);
    if (!this.perClientQueue.has(input.id)) {
      this.perClientQueue.set(input.id, []);
    }
    return next;
  }

  heartbeat(clientId: string, patch?: Partial<RegisterOrUpdateClientInput>): ClientPresence {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Unknown client: ${clientId}`);
    }

    const now = Date.now();
    const next: ClientPresence = {
      ...client,
      ...(patch ?? {}),
      id: client.id,
      lastSeenAt: now,
      isOnline: true,
    };

    this.clients.set(clientId, next);
    return next;
  }

  listParticipants(input: ListParticipantsInput = {}): ClientPresence[] {
    this.scanPresence();
    const includeOffline = Boolean(input.includeOffline);
    const all = [...this.clients.values()]
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);

    return includeOffline ? all : all.filter((c) => c.isOnline);
  }

  triggerPresencePingSweep(): { requestedAt: number; requestedFor: string[] } {
    const now = Date.now();
    const requestedFor: string[] = [];

    for (const client of this.clients.values()) {
      client.lastPingRequestedAt = now;
      this.clients.set(client.id, client);
      requestedFor.push(client.id);
      this.enqueueCommand({
        id: randomUUID(),
        fromClientId: "system",
        toClientId: client.id,
        command: "__presence_ping__",
        payload: { requestedAt: now },
        createdAt: now,
        expiresAt: now + this.commandTtlMs,
        status: "queued",
      });
    }

    return { requestedAt: now, requestedFor };
  }

  sendCommand(input: SendCommandInput): RelayCommand {
    const sender = this.clients.get(input.fromClientId);
    const recipient = this.clients.get(input.toClientId);

    if (!sender && input.fromClientId !== "system") {
      throw new Error(`Unknown sender client: ${input.fromClientId}`);
    }
    if (!recipient) {
      throw new Error(`Unknown recipient client: ${input.toClientId}`);
    }

    const now = Date.now();
    const command: RelayCommand = {
      id: randomUUID(),
      fromClientId: input.fromClientId,
      toClientId: input.toClientId,
      command: input.command,
      payload: input.payload,
      createdAt: now,
      expiresAt: now + Math.max(5_000, input.ttlMs ?? this.commandTtlMs),
      status: "queued",
    };

    this.enqueueCommand(command);
    return command;
  }

  fetchPendingCommands(input: FetchPendingCommandsInput): RelayCommand[] {
    this.scanPresence();
    this.expireCommands();

    const queue = this.perClientQueue.get(input.clientId) ?? [];
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 200);
    const out: RelayCommand[] = [];

    for (const commandId of queue) {
      if (out.length >= limit) break;
      const command = this.commands.get(commandId);
      if (!command) continue;
      if (command.status === "acknowledged" || command.status === "failed" || command.status === "expired") continue;

      if (command.status === "queued") {
        command.status = "delivered";
        command.deliveredAt = Date.now();
        this.commands.set(command.id, command);
      }
      out.push(command);
    }

    this.heartbeat(input.clientId);
    return out;
  }

  ackCommand(input: AckCommandInput): RelayCommand {
    const command = this.commands.get(input.commandId);
    if (!command) {
      throw new Error(`Unknown command: ${input.commandId}`);
    }
    if (command.toClientId !== input.clientId) {
      throw new Error(`Client ${input.clientId} cannot acknowledge command ${input.commandId}`);
    }
    if (command.status === "expired") {
      throw new Error(`Command ${input.commandId} is already expired`);
    }

    command.status = input.success ? "acknowledged" : "failed";
    command.acknowledgedAt = Date.now();
    command.result = input.result;
    command.error = input.success ? undefined : input.error ?? "Command execution failed";
    this.commands.set(command.id, command);

    this.cleanupQueueReference(command.toClientId, command.id);
    this.heartbeat(input.clientId);
    return command;
  }

  getCommandStatus(commandId: string): RelayCommand {
    this.expireCommands();
    const command = this.commands.get(commandId);
    if (!command) {
      throw new Error(`Unknown command: ${commandId}`);
    }
    return command;
  }

  scanPresence(): ClientPresence[] {
    const now = Date.now();
    const snapshot: ClientPresence[] = [];

    for (const client of this.clients.values()) {
      const online = now - client.lastSeenAt <= this.offlineAfterMs;
      const next = {
        ...client,
        isOnline: online,
      };
      this.clients.set(client.id, next);
      snapshot.push(next);
    }

    this.onPresenceSweep?.(snapshot);
    return snapshot;
  }

  registerMCPTools(server: MCPServerAdapter, prefix = "presence_relay"): void {
    server.registerTool({
      name: `${prefix}.register_client`,
      description: "Register a participant/client or update known metadata.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          channel: { type: "string" },
          label: { type: "string" },
          appName: { type: "string" },
          appVersion: { type: "string" },
          userId: { type: "string" },
          hostName: { type: "string" },
          ipAddress: { type: "string" },
          os: { type: "string" },
          capabilities: { type: "array", items: { type: "string" } },
          lastKnownLocation: { type: "string" },
        },
        required: ["id", "channel"],
      },
      execute: async (input) => this.registerOrUpdateClient(input as RegisterOrUpdateClientInput),
    });

    server.registerTool({
      name: `${prefix}.heartbeat`,
      description: "Update heartbeat for a participant and keep it online.",
      inputSchema: {
        type: "object",
        properties: {
          clientId: { type: "string" },
          patch: { type: "object" },
        },
        required: ["clientId"],
      },
      execute: async (input) =>
        this.heartbeat(String(input.clientId), input.patch as Partial<RegisterOrUpdateClientInput> | undefined),
    });

    server.registerTool({
      name: `${prefix}.list_participants`,
      description: "List currently available participants with platform/context metadata.",
      inputSchema: {
        type: "object",
        properties: {
          includeOffline: { type: "boolean" },
        },
      },
      execute: async (input) => this.listParticipants(input as ListParticipantsInput),
    });

    server.registerTool({
      name: `${prefix}.ping_all`,
      description: "Manually request presence ping from all known participants.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      execute: async () => this.triggerPresencePingSweep(),
    });

    server.registerTool({
      name: `${prefix}.send_command`,
      description: "Queue a remote command for execution by another participant.",
      inputSchema: {
        type: "object",
        properties: {
          fromClientId: { type: "string" },
          toClientId: { type: "string" },
          command: { type: "string" },
          payload: {},
          ttlMs: { type: "number" },
        },
        required: ["fromClientId", "toClientId", "command"],
      },
      execute: async (input) => this.sendCommand(input as SendCommandInput),
    });

    server.registerTool({
      name: `${prefix}.fetch_pending_commands`,
      description: "Client-side long-poll replacement: fetch queued commands for this participant.",
      inputSchema: {
        type: "object",
        properties: {
          clientId: { type: "string" },
          limit: { type: "number" },
        },
        required: ["clientId"],
      },
      execute: async (input) => this.fetchPendingCommands(input as FetchPendingCommandsInput),
    });

    server.registerTool({
      name: `${prefix}.ack_command`,
      description: "Acknowledge execution result for a previously fetched command.",
      inputSchema: {
        type: "object",
        properties: {
          clientId: { type: "string" },
          commandId: { type: "string" },
          success: { type: "boolean" },
          result: {},
          error: { type: "string" },
        },
        required: ["clientId", "commandId", "success"],
      },
      execute: async (input) => this.ackCommand(input as AckCommandInput),
    });

    server.registerTool({
      name: `${prefix}.command_status`,
      description: "Read command delivery/execution status.",
      inputSchema: {
        type: "object",
        properties: {
          commandId: { type: "string" },
        },
        required: ["commandId"],
      },
      execute: async (input) => this.getCommandStatus(String(input.commandId)),
    });
  }

  private enqueueCommand(command: RelayCommand): void {
    const queue = this.perClientQueue.get(command.toClientId) ?? [];

    if (queue.length >= this.maxQueuePerClient) {
      const dropped = queue.shift();
      if (dropped) {
        const old = this.commands.get(dropped);
        if (old && old.status !== "acknowledged") {
          old.status = "failed";
          old.error = "Dropped due to queue overflow";
          this.commands.set(old.id, old);
        }
      }
    }

    queue.push(command.id);
    this.perClientQueue.set(command.toClientId, queue);
    this.commands.set(command.id, command);
  }

  private expireCommands(): void {
    const now = Date.now();

    for (const command of this.commands.values()) {
      if (command.status === "acknowledged" || command.status === "failed" || command.status === "expired") {
        continue;
      }

      if (command.expiresAt <= now) {
        command.status = "expired";
        command.error = "Command TTL exceeded";
        this.commands.set(command.id, command);
        this.cleanupQueueReference(command.toClientId, command.id);
      }
    }
  }

  private cleanupQueueReference(clientId: string, commandId: string): void {
    const queue = this.perClientQueue.get(clientId);
    if (!queue) return;
    const filtered = queue.filter((id) => id !== commandId);
    this.perClientQueue.set(clientId, filtered);
  }
}

export * from "./types";
