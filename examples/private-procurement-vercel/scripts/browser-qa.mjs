import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

async function main() {
const appUrl = process.env.MIRROR_WEBMCP_APP_URL || "http://127.0.0.1:4210/";
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chromium = process.env.CHROMIUM_BIN || (existsSync(chromePath) ? chromePath : "/usr/local/bin/chromium");
const profile = await mkdtemp(path.join(os.tmpdir(), "mirror-webmcp-procurement-chrome-"));
const port = await freePort();
const browser = spawn(chromium, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-address=127.0.0.1",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
let browserErrors = "";
browser.stderr.on("data", (chunk) => { browserErrors += String(chunk); });

try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${port}/json/version`).catch(() => null))?.ok, 8_000, "Chromium DevTools");
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((item) => item.type === "page");
  if (!target?.webSocketDebuggerUrl) throw new Error("No Chromium page target was available.");
  const cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  const exceptions = [];
  cdp.on("Runtime.exceptionThrown", (params) => exceptions.push(params.exceptionDetails?.text || "Browser exception"));
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      globalThis.__nativeWebMcpTools = [];
      Object.defineProperty(document, "modelContext", {
        configurable: true,
        value: {
          registerTool: async (definition, options = {}) => {
            globalThis.__nativeWebMcpTools.push(definition.name);
            options.signal?.addEventListener?.("abort", () => {}, { once: true });
          }
        }
      });
      globalThis.confirm = () => true;
    `,
  });
  await cdp.send("Page.navigate", { url: appUrl });
  await waitFor(() => evaluate(cdp, "document.readyState === 'complete'"), 15_000, "page load");
  await waitFor(() => evaluate(cdp, "window.__MIRROR_WEBMCP__?.tools?.length === 4"), 15_000, "WebMCP registration");
  await waitFor(
    () => evaluate(cdp, "document.querySelector('.connection')?.textContent === 'Native WebMCP connected'"),
    15_000,
    "native WebMCP UI status"
  );

  const registration = await evaluate(cdp, `({
    status: document.querySelector('.connection')?.textContent,
    tools: globalThis.__nativeWebMcpTools,
    loaderTools: window.__MIRROR_WEBMCP__.tools,
    nativeWebMcpAvailable: window.__MIRROR_WEBMCP__.nativeWebMcpAvailable,
    nativeErrors: window.__MIRROR_WEBMCP__.nativeErrors
  })`);
  if (registration.status !== "Native WebMCP connected" || registration.tools.length !== 4) {
    throw new Error(`Native WebMCP registration failed: ${JSON.stringify(registration)}`);
  }

  await waitFor(
    () => evaluate(cdp, "document.querySelector('.buyer-panel button')?.disabled === false"),
    15_000,
    "enabled private requirements action"
  );
  await evaluate(cdp, "document.querySelector('.buyer-panel button').click()");
  await waitFor(() => evaluate(cdp, "document.querySelector('.boundary-line code')?.textContent.startsWith('mirrorh_') || Boolean(document.querySelector('[role=alert]'))"), 15_000, "private requirements result");
  const protectionError = await evaluate(cdp, "document.querySelector('[role=alert]')?.textContent || ''");
  if (protectionError) throw new Error(`Protection failed: ${protectionError}`);
  await evaluate(cdp, "document.querySelector('.agent-panel button').click()");
  await waitFor(() => evaluate(cdp, "Boolean(document.querySelector('.proposal-section')) || Boolean(document.querySelector('[role=alert]'))"), 140_000, "protected seller proposal");

  const proposalError = await evaluate(cdp, "document.querySelector('[role=alert]')?.textContent || ''");
  if (proposalError) throw new Error(`Proposal failed: ${proposalError}`);
  const proposal = await evaluate(cdp, `({
    product: document.querySelector('.proposal-section h2')?.textContent,
    rationale: document.querySelector('.proposal-section > div p')?.textContent,
    model: document.querySelector('.encrypted-proof strong')?.textContent,
    proof: document.querySelector('.encrypted-proof small')?.textContent,
    trace: document.querySelector('.trace')?.innerText,
    handle: document.querySelector('.boundary-line code')?.textContent
  })`);
  if (proposal.model !== "mirror/glm-5.3-flash" || !proposal.proof.includes("ciphertext bytes") || !proposal.proof.includes("ciphertext compute")) {
    throw new Error(`Encrypted-inference proof is incomplete: ${JSON.stringify(proposal)}`);
  }
  if (proposal.trace.includes("The ceiling is firm") || proposal.trace.includes("maxUnitPrice")) {
    throw new Error("A private buyer field entered the visible agent trace.");
  }

  await evaluate(cdp, "document.querySelector('.proposal-section button').click()");
  await waitFor(() => evaluate(cdp, "Boolean(document.querySelector('.receipt'))"), 15_000, "approved transaction receipt");
  const receipt = await evaluate(cdp, "document.querySelector('.receipt')?.textContent");
  if (!receipt?.includes("buyer fields returned: 0")) throw new Error(`Receipt boundary is incomplete: ${receipt}`);
  if (exceptions.length) throw new Error(`Browser exceptions: ${exceptions.join(" | ")}`);

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const screenshot = path.join(os.tmpdir(), "mirror-webmcp-private-procurement-real.png");
  await writeFile(screenshot, Buffer.from(shot.data, "base64"));

  console.log(JSON.stringify({ appUrl, registration, proposal, receipt, screenshot }, null, 2));
  await cdp.close();
} catch (error) {
  error.message += `\nBrowser output:\n${browserErrors.slice(-4_000)}`;
  throw error;
} finally {
  browser.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => browser.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 1_000)),
  ]);
  await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
}
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed.");
  return result.result?.value;
}

async function waitFor(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

class CdpClient {
  constructor(url) {
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  async close() {
    this.socket.close();
  }
}

await main();
