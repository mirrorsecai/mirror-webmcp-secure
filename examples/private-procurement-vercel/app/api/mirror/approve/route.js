import { issueApproval } from "../../../../lib/approval-token.js";
import { DEMO_USER_ID, SITE_ID, assertSameOrigin, readSession } from "../../../../lib/server-context.js";
import { PROCUREMENT_TOOLS } from "../../../../lib/tool-names.js";
import { proxyMirrorGateway } from "../../../../lib/mirror-gateway-proxy.js";

export const runtime = "nodejs";

const APPROVED_TOOLS = new Set([PROCUREMENT_TOOLS.release, PROCUREMENT_TOOLS.accept]);

export async function POST(request) {
  try {
    const gateway = await proxyMirrorGateway(request);
    if (gateway) return gateway;
    const origin = assertSameOrigin(request);
    const sessionId = readSession(request);
    const value = await request.json();
    exact(value, ["schema", "siteId", "tool", "arguments"]);
    if (value.schema !== "mirror.webmcp.approval_request.v1" || value.siteId !== SITE_ID) throw new Error("invalid_approval_request");
    if (!APPROVED_TOOLS.has(value.tool)) throw new Error("tool_not_approvable");
    if (!value.arguments || typeof value.arguments !== "object" || Array.isArray(value.arguments)) throw new Error("invalid_approval_arguments");
    const issued = issueApproval({
      siteId: SITE_ID,
      origin,
      sessionId,
      userId: DEMO_USER_ID,
      tool: value.tool,
      arguments: value.arguments
    });
    return Response.json({ schema: "mirror.webmcp.approval.v1", ...issued }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "approval_failed";
    return Response.json({ error: /^[a-z0-9_-]{1,96}$/i.test(code) ? code : "approval_failed" }, { status: 400 });
  }
}

function exact(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_approval_request");
  const expected = new Set(fields);
  for (const field of Object.keys(value)) if (!expected.has(field)) throw new Error("unexpected_approval_field");
  for (const field of fields) if (!(field in value)) throw new Error("missing_approval_field");
}
