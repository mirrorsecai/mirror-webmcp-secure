export const PUBLIC_CATALOG = Object.freeze([
  {
    sku: "gpu-flex-8",
    name: "GPU Flex 8",
    summary: "Eight reserved accelerators with private networking and managed orchestration.",
    listUnitPrice: 2_650,
    minimumQuantity: 4,
    maximumQuantity: 16,
    deliveryDays: 10,
    certifications: ["iso27001", "soc2"],
    region: "eu"
  },
  {
    sku: "gpu-scale-32",
    name: "GPU Scale 32",
    summary: "A larger reserved cluster for sustained training and inference workloads.",
    listUnitPrice: 2_350,
    minimumQuantity: 16,
    maximumQuantity: 64,
    deliveryDays: 21,
    certifications: ["iso27001", "soc2", "pci"],
    region: "eu"
  },
  {
    sku: "gpu-sovereign-12",
    name: "GPU Sovereign 12",
    summary: "Dedicated accelerators with customer-managed keys and isolated operations.",
    listUnitPrice: 3_150,
    minimumQuantity: 8,
    maximumQuantity: 24,
    deliveryDays: 14,
    certifications: ["iso27001", "soc2", "pci"],
    region: "eu"
  }
]);

export function publicProduct(sku) {
  return PUBLIC_CATALOG.find((item) => item.sku === sku) ?? null;
}

export function matchPrivateRequirements(requirements) {
  const required = new Set(requirements.requiredCertifications);
  return PUBLIC_CATALOG
    .filter((product) => product.region === requirements.region)
    .filter((product) => requirements.quantity >= product.minimumQuantity)
    .filter((product) => requirements.quantity <= product.maximumQuantity)
    .filter((product) => product.deliveryDays <= requirements.deliveryDays)
    .filter((product) => product.listUnitPrice <= requirements.maxUnitPrice)
    .filter((product) => [...required].every((certification) => product.certifications.includes(certification)))
    .map((product) => product.sku);
}
