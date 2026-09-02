import assert from "node:assert/strict";
import test from "node:test";

import { runSellerAgent } from "../lib/seller-agent.js";

test("local seller fails with a stable code when no protected or gateway route is configured", async () => {
  const previousGatewayKey = process.env.AI_GATEWAY_API_KEY;
  const previousOidcToken = process.env.VERCEL_OIDC_TOKEN;
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;
  try {
    await assert.rejects(() => runSellerAgent({
      requestId: "rfq_local_configuration_test",
      eligibleSkuIds: ["gpu-sovereign-12"],
      quantity: 12,
      deliveryDays: 14,
      publicObjective: "Return the best available compliant offer",
    }, { endpoint: "", token: "" }), /seller_agent_not_configured/);
  } finally {
    if (previousGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousGatewayKey;
    if (previousOidcToken === undefined) delete process.env.VERCEL_OIDC_TOKEN;
    else process.env.VERCEL_OIDC_TOKEN = previousOidcToken;
  }
});
