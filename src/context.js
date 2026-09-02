export function createWebMcpContext(initial) {
  let current = normalize(initial);

  return Object.freeze({
    get() {
      return { ...current };
    },
    update(patch) {
      current = normalize({ ...current, ...patch });
      return { ...current };
    },
    replace(next) {
      current = normalize(next);
      return { ...current };
    },
    rotateSession(prefix = "webmcp") {
      current = normalize({ ...current, sessionId: `${prefix}-${randomId()}` });
      return { ...current };
    }
  });
}

function normalize(value) {
  const origin = required(value?.origin, "origin");
  const sessionId = required(value?.sessionId, "sessionId");
  const normalized = { origin, sessionId };
  if (value?.userId !== undefined) normalized.userId = required(value.userId, "userId");
  if (value?.model !== undefined) normalized.model = required(value.model, "model");
  return normalized;
}

function required(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} is required.`);
  return text;
}

function randomId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
