/**
 * Privacy primitives for browser-side WebMCP tools.
 *
 * The runtime keeps private values behind encrypted, context-bound handles.
 * Tool implementations must explicitly return either a public result or a new
 * private handle, which makes disclosure a deliberate application decision.
 */
export declare const WEBMCP_PRIVATE_HANDLE_SCHEMA: "mirror.webmcp.private_handle.v1";
export declare const WEBMCP_PRIVATE_BINDING_SCHEMA: "mirror.webmcp.private_binding.v1";
export declare const WEBMCP_PRIVATE_EVIDENCE_SCHEMA: "mirror.webmcp.privacy_evidence.v1";
declare const PRIVATE_RESULT: unique symbol;
type MaybePromise<T> = T | Promise<T>;
type JsonRecord = Record<string, unknown>;
export interface MirrorWebMcpInputSchema extends JsonRecord {
    type?: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
}
export interface MirrorWebMcpToolAnnotations extends JsonRecord {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
}
export interface MirrorWebMcpNativeTool {
    name: string;
    title?: string;
    description: string;
    inputSchema: MirrorWebMcpInputSchema;
    annotations?: MirrorWebMcpToolAnnotations;
    execute(args: JsonRecord, options?: {
        signal?: AbortSignal;
    }): Promise<unknown>;
}
export interface MirrorWebMcpModelContext {
    registerTool(tool: MirrorWebMcpNativeTool, options?: {
        signal?: AbortSignal;
        exposedTo?: string[];
    }): MaybePromise<void>;
}
export interface MirrorWebMcpDocument {
    modelContext?: MirrorWebMcpModelContext;
}
export interface MirrorWebMcpNavigator {
    modelContext?: MirrorWebMcpModelContext;
}
export interface MirrorWebMcpPrivacyContext {
    origin: string;
    sessionId: string;
    userId?: string;
    model?: string;
}
export interface MirrorWebMcpPrivateHandleDescriptor {
    schema: typeof WEBMCP_PRIVATE_HANDLE_SCHEMA;
    handle: string;
    kind: string;
    purpose: string;
    allowedTools: string[];
    createdAt: string;
    expiresAt: string;
    bindingDigest: string;
}
export interface MirrorWebMcpProtectOptions {
    kind: string;
    purpose: string;
    allowedTools: string[];
    ttlMs?: number;
}
export interface MirrorWebMcpResolveOptions {
    toolName: string;
    kind?: string;
    purpose?: string;
}
export interface MirrorWebMcpApprovalRequest {
    phase: "action" | "release";
    toolName: string;
    summary: string;
    argumentNames: string[];
    sensitivity?: "public" | "sensitive";
}
export interface MirrorWebMcpPrivacyEvidence {
    schema: typeof WEBMCP_PRIVATE_EVIDENCE_SCHEMA;
    sequence: number;
    timestamp: string;
    event: "handle.protected" | "handle.opened" | "handle.revoked" | "tool.registered" | "tool.unregistered" | "tool.invoked" | "tool.completed" | "tool.denied";
    outcome: "allow" | "deny" | "success";
    toolName?: string;
    handleDigest?: string;
    details?: JsonRecord;
}
export interface MirrorWebMcpPrivacyOptions {
    context: MirrorWebMcpPrivacyContext | (() => MirrorWebMcpPrivacyContext);
    modelContext?: MirrorWebMcpModelContext;
    document?: MirrorWebMcpDocument;
    navigator?: MirrorWebMcpNavigator;
    defaultTtlMs?: number;
    maxHandles?: number;
    maxEvidenceEvents?: number;
    approval?: (request: MirrorWebMcpApprovalRequest) => MaybePromise<boolean>;
    onEvidence?: (event: MirrorWebMcpPrivacyEvidence) => MaybePromise<void>;
    now?: () => number;
    crypto?: MirrorWebMcpCrypto;
}
export interface MirrorWebMcpPublicResultOptions {
    sensitivity?: "public" | "sensitive";
    approvalSummary?: string;
    /**
     * Allows a result to contain a value opened from a private handle. This is
     * accepted only for a sensitive result after the approval callback allows it.
     */
    allowPrivateData?: boolean;
}
export interface MirrorWebMcpPrivateResultOptions extends MirrorWebMcpProtectOptions {
    publicValue?: unknown;
}
interface MirrorWebMcpPublicResult {
    [PRIVATE_RESULT]: true;
    mode: "public";
    value: unknown;
    options: MirrorWebMcpPublicResultOptions;
}
interface MirrorWebMcpPrivateResult {
    [PRIVATE_RESULT]: true;
    mode: "private";
    value: unknown;
    options: MirrorWebMcpPrivateResultOptions;
}
export type MirrorWebMcpToolResult = MirrorWebMcpPublicResult | MirrorWebMcpPrivateResult;
export interface MirrorWebMcpInvocation {
    readonly toolName: string;
    readonly signal?: AbortSignal;
    resolve<T = unknown>(handle: string, options?: {
        kind?: string;
        purpose?: string;
    }): Promise<T>;
    describe(handle: string): MirrorWebMcpPrivateHandleDescriptor;
    publicResult(value: unknown, options?: MirrorWebMcpPublicResultOptions): MirrorWebMcpToolResult;
    privateResult(value: unknown, options: MirrorWebMcpPrivateResultOptions): MirrorWebMcpToolResult;
}
export interface MirrorWebMcpPrivateTool {
    name: string;
    title?: string;
    description: string;
    inputSchema?: MirrorWebMcpInputSchema;
    annotations?: MirrorWebMcpToolAnnotations;
    exposedTo?: string[];
    requiresApproval?: boolean;
    approvalSummary?: string;
    execute(args: JsonRecord, context: MirrorWebMcpInvocation): MaybePromise<MirrorWebMcpToolResult>;
}
export interface MirrorWebMcpPrivateToolPack {
    name: string;
    tools: MirrorWebMcpPrivateTool[];
}
export interface MirrorWebMcpRegisteredToolPack {
    name: string;
    tools: string[];
}
interface MirrorWebMcpCrypto {
    subtle: {
        generateKey(algorithm: {
            name: "AES-GCM";
            length: 256;
        }, extractable: false, usages: Array<"encrypt" | "decrypt">): Promise<unknown>;
        encrypt(algorithm: {
            name: "AES-GCM";
            iv: Uint8Array;
            additionalData: Uint8Array;
        }, key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
        decrypt(algorithm: {
            name: "AES-GCM";
            iv: Uint8Array;
            additionalData: Uint8Array;
        }, key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
        digest(algorithm: "SHA-256", data: Uint8Array): Promise<ArrayBuffer>;
    };
    getRandomValues<T extends Uint8Array>(array: T): T;
}
export declare class MirrorWebMcpPrivacyError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/**
 * Browser-local privacy runtime for WebMCP.
 *
 * The AES key is generated as a non-extractable WebCrypto key. Private values
 * are retained only as authenticated ciphertext, and the authenticated binding
 * is checked against the live origin/user/session/model context every time a
 * tool opens a handle.
 */
export declare class MirrorWebMcpPrivacy {
    private readonly contextProvider;
    private readonly modelContext?;
    private readonly defaultTtlMs;
    private readonly maxHandles;
    private readonly maxEvidenceEvents;
    private readonly approval?;
    private readonly onEvidence?;
    private readonly now;
    private readonly crypto;
    private readonly key;
    private readonly records;
    private readonly registrations;
    private readonly toolPacks;
    private readonly evidenceRecords;
    private evidenceSequence;
    constructor(options: MirrorWebMcpPrivacyOptions);
    isAvailable(): boolean;
    registeredTools(): string[];
    registeredToolPacks(): MirrorWebMcpRegisteredToolPack[];
    evidence(): MirrorWebMcpPrivacyEvidence[];
    listHandles(): MirrorWebMcpPrivateHandleDescriptor[];
    describe(handle: string): MirrorWebMcpPrivateHandleDescriptor;
    protect(value: unknown, options: MirrorWebMcpProtectOptions): Promise<MirrorWebMcpPrivateHandleDescriptor>;
    resolve<T = unknown>(handle: string, options: MirrorWebMcpResolveOptions): Promise<T>;
    revoke(handle: string): Promise<boolean>;
    registerTool(tool: MirrorWebMcpPrivateTool): Promise<void>;
    /**
     * Registers a complete use-case pack atomically. If any tool fails to
     * register, tools added earlier in the same pack are unregistered.
     */
    registerToolPack(pack: MirrorWebMcpPrivateToolPack): Promise<void>;
    unregisterTool(name: string): Promise<boolean>;
    unregisterToolPack(name: string): Promise<boolean>;
    dispose(): Promise<void>;
    private releasePublicResult;
    private releasePrivateResult;
    private requireApproval;
    private requireRecord;
    private evictExpired;
    private emit;
}
export {};
