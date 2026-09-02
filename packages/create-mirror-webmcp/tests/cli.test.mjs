import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../bin/create-mirror-webmcp.mjs", import.meta.url));

test("creates a standalone Next.js starter without installing or exposing private artifacts", async () => {
  const parent = await mkdtemp(join(tmpdir(), "create-mirror-webmcp-"));
  const destination = join(parent, "Private Buyer Site");
  const { stdout } = await execFileAsync(process.execPath, [cli, destination, "--no-install"]);

  assert.match(stdout, /Nothing was deployed or published/);
  const manifest = JSON.parse(await readFile(join(destination, "package.json"), "utf8"));
  assert.equal(manifest.name, "private-buyer-site");
  assert.equal(manifest.private, true);
  assert.equal("@mirror/webmcp-secure" in manifest.dependencies, false);

  const layout = await readFile(join(destination, "app", "layout.js"), "utf8");
  assert.match(layout, /mirror-webmcp-v1\.js/);
  const loader = await readFile(join(destination, "public", "mirror-webmcp-v1.js"), "utf8");
  for (const marker of ["@mirror/sdk", "mirror_wasm", ".wasm", "MIRROR_SDK_PATH"]) {
    assert.equal(loader.includes(marker), false, `starter loader exposed ${marker}`);
  }
  const environment = await readFile(join(destination, ".env.local"), "utf8");
  assert.match(environment, /^MIRROR_WEBMCP_HANDLE_KEY=/m);
  assert.equal(environment.includes("not-for-production"), false);
});

test("refuses to modify an existing non-empty directory", async () => {
  const parent = await mkdtemp(join(tmpdir(), "create-mirror-webmcp-"));
  const destination = join(parent, "existing");
  await mkdir(destination);
  await writeFile(join(destination, "keep.txt"), "keep me");

  await assert.rejects(
    execFileAsync(process.execPath, [cli, destination, "--no-install"]),
    /Refusing to modify non-empty directory/
  );
  assert.equal(await readFile(join(destination, "keep.txt"), "utf8"), "keep me");
});
