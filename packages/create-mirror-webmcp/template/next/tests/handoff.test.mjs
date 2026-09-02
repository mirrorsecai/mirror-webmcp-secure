import assert from "node:assert/strict";
import test from "node:test";
import { matchPrivateRequirements } from "../lib/catalog.js";
import { assertSellerHandoff, containsPrivateBuyerField, createSellerHandoff } from "../lib/handoff.js";
import { quoteSku } from "../lib/seller-policy.js";

const privateRequirements = Object.freeze({
  region: "eu",
  quantity: 12,
  deliveryDays: 14,
  maxUnitPrice: 3000,
  requiredCertifications: ["iso27001", "soc2"],
  privateNotes: "Never send this note to either agent."
});

test("the private match returns product identifiers without copying buyer fields", () => {
  const eligibleSkuIds = matchPrivateRequirements(privateRequirements);
  assert.deepEqual(eligibleSkuIds, ["gpu-flex-8"]);
  assert.equal(containsPrivateBuyerField({ eligibleSkuIds }), false);
});

test("the seller handoff is allow-listed and excludes private requirements", () => {
  const handoff = createSellerHandoff({
    requestId: "rfq_test",
    eligibleSkuIds: ["gpu-flex-8"],
    quantity: privateRequirements.quantity,
    deliveryDays: privateRequirements.deliveryDays,
    ...privateRequirements
  });
  assert.deepEqual(Object.keys(handoff).sort(), [
    "deliveryDays",
    "eligibleSkuIds",
    "publicObjective",
    "quantity",
    "requestId"
  ]);
  assert.equal(containsPrivateBuyerField(handoff), false);
  assert.equal(JSON.stringify(handoff).includes(privateRequirements.privateNotes), false);
  assert.equal(JSON.stringify(handoff).includes(String(privateRequirements.maxUnitPrice)), false);
});

test("the seller endpoint contract rejects private and unexpected fields", () => {
  assert.throws(() => assertSellerHandoff({
    requestId: "rfq_test",
    eligibleSkuIds: ["gpu-flex-8"],
    quantity: 12,
    deliveryDays: 14,
    maxUnitPrice: 3000
  }), /must not cross/);
  assert.throws(() => assertSellerHandoff({
    requestId: "rfq_test",
    eligibleSkuIds: ["gpu-flex-8"],
    quantity: 12,
    deliveryDays: 14,
    publicObjective: "Return an offer",
    extra: true
  }), /Unexpected seller handoff field/);
});

test("seller policy computes price rather than accepting a model-supplied price", () => {
  const quote = quoteSku({ sku: "gpu-flex-8", quantity: 12, deliveryDays: 14 });
  assert.equal(quote.unitPrice, 2518);
  assert.equal(quote.totalPrice, 30216);
  assert.equal("floorUnitPrice" in quote, false);
});
