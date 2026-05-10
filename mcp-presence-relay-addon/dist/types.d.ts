export type ParticipantChannel = "browser" | "cli" | "desktopapp" | "mobile" | "server" | "agent" | "unknown";
export type ParticipantType = "desktop" | "laptop" | "server" | "browser" | "cli-agent" | "codex" | "automation-agent" | "unknown";
export type ParticipantStatus = "online" | "stale" | "degraded" | "offline" | "blocked" | "busy";
export type ApprovalMode = "never" | "always" | "on-risk";
export type TrustLevel = "low" | "normal" | "trusted" | "admin";
export type TransportMode = "websocket" | "https-polling" | "mqtt" | "unknown";
export type UserRole = "viewer" | "operator" | "developer" | "admin" | "owner";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export interface ParticipantRuntime {
    os?: string;
    shells?: string[];
    apps?: string[];
    environment?: string;
}
export interface ParticipantLocation {
    source?: string;
    timezone?: string;
    network?: string;
    publicIp?: string;
    internalIp?: string;
}
export interface ParticipantMetadata {
    participantId: string;
    displayName: string;
    ownerUserId?: string;
    deviceFingerprint?: string;
    agentVersion?: string;
    channel: ParticipantChannel;
    type: ParticipantType;
    transport: TransportMode;
    hostName?: string;
    userName?: string;
    runtime?: ParticipantRuntime;
    location?: ParticipantLocation;
    capabilities: string[];
    tags?: string[];
    approvalMode: ApprovalMode;
    trustLevel: TrustLevel;
}
export interface ParticipantRecord extends ParticipantMetadata {
    status: ParticipantStatus;
    firstSeenAt: number;
    lastSeenAt: number;
    lastHeartbeatAt: number;
    lastPingRequestedAt?: number;
    lastPingRespondedAt?: number;
    activeTaskCount: number;
    degradedReason?: string;
    blockedReason?: string;
}
export type CommandStatus = "queued" | "waiting_approval" | "delivered" | "running" | "completed" | "failed" | "cancelled" | "expired";
export interface CommandPayload {
    target: string;
    intent: string;
    workspace?: string;
    instruction: string;
    mode?: "safe" | "strict";
    payload?: unknown;
}
export interface CommandLogEntry {
    timestamp: number;
    level: "info" | "warn" | "error";
    message: string;
}
export interface CommandRecord {
    commandId: string;
    targetParticipantId: string;
    requestedBy: string;
    actorRole: UserRole;
    intent: string;
    payload: CommandPayload;
    status: CommandStatus;
    riskLevel: RiskLevel;
    approvalRequired: boolean;
    approvalId?: string;
    progress?: number;
    currentStep?: string;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    expiresAt: number;
    retries: number;
    maxRetries: number;
    result?: unknown;
    error?: string;
    logs: CommandLogEntry[];
}
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export interface ApprovalRecord {
    approvalId: string;
    commandId: string;
    requestedBy: string;
    status: ApprovalStatus;
    reason: string;
    requestedAt: number;
    resolvedAt?: number;
    resolvedBy?: string;
    expiresAt?: number;
    resolutionNote?: string;
}
export interface PolicyRecord {
    version: number;
    allowlistedIntents: string[];
    blockedIntents: string[];
    roleIntentAllowlist: Record<UserRole, string[]>;
    riskApprovalRequired: Record<RiskLevel, boolean>;
    workspaceAllowlist: string[];
    updatedAt: number;
    updatedBy: string;
}
export interface AuditEvent {
    eventId: string;
    actorUserId?: string;
    participantId?: string;
    commandId?: string;
    eventType: string;
    eventPayload: Record<string, unknown>;
    createdAt: number;
}
export interface OrchestratorOptions {
    heartbeatIntervalMs?: number;
    staleAfterMs?: number;
    offlineAfterMs?: number;
    commandTtlMs?: number;
    maxQueuePerParticipant?: number;
    maxCommandLogs?: number;
    policySeed?: Partial<PolicyRecord>;
    onPresenceSweep?: (snapshot: ParticipantRecord[]) => void;
}
export interface RegisterParticipantInput {
    participantId: string;
    displayName: string;
    ownerUserId?: string;
    deviceFingerprint?: string;
    agentVersion?: string;
    channel: ParticipantChannel;
    type: ParticipantType;
    transport?: TransportMode;
    hostName?: string;
    userName?: string;
    runtime?: ParticipantRuntime;
    location?: ParticipantLocation;
    capabilities?: string[];
    tags?: string[];
    approvalMode?: ApprovalMode;
    trustLevel?: TrustLevel;
    degradedReason?: string;
}
export interface HeartbeatInput {
    participantId: string;
    degradedReason?: string;
    capabilities?: string[];
    location?: ParticipantLocation;
    runtime?: ParticipantRuntime;
    activeTaskCount?: number;
}
export interface ListParticipantsInput {
    status?: ParticipantStatus;
    capability?: string;
    tag?: string;
    includeOffline?: boolean;
}
export interface SendCommandInput {
    target: string;
    intent: string;
    workspace?: string;
    instruction: string;
    mode?: "safe" | "strict";
    payload?: unknown;
    requestedBy: string;
    actorRole: UserRole;
    riskLevel?: RiskLevel;
    requireApproval?: boolean;
    ttlMs?: number;
    maxRetries?: number;
}
export interface CommandStatusInput {
    commandId: string;
}
export interface CommandLogsInput {
    commandId: string;
    tail?: number;
}
export interface CancelCommandInput {
    commandId: string;
    requestedBy: string;
    actorRole: UserRole;
    reason?: string;
}
export interface FetchPendingCommandsInput {
    participantId: string;
    limit?: number;
}
export interface StartCommandInput {
    participantId: string;
    commandId: string;
    currentStep?: string;
}
export interface ProgressCommandInput {
    participantId: string;
    commandId: string;
    progress: number;
    currentStep?: string;
    log?: string;
}
export interface CompleteCommandInput {
    participantId: string;
    commandId: string;
    success: boolean;
    result?: unknown;
    error?: string;
    exitCode?: number;
}
export interface RequestApprovalInput {
    commandId: string;
    requestedBy: string;
    reason: string;
    expiresInMs?: number;
}
export interface ResolveApprovalInput {
    approvalId: string;
    approved: boolean;
    resolvedBy: string;
    actorRole: UserRole;
    note?: string;
}
export interface UpdatePolicyInput {
    actorUserId: string;
    actorRole: UserRole;
    allowlistedIntents?: string[];
    blockedIntents?: string[];
    roleIntentAllowlist?: Record<UserRole, string[]>;
    riskApprovalRequired?: Record<RiskLevel, boolean>;
    workspaceAllowlist?: string[];
}
export interface MCPToolContext {
    signal?: AbortSignal;
}
export interface MCPToolSpec {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (input: Record<string, unknown>, ctx?: MCPToolContext) => Promise<unknown>;
}
export interface MCPServerAdapter {
    registerTool: (spec: MCPToolSpec) => void;
}
export type ClientChannel = ParticipantChannel;
export type ClientPresence = ParticipantRecord;
export type PresenceRelayOptions = OrchestratorOptions;
export type RegisterOrUpdateClientInput = RegisterParticipantInput;
export type AckCommandInput = CompleteCommandInput;
