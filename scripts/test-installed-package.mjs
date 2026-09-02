import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = await mkdtemp(path.join(os.tmpdir(), "mirror-webmcp-secure-install-"));

try {
  const starterTarball = pack(projectRoot);
  const starterTarget = path.join(fixture, "node_modules/@mirror/webmcp-secure");
  await mkdir(starterTarget, { recursive: true });
  extract(starterTarball, starterTarget);

  const installed = await import(pathToFileURL(path.join(fixture, "node_modules/@mirror/webmcp-secure/src/index.js")));
  const context = installed.createWebMcpContext({
    origin: "https://release-test.invalid",
    sessionId: "release-session",
    userId: "release-user",
    model: "release-agent"
  });
  const registered = new Map();
  const siteTools = installed.createWebMcpSecure({
    context: context.get,
    modelContext: {
      registerTool(tool) {
        registered.set(tool.name, tool);
      }
    },
    approval: async () => true
  });

  const profile = await siteTools.protect({ score: 742, maximumAprBps: 1400 }, {
    kind: "application-profile",
    purpose: "check-eligibility",
    allowedTools: ["application.check"],
    ttlMs: 60_000
  });
  await siteTools.registerPack({
    name: "application.private",
    tools: [{
      name: "application.check",
      description: "Return a derived eligibility decision.",
      inputSchema: {
        type: "object",
        properties: { profileHandle: { type: "string" } },
        required: ["profileHandle"],
        additionalProperties: false
      },
      async execute({ profileHandle }, call) {
        const value = await call.resolve(profileHandle, {
          kind: "application-profile",
          purpose: "check-eligibility"
        });
        return call.publicResult({ eligible: value.score >= 700 && value.maximumAprBps >= 1200 }, {
          sensitivity: "sensitive",
          approvalSummary: "Release eligibility decision"
        });
      }
    }]
  });

  const result = await registered.get("application.check").execute({ profileHandle: profile.handle });
  assert.deepEqual(result, { eligible: true });
  assert.equal(siteTools.evidence().some((event) => event.event === "tool.completed"), true);
  console.log("Standalone package proof passed through protect, bind, compute, approval, and release without Mirror SDK or WASM.");
} finally {
  await rm(fixture, { recursive: true, force: true });
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
