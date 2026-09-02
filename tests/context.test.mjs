import assert from "node:assert/strict";
import test from "node:test";

import { createWebMcpContext } from "../src/context.js";

test("context bindings are immutable to callers", () => {
  const context = createWebMcpContext({
    origin: "https://example.test",
    sessionId: "session-one",
    userId: "owner-one",
    model: "codex-site-tools"
  });

  const outside = context.get();
  outside.sessionId = "outside-mutation";
  assert.equal(context.get().sessionId, "session-one");
});

test("session rotation invalidates the previous context value", () => {
  const context = createWebMcpContext({
    origin: "https://example.test",
    sessionId: "session-one",
    userId: "owner-one",
    model: "codex-site-tools"
  });

  const previous = context.get().sessionId;
  const next = context.rotateSession("changed").sessionId;
  assert.notEqual(next, previous);
  assert.match(next, /^changed-/);
});

test("required bindings fail closed", () => {
  assert.throws(() => createWebMcpContext({ origin: "https://example.test" }), /sessionId is required/);
  assert.throws(() => createWebMcpContext({ origin: "", sessionId: "session" }), /origin is required/);
});
