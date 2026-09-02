import assert from "node:assert/strict";
import test from "node:test";

import { issueApproval, verifyApproval } from "../lib/approval-token.js";

process.env.MIRROR_WEBMCP_APPROVAL_KEY = "test-only-approval-key";

const now = Date.parse("2026-09-02T12:00:00.000Z");
const expected = {
  siteId: "mirror_site_procurement_demo",
  origin: "https://procurement.example",
  sessionId: "session_test_123456",
  userId: "buyer_test",
  tool: "procurement.release_proposal",
  arguments: { proposalHandle: "mirrorh_proposal_7" }
};

test("approval is bound to site, context, tool, arguments, and expiry", () => {
  const issued = issueApproval({ ...expected, now });
  assert.match(issued.approvalToken, /^mirrora_v1_/);
  assert.equal(verifyApproval(issued.approvalToken, expected, now + 1_000).tool, expected.tool);
  assert.throws(() => verifyApproval(issued.approvalToken, {
    ...expected,
    sessionId: "session_other_123456"
  }, now + 1_000), /approval_context_mismatch/);
  assert.throws(() => verifyApproval(issued.approvalToken, {
    ...expected,
    arguments: { proposalHandle: "mirrorh_swapped" }
  }, now + 1_000), /approval_arguments_mismatch/);
  assert.throws(() => verifyApproval(issued.approvalToken, expected, now + 60_001), /expired_approval/);
});

test("approval rejects signature modification", () => {
  const issued = issueApproval({ ...expected, now });
  const modified = `${issued.approvalToken.slice(0, -1)}${issued.approvalToken.endsWith("A") ? "B" : "A"}`;
  assert.throws(() => verifyApproval(modified, expected, now + 1_000), /invalid_approval/);
});
