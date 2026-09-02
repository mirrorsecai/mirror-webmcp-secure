import { resolveModelContext } from "./model-context.js";

export const WEBMCP_SITE_MANIFEST_SCHEMA = "mirror.webmcp.site_manifest.v1";
export const WEBMCP_TOOL_CALL_SCHEMA = "mirror.webmcp.tool_call.v1";
export const WEBMCP_TOOL_RESULT_SCHEMA = "mirror.webmcp.tool_result.v1";
export const WEBMCP_APPROVAL_REQUEST_SCHEMA = "mirror.webmcp.approval_request.v1";
export const WEBMCP_APPROVAL_SCHEMA = "mirror.webmcp.approval.v1";
export const WEBMCP_ERROR_SCHEMA = "mirror.webmcp.error.v1";

export class MirrorWebMcpRequestError extends Error {
  constructor({ code, status, stage, requestId, retryable = false }) {
    const reference = requestId ? ` Reference ${requestId}.` : "";
    super(`Mirror WebMCP ${stage} request failed (${code}).${reference}`);
    this.name = "MirrorWebMcpRequestError";
    this.code = code;
    this.status = status;
    this.stage = stage;
    this.requestId = requestId;
    this.retryable = retryable;
  }
}

/**
 * Register endpoint-backed WebMCP Site Tools from a same-origin manifest.
 *
 * This file is intentionally only a transport adapter. It contains no handle
 * cryptography, protected-compute client, policy engine, key, or privileged
 * receipt logic. Those controls belong behind the site's authenticated
 * endpoints, where browser visitors cannot download them.
 */
export async function installWebMcpLoader(options = {}) {
  const script = options.script ?? findLoaderScript(options.document ?? globalThis.document);
  const siteId = required(options.siteId ?? script?.dataset.site, "siteId");
  const origin = options.origin ?? globalThis.location?.origin;
  const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);
  if (!origin) throw new Error("A browser origin is required.");
  if (!fetcher) throw new Error("fetch is required.");

  const manifestUrl = sameOriginUrl(
    options.manifestUrl ?? script?.dataset.manifest ?? "/.well-known/mirror-webmcp.json",
    origin,
    "manifestUrl"
  );
  const manifest = validateManifest(await fetchJson(fetcher, manifestUrl, {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  }, "manifest"), { siteId, origin });

  const contextUrl = sameOriginUrl(manifest.contextEndpoint, origin, "contextEndpoint");
  validateBootstrap(await fetchJson(fetcher, contextUrl, {
    credentials: "same-origin",
    headers: { Accept: "application/json", "X-Mirror-Site": siteId }
  }, "session"));
  const nativeModelContext = resolveModelContext(
    options.modelContext,
    options.document?.modelContext ?? globalThis.document?.modelContext,
    options.navigator?.modelContext ?? globalThis.navigator?.modelContext
  );
  const registry = new Map();
  const nativeErrors = [];
  const toolNames = [];

  for (const pack of manifest.packs) {
    for (const tool of pack.tools) {
      const registered = endpointTool({
        tool,
        siteId,
        origin,
        fetcher,
        approvalEndpoint: manifest.approvalEndpoint,
        approval: options.approval ?? defaultApproval
      });
      registry.set(tool.name, registered);
      toolNames.push(tool.name);
      if (typeof nativeModelContext?.registerTool !== "function") continue;
      try {
        await nativeModelContext.registerTool(registered, options.registration);
      } catch (error) {
        nativeErrors.push(safeMessage(error));
      }
    }
  }

  const detail = Object.freeze({
    siteId,
    manifestUrl,
    tools: Object.freeze([...toolNames]),
    nativeWebMcpAvailable: typeof nativeModelContext?.registerTool === "function",
    nativeErrors: Object.freeze([...nativeErrors]),
    async invoke(name, args, invokeOptions = {}) {
      const tool = registry.get(name);
      if (!tool) throw new Error(`WebMCP tool '${name}' is not registered.`);
      return tool.execute(args, invokeOptions);
    }
  });
  globalThis.__MIRROR_WEBMCP__ = detail;
  dispatch("mirror:webmcp-ready", detail);
  return detail;
}

function endpointTool({ tool, siteId, origin, fetcher, approvalEndpoint, approval }) {
  const endpoint = sameOriginUrl(tool.endpoint, origin, `endpoint for ${tool.name}`);
  const approvalUrl = tool.requiresApproval
    ? sameOriginUrl(required(approvalEndpoint, "approvalEndpoint"), origin, "approvalEndpoint")
    : undefined;
  return Object.freeze({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
    async execute(args, call = {}) {
      let approvalToken;
      if (tool.requiresApproval) {
        const approved = await approval(Object.freeze({
          tool: tool.name,
          title: tool.title,
          summary: tool.approvalSummary ?? `Allow ${tool.name} to run`,
          arguments: args
        }));
        if (!approved) throw new Error("User approval is required for this operation.");
        const approvalResult = validateApproval(await fetchJson(fetcher, approvalUrl, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Mirror-Site": siteId
          },
          body: JSON.stringify({
            schema: WEBMCP_APPROVAL_REQUEST_SCHEMA,
            siteId,
            tool: tool.name,
            arguments: args
          }),
          signal: call?.signal
        }, "approval"));
        approvalToken = approvalResult.approvalToken;
      }
      dispatch("mirror:webmcp-call", Object.freeze({ tool: tool.name, state: "running" }));
      try {
        const result = validateToolResult(await fetchJson(fetcher, endpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Mirror-Site": siteId
          },
          body: JSON.stringify({
            schema: WEBMCP_TOOL_CALL_SCHEMA,
            siteId,
            tool: tool.name,
            arguments: args,
            ...(approvalToken ? { approvalToken } : {})
          }),
          signal: call?.signal
        }, `tool:${tool.name}`));
        dispatch("mirror:webmcp-call", Object.freeze({ tool: tool.name, state: "complete" }));
        return result.value;
      } catch (error) {
        dispatch("mirror:webmcp-call", Object.freeze({
          tool: tool.name,
          state: "failed",
          ...safeDiagnostic(error)
        }));
        throw error;
      }
    }
  });
}

function validateManifest(value, { siteId, origin }) {
  if (!value || value.schema !== WEBMCP_SITE_MANIFEST_SCHEMA) throw new Error("Unsupported Mirror WebMCP manifest.");
  if (value.siteId !== siteId) throw new Error("The manifest site id does not match the loader.");
  if (!Array.isArray(value.allowedOrigins) || !value.allowedOrigins.includes(origin)) {
    throw new Error("This origin is not allowed by the Mirror WebMCP manifest.");
  }
  required(value.contextEndpoint, "contextEndpoint");
  if (!Array.isArray(value.packs) || value.packs.length === 0) throw new Error("The manifest must contain at least one tool pack.");
  const names = new Set();
  for (const pack of value.packs) {
    required(pack?.name, "pack.name");
    if (!Array.isArray(pack.tools) || pack.tools.length === 0) throw new Error(`Tool pack ${pack.name} is empty.`);
    for (const tool of pack.tools) {
      const name = required(tool?.name, "tool.name");
      if (names.has(name)) throw new Error(`Duplicate WebMCP tool '${name}'.`);
      names.add(name);
      required(tool?.description, `description for ${name}`);
      required(tool?.endpoint, `endpoint for ${name}`);
      if (!tool.inputSchema || tool.inputSchema.type !== "object") throw new Error(`Input schema for ${name} must be an object schema.`);
      if (tool.requiresApproval) required(value.approvalEndpoint, "approvalEndpoint");
    }
  }
  return value;
}

function validateBootstrap(value) {
  if (!value || value.schema !== "mirror.webmcp.session.v1") throw new Error("Invalid Mirror WebMCP session bootstrap.");
  required(value.sessionId, "sessionId");
  if (value.accessToken !== undefined) throw new Error("Use an HttpOnly site session instead of a browser bearer token.");
  return value;
}

function validateToolResult(value) {
  if (!value || value.schema !== WEBMCP_TOOL_RESULT_SCHEMA) throw new Error("Invalid Mirror WebMCP tool result.");
  if (!("value" in value)) throw new Error("The Mirror WebMCP tool result is missing value.");
  return value;
}

function validateApproval(value) {
  if (!value || value.schema !== WEBMCP_APPROVAL_SCHEMA) throw new Error("Invalid Mirror WebMCP approval response.");
  required(value.approvalToken, "approvalToken");
  required(value.expiresAt, "expiresAt");
  return value;
}

async function fetchJson(fetcher, url, init, stage) {
  const response = await fetcher(url, init);
  let value;
  try {
    value = await response.json();
  } catch {
    throw new MirrorWebMcpRequestError({
      code: "non_json_response",
      status: response.status,
      stage,
      requestId: response.headers?.get?.("x-request-id")
    });
  }
  if (!response.ok) throw safeRemoteError(value, response, stage);
  return value;
}

function safeRemoteError(value, response, stage) {
  const remote = typeof value?.error === "object" ? value.error : value;
  return new MirrorWebMcpRequestError({
    code: safeToken(remote?.code ?? value?.error) ?? `http_${response.status}`,
    status: response.status,
    stage: safeToken(remote?.stage ?? value?.stage) ?? stage,
    requestId: safeToken(remote?.requestId ?? value?.requestId ?? response.headers?.get?.("x-request-id")),
    retryable: remote?.retryable === true || value?.retryable === true
  });
}

function safeToken(value) {
  return typeof value === "string" && /^[a-z0-9_.:-]{1,96}$/i.test(value) ? value : undefined;
}

function safeDiagnostic(error) {
  return error instanceof MirrorWebMcpRequestError
    ? Object.freeze({ code: error.code, stage: error.stage, requestId: error.requestId, retryable: error.retryable })
    : Object.freeze({ code: "client_error", stage: "client", retryable: false });
}

function sameOriginUrl(value, origin, field) {
  const url = new URL(required(value, field), origin);
  if (url.origin !== origin) throw new Error(`${field} must be same-origin.`);
  return url.href;
}

function required(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} is required.`);
  return text;
}

function defaultApproval(request) {
  if (typeof globalThis.confirm !== "function") return false;
  return globalThis.confirm(request.summary);
}

function findLoaderScript(documentValue) {
  const scripts = documentValue?.querySelectorAll?.("script[data-mirror-webmcp][data-site]");
  return scripts?.[scripts.length - 1];
}

function safeMessage(error) {
  return String(error?.message ?? error).replace(/[\r\n]+/g, " ").slice(0, 240);
}

function dispatch(name, detail) {
  if (typeof globalThis.dispatchEvent !== "function" || typeof globalThis.CustomEvent !== "function") return;
  globalThis.dispatchEvent(new CustomEvent(name, { detail }));
}
