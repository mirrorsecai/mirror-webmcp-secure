import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const directory = resolve(root, "artifacts/public");
const pinnedLoader = resolve(root, "examples/private-procurement-vercel/public/mirror-webmcp-v1.js");
const files = await readdir(directory);
if (files.length !== 1 || files[0] !== "v1.js") throw new Error("The public loader build must contain only v1.js.");
const file = resolve(directory, "v1.js");
const [source, pinnedSource, info] = await Promise.all([readFile(file, "utf8"), readFile(pinnedLoader, "utf8"), stat(file)]);
for (const marker of [
  "@mirror/sdk",
  "Mirror" + "Client",
  "mirror_wasm",
  "MIRROR_SDK_PATH",
  "protectedMapi" + "ConverseFromText",
  "crypto.subtle",
  "createCipheriv",
  ".wasm",
  "sourceMappingURL"
]) {
  if (source.includes(marker)) throw new Error(`The public loader contains forbidden implementation marker: ${marker}`);
}
if (info.size > 7_000) throw new Error(`The endpoint-only loader exceeds the 7 KB uncompressed budget: ${info.size} bytes.`);
if (!source.includes("mirror.webmcp.site_manifest.v1")) throw new Error("The loader is missing the manifest protocol.");
if (!source.includes("mirror.webmcp.tool_call.v1")) throw new Error("The loader is missing the tool-call protocol.");
if (source !== pinnedSource) throw new Error("The Vercel example's pinned loader does not match the reviewed package build.");
console.log(`Public one-line loader gate passed: ${info.size.toLocaleString("en-US")} bytes, endpoint transport only, no crypto runtime, SDK, WASM, source map, or secret configuration.`);
