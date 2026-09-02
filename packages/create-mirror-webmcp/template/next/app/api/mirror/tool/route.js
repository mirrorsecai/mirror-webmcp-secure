import { randomUUID } from "node:crypto";
import { matchPrivateRequirements } from "../../../../lib/catalog.js";
import { createSellerHandoff } from "../../../../lib/handoff.js";
import { verifyProposalToken } from "../../../../lib/proposal-token.js";
import { runSellerAgent } from "../../../../lib/seller-agent.js";
import { openServerValue, protectServerValue } from "../../../../lib/server-handle.js";
import { DEMO_USER_ID, SITE_ID, assertSameOrigin, readSession } from "../../../../lib/server-context.js";
import { PROCUREMENT_TOOLS } from "../../../../lib/tool-names.js";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const origin = assertSameOrigin(request);
    const sessionId = readSession(request);
    const call = validateCall(await request.json());
    const context = { origin, sessionId, userId: DEMO_USER_ID };
    const value = await execute(call.tool, call.arguments, context);
    return Response.json({
      schema: "mirror.webmcp.tool_result.v1",
      value
    }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Tool call failed." }, { status: 400 });
  }
}

async function execute(toolName, args, context) {
  if (toolName === PROCUREMENT_TOOLS.find) {
    exactArgs(args, ["requirementsHandle"]);
    const requirements = openServerValue(args.requirementsHandle, {
      ...context,
      toolName,
      kind: "buyer-requirements",
      purpose: "private-procurement"
    });
    const eligibleSkuIds = matchPrivateRequirements(requirements);
    if (eligibleSkuIds.length === 0) {
      return { status: "no-compatible-products", matchedProducts: 0, buyerPrivateFieldsReturned: 0 };
    }
    const descriptor = protectServerValue({
      requestId: `rfq_${randomUUID()}`,
      eligibleSkuIds,
      quantity: requirements.quantity,
      deliveryDays: requirements.deliveryDays
    }, {
      ...context,
      kind: "private-procurement-match",
      purpose: "request-seller-proposal",
      allowedTools: [PROCUREMENT_TOOLS.propose],
      ttlMs: 10 * 60_000
    });
    return privateResult(descriptor, toolName, {
      status: "private-match-complete",
      matchedProducts: eligibleSkuIds.length,
      buyerPrivateFieldsReturned: 0,
      productIdentifiersReturned: 0
    });
  }

  if (toolName === PROCUREMENT_TOOLS.propose) {
    exactArgs(args, ["matchHandle"]);
    const match = openServerValue(args.matchHandle, {
      ...context,
      toolName,
      kind: "private-procurement-match",
      purpose: "request-seller-proposal"
    });
    const handoff = createSellerHandoff(match);
    const proposal = await runSellerAgent(handoff);
    const { signProposal } = await import("../../../../lib/proposal-token.js");
    const result = { proposal, commitToken: signProposal(proposal) };
    const descriptor = protectServerValue(result, {
      ...context,
      kind: "seller-proposal",
      purpose: "review-and-commit-proposal",
      allowedTools: [PROCUREMENT_TOOLS.release, PROCUREMENT_TOOLS.accept],
      ttlMs: 15 * 60_000
    });
    return privateResult(descriptor, toolName, {
      status: "seller-proposal-ready",
      proposalCount: 1,
      buyerPrivateFieldsReceivedBySeller: 0,
      browserHandleReceivedBySeller: false,
      proposalTermsReturned: 0,
      protectedInference: proposal.protectedInference
    });
  }

  if (toolName === PROCUREMENT_TOOLS.release) {
    exactArgs(args, ["proposalHandle"]);
    const result = openServerValue(args.proposalHandle, {
      ...context,
      toolName,
      kind: "seller-proposal",
      purpose: "review-and-commit-proposal"
    });
    const proposal = result.proposal;
    return {
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
        rationale: proposal.rationale,
        protectedInference: proposal.protectedInference
      },
      buyerPrivateFieldsReturned: 0,
      sellerPrivateRulesReturned: 0
    };
  }

  if (toolName === PROCUREMENT_TOOLS.accept) {
    exactArgs(args, ["proposalHandle"]);
    const result = openServerValue(args.proposalHandle, {
      ...context,
      toolName,
      kind: "seller-proposal",
      purpose: "review-and-commit-proposal"
    });
    const proposal = verifyProposalToken(result.commitToken);
    return {
      status: "accepted",
      receiptId: `receipt_${randomUUID()}`,
      acceptedAt: new Date().toISOString(),
      proposalDigest: proposal.proposalId.slice(-12),
      buyerPrivateFieldsReturned: 0,
      sellerPrivateRulesReturned: 0
    };
  }

  throw new Error("Tool is not allowed for this site.");
}

function privateResult(descriptor, toolName, publicValue) {
  return {
    ok: true,
    privacy: { mode: "private_handle", ...descriptor },
    public: publicValue,
    producedBy: toolName
  };
}

function validateCall(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid tool call.");
  exactArgs(value, ["schema", "siteId", "tool", "arguments"]);
  if (value.schema !== "mirror.webmcp.tool_call.v1" || value.siteId !== SITE_ID) throw new Error("Invalid tool-call envelope.");
  if (!Object.values(PROCUREMENT_TOOLS).includes(value.tool)) throw new Error("Unknown tool.");
  if (!value.arguments || typeof value.arguments !== "object" || Array.isArray(value.arguments)) throw new Error("Invalid tool arguments.");
  return value;
}

function exactArgs(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid object.");
  const expected = new Set(fields);
  for (const field of Object.keys(value)) if (!expected.has(field)) throw new Error(`Unexpected field '${field}'.`);
  for (const field of fields) if (!(field in value)) throw new Error(`Missing field '${field}'.`);
}
