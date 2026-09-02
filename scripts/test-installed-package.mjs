import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = await mkdtemp(path.join(os.tmpdir(), "mirror-webmcp-secure-install-"));

try {
  const archive = pack(projectRoot);
  const target = path.join(fixture, "node_modules/@mirror/webmcp-secure");
  await mkdir(target, { recursive: true });
  extract(archive, target);

  const installed = await import(pathToFileURL(path.join(target, "src/index.js")));
  const registered = new Map();
  const requests = [];
  const origin = "https://release-test.invalid";
  const fetcher = async (url, init = {}) => {
    requests.push({ url, init });
    if (url === `${origin}/.well-known/mirror-webmcp.json`) return json({
      schema: "mirror.webmcp.site_manifest.v1",
      siteId: "mirror_site_release",
      allowedOrigins: [origin],
      contextEndpoint: "/api/mirror/context",
      approvalEndpoint: "/api/mirror/approve",
      packs: [{
        name: "eligibility.private",
        tools: [{
          name: "eligibility.release",
          description: "Release a minimum eligibility result.",
          endpoint: "/api/mirror/tool",
          inputSchema: {
            type: "object",
            properties: { resultHandle: { type: "string" } },
            required: ["resultHandle"],
            additionalProperties: false
          },
          requiresApproval: true,
          approvalSummary: "Release the eligibility result"
        }]
      }]
    });
    if (url === `${origin}/api/mirror/context`) return json({
      schema: "mirror.webmcp.session.v1",
      sessionId: "session-release"
    });
    if (url === `${origin}/api/mirror/approve`) return json({
      schema: "mirror.webmcp.approval.v1",
      approvalToken: "mirrora_test_release",
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    if (url === `${origin}/api/mirror/tool`) return json({
      schema: "mirror.webmcp.tool_result.v1",
      value: { eligible: true, privateFieldsReturned: 0 }
    });
    throw new Error(`Unexpected request to ${url}`);
  };
  let approvals = 0;
  const loaded = await installed.installWebMcpLoader({
    siteId: "mirror_site_release",
    origin,
    fetcher,
    modelContext: { registerTool(tool) { registered.set(tool.name, tool); } },
    approval: async () => { approvals += 1; return true; }
  });

  const result = await registered.get("eligibility.release").execute({ resultHandle: "mirrorh_release_7" });
  assert.deepEqual(result, { eligible: true, privateFieldsReturned: 0 });
  assert.deepEqual(loaded.tools, ["eligibility.release"]);
  assert.equal(approvals, 1);
  assert.equal(JSON.parse(requests.at(-1).init.body).arguments.resultHandle, "mirrorh_release_7");
  assert.equal(JSON.parse(requests.at(-1).init.body).approvalToken, "mirrora_test_release");
  console.log("Standalone package proof passed through native registration, approval, and same-origin endpoint invocation.");
} finally {
  await rm(fixture, { recursive: true, force: true });
}

function json(value, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return value; } };
}

function pack(directory) {
  const result = spawnSync("npm", ["pack", directory, "--pack-destination", fixture, "--json"], {
    cwd: fixture,
    encoding: "utf8",
    env: { ...process.env, npm_config_cache: "/tmp/mirror-webmcp-secure-npm-cache" }
  });
  if (result.status !== 0) throw new Error(`Package archive failed:\n${result.stdout}\n${result.stderr}`);
  const [{ filename }] = JSON.parse(result.stdout);
  return path.join(fixture, filename);
}

function extract(archive, destination) {
  const result = spawnSync("tar", ["-xzf", archive, "-C", destination, "--strip-components=1"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Package extraction failed:\n${result.stdout}\n${result.stderr}`);
}
