import { installWebMcpLoader } from "./loader.js";

installWebMcpLoader().catch((error) => {
  if (typeof globalThis.dispatchEvent !== "function" || typeof globalThis.CustomEvent !== "function") return;
  globalThis.dispatchEvent(new CustomEvent("mirror:webmcp-error", {
    detail: Object.freeze({
      message: String(error?.message ?? error),
      code: error?.code ?? "loader_error",
      stage: error?.stage ?? "loader",
      requestId: error?.requestId
    })
  }));
});
