import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SCHEMA = "mirror.webmcp.server_handle.v1";
const PREFIX = "mirrorh_srv_v1_";
const AAD = Buffer.from(SCHEMA);

function key() {
  const configured = process.env.MIRROR_WEBMCP_HANDLE_KEY;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("MIRROR_WEBMCP_HANDLE_KEY is required in production.");
  }
  const material = configured || "mirror-webmcp-local-handle-key-not-for-production";
  return createHash("sha256").update(material).digest();
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

function digest(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")}`;
}

function text(value, name) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

export function protectServerValue(value, options) {
  const now = Date.now();
  const binding = {
    origin: text(options.origin, "origin"),
    sessionId: text(options.sessionId, "sessionId"),
    userId: text(options.userId, "userId"),
    kind: text(options.kind, "kind"),
    purpose: text(options.purpose, "purpose"),
    allowedTools: [...new Set(options.allowedTools.map((name) => text(name, "allowed tool")))].sort(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + (options.ttlMs ?? 10 * 60_000)).toISOString()
  };
  const payload = Buffer.from(JSON.stringify({ schema: SCHEMA, binding, value }));
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), nonce);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  const handle = `${PREFIX}${Buffer.concat([nonce, tag, ciphertext]).toString("base64url")}`;
  return {
    schema: "mirror.webmcp.private_handle.v1",
    handle,
    kind: binding.kind,
    purpose: binding.purpose,
    allowedTools: binding.allowedTools,
    createdAt: binding.createdAt,
    expiresAt: binding.expiresAt,
    bindingDigest: digest(binding)
  };
}

export function openServerValue(handle, expected) {
  if (!String(handle).startsWith(PREFIX)) throw new Error("Invalid private handle.");
  const packed = Buffer.from(String(handle).slice(PREFIX.length), "base64url");
  if (packed.length < 29) throw new Error("Invalid private handle.");
  const nonce = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  let decoded;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), nonce);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    decoded = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"));
  } catch {
    throw new Error("Private handle authentication failed.");
  }
  if (decoded.schema !== SCHEMA) throw new Error("Unsupported private handle.");
  const binding = decoded.binding;
  if (Date.parse(binding.expiresAt) <= Date.now()) throw new Error("Private handle expired.");
  if (binding.origin !== expected.origin || binding.sessionId !== expected.sessionId || binding.userId !== expected.userId) {
    throw new Error("Private handle context mismatch.");
  }
  if (!binding.allowedTools.includes(expected.toolName)) throw new Error("Private handle is not allowed for this tool.");
  if (expected.kind && binding.kind !== expected.kind) throw new Error("Private handle kind mismatch.");
  if (expected.purpose && binding.purpose !== expected.purpose) throw new Error("Private handle purpose mismatch.");
  return decoded.value;
}
