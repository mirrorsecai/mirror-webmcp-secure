export interface WebMcpToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  execute(args: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown>;
}

export interface WebMcpModelContext {
  registerTool(tool: WebMcpToolDefinition, options?: { signal?: AbortSignal }): void | Promise<void>;
}

export interface WebMcpApprovalRequest {
  readonly tool: string;
  readonly title?: string;
  readonly summary: string;
  readonly arguments: unknown;
}

export interface WebMcpLoaderOptions {
  siteId?: string;
  manifestUrl?: string;
  origin?: string;
  script?: HTMLScriptElement;
  modelContext?: WebMcpModelContext;
  document?: Document & { modelContext?: WebMcpModelContext };
  navigator?: Navigator & { modelContext?: WebMcpModelContext };
  fetcher?: typeof fetch;
  approval?: (request: WebMcpApprovalRequest) => boolean | Promise<boolean>;
  registration?: { signal?: AbortSignal };
}

export interface WebMcpLoaderResult {
  readonly siteId: string;
  readonly manifestUrl: string;
  readonly tools: readonly string[];
  readonly nativeWebMcpAvailable: boolean;
  readonly nativeErrors: readonly string[];
  invoke(name: string, args: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown>;
}

export declare const WEBMCP_SITE_MANIFEST_SCHEMA: "mirror.webmcp.site_manifest.v1";
export declare const WEBMCP_APPROVAL_REQUEST_SCHEMA: "mirror.webmcp.approval_request.v1";
export declare const WEBMCP_APPROVAL_SCHEMA: "mirror.webmcp.approval.v1";
export declare const WEBMCP_TOOL_CALL_SCHEMA: "mirror.webmcp.tool_call.v1";
export declare const WEBMCP_TOOL_RESULT_SCHEMA: "mirror.webmcp.tool_result.v1";
export function installWebMcpLoader(options?: WebMcpLoaderOptions): Promise<WebMcpLoaderResult>;
