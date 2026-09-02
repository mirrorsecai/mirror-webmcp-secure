import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const allowedExtensions = new Set([".css", ".example", ".html", ".js", ".json", ".md", ".mjs", ".svg", ".yml"]);
const excluded = new Set([".git", ".vercel", "artifacts", "dist", "node_modules"]);
const patterns = [
  [/\bsk-[A-Za-z0-9_-]{20,}\b/g, "provider API key"],
  [/\blms_live_[A-Za-z0-9_-]{20,}\b/g, "Mirror live key"],
  [/\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g, "GitHub token"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "private key"]
];

const findings = [];
for (const file of await walk(root)) {
  if (!allowedExtensions.has(extname(file)) && !file.endsWith(".env.example")) continue;
  const contents = await readFile(file, "utf8");
  for (const [pattern, label] of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(contents)) findings.push(`${relative(root, file)}: ${label}`);
  }
}

if (findings.length) throw new Error(`Secret scan failed:\n${findings.join("\n")}`);
console.log("Secret scan passed.");

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(resolve(path));
  }
  return files;
}
