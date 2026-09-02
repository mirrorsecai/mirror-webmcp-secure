import type { MirrorWebMcpApprovalRequest, MirrorWebMcpDocument, MirrorWebMcpModelContext, MirrorWebMcpNavigator, MirrorWebMcpPrivacyEvidence } from "./runtime.js";
import type { WebMcpSecure } from "./index.js";

export declare const WEBMCP_SITE_MANIFEST_SCHEMA: "mirror.webmcp.site_manifest.v1";
export declare const WEBMCP_TOOL_RESULT_SCHEMA: "mirror.webmcp.tool_result.v1";

export interface WebMcpLoaderOptions {
  siteId?: string;
  manifestUrl?: string;
  origin?: string;
  script?: HTMLScriptElement;
  modelContext?: MirrorWebMcpModelContext;
  document?: MirrorWebMcpDocument;
  navigator?: MirrorWebMcpNavigator;
  fetcher?: typeof fetch;
  approval?: (request: MirrorWebMcpApprovalRequest) => boolean | Promise<boolean>;
  onEvidence?: (event: MirrorWebMcpPrivacyEvidence) => void | Promise<void>;
}

export interface WebMcpLoaderResult {
  readonly siteId: string;
  readonly manifestUrl: string;
  readonly tools: string[];
  readonly nativeWebMcpAvailable: boolean;
  readonly nativeErrors: readonly string[];
  readonly secure: WebMcpSecure;
  invoke(name: string, args: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown>;
}

export function installWebMcpLoader(options?: WebMcpLoaderOptions): Promise<WebMcpLoaderResult>;
