import { installWebMcpLoader } from "./loader.js";

installWebMcpLoader().catch((error) => {
  if (typeof globalThis.dispatchEvent !== "function" || typeof globalThis.CustomEvent !== "function") return;
  globalThis.dispatchEvent(new CustomEvent("mirror:webmcp-error", {
    detail: Object.freeze({ message: String(error?.message ?? error) })
  }));
});
