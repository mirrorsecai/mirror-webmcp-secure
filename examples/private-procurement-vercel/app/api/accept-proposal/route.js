import { randomUUID } from "node:crypto";
import { verifyProposalToken } from "../../../lib/proposal-token.js";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { commitToken } = await request.json();
    const proposal = verifyProposalToken(commitToken);
    return Response.json({
      status: "accepted",
      receiptId: `receipt_${randomUUID()}`,
      acceptedAt: new Date().toISOString(),
      proposalDigest: proposal.proposalId.slice(-12)
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Proposal acceptance failed." }, { status: 400 });
  }
}
