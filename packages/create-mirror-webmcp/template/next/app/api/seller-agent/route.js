import { containsPrivateBuyerField } from "../../../lib/handoff.js";
import { signProposal } from "../../../lib/proposal-token.js";
import { runSellerAgent } from "../../../lib/seller-agent.js";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const handoff = await request.json();
    if (containsPrivateBuyerField(handoff)) {
      return Response.json({ error: "Private buyer fields are not accepted by this endpoint." }, { status: 400 });
    }
    const proposal = await runSellerAgent(handoff);
    return Response.json({
      proposal,
      commitToken: signProposal(proposal),
      boundary: {
        receivedFields: Object.keys(handoff).sort(),
        buyerPrivateFieldsReceived: 0,
        browserHandleReceived: false,
        protectedInference: proposal.protectedInference
      }
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Seller agent failed." }, { status: 502 });
  }
}
