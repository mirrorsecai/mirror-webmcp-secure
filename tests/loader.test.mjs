import assert from "node:assert/strict";
import test from "node:test";

import { installWebMcpLoader } from "../src/loader.js";

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
      model: "codex",
      accessToken: "short-lived-test-token"
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
  assert.equal(requests.at(-1).init.headers.Authorization, "Bearer short-lived-test-token");
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
