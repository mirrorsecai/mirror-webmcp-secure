import { createWebMcpContext, createWebMcpSecure } from "../../../src/index.js";
import { matchPrivateRequirements } from "./catalog.js";
import { createSellerHandoff } from "./handoff.js";
import { PROCUREMENT_TOOLS } from "./tool-names.js";

export { PROCUREMENT_TOOLS } from "./tool-names.js";

function requestId() {
  return `rfq_${globalThis.crypto.randomUUID()}`;
}

async function readJson(response) {
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `Request failed with HTTP ${response.status}.`);
  return value;
}

export async function createPrivateProcurement({ modelContext, context: initialContext, approval, fetcher = fetch }) {
  const context = createWebMcpContext(initialContext);
  const secure = createWebMcpSecure({
    modelContext,
    context: context.get,
    approval
  });

  await secure.registerPack({
    name: "procurement.private",
    tools: [
      {
        name: PROCUREMENT_TOOLS.find,
        title: "Find private matches",
        description: "Match protected buyer requirements against the public catalogue without returning the budget, compliance list, notes, or raw requirements.",
        inputSchema: {
          type: "object",
          properties: { requirementsHandle: { type: "string" } },
          required: ["requirementsHandle"],
          additionalProperties: false
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async ({ requirementsHandle }, call) => {
          const requirements = await call.resolve(String(requirementsHandle), {
            kind: "buyer-requirements",
            purpose: "private-procurement"
          });
          const eligibleSkuIds = matchPrivateRequirements(requirements);
          if (eligibleSkuIds.length === 0) {
            return call.publicResult({
              status: "no-compatible-products",
              matchedProducts: 0,
              buyerPrivateFieldsReturned: 0
            });
          }
          return call.privateResult({
            requestId: requestId(),
            eligibleSkuIds,
            quantity: requirements.quantity,
            deliveryDays: requirements.deliveryDays
          }, {
            kind: "private-procurement-match",
            purpose: "request-seller-proposal",
            allowedTools: [PROCUREMENT_TOOLS.propose],
            ttlMs: 10 * 60_000,
            publicValue: {
              status: "private-match-complete",
              matchedProducts: eligibleSkuIds.length,
              buyerPrivateFieldsReturned: 0,
              productIdentifiersReturned: 0
            }
          });
        }
      },
      {
        name: PROCUREMENT_TOOLS.propose,
        title: "Ask the seller agent",
        description: "Give the seller agent only an allow-listed derived handoff. Browser handles and private buyer constraints never cross to the backend agent.",
        inputSchema: {
          type: "object",
          properties: { matchHandle: { type: "string" } },
          required: ["matchHandle"],
          additionalProperties: false
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async ({ matchHandle }, call) => {
          const match = await call.resolve(String(matchHandle), {
            kind: "private-procurement-match",
            purpose: "request-seller-proposal"
          });
          const handoff = createSellerHandoff(match);
          const response = await fetcher("/api/seller-agent", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(handoff),
            signal: call.signal
          });
          const result = await readJson(response);
          return call.privateResult(result, {
            kind: "seller-proposal",
            purpose: "review-and-commit-proposal",
            allowedTools: [PROCUREMENT_TOOLS.release, PROCUREMENT_TOOLS.accept],
            ttlMs: 15 * 60_000,
            publicValue: {
              status: "seller-proposal-ready",
              proposalCount: 1,
              buyerPrivateFieldsReceivedBySeller: result.boundary.buyerPrivateFieldsReceived,
              browserHandleReceivedBySeller: result.boundary.browserHandleReceived,
              proposalTermsReturned: 0
            }
          });
        }
      },
      {
        name: PROCUREMENT_TOOLS.release,
        title: "Release the proposal",
        description: "Release the seller's proposed commercial terms after the buyer approves the disclosure.",
        inputSchema: {
          type: "object",
          properties: { proposalHandle: { type: "string" } },
          required: ["proposalHandle"],
          additionalProperties: false
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async ({ proposalHandle }, call) => {
          const result = await call.resolve(String(proposalHandle), {
            kind: "seller-proposal",
            purpose: "review-and-commit-proposal"
          });
          const proposal = result.proposal;
          return call.publicResult({
            status: "proposal-released",
            offer: {
              proposalId: proposal.proposalId,
              product: proposal.name,
              sku: proposal.sku,
              quantity: proposal.quantity,
              unitPrice: proposal.unitPrice,
              totalPrice: proposal.totalPrice,
              currency: proposal.currency,
              deliveryDays: proposal.deliveryDays,
              validUntil: proposal.validUntil,
              rationale: proposal.rationale
            },
            buyerPrivateFieldsReturned: 0,
            sellerPrivateRulesReturned: 0
          }, {
            sensitivity: "sensitive",
            allowPrivateData: true,
            approvalSummary: "Release this proposal to your agent. Your budget, compliance requirements, private notes, and the seller's pricing rules remain private."
          });
        }
      },
      {
        name: PROCUREMENT_TOOLS.accept,
        title: "Accept the proposal",
        description: "Accept the bound proposal after explicit buyer approval and return a transaction receipt.",
        inputSchema: {
          type: "object",
          properties: { proposalHandle: { type: "string" } },
          required: ["proposalHandle"],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        requiresApproval: true,
        approvalSummary: "Accept this proposal and create a transaction receipt",
        execute: async ({ proposalHandle }, call) => {
          const result = await call.resolve(String(proposalHandle), {
            kind: "seller-proposal",
            purpose: "review-and-commit-proposal"
          });
          const response = await fetcher("/api/accept-proposal", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ commitToken: result.commitToken }),
            signal: call.signal
          });
          const receipt = await readJson(response);
          return call.publicResult({
            ...receipt,
            buyerPrivateFieldsReturned: 0,
            sellerPrivateRulesReturned: 0
          });
        }
      }
    ]
  });

  return Object.freeze({
    secure,
    context,
    async protectRequirements(requirements) {
      return secure.protect(requirements, {
        kind: "buyer-requirements",
        purpose: "private-procurement",
        allowedTools: [PROCUREMENT_TOOLS.find],
        ttlMs: 10 * 60_000
      });
    },
    dispose: () => secure.dispose()
  });
}
