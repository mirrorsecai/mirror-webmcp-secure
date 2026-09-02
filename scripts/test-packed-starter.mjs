import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const packageRoot = join(root, "packages", "create-mirror-webmcp");
const trialRoot = await mkdtemp(join(tmpdir(), "mirror-webmcp-packed-starter-"));
const archiveRoot = join(trialRoot, "archive");
const installRoot = join(trialRoot, "runner");
const generatedRoot = join(trialRoot, "generated-site");
const environment = { ...process.env, npm_config_cache: join(trialRoot, "npm-cache") };

try {
  await mkdir(archiveRoot);
  const packed = await execFileAsync("npm", ["pack", "--json", "--pack-destination", archiveRoot], {
    cwd: packageRoot,
    env: environment
  });
  const metadata = JSON.parse(packed.stdout);
  assert.equal(metadata.length, 1, "Expected one starter package archive.");
  const archive = join(archiveRoot, metadata[0].filename);

  await mkdir(installRoot);
  await writeFile(join(installRoot, "package.json"), '{"name":"packed-starter-test","private":true}\n');
  await execFileAsync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", archive], {
    cwd: installRoot,
    env: environment
  });

  const command = join(installRoot, "node_modules", ".bin", "create-mirror-webmcp");
  await execFileAsync(command, [generatedRoot, "--no-install"], { cwd: installRoot, env: environment });

  const manifest = JSON.parse(await readFile(join(generatedRoot, "package.json"), "utf8"));
  assert.equal(manifest.name, "generated-site");
  assert.equal(manifest.private, true);
  assert.equal("@mirror/webmcp-secure" in manifest.dependencies, false);
  const loader = await readFile(join(generatedRoot, "public", "mirror-webmcp-v1.js"), "utf8");
  const loaderBytes = (await stat(join(generatedRoot, "public", "mirror-webmcp-v1.js"))).size;
  assert.equal(loaderBytes <= 50_000, true);
  for (const marker of ["@mirror/sdk", "mirror_wasm", ".wasm", "MIRROR_SDK_PATH"]) {
    assert.equal(loader.includes(marker), false, `Packed starter exposed ${marker}.`);
  }

  console.log(`Packed starter proof passed: ${metadata[0].size.toLocaleString("en-US")} byte package, ${loaderBytes.toLocaleString("en-US")} byte loader.`);
} finally {
  await rm(trialRoot, { recursive: true, force: true });
}
