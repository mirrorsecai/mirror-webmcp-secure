import assert from "node:assert/strict";
import test from "node:test";
import { signProposal, verifyProposalToken } from "../lib/proposal-token.js";

const proposal = Object.freeze({
  proposalId: "proposal_test",
  requestId: "rfq_test",
  sku: "gpu-flex-8",
  totalPrice: 30216,
  validUntil: new Date(Date.now() + 60_000).toISOString()
});

test("proposal commit tokens are authenticated", () => {
  const token = signProposal(proposal);
  assert.deepEqual(verifyProposalToken(token), proposal);
  assert.throws(() => verifyProposalToken(`${token.slice(0, -1)}x`), /Invalid proposal token/);
});
