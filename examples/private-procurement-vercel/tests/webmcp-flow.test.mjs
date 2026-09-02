import assert from "node:assert/strict";
import test from "node:test";
import { createPrivateProcurement, PROCUREMENT_TOOLS } from "../lib/procurement-tools.js";

function modelContext() {
  const tools = new Map();
  return {
    tools,
    async registerTool(tool, options) {
      tools.set(tool.name, tool);
      options?.signal?.addEventListener("abort", () => tools.delete(tool.name), { once: true });
    }
  };
}

function response(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("the complete WebMCP chain exposes handles and approved results, not buyer fields", async () => {
  const native = modelContext();
  const outboundBodies = [];
  const approvals = [];
  const fetcher = async (path, init) => {
    const body = JSON.parse(init.body);
    outboundBodies.push({ path, body });
    if (path === "/api/seller-agent") {
      return response({
        proposal: {
          proposalId: "proposal_test",
          requestId: body.requestId,
          sku: "gpu-flex-8",
          name: "GPU Flex 8",
          quantity: body.quantity,
          unitPrice: 2518,
          totalPrice: 30216,
          deliveryDays: 10,
          currency: "EUR",
          rationale: "Best available eligible package.",
          validUntil: new Date(Date.now() + 60_000).toISOString()
        },
        commitToken: "private-commit-token",
        boundary: {
          receivedFields: Object.keys(body).sort(),
          buyerPrivateFieldsReceived: 0,
          browserHandleReceived: false
        }
      });
    }
    return response({
      status: "accepted",
      receiptId: "receipt_test",
      acceptedAt: new Date().toISOString(),
      proposalDigest: "proposaltest"
    });
  };

  const procurement = await createPrivateProcurement({
    modelContext: native,
    context: {
      origin: "https://procurement.example",
      sessionId: "session_test",
      userId: "buyer_test",
      model: "user_agent"
    },
    approval: async (request) => {
      approvals.push(request);
      return true;
    },
    fetcher
  });

  assert.deepEqual([...native.tools.keys()].sort(), Object.values(PROCUREMENT_TOOLS).sort());
  const requirements = {
    region: "eu",
    quantity: 12,
    deliveryDays: 14,
    maxUnitPrice: 3000,
    requiredCertifications: ["iso27001", "soc2"],
    privateNotes: "Do not disclose this note."
  };
  const protectedRequirements = await procurement.protectRequirements(requirements);

  const match = await native.tools.get(PROCUREMENT_TOOLS.find).execute({
    requirementsHandle: protectedRequirements.handle
  }, {});
  assert.equal(match.public.buyerPrivateFieldsReturned, 0);
  assert.match(match.privacy.handle, /^mirrorh_v1_/);
  assert.equal(JSON.stringify(match).includes(requirements.privateNotes), false);
  assert.equal(JSON.stringify(match).includes(String(requirements.maxUnitPrice)), false);

  const proposal = await native.tools.get(PROCUREMENT_TOOLS.propose).execute({
    matchHandle: match.privacy.handle
  }, {});
  assert.match(proposal.privacy.handle, /^mirrorh_v1_/);
  assert.equal(proposal.public.buyerPrivateFieldsReceivedBySeller, 0);
  assert.equal(proposal.public.browserHandleReceivedBySeller, false);

  const sellerBody = outboundBodies[0].body;
  assert.deepEqual(Object.keys(sellerBody).sort(), [
    "deliveryDays",
    "eligibleSkuIds",
    "publicObjective",
    "quantity",
    "requestId"
  ]);
  assert.equal(JSON.stringify(sellerBody).includes(protectedRequirements.handle), false);
  assert.equal(JSON.stringify(sellerBody).includes(requirements.privateNotes), false);
  assert.equal(JSON.stringify(sellerBody).includes(String(requirements.maxUnitPrice)), false);

  const released = await native.tools.get(PROCUREMENT_TOOLS.release).execute({
    proposalHandle: proposal.privacy.handle
  }, {});
  assert.equal(released.status, "proposal-released");
  assert.equal(released.buyerPrivateFieldsReturned, 0);
  assert.equal(released.sellerPrivateRulesReturned, 0);
  assert.equal(approvals.at(-1).phase, "release");

  const receipt = await native.tools.get(PROCUREMENT_TOOLS.accept).execute({
    proposalHandle: proposal.privacy.handle
  }, {});
  assert.equal(receipt.status, "accepted");
  assert.equal(receipt.buyerPrivateFieldsReturned, 0);
  assert.equal(outboundBodies[1].body.commitToken, "private-commit-token");
  assert.equal(approvals.some((request) => request.phase === "action"), true);

  await procurement.dispose();
  assert.equal(native.tools.size, 0);
});
