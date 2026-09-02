import { createHmac, timingSafeEqual } from "node:crypto";

function signingKey() {
  const configured = process.env.PROPOSAL_SIGNING_KEY;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("PROPOSAL_SIGNING_KEY is required in production.");
  return "mirror-webmcp-local-development-key-not-for-production";
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signature(payload) {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

export function signProposal(proposal) {
  const payload = encode(proposal);
  return `${payload}.${signature(payload)}`;
}

export function verifyProposalToken(token) {
  const [payload, supplied, extra] = String(token).split(".");
  if (!payload || !supplied || extra) throw new Error("Invalid proposal token.");
  const expected = signature(payload);
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("Invalid proposal token.");
  const proposal = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!proposal.proposalId || Date.parse(proposal.validUntil) <= Date.now()) throw new Error("Proposal is invalid or expired.");
  return proposal;
}
