export type ClientChannel = "browser" | "cli" | "desktopapp" | "mobile" | "server" | "unknown";
export interface ClientMetadata {
    id: string;
    label?: string;
    appName?: string;
    appVersion?: string;
    channel: ClientChannel;
    userId?: string;
    hostName?: string;
    ipAddress?: string;
    os?: string;
    capabilities?: string[];
    lastKnownLocation?: string;
}
export interface ClientPresence extends ClientMetadata {
    firstSeenAt: number;
    lastSeenAt: number;
    lastPingRequestedAt?: number;
    isOnline: boolean;
}
export type CommandStatus = "queued" | "delivered" | "acknowledged" | "failed" | "expired";
export interface RelayCommand {
    id: string;
    fromClientId: string;
    toClientId: string;
    command: string;
    payload?: unknown;
    createdAt: number;
    expiresAt: number;
    status: CommandStatus;
    deliveredAt?: number;
    acknowledgedAt?: number;
    result?: unknown;
    error?: string;
}
export interface PresenceRelayOptions {
    heartbeatIntervalMs?: number;
    offlineAfterMs?: number;
    commandTtlMs?: number;
    maxQueuePerClient?: number;
    onPresenceSweep?: (snapshot: ClientPresence[]) => void;
}
export interface RegisterOrUpdateClientInput {
    id: string;
    channel: ClientChannel;
    label?: string;
    appName?: string;
    appVersion?: string;
    userId?: string;
    hostName?: string;
    ipAddress?: string;
    os?: string;
    capabilities?: string[];
    lastKnownLocation?: string;
}
export interface SendCommandInput {
    fromClientId: string;
    toClientId: string;
    command: string;
    payload?: unknown;
    ttlMs?: number;
}
export interface AckCommandInput {
    clientId: string;
    commandId: string;
    success: boolean;
    result?: unknown;
    error?: string;
}
export interface ListParticipantsInput {
    includeOffline?: boolean;
}
export interface FetchPendingCommandsInput {
    clientId: string;
    limit?: number;
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
