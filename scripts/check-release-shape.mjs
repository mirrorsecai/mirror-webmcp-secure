import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  ".github/workflows/ci.yml",
  "CHALLENGE_SUBMISSION.md",
  "LICENSE",
  "SECURITY.md",
  "docs/ARCHITECTURE.md",
  "src/runtime.js",
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
const starter = JSON.parse(await readFile(resolve(root, "packages/create-mirror-webmcp/package.json"), "utf8"));
if (starter.private !== true) throw new Error("The starter package publish lock must remain enabled before owner approval.");
if (starter.dependencies || starter.peerDependencies) throw new Error("The starter command must not depend on a private package.");
if (starter.bin?.["create-mirror-webmcp"] !== "./bin/create-mirror-webmcp.mjs") throw new Error("The starter command is missing.");
console.log("Release repository shape passed. The public package and reference site have no private SDK or WASM dependency.");
