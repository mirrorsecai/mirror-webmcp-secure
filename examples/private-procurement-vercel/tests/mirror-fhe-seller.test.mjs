import assert from "node:assert/strict";
import test from "node:test";

import { runMirrorFheSeller } from "../lib/mirror-fhe-seller.js";

const handoff = Object.freeze({
  requestId: "rfq_12345678-abcd-4321-9876-123456789abc",
  eligibleSkuIds: ["gpu-flex-8"],
  quantity: 12,
  deliveryDays: 14,
  publicObjective: "Return the best available compliant offer",
});

test("the Mirror FHE seller sends only the bounded handoff and returns safe proof facts", async () => {
  let sent;
  const proposal = await runMirrorFheSeller(handoff, {
    endpoint: "https://mirror.example/api/webmcp/fhe-seller",
    token: "test-relay-token",
    fetchImpl: async (_url, init) => {
      sent = JSON.parse(init.body);
      return Response.json({
        status: "complete",
        selectedSku: "gpu-flex-8",
        rationale: "The available configuration fits the requested quantity and delivery window.",
        proof: {
          model: "mirror/glm-5.3-flash",
          envelopeFingerprint: "0123456789abcdef",
          ciphertextBytes: 8003,
          plaintextCanary: "absent",
          ingress: "encrypted",
          compute: "ciphertext",
          egress: "encrypted",
          providerReasoning: "withheld",
          roundTripSeconds: 2.4,
        },
      });
    },
  });

  assert.deepEqual(sent, handoff);
  assert.equal(JSON.stringify(sent).includes("maxUnitPrice"), false);
  assert.equal(proposal.protectedInference.compute, "ciphertext");
  assert.equal(proposal.protectedInference.providerReasoning, "withheld");
  assert.equal(proposal.issuedBy, "mirror-fhe-seller-agent");
});
