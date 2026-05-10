import { randomUUID } from "node:crypto";
import {
  ApprovalRecord,
  ApprovalStatus,
  AuditEvent,
  CancelCommandInput,
  CommandLogsInput,
  CommandRecord,
  CommandStatus,
  CommandStatusInput,
  CompleteCommandInput,
  FetchPendingCommandsInput,
  HeartbeatInput,
  ListParticipantsInput,
  MCPServerAdapter,
  OrchestratorOptions,
  ParticipantRecord,
  ParticipantStatus,
  ProgressCommandInput,
  RegisterParticipantInput,
  ResolveApprovalInput,
  RiskLevel,
  SendCommandInput,
  StartCommandInput,
  UpdatePolicyInput,
  UserRole,
  PolicyRecord,
  RequestApprovalInput,
} from "./types";

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;
const TERMINAL_COMMAND_STATUSES: CommandStatus[] = ["completed", "failed", "cancelled", "expired"];

interface PingInput {
  participantId?: string;
  timeoutSeconds?: number;
}

interface LegacySendInput {
  fromClientId: string;
  toClientId: string;
  command: string;
  payload?: unknown;
  ttlMs?: number;
}

function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  const order: UserRole[] = ["viewer", "operator", "developer", "admin", "owner"];
  return order.indexOf(role) >= order.indexOf(minimum);
}

function normalizeRole(role: unknown): UserRole {
  const allowed: UserRole[] = ["viewer", "operator", "developer", "admin", "owner"];
  const value = String(role ?? "viewer") as UserRole;
  return allowed.includes(value) ? value : "viewer";
}

export class MCPRemoteOrchestrator {
  private readonly participants = new Map<string, ParticipantRecord>();
  private readonly commands = new Map<string, CommandRecord>();
  private readonly commandQueueByParticipant = new Map<string, string[]>();
  private readonly approvals = new Map<string, ApprovalRecord>();
  private readonly auditEvents: AuditEvent[] = [];

  private readonly heartbeatIntervalMs: number;
  private readonly staleAfterMs: number;
  private readonly offlineAfterMs: number;
  private readonly commandTtlMs: number;
  private readonly maxQueuePerParticipant: number;
  private readonly maxCommandLogs: number;
  private readonly onPresenceSweep?: (snapshot: ParticipantRecord[]) => void;

  private policy: PolicyRecord;
  private timer?: NodeJS.Timeout;

  constructor(options: OrchestratorOptions = {}) {
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? FIFTEEN_MINUTES;
    this.staleAfterMs = options.staleAfterMs ?? THIRTY_MINUTES;
    this.offlineAfterMs = options.offlineAfterMs ?? THIRTY_MINUTES;
    this.commandTtlMs = options.commandTtlMs ?? 30 * 60 * 1000;
    this.maxQueuePerParticipant = options.maxQueuePerParticipant ?? 500;
    this.maxCommandLogs = options.maxCommandLogs ?? 500;
    this.onPresenceSweep = options.onPresenceSweep;

    const now = Date.now();
    this.policy = {
      version: 1,
      allowlistedIntents: ["codex.task.run", "shell.exec.allowlisted", "browser.automation", "filesystem.project_access", "legacy.command"],
      blockedIntents: ["shell.exec.raw", "shell.exec.unrestricted", "system.delete.recursive"],
      roleIntentAllowlist: {
        viewer: [],
        operator: ["codex.task.run", "browser.automation"],
        developer: ["codex.task.run", "shell.exec.allowlisted", "filesystem.project_access", "browser.automation", "legacy.command"],
        admin: ["codex.task.run", "shell.exec.allowlisted", "filesystem.project_access", "browser.automation", "legacy.command"],
        owner: ["codex.task.run", "shell.exec.allowlisted", "filesystem.project_access", "browser.automation", "legacy.command"],
      },
      riskApprovalRequired: {
        low: false,
        medium: false,
        high: true,
        critical: true,
      },
      workspaceAllowlist: [],
      updatedAt: now,
      updatedBy: "system",
      ...(options.policySeed ?? {}),
    };
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.scanPresence();
      this.expireCommands();
      this.expireApprovals();
    }, this.heartbeatIntervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  registerParticipant(input: RegisterParticipantInput): ParticipantRecord {
    const now = Date.now();
    const existing = this.participants.get(input.participantId);
    const record: ParticipantRecord = {
      participantId: input.participantId,
      displayName: input.displayName,
      ownerUserId: input.ownerUserId ?? existing?.ownerUserId,
      deviceFingerprint: input.deviceFingerprint ?? existing?.deviceFingerprint,
      agentVersion: input.agentVersion ?? existing?.agentVersion,
      channel: input.channel,
      type: input.type,
      transport: input.transport ?? existing?.transport ?? "unknown",
      hostName: input.hostName ?? existing?.hostName,
      userName: input.userName ?? existing?.userName,
      runtime: input.runtime ?? existing?.runtime,
      location: input.location ?? existing?.location,
      capabilities: input.capabilities ?? existing?.capabilities ?? [],
      tags: input.tags ?? existing?.tags,
      approvalMode: input.approvalMode ?? existing?.approvalMode ?? "on-risk",
      trustLevel: input.trustLevel ?? existing?.trustLevel ?? "normal",
      status: existing?.status ?? "online",
      firstSeenAt: existing?.firstSeenAt ?? now,
      lastSeenAt: now,
      lastHeartbeatAt: now,
      lastPingRequestedAt: existing?.lastPingRequestedAt,
      lastPingRespondedAt: existing?.lastPingRespondedAt,
      activeTaskCount: existing?.activeTaskCount ?? 0,
      degradedReason: input.degradedReason,
      blockedReason: existing?.blockedReason,
    };

    if (record.blockedReason) {
      record.status = "blocked";
    } else if (record.degradedReason) {
      record.status = "degraded";
    } else {
      record.status = "online";
    }

    this.participants.set(record.participantId, record);
    if (!this.commandQueueByParticipant.has(record.participantId)) {
      this.commandQueueByParticipant.set(record.participantId, []);
    }

    this.appendAudit("participant.registered", { participantId: record.participantId }, record.participantId);
    return record;
  }

  heartbeat(input: HeartbeatInput | string, patch?: Partial<RegisterParticipantInput>): ParticipantRecord {
    if (typeof input === "string") {
      const participantId = input;
      return this.heartbeat({
        participantId,
        capabilities: patch?.capabilities,
        location: patch?.location,
        runtime: patch?.runtime,
      });
    }

    const participant = this.participants.get(input.participantId);
    if (!participant) {
      throw new Error(`Unknown participant: ${input.participantId}`);
    }

    const now = Date.now();
    participant.lastSeenAt = now;
    participant.lastHeartbeatAt = now;
    if (input.capabilities) participant.capabilities = input.capabilities;
    if (input.location) participant.location = input.location;
    if (input.runtime) participant.runtime = input.runtime;
    if (typeof input.activeTaskCount === "number") participant.activeTaskCount = Math.max(0, input.activeTaskCount);
    participant.degradedReason = input.degradedReason;

    this.participants.set(participant.participantId, this.deriveParticipantStatus(participant));
    return this.participants.get(participant.participantId)!;
  }

  listParticipants(input: ListParticipantsInput = {}): ParticipantRecord[] {
    this.scanPresence();
    const includeOffline = Boolean(input.includeOffline);

    return [...this.participants.values()]
      .filter((participant) => {
        if (!includeOffline && participant.status === "offline") return false;
        if (input.status && participant.status !== input.status) return false;
        if (input.capability && !participant.capabilities.includes(input.capability)) return false;
        if (input.tag && !(participant.tags ?? []).includes(input.tag)) return false;
        return true;
      })
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }

  getParticipant(participantId: string): ParticipantRecord {
    this.scanPresence();
    const participant = this.participants.get(participantId);
    if (!participant) throw new Error(`Unknown participant: ${participantId}`);
    return participant;
  }

  getParticipantCapabilities(participantId: string): { participantId: string; capabilities: string[] } {
    const participant = this.getParticipant(participantId);
    return {
      participantId: participant.participantId,
      capabilities: participant.capabilities,
    };
  }

  pingParticipants(input: PingInput = {}): { requestedAt: number; results: Array<Record<string, unknown>> } {
    this.scanPresence();
    const requestedAt = Date.now();
    const targets = input.participantId
      ? [this.getParticipant(input.participantId)]
      : [...this.participants.values()];

    const results = targets.map((participant) => {
      participant.lastPingRequestedAt = requestedAt;
      const reachable = participant.status !== "offline" && participant.status !== "blocked";
      const latencyMs = reachable ? Math.max(5, Math.min(2_000, Date.now() - participant.lastHeartbeatAt)) : null;
      if (reachable) participant.lastPingRespondedAt = Date.now();
      this.participants.set(participant.participantId, participant);

      return {
        participant_id: participant.participantId,
        reachable,
        latency_ms: latencyMs,
        current_status: participant.status,
        active_tasks: participant.activeTaskCount,
        timestamp: new Date().toISOString(),
      };
    });

    this.appendAudit("participants.ping", { targetCount: results.length }, input.participantId);
    return { requestedAt, results };
  }

  sendCommand(input: SendCommandInput | LegacySendInput): CommandRecord {
    if ("fromClientId" in input) {
      const legacy = input;
      return this.sendCommand({
        target: legacy.toClientId,
        intent: "legacy.command",
        instruction: legacy.command,
        payload: legacy.payload,
        requestedBy: legacy.fromClientId,
        actorRole: "developer",
        requireApproval: false,
        ttlMs: legacy.ttlMs,
      });
    }

    const role = normalizeRole(input.actorRole);
    if (!roleAtLeast(role, "operator")) {
      throw new Error(`Role ${role} is not allowed to send commands`);
    }

    const participant = this.participants.get(input.target);
    if (!participant) throw new Error(`Unknown target participant: ${input.target}`);
    if (participant.status === "blocked") {
      throw new Error(`Target participant is blocked: ${participant.participantId}`);
    }

    this.assertIntentAllowed(role, input.intent);
    this.assertWorkspaceAllowed(input.workspace);

    const now = Date.now();
    const riskLevel = input.riskLevel ?? this.deriveRiskLevel(input.intent);
    const approvalRequired =
      Boolean(input.requireApproval) ||
      participant.approvalMode === "always" ||
      (participant.approvalMode === "on-risk" && (riskLevel === "high" || riskLevel === "critical")) ||
      Boolean(this.policy.riskApprovalRequired[riskLevel]);

    const command: CommandRecord = {
      commandId: randomUUID(),
      targetParticipantId: participant.participantId,
      requestedBy: input.requestedBy,
      actorRole: role,
      intent: input.intent,
      payload: {
        target: input.target,
        intent: input.intent,
        workspace: input.workspace,
        instruction: input.instruction,
        mode: input.mode ?? "safe",
        payload: input.payload,
      },
      status: approvalRequired ? "waiting_approval" : "queued",
      riskLevel,
      approvalRequired,
      createdAt: now,
      expiresAt: now + Math.max(5_000, input.ttlMs ?? this.commandTtlMs),
      retries: 0,
      maxRetries: Math.max(0, input.maxRetries ?? 1),
      logs: [],
    };

    this.appendCommandLog(command, "info", "Command accepted by orchestrator");
    this.commands.set(command.commandId, command);

    if (approvalRequired) {
      const approval = this.createApproval({
        commandId: command.commandId,
        requestedBy: input.requestedBy,
        reason: `Approval required for risk level ${riskLevel}`,
      });
      command.approvalId = approval.approvalId;
      this.commands.set(command.commandId, command);
    } else {
      this.enqueueCommand(command);
    }

    this.appendAudit("command.created", {
      commandId: command.commandId,
      target: command.targetParticipantId,
      intent: command.intent,
      riskLevel,
      approvalRequired,
    }, command.targetParticipantId, command.commandId, input.requestedBy);

    return command;
  }

  fetchPendingCommands(input: FetchPendingCommandsInput | { clientId: string; limit?: number }): CommandRecord[] {
    const participantId = "clientId" in input ? input.clientId : input.participantId;
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 200);

    this.scanPresence();
    this.expireCommands();

    const queue = this.commandQueueByParticipant.get(participantId) ?? [];
    const out: CommandRecord[] = [];

    for (const commandId of queue) {
      if (out.length >= limit) break;
      const command = this.commands.get(commandId);
      if (!command || TERMINAL_COMMAND_STATUSES.includes(command.status)) continue;
      if (command.status === "waiting_approval") continue;

      if (command.status === "queued") {
        command.status = "delivered";
        this.appendCommandLog(command, "info", "Command delivered to participant queue fetch");
        this.commands.set(command.commandId, command);
      }

      out.push(command);
    }

    this.heartbeat({ participantId });
    return out;
  }

  startCommand(input: StartCommandInput): CommandRecord {
    const command = this.requireCommand(input.commandId);
    this.assertCommandTarget(input.participantId, command);
    if (TERMINAL_COMMAND_STATUSES.includes(command.status)) return command;

    command.status = "running";
    command.startedAt = command.startedAt ?? Date.now();
    command.currentStep = input.currentStep ?? command.currentStep ?? "Task started";
    this.appendCommandLog(command, "info", `Command started: ${command.currentStep}`);
    this.commands.set(command.commandId, command);

    this.adjustParticipantLoad(input.participantId, +1);
    return command;
  }

  progressCommand(input: ProgressCommandInput): CommandRecord {
    const command = this.requireCommand(input.commandId);
    this.assertCommandTarget(input.participantId, command);
    if (TERMINAL_COMMAND_STATUSES.includes(command.status)) return command;

    if (command.status !== "running") {
      command.status = "running";
      command.startedAt = command.startedAt ?? Date.now();
      this.adjustParticipantLoad(input.participantId, +1);
    }

    command.progress = Math.max(0, Math.min(100, input.progress));
    command.currentStep = input.currentStep ?? command.currentStep;
    if (input.log) this.appendCommandLog(command, "info", input.log);
    this.commands.set(command.commandId, command);
    return command;
  }

  completeCommand(input: CompleteCommandInput): CommandRecord {
    const command = this.requireCommand(input.commandId);
    this.assertCommandTarget(input.participantId, command);
    if (TERMINAL_COMMAND_STATUSES.includes(command.status)) return command;

    command.status = input.success ? "completed" : "failed";
    command.completedAt = Date.now();
    command.result = input.result;
    command.error = input.success ? undefined : input.error ?? "Command execution failed";
    command.progress = 100;
    command.currentStep = input.success ? "Completed" : "Failed";

    this.appendCommandLog(command, input.success ? "info" : "error", input.success ? "Command completed" : command.error!);
    this.commands.set(command.commandId, command);

    this.cleanupQueueReference(command.targetParticipantId, command.commandId);
    this.adjustParticipantLoad(input.participantId, -1);
    this.heartbeat({ participantId: input.participantId });

    this.appendAudit("command.completed", {
      commandId: command.commandId,
      status: command.status,
      exitCode: input.exitCode,
    }, input.participantId, command.commandId);

    return command;
  }

  ackCommand(input: CompleteCommandInput): CommandRecord {
    return this.completeCommand(input);
  }

  cancelCommand(input: CancelCommandInput): CommandRecord {
    const role = normalizeRole(input.actorRole);
    if (!roleAtLeast(role, "developer")) {
      throw new Error(`Role ${role} is not allowed to cancel commands`);
    }

    const command = this.requireCommand(input.commandId);
    if (TERMINAL_COMMAND_STATUSES.includes(command.status)) return command;

    command.status = "cancelled";
    command.completedAt = Date.now();
    command.error = input.reason ?? `Cancelled by ${input.requestedBy}`;
    this.appendCommandLog(command, "warn", command.error);
    this.commands.set(command.commandId, command);
    this.cleanupQueueReference(command.targetParticipantId, command.commandId);
    this.adjustParticipantLoad(command.targetParticipantId, -1);

    this.appendAudit("command.cancelled", {
      commandId: command.commandId,
      reason: command.error,
    }, command.targetParticipantId, command.commandId, input.requestedBy);

    return command;
  }

  getCommandStatus(input: CommandStatusInput | string): CommandRecord {
    this.expireCommands();
    const commandId = typeof input === "string" ? input : input.commandId;
    return this.requireCommand(commandId);
  }

  getCommandLogs(input: CommandLogsInput): { commandId: string; logs: string[] } {
    const command = this.requireCommand(input.commandId);
    const tail = Math.min(Math.max(input.tail ?? 200, 1), this.maxCommandLogs);
    const logs = command.logs.slice(-tail).map((entry) => {
      const ts = new Date(entry.timestamp).toISOString();
      return `[${ts}] [${entry.level}] ${entry.message}`;
    });
    return { commandId: command.commandId, logs };
  }

  listPolicies(): PolicyRecord {
    return this.policy;
  }

  updatePolicies(input: UpdatePolicyInput): PolicyRecord {
    const role = normalizeRole(input.actorRole);
    if (!roleAtLeast(role, "admin")) {
      throw new Error(`Role ${role} is not allowed to update policies`);
    }

    this.policy = {
      ...this.policy,
      allowlistedIntents: input.allowlistedIntents ?? this.policy.allowlistedIntents,
      blockedIntents: input.blockedIntents ?? this.policy.blockedIntents,
      roleIntentAllowlist: input.roleIntentAllowlist ?? this.policy.roleIntentAllowlist,
      riskApprovalRequired: input.riskApprovalRequired ?? this.policy.riskApprovalRequired,
      workspaceAllowlist: input.workspaceAllowlist ?? this.policy.workspaceAllowlist,
      version: this.policy.version + 1,
      updatedAt: Date.now(),
      updatedBy: input.actorUserId,
    };

    this.appendAudit("policy.updated", {
      version: this.policy.version,
    }, undefined, undefined, input.actorUserId);

    return this.policy;
  }

  requestApproval(input: RequestApprovalInput): ApprovalRecord {
    return this.createApproval(input);
  }

  resolveApproval(input: ResolveApprovalInput): ApprovalRecord {
    const role = normalizeRole(input.actorRole);
    if (!roleAtLeast(role, "admin")) {
      throw new Error(`Role ${role} is not allowed to resolve approvals`);
    }

    const approval = this.approvals.get(input.approvalId);
    if (!approval) throw new Error(`Unknown approval: ${input.approvalId}`);
    if (approval.status !== "pending") return approval;

    approval.status = input.approved ? "approved" : "rejected";
    approval.resolvedAt = Date.now();
    approval.resolvedBy = input.resolvedBy;
    approval.resolutionNote = input.note;
    this.approvals.set(approval.approvalId, approval);

    const command = this.commands.get(approval.commandId);
    if (command && command.status === "waiting_approval") {
      if (input.approved) {
        command.status = "queued";
        this.appendCommandLog(command, "info", `Approval granted by ${input.resolvedBy}`);
        this.enqueueCommand(command);
      } else {
        command.status = "failed";
        command.completedAt = Date.now();
        command.error = `Approval rejected by ${input.resolvedBy}`;
        this.appendCommandLog(command, "warn", command.error);
        this.commands.set(command.commandId, command);
      }
    }

    this.appendAudit("approval.resolved", {
      approvalId: approval.approvalId,
      commandId: approval.commandId,
      status: approval.status,
    }, command?.targetParticipantId, approval.commandId, input.resolvedBy);

    return approval;
  }

  scanPresence(): ParticipantRecord[] {
    const snapshot: ParticipantRecord[] = [];

    for (const participant of this.participants.values()) {
      const updated = this.deriveParticipantStatus(participant);
      this.participants.set(updated.participantId, updated);
      snapshot.push(updated);
    }

    this.onPresenceSweep?.(snapshot);
    return snapshot;
  }

  getAuditEvents(limit = 200): AuditEvent[] {
    const size = Math.min(Math.max(limit, 1), 5_000);
    return this.auditEvents.slice(-size);
  }

  registerMCPTools(server: MCPServerAdapter, prefix = ""): void {
    const nameOf = (name: string) => (prefix ? `${prefix}.${name}` : name);

    server.registerTool({
      name: nameOf("participants.list"),
      description: "Alle bekannten Teilnehmer anzeigen.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string" },
          capability: { type: "string" },
          tag: { type: "string" },
          includeOffline: { type: "boolean" },
        },
      },
      execute: async (input) => this.listParticipants(input as unknown as ListParticipantsInput),
    });

    server.registerTool({
      name: nameOf("participants.get"),
      description: "Details zu einem Teilnehmer anzeigen.",
      inputSchema: {
        type: "object",
        properties: { participantId: { type: "string" } },
        required: ["participantId"],
      },
      execute: async (input) => this.getParticipant(String(input.participantId)),
    });

    server.registerTool({
      name: nameOf("participants.ping"),
      description: "Teilnehmer manuell anpingen (einzeln oder Broadcast).",
      inputSchema: {
        type: "object",
        properties: {
          participantId: { type: "string" },
          timeoutSeconds: { type: "number" },
        },
      },
      execute: async (input) => this.pingParticipants(input as unknown as PingInput),
    });

    server.registerTool({
      name: nameOf("participants.capabilities"),
      description: "Fähigkeiten eines Teilnehmers anzeigen.",
      inputSchema: {
        type: "object",
        properties: { participantId: { type: "string" } },
        required: ["participantId"],
      },
      execute: async (input) => this.getParticipantCapabilities(String(input.participantId)),
    });

    server.registerTool({
      name: nameOf("commands.send"),
      description: "Strukturierte Aufgabe sicher an Zielteilnehmer senden.",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string" },
          intent: { type: "string" },
          workspace: { type: "string" },
          instruction: { type: "string" },
          mode: { type: "string" },
          payload: {},
          requestedBy: { type: "string" },
          actorRole: { type: "string" },
          riskLevel: { type: "string" },
          requireApproval: { type: "boolean" },
          ttlMs: { type: "number" },
          maxRetries: { type: "number" },
        },
        required: ["target", "intent", "instruction", "requestedBy", "actorRole"],
      },
      execute: async (input) => this.sendCommand(input as unknown as SendCommandInput),
    });

    server.registerTool({
      name: nameOf("commands.status"),
      description: "Status eines Befehls abrufen.",
      inputSchema: {
        type: "object",
        properties: { commandId: { type: "string" } },
        required: ["commandId"],
      },
      execute: async (input) => this.getCommandStatus({ commandId: String(input.commandId) }),
    });

    server.registerTool({
      name: nameOf("commands.cancel"),
      description: "Laufenden Befehl abbrechen.",
      inputSchema: {
        type: "object",
        properties: {
          commandId: { type: "string" },
          requestedBy: { type: "string" },
          actorRole: { type: "string" },
          reason: { type: "string" },
        },
        required: ["commandId", "requestedBy", "actorRole"],
      },
      execute: async (input) => this.cancelCommand(input as unknown as CancelCommandInput),
    });

    server.registerTool({
      name: nameOf("commands.logs"),
      description: "Ausführungsprotokoll eines Befehls abrufen.",
      inputSchema: {
        type: "object",
        properties: {
          commandId: { type: "string" },
          tail: { type: "number" },
        },
        required: ["commandId"],
      },
      execute: async (input) => this.getCommandLogs(input as unknown as CommandLogsInput),
    });

    server.registerTool({
      name: nameOf("approvals.request"),
      description: "Freigabe für riskante Aktion anfordern.",
      inputSchema: {
        type: "object",
        properties: {
          commandId: { type: "string" },
          requestedBy: { type: "string" },
          reason: { type: "string" },
          expiresInMs: { type: "number" },
        },
        required: ["commandId", "requestedBy", "reason"],
      },
      execute: async (input) => this.requestApproval(input as unknown as RequestApprovalInput),
    });

    server.registerTool({
      name: nameOf("approvals.resolve"),
      description: "Freigabe bestätigen oder ablehnen (nur admin/owner).",
      inputSchema: {
        type: "object",
        properties: {
          approvalId: { type: "string" },
          approved: { type: "boolean" },
          resolvedBy: { type: "string" },
          actorRole: { type: "string" },
          note: { type: "string" },
        },
        required: ["approvalId", "approved", "resolvedBy", "actorRole"],
      },
      execute: async (input) => this.resolveApproval(input as unknown as ResolveApprovalInput),
    });

    server.registerTool({
      name: nameOf("policies.list"),
      description: "Sicherheitsrichtlinien anzeigen.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => this.listPolicies(),
    });

    server.registerTool({
      name: nameOf("policies.update"),
      description: "Sicherheitsrichtlinien aktualisieren (nur admin/owner).",
      inputSchema: {
        type: "object",
        properties: {
          actorUserId: { type: "string" },
          actorRole: { type: "string" },
          allowlistedIntents: { type: "array", items: { type: "string" } },
          blockedIntents: { type: "array", items: { type: "string" } },
          roleIntentAllowlist: { type: "object" },
          riskApprovalRequired: { type: "object" },
          workspaceAllowlist: { type: "array", items: { type: "string" } },
        },
        required: ["actorUserId", "actorRole"],
      },
      execute: async (input) => this.updatePolicies(input as unknown as UpdatePolicyInput),
    });

    // agent runtime tools
    server.registerTool({
      name: nameOf("participants.register"),
      description: "Device Agent registriert/aktualisiert Teilnehmerdaten.",
      inputSchema: {
        type: "object",
        properties: {
          participantId: { type: "string" },
          displayName: { type: "string" },
          channel: { type: "string" },
          type: { type: "string" },
          capabilities: { type: "array", items: { type: "string" } },
          runtime: { type: "object" },
          location: { type: "object" },
          transport: { type: "string" },
        },
        required: ["participantId", "displayName", "channel", "type"],
      },
      execute: async (input) => this.registerParticipant(input as unknown as RegisterParticipantInput),
    });

    server.registerTool({
      name: nameOf("participants.heartbeat"),
      description: "Heartbeat von Device Agent empfangen.",
      inputSchema: {
        type: "object",
        properties: {
          participantId: { type: "string" },
          degradedReason: { type: "string" },
          capabilities: { type: "array", items: { type: "string" } },
          location: { type: "object" },
          runtime: { type: "object" },
          activeTaskCount: { type: "number" },
        },
        required: ["participantId"],
      },
      execute: async (input) => this.heartbeat(input as unknown as HeartbeatInput),
    });

    server.registerTool({
      name: nameOf("commands.fetch"),
      description: "Agent holt wartende Befehle ab.",
      inputSchema: {
        type: "object",
        properties: { participantId: { type: "string" }, limit: { type: "number" } },
        required: ["participantId"],
      },
      execute: async (input) => this.fetchPendingCommands(input as unknown as FetchPendingCommandsInput),
    });

    server.registerTool({
      name: nameOf("commands.start"),
      description: "Agent meldet den Start eines Befehls.",
      inputSchema: {
        type: "object",
        properties: {
          participantId: { type: "string" },
          commandId: { type: "string" },
          currentStep: { type: "string" },
        },
        required: ["participantId", "commandId"],
      },
      execute: async (input) => this.startCommand(input as unknown as StartCommandInput),
    });

    server.registerTool({
      name: nameOf("commands.progress"),
      description: "Agent meldet Fortschritt eines Befehls.",
      inputSchema: {
        type: "object",
        properties: {
          participantId: { type: "string" },
          commandId: { type: "string" },
          progress: { type: "number" },
          currentStep: { type: "string" },
          log: { type: "string" },
        },
        required: ["participantId", "commandId", "progress"],
      },
      execute: async (input) => this.progressCommand(input as unknown as ProgressCommandInput),
    });

    server.registerTool({
      name: nameOf("commands.complete"),
      description: "Agent meldet Ergebnis eines Befehls.",
      inputSchema: {
        type: "object",
        properties: {
          participantId: { type: "string" },
          commandId: { type: "string" },
          success: { type: "boolean" },
          result: {},
          error: { type: "string" },
          exitCode: { type: "number" },
        },
        required: ["participantId", "commandId", "success"],
      },
      execute: async (input) => this.completeCommand(input as unknown as CompleteCommandInput),
    });

    // backwards compatibility names from initial addon
    this.registerLegacyTools(server, prefix);
  }

  private registerLegacyTools(server: MCPServerAdapter, prefix: string): void {
    const legacyPrefix = prefix ? `${prefix}.presence_relay` : "presence_relay";

    const legacy = (name: string) => `${legacyPrefix}.${name}`;

    server.registerTool({
      name: legacy("register_client"),
      description: "Legacy alias for participants.register",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          channel: { type: "string" },
          appName: { type: "string" },
          appVersion: { type: "string" },
          userId: { type: "string" },
          hostName: { type: "string" },
          os: { type: "string" },
          capabilities: { type: "array", items: { type: "string" } },
          lastKnownLocation: { type: "string" },
        },
        required: ["id", "channel"],
      },
      execute: async (input) =>
        this.registerParticipant({
          participantId: String(input.id),
          displayName: String(input.label ?? input.id),
          channel: String(input.channel) as RegisterParticipantInput["channel"],
          type: "unknown",
          hostName: input.hostName ? String(input.hostName) : undefined,
          ownerUserId: input.userId ? String(input.userId) : undefined,
          runtime: {
            os: input.os ? String(input.os) : undefined,
            apps: input.appName ? [String(input.appName)] : undefined,
            environment: input.appVersion ? String(input.appVersion) : undefined,
          },
          location: input.lastKnownLocation
            ? { source: "legacy", network: String(input.lastKnownLocation) }
            : undefined,
          capabilities: Array.isArray(input.capabilities)
            ? input.capabilities.map((item) => String(item))
            : [],
        }),
    });

    server.registerTool({
      name: legacy("heartbeat"),
      description: "Legacy alias for participants.heartbeat",
      inputSchema: {
        type: "object",
        properties: {
          clientId: { type: "string" },
          patch: { type: "object" },
        },
        required: ["clientId"],
      },
      execute: async (input) => this.heartbeat(String(input.clientId), input.patch as Partial<RegisterParticipantInput>),
    });

    server.registerTool({
      name: legacy("list_participants"),
      description: "Legacy alias for participants.list",
      inputSchema: {
        type: "object",
        properties: {
          includeOffline: { type: "boolean" },
        },
      },
      execute: async (input) => this.listParticipants(input as unknown as ListParticipantsInput),
    });

    server.registerTool({
      name: legacy("ping_all"),
      description: "Legacy alias for participants.ping broadcast",
      inputSchema: { type: "object", properties: {} },
      execute: async () => this.pingParticipants({}),
    });

    server.registerTool({
      name: legacy("send_command"),
      description: "Legacy alias for commands.send",
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
      execute: async (input) => this.sendCommand(input as unknown as LegacySendInput),
    });

    server.registerTool({
      name: legacy("fetch_pending_commands"),
      description: "Legacy alias for commands.fetch",
      inputSchema: {
        type: "object",
        properties: {
          clientId: { type: "string" },
          limit: { type: "number" },
        },
        required: ["clientId"],
      },
      execute: async (input) => this.fetchPendingCommands({ clientId: String(input.clientId), limit: input.limit as number | undefined }),
    });

    server.registerTool({
      name: legacy("ack_command"),
      description: "Legacy alias for commands.complete",
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
      execute: async (input) =>
        this.completeCommand({
          participantId: String(input.clientId),
          commandId: String(input.commandId),
          success: Boolean(input.success),
          result: input.result,
          error: input.error ? String(input.error) : undefined,
        }),
    });

    server.registerTool({
      name: legacy("command_status"),
      description: "Legacy alias for commands.status",
      inputSchema: {
        type: "object",
        properties: { commandId: { type: "string" } },
        required: ["commandId"],
      },
      execute: async (input) => this.getCommandStatus(String(input.commandId)),
    });
  }

  private deriveParticipantStatus(participant: ParticipantRecord): ParticipantRecord {
    const now = Date.now();
    if (participant.blockedReason) {
      participant.status = "blocked";
      return participant;
    }

    if (participant.activeTaskCount > 0) {
      participant.status = "busy";
      return participant;
    }

    if (participant.degradedReason) {
      participant.status = "degraded";
      return participant;
    }

    const delta = now - participant.lastHeartbeatAt;
    if (delta > this.offlineAfterMs) {
      participant.status = "offline";
    } else if (delta > this.heartbeatIntervalMs && delta <= this.staleAfterMs) {
      participant.status = "stale";
    } else if (delta > this.staleAfterMs) {
      participant.status = "offline";
    } else {
      participant.status = "online";
    }

    return participant;
  }

  private assertIntentAllowed(role: UserRole, intent: string): void {
    if (this.policy.blockedIntents.includes(intent)) {
      throw new Error(`Intent ${intent} is blocked by policy`);
    }

    if (!this.policy.allowlistedIntents.includes(intent)) {
      throw new Error(`Intent ${intent} is not allowlisted`);
    }

    const roleAllowlist = this.policy.roleIntentAllowlist[role] ?? [];
    if (!roleAllowlist.includes(intent) && !roleAtLeast(role, "admin")) {
      throw new Error(`Role ${role} is not allowed to invoke intent ${intent}`);
    }

    if (/\b(shell|bash|cmd|powershell)\b/i.test(intent) && intent !== "shell.exec.allowlisted") {
      throw new Error("Open shell execution intents are not allowed");
    }
  }

  private assertWorkspaceAllowed(workspace?: string): void {
    if (!workspace) return;
    if (this.policy.workspaceAllowlist.length === 0) return;
    if (!this.policy.workspaceAllowlist.includes(workspace)) {
      throw new Error(`Workspace ${workspace} is not allowlisted`);
    }
  }

  private deriveRiskLevel(intent: string): RiskLevel {
    if (intent === "legacy.command") return "high";
    if (intent.includes("deploy") || intent.includes("delete") || intent.includes("shell")) return "critical";
    if (intent.includes("filesystem") || intent.includes("git.commit")) return "high";
    if (intent.includes("codex") || intent.includes("test")) return "medium";
    return "low";
  }

  private enqueueCommand(command: CommandRecord): void {
    const queue = this.commandQueueByParticipant.get(command.targetParticipantId) ?? [];

    if (queue.length >= this.maxQueuePerParticipant) {
      const droppedId = queue.shift();
      if (droppedId) {
        const dropped = this.commands.get(droppedId);
        if (dropped && !TERMINAL_COMMAND_STATUSES.includes(dropped.status)) {
          dropped.status = "failed";
          dropped.error = "Dropped due to queue overflow";
          dropped.completedAt = Date.now();
          this.appendCommandLog(dropped, "error", dropped.error);
          this.commands.set(dropped.commandId, dropped);
        }
      }
    }

    queue.push(command.commandId);
    this.commandQueueByParticipant.set(command.targetParticipantId, queue);
    this.commands.set(command.commandId, command);
  }

  private expireCommands(): void {
    const now = Date.now();
    for (const command of this.commands.values()) {
      if (TERMINAL_COMMAND_STATUSES.includes(command.status)) continue;
      if (command.expiresAt <= now) {
        command.status = "expired";
        command.error = "Command TTL exceeded";
        command.completedAt = now;
        this.appendCommandLog(command, "warn", command.error);
        this.commands.set(command.commandId, command);
        this.cleanupQueueReference(command.targetParticipantId, command.commandId);
      }
    }
  }

  private expireApprovals(): void {
    const now = Date.now();

    for (const approval of this.approvals.values()) {
      if (approval.status !== "pending" || !approval.expiresAt) continue;
      if (approval.expiresAt <= now) {
        approval.status = "expired";
        approval.resolvedAt = now;
        this.approvals.set(approval.approvalId, approval);

        const command = this.commands.get(approval.commandId);
        if (command && command.status === "waiting_approval") {
          command.status = "failed";
          command.error = "Approval expired";
          command.completedAt = now;
          this.appendCommandLog(command, "warn", command.error);
          this.commands.set(command.commandId, command);
        }
      }
    }
  }

  private appendCommandLog(command: CommandRecord, level: "info" | "warn" | "error", message: string): void {
    command.logs.push({ timestamp: Date.now(), level, message });
    if (command.logs.length > this.maxCommandLogs) {
      command.logs = command.logs.slice(-this.maxCommandLogs);
    }
  }

  private createApproval(input: RequestApprovalInput): ApprovalRecord {
    const command = this.requireCommand(input.commandId);

    const approval: ApprovalRecord = {
      approvalId: randomUUID(),
      commandId: command.commandId,
      requestedBy: input.requestedBy,
      status: "pending",
      reason: input.reason,
      requestedAt: Date.now(),
      expiresAt: input.expiresInMs ? Date.now() + Math.max(1_000, input.expiresInMs) : undefined,
    };

    this.approvals.set(approval.approvalId, approval);
    command.approvalId = approval.approvalId;
    command.approvalRequired = true;
    command.status = "waiting_approval";
    this.appendCommandLog(command, "info", `Approval requested: ${approval.reason}`);
    this.commands.set(command.commandId, command);

    this.appendAudit("approval.requested", {
      approvalId: approval.approvalId,
      commandId: command.commandId,
    }, command.targetParticipantId, command.commandId, input.requestedBy);

    return approval;
  }

  private requireCommand(commandId: string): CommandRecord {
    const command = this.commands.get(commandId);
    if (!command) throw new Error(`Unknown command: ${commandId}`);
    return command;
  }

  private assertCommandTarget(participantId: string, command: CommandRecord): void {
    if (command.targetParticipantId !== participantId) {
      throw new Error(`Participant ${participantId} is not target of command ${command.commandId}`);
    }
  }

  private cleanupQueueReference(participantId: string, commandId: string): void {
    const queue = this.commandQueueByParticipant.get(participantId);
    if (!queue) return;
    this.commandQueueByParticipant.set(
      participantId,
      queue.filter((id) => id !== commandId),
    );
  }

  private adjustParticipantLoad(participantId: string, delta: number): void {
    const participant = this.participants.get(participantId);
    if (!participant) return;
    participant.activeTaskCount = Math.max(0, participant.activeTaskCount + delta);
    participant.lastSeenAt = Date.now();
    participant.lastHeartbeatAt = Date.now();
    this.participants.set(participantId, this.deriveParticipantStatus(participant));
  }

  private appendAudit(
    eventType: string,
    payload: Record<string, unknown>,
    participantId?: string,
    commandId?: string,
    actorUserId?: string,
  ): void {
    const event: AuditEvent = {
      eventId: randomUUID(),
      actorUserId,
      participantId,
      commandId,
      eventType,
      eventPayload: payload,
      createdAt: Date.now(),
    };

    this.auditEvents.push(event);
    if (this.auditEvents.length > 50_000) {
      this.auditEvents.splice(0, this.auditEvents.length - 50_000);
    }
  }
}

export class PresenceRelayAddon extends MCPRemoteOrchestrator {}
export * from "./types";
