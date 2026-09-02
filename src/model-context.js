export function resolveModelContext(...candidates) {
  return candidates.find((candidate) => typeof candidate?.registerTool === "function");
}
