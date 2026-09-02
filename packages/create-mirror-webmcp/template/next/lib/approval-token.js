import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "mirrora_v1_";
const MAX_TTL_MS = 60_000;

function key() {
  const configured = process.env.MIRROR_WEBMCP_APPROVAL_KEY || process.env.MIRROR_WEBMCP_HANDLE_KEY;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("MIRROR_WEBMCP_APPROVAL_KEY is required in production.");
  }
  return configured || "mirror-webmcp-local-approval-key-not-for-production";
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, child]) => [name, canonical(child)]));
  }
  return value;
}

function argumentsDigest(value) {
  return createHmac("sha256", key()).update(JSON.stringify(canonical(value))).digest("base64url");
}

function sign(encoded) {
  return createHmac("sha256", key()).update(encoded).digest("base64url");
}

export function issueApproval({ siteId, origin, sessionId, userId, tool, arguments: args, now = Date.now() }) {
  const payload = {
    schema: "mirror.webmcp.approval_token.v1",
    siteId,
    origin,
    sessionId,
    userId,
    tool,
    argumentsDigest: argumentsDigest(args),
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + MAX_TTL_MS).toISOString()
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    approvalToken: `${PREFIX}${encoded}.${sign(encoded)}`,
    expiresAt: payload.expiresAt
  };
}

export function verifyApproval(token, expected, now = Date.now()) {
  if (typeof token !== "string" || !token.startsWith(PREFIX)) throw new Error("approval_required");
  const [encoded, signature, extra] = token.slice(PREFIX.length).split(".");
  if (!encoded || !signature || extra) throw new Error("invalid_approval");
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(sign(encoded));
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) throw new Error("invalid_approval");
  let payload;
  try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); }
  catch { throw new Error("invalid_approval"); }
  if (payload.schema !== "mirror.webmcp.approval_token.v1" || Date.parse(payload.expiresAt) <= now) {
    throw new Error("expired_approval");
  }
  for (const field of ["siteId", "origin", "sessionId", "userId", "tool"]) {
    if (payload[field] !== expected[field]) throw new Error("approval_context_mismatch");
  }
  if (payload.argumentsDigest !== argumentsDigest(expected.arguments)) throw new Error("approval_arguments_mismatch");
  return payload;
}
