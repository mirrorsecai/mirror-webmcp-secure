import { publicProduct } from "./catalog.js";

// This module is reachable only from server routes. The build audit fails if any
// of these policy markers appear in a browser bundle.
const SELLER_RULES = Object.freeze({
  "gpu-flex-8": { inventory: 12, floorUnitPrice: 2_280, volumeDiscount: 0.05 },
  "gpu-scale-32": { inventory: 48, floorUnitPrice: 1_980, volumeDiscount: 0.09 },
  "gpu-sovereign-12": { inventory: 18, floorUnitPrice: 2_760, volumeDiscount: 0.04 }
});

export function sellerRule(sku) {
  return SELLER_RULES[sku] ?? null;
}

export function quoteSku({ sku, quantity, deliveryDays }) {
  const product = publicProduct(sku);
  const rule = sellerRule(sku);
  if (!product || !rule) throw new Error("Unknown product.");
  if (!Number.isInteger(quantity) || quantity < product.minimumQuantity || quantity > product.maximumQuantity) {
    throw new Error("Quantity is outside the supported range.");
  }
  if (quantity > rule.inventory) throw new Error("Requested quantity is not currently available.");
  if (deliveryDays < product.deliveryDays) throw new Error("Requested delivery cannot be met.");
  const discount = quantity >= 12 ? rule.volumeDiscount : 0;
  const unitPrice = Math.max(rule.floorUnitPrice, Math.round(product.listUnitPrice * (1 - discount)));
  return {
    sku,
    name: product.name,
    quantity,
    unitPrice,
    totalPrice: unitPrice * quantity,
    deliveryDays: product.deliveryDays,
    currency: "EUR"
  };
}
