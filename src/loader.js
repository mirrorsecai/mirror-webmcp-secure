import { createWebMcpSecure } from "./index.js";
import { resolveModelContext } from "./model-context.js";

export const WEBMCP_SITE_MANIFEST_SCHEMA = "mirror.webmcp.site_manifest.v1";
export const WEBMCP_TOOL_RESULT_SCHEMA = "mirror.webmcp.tool_result.v1";

/**
 * Register endpoint-backed Site Tools from a same-origin manifest.
 *
 * A site id identifies configuration; it is never treated as a credential.
 * The site's context endpoint authenticates the browser session, and every
 * tool endpoint must repeat authorization and binding checks server-side.
 */
export async function installWebMcpLoader(options = {}) {
  const script = options.script ?? findLoaderScript();
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
  }), { siteId, origin });

  const contextUrl = sameOriginUrl(manifest.contextEndpoint, origin, "contextEndpoint");
  const bootstrap = validateBootstrap(await fetchJson(fetcher, contextUrl, {
    credentials: "same-origin",
    headers: { Accept: "application/json", "X-Mirror-Site": siteId }
  }));
  const context = () => ({
    origin,
    sessionId: bootstrap.sessionId,
    ...(bootstrap.userId ? { userId: bootstrap.userId } : {}),
    ...(bootstrap.model ? { model: bootstrap.model } : {})
  });
  const nativeModelContext = resolveModelContext(
    options.modelContext,
    options.document?.modelContext ?? globalThis.document?.modelContext,
    options.navigator?.modelContext ?? globalThis.navigator?.modelContext
  );
  const registry = new Map();
  const nativeErrors = [];
  const modelContext = {
    async registerTool(tool, registration = {}) {
      registry.set(tool.name, tool);
      registration.signal?.addEventListener("abort", () => registry.delete(tool.name), { once: true });
      if (typeof nativeModelContext?.registerTool !== "function") return;
      try {
        await nativeModelContext.registerTool(tool, registration);
      } catch (error) {
        nativeErrors.push(String(error?.message ?? error));
      }
    }
  };
  const secure = createWebMcpSecure({
    context,
    modelContext,
    approval: options.approval ?? defaultApproval,
    onEvidence: options.onEvidence
  });

  for (const pack of manifest.packs) {
    await secure.registerPack({
      name: pack.name,
      tools: pack.tools.map((tool) => endpointTool({
        tool,
        siteId,
        origin,
        fetcher,
        accessToken: bootstrap.accessToken
      }))
    });
  }

  const detail = Object.freeze({
    siteId,
    manifestUrl,
    tools: secure.runtime.registeredTools(),
    nativeWebMcpAvailable: typeof nativeModelContext?.registerTool === "function",
    nativeErrors: Object.freeze([...nativeErrors]),
    secure,
    async invoke(name, args, invokeOptions) {
      const tool = registry.get(name);
      if (!tool) throw new Error(`WebMCP tool '${name}' is not registered.`);
      return tool.execute(args, invokeOptions);
    }
  });
  globalThis.__MIRROR_WEBMCP__ = detail;
  dispatch("mirror:webmcp-ready", detail);
  return detail;
}

function endpointTool({ tool, siteId, origin, fetcher, accessToken }) {
  const endpoint = sameOriginUrl(tool.endpoint, origin, `endpoint for ${tool.name}`);
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
    exposedTo: tool.exposedTo,
    requiresApproval: Boolean(tool.requiresApproval),
    approvalSummary: tool.approvalSummary,
    async execute(args, call) {
      const result = validateToolResult(await fetchJson(fetcher, endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Mirror-Site": siteId,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          schema: "mirror.webmcp.tool_call.v1",
          siteId,
          tool: tool.name,
          arguments: args
        }),
        signal: call.signal
      }));
      return call.publicResult(result.value, {
        sensitivity: result.sensitivity ?? "public",
        approvalSummary: result.approvalSummary
      });
    }
  };
}

function validateManifest(value, { siteId, origin }) {
  if (!value || value.schema !== WEBMCP_SITE_MANIFEST_SCHEMA) throw new Error("Unsupported Mirror WebMCP manifest.");
  if (value.siteId !== siteId) throw new Error("The manifest site id does not match the loader.");
  if (!Array.isArray(value.allowedOrigins) || !value.allowedOrigins.includes(origin)) {
    throw new Error("This origin is not allowed by the Mirror WebMCP manifest.");
  }
  required(value.contextEndpoint, "contextEndpoint");
  if (!Array.isArray(value.packs) || value.packs.length === 0) throw new Error("The manifest must contain at least one tool pack.");
  for (const pack of value.packs) {
    required(pack?.name, "pack.name");
    if (!Array.isArray(pack.tools) || pack.tools.length === 0) throw new Error(`Tool pack ${pack.name} is empty.`);
    for (const tool of pack.tools) {
      required(tool?.name, "tool.name");
      required(tool?.description, `description for ${tool?.name ?? "tool"}`);
      required(tool?.endpoint, `endpoint for ${tool?.name ?? "tool"}`);
    }
  }
  return value;
}

function validateBootstrap(value) {
  if (!value || value.schema !== "mirror.webmcp.session.v1") throw new Error("Invalid Mirror WebMCP session bootstrap.");
  required(value.sessionId, "sessionId");
  if (value.accessToken !== undefined) required(value.accessToken, "accessToken");
  return value;
}

function validateToolResult(value) {
  if (!value || value.schema !== WEBMCP_TOOL_RESULT_SCHEMA) throw new Error("Invalid Mirror WebMCP tool result.");
  if (!("value" in value)) throw new Error("The Mirror WebMCP tool result is missing value.");
  if (value.sensitivity !== undefined && !["public", "sensitive"].includes(value.sensitivity)) {
    throw new Error("Invalid Mirror WebMCP result sensitivity.");
  }
  return value;
}

async function fetchJson(fetcher, url, init) {
  const response = await fetcher(url, init);
  let value;
  try {
    value = await response.json();
  } catch {
    throw new Error(`Mirror WebMCP endpoint returned non-JSON (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(value?.error ?? `Mirror WebMCP endpoint failed with HTTP ${response.status}.`);
  return value;
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

function findLoaderScript() {
  const scripts = globalThis.document?.querySelectorAll?.("script[data-mirror-webmcp][data-site]");
  return scripts?.[scripts.length - 1];
}

function dispatch(name, detail) {
  if (typeof globalThis.dispatchEvent !== "function" || typeof globalThis.CustomEvent !== "function") return;
  globalThis.dispatchEvent(new CustomEvent(name, { detail }));
}
