import assert from "node:assert/strict";
import test from "node:test";

import { GET as contextGet } from "../app/api/mirror/context/route.js";
import { POST as approvePost } from "../app/api/mirror/approve/route.js";
import { POST as protectPost } from "../app/api/mirror/protect/route.js";
import { POST as toolPost } from "../app/api/mirror/tool/route.js";
import { protectServerValue } from "../lib/server-handle.js";

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
  assert.match(contextResponse.headers.get("set-cookie"), /; Secure$/);
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

test("localhost HTTP session cookie remains browser-usable without weakening HTTPS", async () => {
  const localOrigin = "http://127.0.0.1:4210";
  const response = await contextGet(new Request(`${localOrigin}/api/mirror/context`, {
    headers: {
      Origin: localOrigin,
      Host: "127.0.0.1:4210",
      "X-Mirror-Site": siteId
    }
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie").includes("; Secure"), false);
});

test("release endpoint requires approval bound to the exact proposal handle", async () => {
  const contextResponse = await contextGet(new Request(`${origin}/api/mirror/context`, { headers: headers() }));
  const cookie = contextResponse.headers.get("set-cookie").split(";")[0];
  const sessionId = cookie.split("=")[1];
  const proposalHandle = protectServerValue({
    proposal: {
      proposalId: "proposal_test_7",
      name: "Sovereign accelerator cluster",
      sku: "gpu-sovereign-12",
      quantity: 12,
      unitPrice: 2850,
      totalPrice: 34200,
      currency: "EUR",
      deliveryDays: 14,
      validUntil: "2026-09-02T13:00:00.000Z",
      rationale: "Meets the bounded request."
    }
  }, {
    origin,
    sessionId,
    userId: "buyer-demo-user",
    kind: "seller-proposal",
    purpose: "review-and-commit-proposal",
    allowedTools: ["procurement.release_proposal"]
  }).handle;
  const baseCall = {
    schema: "mirror.webmcp.tool_call.v1",
    siteId,
    tool: "procurement.release_proposal",
    arguments: { proposalHandle }
  };
  const withoutApproval = await toolPost(new Request(`${origin}/api/mirror/tool`, {
    method: "POST",
    headers: { ...headers(cookie), "Content-Type": "application/json" },
    body: JSON.stringify(baseCall)
  }));
  assert.equal(withoutApproval.status, 400);
  assert.equal((await withoutApproval.json()).error, "approval_required");

  const approvalResponse = await approvePost(new Request(`${origin}/api/mirror/approve`, {
    method: "POST",
    headers: { ...headers(cookie), "Content-Type": "application/json" },
    body: JSON.stringify({
      schema: "mirror.webmcp.approval_request.v1",
      siteId,
      tool: baseCall.tool,
      arguments: baseCall.arguments
    })
  }));
  assert.equal(approvalResponse.status, 200);
  const approval = await approvalResponse.json();

  const swapped = await toolPost(new Request(`${origin}/api/mirror/tool`, {
    method: "POST",
    headers: { ...headers(cookie), "Content-Type": "application/json" },
    body: JSON.stringify({
      ...baseCall,
      arguments: { proposalHandle: "mirrorh_srv_v1_swapped" },
      approvalToken: approval.approvalToken
    })
  }));
  assert.equal(swapped.status, 400);
  assert.equal((await swapped.json()).error, "approval_arguments_mismatch");

  const released = await toolPost(new Request(`${origin}/api/mirror/tool`, {
    method: "POST",
    headers: { ...headers(cookie), "Content-Type": "application/json" },
    body: JSON.stringify({ ...baseCall, approvalToken: approval.approvalToken })
  }));
  assert.equal(released.status, 200);
  assert.equal((await released.json()).value.status, "proposal-released");
});
