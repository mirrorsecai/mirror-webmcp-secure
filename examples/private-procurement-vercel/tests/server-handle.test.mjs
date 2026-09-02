import assert from "node:assert/strict";
import test from "node:test";

import { openServerValue, protectServerValue } from "../lib/server-handle.js";

process.env.MIRROR_WEBMCP_HANDLE_KEY = "test-only-webmcp-handle-key";

const context = Object.freeze({
  origin: "https://procurement.example",
  sessionId: "session_test_123456",
  userId: "buyer_test",
  toolName: "procurement.find_private_matches"
});

test("server handle opens only for its bound context, tool, kind, and purpose", () => {
  const privateValue = { maxUnitPrice: 3000, privateNotes: "do not release" };
  const descriptor = protectServerValue(privateValue, {
    ...context,
    kind: "buyer-requirements",
    purpose: "private-procurement",
    allowedTools: [context.toolName]
  });
  assert.match(descriptor.handle, /^mirrorh_srv_v1_/);
  assert.deepEqual(openServerValue(descriptor.handle, {
    ...context,
    kind: "buyer-requirements",
    purpose: "private-procurement"
  }), privateValue);
  assert.throws(() => openServerValue(descriptor.handle, {
    ...context,
    sessionId: "session_other_123456",
    kind: "buyer-requirements",
    purpose: "private-procurement"
  }), /context mismatch/);
  assert.throws(() => openServerValue(descriptor.handle, {
    ...context,
    toolName: "procurement.export_raw",
    kind: "buyer-requirements",
    purpose: "private-procurement"
  }), /not allowed/);
});

test("server handle rejects ciphertext modification", () => {
  const descriptor = protectServerValue({ value: 7 }, {
    ...context,
    kind: "test-value",
    purpose: "test-purpose",
    allowedTools: [context.toolName]
  });
  const index = "mirrorh_srv_v1_".length + 8;
  const replacement = descriptor.handle[index] === "A" ? "B" : "A";
  const modified = descriptor.handle.slice(0, index) + replacement + descriptor.handle.slice(index + 1);
  assert.throws(() => openServerValue(modified, {
    ...context,
    kind: "test-value",
    purpose: "test-purpose"
  }), /authentication failed/);
});
