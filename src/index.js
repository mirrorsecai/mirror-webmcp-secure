import { MirrorWebMcpPrivacy } from "./runtime.js";
import { resolveModelContext } from "./model-context.js";

export { createWebMcpContext } from "./context.js";
export {
  MirrorWebMcpPrivacy,
  MirrorWebMcpPrivacyError,
  WEBMCP_PRIVATE_BINDING_SCHEMA,
  WEBMCP_PRIVATE_EVIDENCE_SCHEMA,
  WEBMCP_PRIVATE_HANDLE_SCHEMA
} from "./runtime.js";

export function createWebMcpSecure(options) {
  const modelContext = resolveModelContext(
    options.modelContext,
    globalThis.document?.modelContext,
    globalThis.navigator?.modelContext
  );
  const runtime = new MirrorWebMcpPrivacy({
    context: options.context,
    modelContext,
    approval: options.approval,
    onEvidence: options.onEvidence,
    defaultTtlMs: options.defaultTtlMs,
    maxHandles: options.maxHandles,
    maxEvidenceEvents: options.maxEvidenceEvents
  });

  return Object.freeze({
    runtime,
    nativeWebMcpAvailable: Boolean(modelContext?.registerTool),
    registerPack(pack) {
      return runtime.registerToolPack(pack);
    },
    unregisterPack(name) {
      return runtime.unregisterToolPack(name);
    },
    protect(value, binding) {
      return runtime.protect(value, binding);
    },
    evidence() {
      return runtime.evidence();
    },
    dispose() {
      return runtime.dispose();
    }
  });
}
