import assert from "node:assert/strict";
import test from "node:test";

import { GET as contextGet } from "../app/api/mirror/context/route.js";
import { POST as protectPost } from "../app/api/mirror/protect/route.js";
import { POST as toolPost } from "../app/api/mirror/tool/route.js";

process.env.MIRROR_WEBMCP_HANDLE_KEY = "test-only-webmcp-handle-key";

const origin = "https://procurement.example";
const siteId = "mirror_site_procurement_demo";

function headers(cookie) {
  return {
    Origin: origin,
    Host: "procurement.example",
    "X-Mirror-Site": siteId,
    ...(cookie ? { Cookie: cookie } : {})
  };
}

test("same-origin endpoint path creates a handle, runs a tool, and rejects session replay", async () => {
  const contextResponse = await contextGet(new Request(`${origin}/api/mirror/context`, { headers: headers() }));
  assert.equal(contextResponse.status, 200);
  const cookie = contextResponse.headers.get("set-cookie").split(";")[0];

  const requirements = {
    region: "eu",
    quantity: 12,
    deliveryDays: 14,
    maxUnitPrice: 3000,
    requiredCertifications: ["iso27001", "soc2"],
    privateNotes: "Never place this in agent context."
  };
  const protectResponse = await protectPost(new Request(`${origin}/api/mirror/protect`, {
    method: "POST",
    headers: { ...headers(cookie), "Content-Type": "application/json" },
    body: JSON.stringify(requirements)
  }));
  assert.equal(protectResponse.status, 200);
  const protectedValue = await protectResponse.json();
  assert.match(protectedValue.privacy.handle, /^mirrorh_srv_v1_/);
  assert.equal(JSON.stringify(protectedValue).includes(requirements.privateNotes), false);

  const call = {
    schema: "mirror.webmcp.tool_call.v1",
    siteId,
    tool: "procurement.find_private_matches",
    arguments: { requirementsHandle: protectedValue.privacy.handle }
  };
  const toolResponse = await toolPost(new Request(`${origin}/api/mirror/tool`, {
    method: "POST",
    headers: { ...headers(cookie), "Content-Type": "application/json" },
    body: JSON.stringify(call)
  }));
  assert.equal(toolResponse.status, 200);
  const toolResult = await toolResponse.json();
  assert.equal(toolResult.value.public.matchedProducts, 1);
  assert.equal(toolResult.value.public.buyerPrivateFieldsReturned, 0);
  assert.equal(JSON.stringify(toolResult).includes(requirements.privateNotes), false);
  assert.equal(JSON.stringify(toolResult).includes(String(requirements.maxUnitPrice)), false);

  const replayResponse = await toolPost(new Request(`${origin}/api/mirror/tool`, {
    method: "POST",
    headers: { ...headers("mirror_webmcp_session=wmcp_wrongwrongwrong"), "Content-Type": "application/json" },
    body: JSON.stringify(call)
  }));
  assert.equal(replayResponse.status, 400);
  assert.match((await replayResponse.json()).error, /context mismatch/);
});
