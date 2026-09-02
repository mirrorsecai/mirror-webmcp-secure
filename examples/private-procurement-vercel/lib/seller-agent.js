import { randomUUID } from "node:crypto";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import { publicProduct } from "./catalog.js";
import { assertSellerHandoff } from "./handoff.js";
import { mirrorFheSellerConfigured, runMirrorFheSeller } from "./mirror-fhe-seller.js";
import { quoteSku, sellerRule } from "./seller-policy.js";

export async function runSellerAgent(rawHandoff, options = {}) {
  const handoff = assertSellerHandoff(rawHandoff);
  if (mirrorFheSellerConfigured(options)) return runMirrorFheSeller(handoff, options);
  return runVercelSellerAgent(handoff);
}

async function runVercelSellerAgent(handoff) {
  let issuedProposal = null;
  const eligible = new Set(handoff.eligibleSkuIds);

  const agent = new ToolLoopAgent({
    model: process.env.SELLER_AGENT_MODEL || "poolside/laguna-s-2.1-free",
    instructions: [
      "You are the seller-side procurement agent.",
      "You receive only an allow-listed handoff produced by a private buyer-side match.",
      "Inspect inventory, choose only an eligible SKU, and call issue_proposal exactly once.",
      "Never ask for the buyer budget, pricing ceiling, compliance list, private notes, or raw profile.",
      "Private price floors and discount rules remain inside tools. Do not infer or disclose them."
    ].join(" "),
    stopWhen: stepCountIs(6),
    tools: {
      inspect_inventory: tool({
        description: "Inspect seller inventory for SKU identifiers already approved by the private match.",
        inputSchema: z.object({ skuIds: z.array(z.string()).min(1) }),
        execute: async ({ skuIds }) => skuIds
          .filter((sku) => eligible.has(sku))
          .map((sku) => {
            const product = publicProduct(sku);
            const rule = sellerRule(sku);
            return product && rule
              ? { sku, name: product.name, available: rule.inventory >= handoff.quantity, deliveryDays: product.deliveryDays }
              : null;
          })
          .filter(Boolean)
      }),
      issue_proposal: tool({
        description: "Issue a proposal for one eligible SKU. Pricing is calculated by seller policy, not by the model.",
        inputSchema: z.object({
          sku: z.string(),
          rationale: z.string().min(1).max(240)
        }),
        execute: async ({ sku, rationale }) => {
          if (!eligible.has(sku)) throw new Error("The seller agent selected a SKU outside the private match.");
          const quote = quoteSku({ sku, quantity: handoff.quantity, deliveryDays: handoff.deliveryDays });
          const createdAt = new Date();
          issuedProposal = {
            proposalId: `proposal_${randomUUID()}`,
            requestId: handoff.requestId,
            ...quote,
            rationale,
            createdAt: createdAt.toISOString(),
            validUntil: new Date(createdAt.getTime() + 15 * 60_000).toISOString(),
            issuedBy: "vercel-ai-sdk-seller-agent"
          };
          return { issued: true, proposalId: issuedProposal.proposalId, sku };
        }
      })
    }
  });

  await agent.generate({
    prompt: JSON.stringify({
      requestId: handoff.requestId,
      eligibleSkuIds: handoff.eligibleSkuIds,
      quantity: handoff.quantity,
      deliveryDays: handoff.deliveryDays,
      objective: handoff.publicObjective
    })
  });

  if (!issuedProposal) throw new Error("The seller agent completed without issuing a bounded proposal.");
  return issuedProposal;
}
