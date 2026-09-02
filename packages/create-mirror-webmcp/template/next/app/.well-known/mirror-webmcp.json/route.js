import { PROCUREMENT_TOOLS } from "../../../lib/tool-names.js";
import { SITE_ID, requestOrigin } from "../../../lib/server-context.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const origin = requestOrigin(request);
  return Response.json({
    schema: "mirror.webmcp.site_manifest.v1",
    siteId: SITE_ID,
    allowedOrigins: [origin],
    contextEndpoint: "/api/mirror/context",
    packs: [{
      name: "procurement.private",
      tools: [
        {
          name: PROCUREMENT_TOOLS.find,
          title: "Find private matches",
          description: "Match protected buyer requirements without returning budget, compliance requirements, or notes.",
          endpoint: "/api/mirror/tool",
          inputSchema: {
            type: "object",
            properties: { requirementsHandle: { type: "string" } },
            required: ["requirementsHandle"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false }
        },
        {
          name: PROCUREMENT_TOOLS.propose,
          title: "Ask the seller agent",
          description: "Send an allow-listed derived handoff to the seller agent and keep the proposal behind a handle.",
          endpoint: "/api/mirror/tool",
          inputSchema: {
            type: "object",
            properties: { matchHandle: { type: "string" } },
            required: ["matchHandle"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false }
        },
        {
          name: PROCUREMENT_TOOLS.release,
          title: "Release the proposal",
          description: "Release the bounded commercial proposal after buyer approval.",
          endpoint: "/api/mirror/tool",
          inputSchema: {
            type: "object",
            properties: { proposalHandle: { type: "string" } },
            required: ["proposalHandle"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          requiresApproval: true,
          approvalSummary: "Release this proposal to the user agent"
        },
        {
          name: PROCUREMENT_TOOLS.accept,
          title: "Accept the proposal",
          description: "Commit the bound proposal after explicit buyer approval.",
          endpoint: "/api/mirror/tool",
          inputSchema: {
            type: "object",
            properties: { proposalHandle: { type: "string" } },
            required: ["proposalHandle"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          requiresApproval: true,
          approvalSummary: "Accept this proposal and create a transaction receipt"
        }
      ]
    }]
  }, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
