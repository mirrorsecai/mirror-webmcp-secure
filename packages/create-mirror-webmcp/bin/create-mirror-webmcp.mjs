#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { access, cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const templateRoot = join(packageRoot, "template", "next");

const HELP = `Create a private-by-default WebMCP website.

Usage:
  create-mirror-webmcp <directory> [options]

Options:
  --template next    Generate the Next.js starter (default)
  --no-install       Create files without running npm install
  --help             Show this help

This command creates a new directory. It never modifies a non-empty project.`;

function parseArgs(argv) {
  const options = { install: true, template: "next", target: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { ...options, help: true };
    if (argument === "--no-install") {
      options.install = false;
      continue;
    }
    if (argument === "--template") {
      options.template = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (argument.startsWith("--template=")) {
      options.template = argument.slice("--template=".length);
      continue;
    }
    if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    if (options.target) throw new Error("Only one destination directory may be supplied.");
    options.target = argument;
  }
  return options;
}

function packageName(target) {
  return basename(target)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "") || "mirror-webmcp-site";
}

async function directoryIsEmpty(path) {
  try {
    return (await readdir(path)).length === 0;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}

async function replacePlaceholders(path, replacements) {
  const source = await readFile(path, "utf8");
  let updated = source;
  for (const [marker, value] of Object.entries(replacements)) updated = updated.replaceAll(marker, value);
  await writeFile(path, updated);
}

function run(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} failed${signal ? ` with ${signal}` : ` with exit code ${code}`}.`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }
  if (!options.target) throw new Error("Choose a new directory, for example: create-mirror-webmcp my-private-site");
  if (options.template !== "next") throw new Error(`Unsupported template '${options.template}'. Available templates: next.`);
  await access(templateRoot);

  const cwd = process.cwd();
  const destination = isAbsolute(options.target) ? resolve(options.target) : resolve(cwd, options.target);
  const relativePath = relative(cwd, destination);
  const displayPath = relativePath && !relativePath.startsWith("..") ? relativePath : destination;
  if (!await directoryIsEmpty(destination)) throw new Error(`Refusing to modify non-empty directory: ${displayPath}`);

  await mkdir(destination, { recursive: true });
  await cp(templateRoot, destination, { recursive: true, errorOnExist: false });
  await replacePlaceholders(join(destination, "package.json"), { __PROJECT_NAME__: packageName(destination) });
  await replacePlaceholders(join(destination, "README.md"), { __PROJECT_NAME__: packageName(destination) });

  const localSecret = randomBytes(32).toString("base64url");
  await writeFile(join(destination, ".env.local"), [
    "# Local development only. This file is ignored by git.",
    `MIRROR_WEBMCP_HANDLE_KEY=${localSecret}`,
    "PROPOSAL_SIGNING_KEY=local-proposal-signing-key-change-before-production",
    ""
  ].join("\n"), { mode: 0o600 });

  if (options.install) await run("npm", ["install"], destination);

  console.log(`\nMirror WebMCP starter created in ${displayPath}`);
  console.log(`  cd ${displayPath}`);
  if (!options.install) console.log("  npm install");
  console.log("  npm run check");
  console.log("  npm run dev");
  console.log("\nNothing was deployed or published.");
}

main().catch((error) => {
  console.error(`create-mirror-webmcp: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
