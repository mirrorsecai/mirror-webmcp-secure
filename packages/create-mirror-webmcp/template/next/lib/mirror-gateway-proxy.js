import { createHash, createHmac, randomUUID } from "node:crypto";

import { DEMO_USER_ID, assertSameOrigin } from "./server-context.js";

export function mirrorGatewayConfigured() {
  return Boolean(process.env.MIRROR_WEBMCP_GATEWAY_URL && process.env.MIRROR_WEBMCP_GATEWAY_SECRET);
}

export async function proxyMirrorGateway(request) {
  if (!mirrorGatewayConfigured()) return null;
  const gateway = new URL(process.env.MIRROR_WEBMCP_GATEWAY_URL);
  if (gateway.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("Mirror gateway must use HTTPS.");
  const incoming = new URL(request.url);
  const body = request.method === "GET" || request.method === "HEAD"
    ? new Uint8Array()
    : new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > 16_384) throw new Error("Mirror gateway request is too large.");
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  const originalOrigin = assertSameOrigin(request);
  const pathname = incoming.pathname;
  const bodyDigest = createHash("sha256").update(body).digest("base64url");
  const signatureInput = [timestamp, nonce, request.method, pathname, originalOrigin, bodyDigest].join("\n");
  const signature = createHmac("sha256", process.env.MIRROR_WEBMCP_GATEWAY_SECRET)
    .update(signatureInput)
    .digest("base64url");
  const target = new URL(pathname, gateway);
  const response = await fetch(target, {
    method: request.method,
    headers: {
      Accept: "application/json",
      "Content-Type": request.headers.get("content-type") || "application/json",
      Cookie: request.headers.get("cookie") || "",
      "X-Mirror-Site": request.headers.get("x-mirror-site") || "",
      "X-Mirror-Original-Origin": originalOrigin,
      "X-Mirror-Authenticated-User": DEMO_USER_ID,
      "X-Mirror-Proxy-Timestamp": timestamp,
      "X-Mirror-Proxy-Nonce": nonce,
      "X-Mirror-Proxy-Signature": signature
    },
    body: body.byteLength ? body : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(120_000)
  });
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) headers.set("Set-Cookie", setCookie);
  return new Response(response.body, { status: response.status, headers });
}
