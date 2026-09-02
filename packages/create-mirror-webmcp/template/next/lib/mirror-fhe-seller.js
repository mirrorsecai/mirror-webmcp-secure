import { randomUUID } from "node:crypto";

import { assertSellerHandoff } from "./handoff.js";
import { quoteSku } from "./seller-policy.js";

const MODEL = "mirror/glm-5.3-flash";

function configuredValue(explicit, environmentName) {
  const value = explicit ?? process.env[environmentName];
  return typeof value === "string" ? value.trim() : "";
}

export function mirrorFheSellerConfigured(options = {}) {
  return Boolean(
    configuredValue(options.endpoint, "MIRROR_WEBMCP_FHE_URL")
    && configuredValue(options.token, "MIRROR_WEBMCP_FHE_TOKEN")
  );
}

function validateProof(value) {
  if (
    !value
    || value.model !== MODEL
    || value.plaintextCanary !== "absent"
    || value.ingress !== "encrypted"
    || value.compute !== "ciphertext"
    || value.egress !== "encrypted"
    || value.providerReasoning !== "withheld"
    || typeof value.envelopeFingerprint !== "string"
    || !Number.isInteger(value.ciphertextBytes)
  ) {
    throw new Error("Mirror returned an incomplete encrypted-inference proof.");
  }
  return Object.freeze({
    model: value.model,
    envelopeFingerprint: value.envelopeFingerprint.slice(0, 32),
    ciphertextBytes: value.ciphertextBytes,
    plaintextCanary: "absent",
    ingress: "encrypted",
    compute: "ciphertext",
    egress: "encrypted",
    providerReasoning: "withheld",
    roundTripSeconds: Number(value.roundTripSeconds),
  });
}

export async function runMirrorFheSeller(rawHandoff, options = {}) {
  const handoff = assertSellerHandoff(rawHandoff);
  const endpoint = configuredValue(options.endpoint, "MIRROR_WEBMCP_FHE_URL");
  const token = configuredValue(options.token, "MIRROR_WEBMCP_FHE_TOKEN");
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!endpoint || !token) throw new Error("Mirror encrypted seller configuration is unavailable.");

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Mirror-WebMCP-Auth": token,
    },
    body: JSON.stringify(handoff),
    signal: AbortSignal.timeout(120_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Mirror encrypted seller failed with HTTP ${response.status}.`);
  if (result.status !== "complete" || !handoff.eligibleSkuIds.includes(result.selectedSku)) {
    throw new Error("Mirror encrypted seller selected an invalid product.");
  }
  const rationale = String(result.rationale || "").replace(/\s+/g, " ").trim();
  if (!rationale || rationale.length > 240) throw new Error("Mirror encrypted seller returned an invalid rationale.");
  const quote = quoteSku({
    sku: result.selectedSku,
    quantity: handoff.quantity,
    deliveryDays: handoff.deliveryDays,
  });
  const createdAt = new Date();
  return {
    proposalId: `proposal_${randomUUID()}`,
    requestId: handoff.requestId,
    ...quote,
    rationale,
    createdAt: createdAt.toISOString(),
    validUntil: new Date(createdAt.getTime() + 15 * 60_000).toISOString(),
    issuedBy: "mirror-fhe-seller-agent",
    protectedInference: validateProof(result.proof),
  };
}
