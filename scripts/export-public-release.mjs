import { cp, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";

const source = resolve(import.meta.dirname, "..");
const destination = resolve(process.argv[2] || "");

if (!process.argv[2]) throw new Error("Usage: npm run public:export -- /absolute/empty/destination");
if (destination === source || destination.startsWith(`${source}${sep}`)) {
  throw new Error("The public export must be outside the private working tree.");
}

await mkdir(destination, { recursive: true });
if ((await readdir(destination)).length !== 0) throw new Error("The public export destination must be empty.");

const releaseRoots = [
  ".github",
  ".gitignore",
  "CHANGELOG.md",
  "CHALLENGE_SUBMISSION.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "docs/ARCHITECTURE.md",
  "docs/AUTHENTICATION.md",
  "docs/COMPATIBILITY.md",
  "docs/DEPLOYMENT.md",
  "docs/PUBLIC_PRIVATE_BOUNDARY.md",
  "docs/PROTOCOL.md",
  "docs/QUICKSTART.md",
  "docs/SITE_OWNER_INTEGRATION.md",
  "docs/TROUBLESHOOTING.md",
  "docs/USING_WITH_A_BROWSER_AGENT.md",
  "examples/private-procurement-vercel",
  "package-lock.json",
  "package.json",
  "packages/create-mirror-webmcp",
  "schemas",
  "scripts/check-loader-build.mjs",
  "scripts/check-release-shape.mjs",
  "scripts/check-secrets.mjs",
  "scripts/export-public-release.mjs",
  "scripts/sync-create-template.mjs",
  "scripts/test-installed-package.mjs",
  "scripts/test-packed-starter.mjs",
  "src/auto.js",
  "src/index.d.ts",
  "src/index.js",
  "src/loader.d.ts",
  "src/loader.js",
  "src/model-context.js",
  "tests/loader.test.mjs",
];

for (const name of releaseRoots) {
  await cp(join(source, name), join(destination, name), {
    recursive: true,
    filter: (path) => includePath(path),
  });
}

const files = await listFiles(destination);
const forbiddenNames = files.filter((path) => {
  const parts = relative(destination, path).split(sep);
  return parts.some((part) => part === "node_modules" || part === ".next" || part === ".vercel" || part === ".git")
    || (basename(path).startsWith(".env") && basename(path) !== ".env.example")
    || path.endsWith(".wasm")
    || path.endsWith(".map");
});
if (forbiddenNames.length) throw new Error(`Forbidden public files: ${forbiddenNames.join(", ")}`);

const secretPatterns = [
  /lms_live_[A-Za-z0-9_-]+/,
  /sk-default-[A-Za-z0-9_-]+/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\/Users\/[A-Za-z0-9._-]+\//,
  new RegExp("Mirror" + "Client"),
  new RegExp("protectedMapi" + "ConverseFromText"),
  new RegExp("mirror_fhe" + "_ffi"),
];
for (const path of files) {
  if ((await stat(path)).size > 2_000_000) continue;
  const content = await readFile(path, "utf8");
  const pattern = secretPatterns.find((candidate) => candidate.test(content));
  if (pattern) throw new Error(`Public export safety check failed for ${relative(destination, path)}.`);
}

console.log(`Created clean public release at ${destination} with ${files.length} files.`);

function includePath(path) {
  const name = basename(path);
  if (["node_modules", ".next", ".vercel", ".git", "AGENTS.md", "CLAUDE.md"].includes(name)) return false;
  if (name.startsWith(".env") && name !== ".env.example") return false;
  if (name.endsWith(".tgz") || name.endsWith(".map") || name.endsWith(".wasm")) return false;
  return true;
}

async function listFiles(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(path));
    else output.push(path);
  }
  return output.sort();
}
