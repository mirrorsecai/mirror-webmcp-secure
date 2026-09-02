import type {
  MirrorWebMcpModelContext,
  MirrorWebMcpPrivacy,
  MirrorWebMcpPrivacyContext,
  MirrorWebMcpPrivacyEvidence,
  MirrorWebMcpPrivateHandleDescriptor,
  MirrorWebMcpPrivateToolPack,
  MirrorWebMcpProtectOptions,
  MirrorWebMcpApprovalRequest
} from "./runtime.js";

export { createWebMcpContext } from "./context.js";
export type { WebMcpContextController } from "./context.js";
export {
  MirrorWebMcpPrivacy,
  MirrorWebMcpPrivacyError,
  WEBMCP_PRIVATE_BINDING_SCHEMA,
  WEBMCP_PRIVATE_EVIDENCE_SCHEMA,
  WEBMCP_PRIVATE_HANDLE_SCHEMA
} from "./runtime.js";
export type {
  MirrorWebMcpApprovalRequest,
  MirrorWebMcpInputSchema,
  MirrorWebMcpInvocation,
  MirrorWebMcpModelContext,
  MirrorWebMcpNativeTool,
  MirrorWebMcpPrivateHandleDescriptor,
  MirrorWebMcpPrivateTool,
  MirrorWebMcpPrivateToolPack,
  MirrorWebMcpPrivacyContext,
  MirrorWebMcpPrivacyEvidence,
  MirrorWebMcpProtectOptions,
  MirrorWebMcpPublicResultOptions,
  MirrorWebMcpRegisteredToolPack,
  MirrorWebMcpToolAnnotations,
  MirrorWebMcpToolResult
} from "./runtime.js";

type MaybePromise<T> = T | Promise<T>;

export interface WebMcpSecureOptions {
  context: MirrorWebMcpPrivacyContext | (() => MirrorWebMcpPrivacyContext);
  modelContext?: MirrorWebMcpModelContext;
  approval?: (request: MirrorWebMcpApprovalRequest) => MaybePromise<boolean>;
  onEvidence?: (event: MirrorWebMcpPrivacyEvidence) => MaybePromise<void>;
  defaultTtlMs?: number;
  maxHandles?: number;
  maxEvidenceEvents?: number;
}

export interface WebMcpSecure {
  readonly runtime: MirrorWebMcpPrivacy;
  readonly nativeWebMcpAvailable: boolean;
  registerPack(pack: MirrorWebMcpPrivateToolPack): Promise<void>;
  unregisterPack(name: string): Promise<boolean>;
  protect(value: unknown, binding: MirrorWebMcpProtectOptions): Promise<MirrorWebMcpPrivateHandleDescriptor>;
  evidence(): MirrorWebMcpPrivacyEvidence[];
  dispose(): Promise<void>;
}

export function createWebMcpSecure(options: WebMcpSecureOptions): WebMcpSecure;
