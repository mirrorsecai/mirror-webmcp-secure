import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  ".github/workflows/ci.yml",
  "CHALLENGE_SUBMISSION.md",
  "LICENSE",
  "SECURITY.md",
  "docs/ARCHITECTURE.md",
  "docs/PUBLIC_PRIVATE_BOUNDARY.md",
  "src/model-context.js",
  "src/loader.js",
  "src/auto.js",
  "packages/create-mirror-webmcp/bin/create-mirror-webmcp.mjs",
  "packages/create-mirror-webmcp/package.json",
  "examples/private-procurement-vercel/app/page.js",
  "examples/private-procurement-vercel/app/api/mirror/tool/route.js",
  "examples/private-procurement-vercel/lib/mirror-fhe-seller.js",
  "examples/private-procurement-vercel/scripts/browser-qa.mjs"
];

await Promise.all(required.map((path) => access(resolve(root, path))));
const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (manifest.private !== true) throw new Error("The package publish lock must remain enabled before owner approval.");
if (manifest.dependencies || manifest.peerDependencies) throw new Error("The public package must remain standalone.");
if (manifest.exports?.["./loader"]?.default !== "./src/loader.js") throw new Error("The loader export is missing.");
if (manifest.exports?.["./context"] || manifest.files.includes("src/runtime.js") || manifest.files.includes("src/context.js")) {
  throw new Error("The public package must contain only the endpoint adapter, not the internal browser runtime.");
}
const starter = JSON.parse(await readFile(resolve(root, "packages/create-mirror-webmcp/package.json"), "utf8"));
if (starter.private !== true) throw new Error("The starter package publish lock must remain enabled before owner approval.");
if (starter.dependencies || starter.peerDependencies) throw new Error("The starter command must not depend on a private package.");
if (starter.bin?.["create-mirror-webmcp"] !== "./bin/create-mirror-webmcp.mjs") throw new Error("The starter command is missing.");
console.log("Release repository shape passed. The public package is a thin endpoint adapter with no private runtime, SDK, or WASM dependency.");
