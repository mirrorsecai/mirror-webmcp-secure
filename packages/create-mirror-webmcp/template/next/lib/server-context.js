import { randomUUID } from "node:crypto";

export const SITE_ID = "mirror_site_procurement_demo";
export const SESSION_COOKIE = "mirror_webmcp_session";

/**
 * Reference-only identity adapter.
 *
 * Replace this function with the user id from a server-verified application
 * session. Never accept the user id from tool arguments or an unsigned browser
 * header. Keeping this as one function makes the production replacement
 * explicit without coupling the example to an authentication framework.
 */
export function applicationUserId(_request) {
  return "buyer-demo-user";
}

export function requestOrigin(request) {
  const parsed = new URL(request.url);
  const protocol = request.headers.get("x-forwarded-proto") || parsed.protocol.slice(0, -1);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || parsed.host;
  return `${protocol}://${host}`;
}

export function assertSameOrigin(request) {
  const expected = requestOrigin(request);
  const supplied = request.headers.get("origin");
  if (supplied && supplied !== expected) throw new Error("Cross-origin request denied.");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) throw new Error("Cross-site request denied.");
  const siteId = request.headers.get("x-mirror-site");
  if (siteId !== SITE_ID) throw new Error("Unknown Mirror site.");
  return expected;
}

export function readSession(request) {
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!value || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) throw new Error("Authenticated WebMCP session required.");
  return value;
}

export function newSession() {
  return `wmcp_${randomUUID().replaceAll("-", "")}`;
}

export function sessionCookie(sessionId, { secure = false } = {}) {
  const secureAttribute = secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=1800${secureAttribute}`;
}
