const PRIVATE_FIELDS = Object.freeze([
  "maxUnitPrice",
  "maximumBudget",
  "budget",
  "walkAwayPrice",
  "requiredCertifications",
  "privateNotes"
]);

export function createSellerHandoff(match) {
  const handoff = {
    requestId: String(match.requestId),
    eligibleSkuIds: [...new Set(match.eligibleSkuIds.map(String))],
    quantity: Number(match.quantity),
    deliveryDays: Number(match.deliveryDays),
    publicObjective: "Return the best available compliant offer"
  };
  assertSellerHandoff(handoff);
  return Object.freeze(handoff);
}

export function assertSellerHandoff(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid seller handoff.");
  for (const field of PRIVATE_FIELDS) {
    if (field in value) throw new Error(`Private field '${field}' must not cross the seller-agent boundary.`);
  }
  const allowed = new Set(["requestId", "eligibleSkuIds", "quantity", "deliveryDays", "publicObjective"]);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new Error(`Unexpected seller handoff field '${field}'.`);
  }
  if (!value.requestId || !Array.isArray(value.eligibleSkuIds) || value.eligibleSkuIds.length === 0) {
    throw new Error("Seller handoff requires a request and at least one eligible product.");
  }
  if (!Number.isInteger(value.quantity) || value.quantity <= 0) throw new Error("Invalid quantity.");
  if (!Number.isInteger(value.deliveryDays) || value.deliveryDays <= 0) throw new Error("Invalid delivery window.");
  return value;
}

export function containsPrivateBuyerField(value) {
  const serialized = JSON.stringify(value);
  return PRIVATE_FIELDS.some((field) => serialized.includes(field));
}

export { PRIVATE_FIELDS };
