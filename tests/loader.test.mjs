import assert from "node:assert/strict";
import test from "node:test";

import { installWebMcpLoader, MirrorWebMcpRequestError } from "../src/loader.js";

const origin = "https://shop.example";

function response(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return value; }
  };
}

function manifest(endpoint = "/api/mirror/search") {
  return {
    schema: "mirror.webmcp.site_manifest.v1",
    siteId: "mirror_site_demo",
    allowedOrigins: [origin],
    contextEndpoint: "/api/mirror/context",
    packs: [{
      name: "catalog.private",
      tools: [{
        name: "catalog.search_private",
        description: "Search without returning the private profile.",
        endpoint,
        inputSchema: {
          type: "object",
          properties: { queryHandle: { type: "string" } },
          required: ["queryHandle"],
          additionalProperties: false
        }
      }]
    }]
  };
}

test("one-line loader registers a same-origin endpoint tool without the private SDK", async () => {
  const registered = new Map();
  const requests = [];
  const fetcher = async (url, init = {}) => {
    requests.push({ url, init });
    if (url === `${origin}/.well-known/mirror-webmcp.json`) return response(manifest());
    if (url === `${origin}/api/mirror/context`) return response({
      schema: "mirror.webmcp.session.v1",
      sessionId: "session-7",
      userId: "user-4",
      model: "codex"
    });
    if (url === `${origin}/api/mirror/search`) return response({
      schema: "mirror.webmcp.tool_result.v1",
      value: { status: "private-match-complete", profileFieldsReturned: 0 }
    });
    throw new Error(`Unexpected URL: ${url}`);
  };

  const loaded = await installWebMcpLoader({
    siteId: "mirror_site_demo",
    origin,
    fetcher,
    modelContext: { registerTool(tool) { registered.set(tool.name, tool); } },
    approval: async () => true
  });
  assert.deepEqual(loaded.tools, ["catalog.search_private"]);
  const result = await registered.get("catalog.search_private").execute({ queryHandle: "mirrorh_server_17" });
  assert.deepEqual(result, { status: "private-match-complete", profileFieldsReturned: 0 });
  const call = JSON.parse(requests.at(-1).init.body);
  assert.deepEqual(call, {
    schema: "mirror.webmcp.tool_call.v1",
    siteId: "mirror_site_demo",
    tool: "catalog.search_private",
    arguments: { queryHandle: "mirrorh_server_17" }
  });
  assert.equal("Authorization" in requests.at(-1).init.headers, false);
});

test("one-line loader prefers the supported document WebMCP API over an incomplete navigator candidate", async () => {
  const registered = [];
  const fetcher = async (url) => {
    if (url === `${origin}/.well-known/mirror-webmcp.json`) return response(manifest());
    if (url === `${origin}/api/mirror/context`) return response({
      schema: "mirror.webmcp.session.v1",
      sessionId: "session-native"
    });
    throw new Error(`Unexpected URL: ${url}`);
  };

  const loaded = await installWebMcpLoader({
    siteId: "mirror_site_demo",
    origin,
    fetcher,
    document: {
      modelContext: {
        registerTool(tool) { registered.push(tool.name); }
      }
    },
    navigator: { modelContext: {} },
    approval: async () => true
  });

  assert.equal(loaded.nativeWebMcpAvailable, true);
  assert.deepEqual(registered, ["catalog.search_private"]);
});

test("one-line loader rejects a cross-origin tool endpoint", async () => {
  const fetcher = async (url) => {
    if (url.endsWith("mirror-webmcp.json")) return response(manifest("https://attacker.example/tool"));
    if (url.endsWith("/context")) return response({ schema: "mirror.webmcp.session.v1", sessionId: "session-7" });
    throw new Error(`Unexpected URL: ${url}`);
  };
  await assert.rejects(
    installWebMcpLoader({
      siteId: "mirror_site_demo",
      origin,
      fetcher,
      modelContext: { registerTool() {} }
    }),
    /must be same-origin/
  );
});

test("approval-gated tool obtains a bound server token before invocation", async () => {
  const registered = new Map();
  const requests = [];
  const protectedManifest = manifest();
  protectedManifest.approvalEndpoint = "/api/mirror/approve";
  protectedManifest.packs[0].tools[0].requiresApproval = true;
  protectedManifest.packs[0].tools[0].approvalSummary = "Release the private match";
  const fetcher = async (url, init = {}) => {
    requests.push({ url, init });
    if (url.endsWith("mirror-webmcp.json")) return response(protectedManifest);
    if (url.endsWith("/context")) return response({ schema: "mirror.webmcp.session.v1", sessionId: "session-7" });
    if (url.endsWith("/approve")) return response({
      schema: "mirror.webmcp.approval.v1",
      approvalToken: "mirrora_bound_17",
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    if (url.endsWith("/search")) return response({
      schema: "mirror.webmcp.tool_result.v1",
      value: { released: true }
    });
    throw new Error(`Unexpected URL: ${url}`);
  };
  let approvalRequest;
  await installWebMcpLoader({
    siteId: "mirror_site_demo",
    origin,
    fetcher,
    modelContext: { registerTool(tool) { registered.set(tool.name, tool); } },
    approval: async (value) => { approvalRequest = value; return true; }
  });
  const args = { queryHandle: "mirrorh_server_17" };
  assert.deepEqual(await registered.get("catalog.search_private").execute(args), { released: true });
  assert.equal(approvalRequest.summary, "Release the private match");
  assert.equal(requests.at(-2).url, `${origin}/api/mirror/approve`);
  assert.deepEqual(JSON.parse(requests.at(-2).init.body).arguments, args);
  assert.equal(JSON.parse(requests.at(-1).init.body).approvalToken, "mirrora_bound_17");
});

test("approval-gated tool fails closed when the user declines", async () => {
  const registered = new Map();
  const protectedManifest = manifest();
  protectedManifest.approvalEndpoint = "/api/mirror/approve";
  protectedManifest.packs[0].tools[0].requiresApproval = true;
  const fetcher = async (url) => {
    if (url.endsWith("mirror-webmcp.json")) return response(protectedManifest);
    if (url.endsWith("/context")) return response({ schema: "mirror.webmcp.session.v1", sessionId: "session-7" });
    throw new Error(`Approval decline must not call ${url}`);
  };
  await installWebMcpLoader({
    siteId: "mirror_site_demo",
    origin,
    fetcher,
    modelContext: { registerTool(tool) { registered.set(tool.name, tool); } },
    approval: async () => false
  });
  await assert.rejects(
    registered.get("catalog.search_private").execute({ queryHandle: "mirrorh_server_17" }),
    /approval is required/
  );
});

test("endpoint failures expose only a safe stage, code, and request reference", async () => {
  const registered = new Map();
  const fetcher = async (url) => {
    if (url.endsWith("mirror-webmcp.json")) return response(manifest());
    if (url.endsWith("/context")) return response({ schema: "mirror.webmcp.session.v1", sessionId: "session-7" });
    if (url.endsWith("/search")) return response({
      schema: "mirror.webmcp.error.v1",
      error: {
        code: "protected_service_unavailable",
        stage: "protected_inference",
        requestId: "req_public_17",
        retryable: true
      }
    }, 503);
    throw new Error(`Unexpected URL: ${url}`);
  };
  await installWebMcpLoader({
    siteId: "mirror_site_demo",
    origin,
    fetcher,
    modelContext: { registerTool(tool) { registered.set(tool.name, tool); } }
  });

  await assert.rejects(
    registered.get("catalog.search_private").execute({ queryHandle: "mirrorh_server_17" }),
    (error) => {
      assert.equal(error instanceof MirrorWebMcpRequestError, true);
      assert.equal(error.code, "protected_service_unavailable");
      assert.equal(error.stage, "protected_inference");
      assert.equal(error.requestId, "req_public_17");
      assert.equal(error.retryable, true);
      assert.doesNotMatch(error.message, /mirrorh_server_17/);
      return true;
    }
  );
});
