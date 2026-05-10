import { ApprovalRecord, AuditEvent, CancelCommandInput, CommandLogsInput, CommandRecord, CommandStatusInput, CompleteCommandInput, FetchPendingCommandsInput, HeartbeatInput, ListParticipantsInput, MCPServerAdapter, OrchestratorOptions, ParticipantRecord, ProgressCommandInput, RegisterParticipantInput, ResolveApprovalInput, SendCommandInput, StartCommandInput, UpdatePolicyInput, PolicyRecord, RequestApprovalInput } from "./types";
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
export declare class MCPRemoteOrchestrator {
    private readonly participants;
    private readonly commands;
    private readonly commandQueueByParticipant;
    private readonly approvals;
    private readonly auditEvents;
    private readonly heartbeatIntervalMs;
    private readonly staleAfterMs;
    private readonly offlineAfterMs;
    private readonly commandTtlMs;
    private readonly maxQueuePerParticipant;
    private readonly maxCommandLogs;
    private readonly onPresenceSweep?;
    private policy;
    private timer?;
    constructor(options?: OrchestratorOptions);
    start(): void;
    stop(): void;
    registerParticipant(input: RegisterParticipantInput): ParticipantRecord;
    heartbeat(input: HeartbeatInput | string, patch?: Partial<RegisterParticipantInput>): ParticipantRecord;
    listParticipants(input?: ListParticipantsInput): ParticipantRecord[];
    getParticipant(participantId: string): ParticipantRecord;
    getParticipantCapabilities(participantId: string): {
        participantId: string;
        capabilities: string[];
    };
    pingParticipants(input?: PingInput): {
        requestedAt: number;
        results: Array<Record<string, unknown>>;
    };
    sendCommand(input: SendCommandInput | LegacySendInput): CommandRecord;
    fetchPendingCommands(input: FetchPendingCommandsInput | {
        clientId: string;
        limit?: number;
    }): CommandRecord[];
    startCommand(input: StartCommandInput): CommandRecord;
    progressCommand(input: ProgressCommandInput): CommandRecord;
    completeCommand(input: CompleteCommandInput): CommandRecord;
    ackCommand(input: CompleteCommandInput): CommandRecord;
    cancelCommand(input: CancelCommandInput): CommandRecord;
    getCommandStatus(input: CommandStatusInput | string): CommandRecord;
    getCommandLogs(input: CommandLogsInput): {
        commandId: string;
        logs: string[];
    };
    listPolicies(): PolicyRecord;
    updatePolicies(input: UpdatePolicyInput): PolicyRecord;
    requestApproval(input: RequestApprovalInput): ApprovalRecord;
    resolveApproval(input: ResolveApprovalInput): ApprovalRecord;
    scanPresence(): ParticipantRecord[];
    getAuditEvents(limit?: number): AuditEvent[];
    registerMCPTools(server: MCPServerAdapter, prefix?: string): void;
    private registerLegacyTools;
    private deriveParticipantStatus;
    private assertIntentAllowed;
    private assertWorkspaceAllowed;
    private deriveRiskLevel;
    private enqueueCommand;
    private expireCommands;
    private expireApprovals;
    private appendCommandLog;
    private createApproval;
    private requireCommand;
    private assertCommandTarget;
    private cleanupQueueReference;
    private adjustParticipantLoad;
    private appendAudit;
}
export declare class PresenceRelayAddon extends MCPRemoteOrchestrator {
}
export * from "./types";
