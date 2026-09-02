import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";

import { proxyMirrorGateway } from "../lib/mirror-gateway-proxy.js";

test("Vercel proxy signs the method, path, origin, nonce, timestamp, and body", async () => {
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.MIRROR_WEBMCP_GATEWAY_URL;
  const previousSecret = process.env.MIRROR_WEBMCP_GATEWAY_SECRET;
  process.env.MIRROR_WEBMCP_GATEWAY_URL = "https://gateway.private.invalid";
  process.env.MIRROR_WEBMCP_GATEWAY_SECRET = "test-gateway-secret";
  let observed;
  globalThis.fetch = async (url, init) => {
    observed = { url: String(url), init };
    return Response.json({ schema: "mirror.webmcp.tool_result.v1", value: { ok: true } }, {
      status: 200,
      headers: { "Set-Cookie": "__Host-mirror_wmcp_session=wmcp_test; Secure; HttpOnly" }
    });
  };
  try {
    const body = JSON.stringify({ schema: "mirror.webmcp.tool_call.v1", tool: "private.search" });
    const response = await proxyMirrorGateway(new Request("https://site.example/api/mirror/tool", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "__Host-mirror_wmcp_session=wmcp_test",
        "X-Mirror-Site": "mirror_site_procurement_demo"
      },
      body
    }));
    assert.equal(response.status, 200);
    assert.equal(observed.url, "https://gateway.private.invalid/api/mirror/tool");
    const headers = new Headers(observed.init.headers);
    const bodyDigest = createHash("sha256").update(Buffer.from(observed.init.body)).digest("base64url");
    const signed = [
      headers.get("x-mirror-proxy-timestamp"),
      headers.get("x-mirror-proxy-nonce"),
      "POST",
      "/api/mirror/tool",
      "https://site.example",
      bodyDigest
    ].join("\n");
    const expected = createHmac("sha256", "test-gateway-secret").update(signed).digest("base64url");
    assert.equal(headers.get("x-mirror-proxy-signature"), expected);
    assert.equal(headers.get("x-mirror-original-origin"), "https://site.example");
    assert.equal(Buffer.from(observed.init.body).toString("utf8"), body);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.MIRROR_WEBMCP_GATEWAY_URL;
    else process.env.MIRROR_WEBMCP_GATEWAY_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.MIRROR_WEBMCP_GATEWAY_SECRET;
    else process.env.MIRROR_WEBMCP_GATEWAY_SECRET = previousSecret;
  }
});

test("Vercel proxy rejects a cross-origin request before forwarding", async () => {
  const previousUrl = process.env.MIRROR_WEBMCP_GATEWAY_URL;
  const previousSecret = process.env.MIRROR_WEBMCP_GATEWAY_SECRET;
  process.env.MIRROR_WEBMCP_GATEWAY_URL = "https://gateway.example";
  process.env.MIRROR_WEBMCP_GATEWAY_SECRET = "test-gateway-secret";
  let forwarded = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    forwarded = true;
    return Response.json({});
  };
  try {
    const request = new Request("https://buyer.example/api/mirror/context", {
      headers: {
        Origin: "https://lookalike.example",
        "X-Mirror-Site": "mirror_site_procurement_demo"
      }
    });
    await assert.rejects(() => proxyMirrorGateway(request), /Cross-origin request denied/);
    assert.equal(forwarded, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.MIRROR_WEBMCP_GATEWAY_URL;
    else process.env.MIRROR_WEBMCP_GATEWAY_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.MIRROR_WEBMCP_GATEWAY_SECRET;
    else process.env.MIRROR_WEBMCP_GATEWAY_SECRET = previousSecret;
  }
});
