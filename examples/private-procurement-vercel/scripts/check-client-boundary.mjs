import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = fileURLToPath(new URL("../.next/static/", import.meta.url));
const loaderFile = fileURLToPath(new URL("../public/mirror-webmcp-v1.js", import.meta.url));
const forbidden = [
  "@mirror/sdk",
  "Mirror" + "Client",
  "mirror_wasm",
  "MIRROR_SDK_PATH",
  "MIRROR_WEBMCP_FHE_TOKEN",
  "MIRROR_ETF_API_KEY",
  "protectedMapi" + "ConverseFromText",
  "floorUnitPrice",
  "volumeDiscount",
  '"inventory":12',
  '"inventory":48',
  '"inventory":18'
];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

const files = [...await filesUnder(clientRoot), loaderFile];
assert.equal(files.some((file) => file.endsWith(".wasm")), false, "A WASM artifact leaked into the site-owner browser build.");
const browserCode = (await Promise.all(
  files.filter((file) => /\.(?:js|css)$/.test(file)).map((file) => readFile(file, "utf8"))
)).join("\n");
const loaderCode = await readFile(loaderFile, "utf8");

for (const marker of forbidden) {
  assert.equal(browserCode.includes(marker), false, `Private implementation detail leaked into the browser bundle: ${marker}`);
}

const loaderBytes = (await stat(loaderFile)).size;
assert.equal(loaderBytes <= 6_500, true, `The endpoint-only loader exceeds 6.5 KB: ${loaderBytes} bytes.`);
assert.equal(loaderCode.includes("crypto.subtle"), false, "A browser cryptographic runtime entered the public adapter.");
assert.equal(browserCode.includes("mirror.webmcp.site_manifest.v1"), true, "The public loader manifest protocol is missing.");

console.log(`Client boundary audit passed across ${files.length} browser artifacts; loader ${loaderBytes.toLocaleString("en-US")} bytes.`);
