import { protectServerValue } from "../../../../lib/server-handle.js";
import { DEMO_USER_ID, assertSameOrigin, readSession } from "../../../../lib/server-context.js";
import { PROCUREMENT_TOOLS } from "../../../../lib/tool-names.js";
import { proxyMirrorGateway } from "../../../../lib/mirror-gateway-proxy.js";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const gateway = await proxyMirrorGateway(request);
    if (gateway) return gateway;
    const origin = assertSameOrigin(request);
    const sessionId = readSession(request);
    const requirements = validateRequirements(await request.json());
    const descriptor = protectServerValue(requirements, {
      origin,
      sessionId,
      userId: DEMO_USER_ID,
      kind: "buyer-requirements",
      purpose: "private-procurement",
      allowedTools: [PROCUREMENT_TOOLS.find],
      ttlMs: 10 * 60_000
    });
    return Response.json({
      schema: "mirror.webmcp.protect_result.v1",
      privacy: descriptor,
      public: {
        status: "requirements-protected",
        buyerPrivateFieldsReturned: 0
      }
    }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Protection failed." }, { status: 400 });
  }
}

function validateRequirements(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid buyer requirements.");
  const allowed = new Set(["region", "quantity", "deliveryDays", "maxUnitPrice", "requiredCertifications", "privateNotes"]);
  for (const field of Object.keys(value)) if (!allowed.has(field)) throw new Error(`Unexpected buyer field '${field}'.`);
  if (value.region !== "eu") throw new Error("Unsupported region.");
  for (const [name, minimum, maximum] of [
    ["quantity", 1, 64],
    ["deliveryDays", 1, 90],
    ["maxUnitPrice", 1, 100_000]
  ]) {
    if (!Number.isInteger(value[name]) || value[name] < minimum || value[name] > maximum) throw new Error(`Invalid ${name}.`);
  }
  if (!Array.isArray(value.requiredCertifications) || value.requiredCertifications.length === 0) {
    throw new Error("At least one certification is required.");
  }
  const certifications = value.requiredCertifications.map(String);
  if (certifications.some((item) => !["iso27001", "soc2", "pci"].includes(item))) throw new Error("Unsupported certification.");
  if (typeof value.privateNotes !== "string" || value.privateNotes.length > 500) throw new Error("Invalid private notes.");
  return {
    region: value.region,
    quantity: value.quantity,
    deliveryDays: value.deliveryDays,
    maxUnitPrice: value.maxUnitPrice,
    requiredCertifications: [...new Set(certifications)],
    privateNotes: value.privateNotes
  };
}
