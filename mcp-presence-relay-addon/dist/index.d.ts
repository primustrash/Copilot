import { AckCommandInput, ClientPresence, FetchPendingCommandsInput, ListParticipantsInput, MCPServerAdapter, PresenceRelayOptions, RegisterOrUpdateClientInput, RelayCommand, SendCommandInput } from "./types";
export declare class PresenceRelayAddon {
    private readonly clients;
    private readonly commands;
    private readonly perClientQueue;
    private readonly heartbeatIntervalMs;
    private readonly offlineAfterMs;
    private readonly commandTtlMs;
    private readonly maxQueuePerClient;
    private readonly onPresenceSweep?;
    private timer?;
    constructor(options?: PresenceRelayOptions);
    start(): void;
    stop(): void;
    registerOrUpdateClient(input: RegisterOrUpdateClientInput): ClientPresence;
    heartbeat(clientId: string, patch?: Partial<RegisterOrUpdateClientInput>): ClientPresence;
    listParticipants(input?: ListParticipantsInput): ClientPresence[];
    triggerPresencePingSweep(): {
        requestedAt: number;
        requestedFor: string[];
    };
    sendCommand(input: SendCommandInput): RelayCommand;
    fetchPendingCommands(input: FetchPendingCommandsInput): RelayCommand[];
    ackCommand(input: AckCommandInput): RelayCommand;
    getCommandStatus(commandId: string): RelayCommand;
    scanPresence(): ClientPresence[];
    registerMCPTools(server: MCPServerAdapter, prefix?: string): void;
    private enqueueCommand;
    private expireCommands;
    private cleanupQueueReference;
}
export * from "./types";
