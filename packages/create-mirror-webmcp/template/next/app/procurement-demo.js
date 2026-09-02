"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PUBLIC_CATALOG } from "../lib/catalog.js";
import { PROCUREMENT_TOOLS } from "../lib/tool-names.js";

const INITIAL_REQUIREMENTS = Object.freeze({
  region: "eu",
  quantity: 12,
  deliveryDays: 14,
  maxUnitPrice: 3000,
  requiredCertifications: ["iso27001", "soc2"],
  privateNotes: "The ceiling is firm. Prefer an isolated deployment."
});

function handleFrom(result) {
  const handle = result?.privacy?.handle;
  if (!handle) throw new Error("The tool did not return the expected private handle.");
  return handle;
}

function visibleHandle(value) {
  if (typeof value !== "string" || !value.startsWith("mirrorh_")) return value;
  return `${value.slice(0, 20)}…${value.slice(-8)}`;
}

function safeArguments(value) {
  return JSON.stringify(value, (_key, item) => visibleHandle(item), 2);
}

export function ProcurementDemo() {
  const integration = useRef(null);
  const [requirements, setRequirements] = useState(INITIAL_REQUIREMENTS);
  const [nativeConnected, setNativeConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [requirementsHandle, setRequirementsHandle] = useState("");
  const [proposalHandle, setProposalHandle] = useState("");
  const [released, setReleased] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);

  const toolNames = useMemo(() => Object.values(PROCUREMENT_TOOLS), []);

  useEffect(() => {
    let active = true;
    const connect = (loaded) => {
      if (!active || !loaded) return;
      integration.current = loaded;
      setNativeConnected(Boolean(loaded.nativeWebMcpAvailable && loaded.nativeErrors.length === 0));
      setReady(true);
    };
    const onReady = (event) => connect(event.detail);
    const onError = (event) => active && setError(event.detail?.message || "WebMCP loader failed.");
    window.addEventListener("mirror:webmcp-ready", onReady);
    window.addEventListener("mirror:webmcp-error", onError);
    connect(window.__MIRROR_WEBMCP__);
    return () => {
      active = false;
      window.removeEventListener("mirror:webmcp-ready", onReady);
      window.removeEventListener("mirror:webmcp-error", onError);
    };
  }, []);

  function updateNumber(field, value) {
    setRequirements((current) => ({ ...current, [field]: Number(value) }));
  }

  async function invoke(toolName, args, label) {
    if (!integration.current) throw new Error("WebMCP loader is not ready.");
    setEvents((current) => [...current, { label, tool: toolName, args: safeArguments(args), state: "running" }]);
    try {
      const result = await integration.current.invoke(toolName, args, {});
      setEvents((current) => current.map((event, index) => index === current.length - 1
        ? { ...event, state: "complete", result: safeArguments(result) }
        : event));
      return result;
    } catch (cause) {
      setEvents((current) => current.map((event, index) => index === current.length - 1
        ? { ...event, state: "failed", result: cause.message }
        : event));
      throw cause;
    }
  }

  async function seal() {
    setRunning(true);
    setError("");
    setReleased(null);
    setReceipt(null);
    setProposalHandle("");
    try {
      const response = await fetch("/api/mirror/protect", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Mirror-Site": "mirror_site_procurement_demo" },
        body: JSON.stringify(requirements)
      });
      const result = await response.json();
      if (!response.ok) {
        const code = typeof result.error === "object" ? result.error.code : result.error;
        const reference = typeof result.error === "object" && result.error.requestId
          ? ` Reference ${result.error.requestId}.`
          : "";
        throw new Error(`Protection failed (${code || `http_${response.status}`}).${reference}`);
      }
      const descriptor = result.privacy;
      setRequirementsHandle(descriptor.handle);
      setEvents([{ label: "Buyer boundary", tool: "Mirror protect", args: "Private form → context-bound handle", state: "complete", result: descriptor.handle }]);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setRunning(false);
    }
  }

  async function runAgents() {
    if (!requirementsHandle) return;
    setRunning(true);
    setError("");
    try {
      const match = await invoke(PROCUREMENT_TOOLS.find, { requirementsHandle }, "User agent");
      const proposal = await invoke(PROCUREMENT_TOOLS.propose, { matchHandle: handleFrom(match) }, "User agent → seller agent");
      const nextHandle = handleFrom(proposal);
      setProposalHandle(nextHandle);
      const result = await invoke(PROCUREMENT_TOOLS.release, { proposalHandle: nextHandle }, "Approved release");
      setReleased(result);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setRunning(false);
    }
  }

  async function accept() {
    setRunning(true);
    setError("");
    try {
      const result = await invoke(PROCUREMENT_TOOLS.accept, { proposalHandle }, "Approved commit");
      setReceipt(result);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="https://mirrorsecurity.io/etf/">MIRROR</a>
        <span>PRIVATE SITE TOOLS / WEBMCP</span>
        <span className={`connection ${nativeConnected ? "live" : "preview"}`}>
          {nativeConnected ? "Native WebMCP connected" : "Local WebMCP preview"}
        </span>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">PRIVATE ACTIONS FOR WEBMCP</p>
          <h1>Let agents act on private data without putting it in agent context.</h1>
          <p className="lede">WebMCP makes a website actionable. Mirror keeps sensitive site state under website control and releases only what the user approves.</p>
        </div>
        <div className="flow" aria-label="Private WebMCP action flow">
          <div><strong>WEBSITE</strong><span>Private state</span></div>
          <b>→</b><div className="mirror"><strong>MIRROR</strong><span>Restricted capability</span></div>
          <b>→</b><div><strong>AGENT</strong><span>Bounded action</span></div>
          <b>→</b><div className="result"><strong>RESULT</strong><span>Approved disclosure</span></div>
        </div>
      </section>

      <section className="problem-section" aria-labelledby="privacy-gap-title">
        <div className="problem-copy">
          <p className="eyebrow">THE PRIVACY GAP</p>
          <h2 id="privacy-gap-title">Useful actions often depend on private data.</h2>
          <p>Financial limits, patient records, legal conflicts and private business rules can leak through tool arguments, chat history, logs and agent handoffs.</p>
        </div>

        <div className="boundary-comparison">
          <article className="boundary-lane exposed-lane">
            <div className="lane-copy">
              <span>WITHOUT A DATA BOUNDARY</span>
              <strong>The private record enters agent context.</strong>
              <p>The agent can read and carry it beyond the action that needed it.</p>
            </div>
            <div className="boundary-route" aria-label="Private data copied through the conventional agent path">
              <div><small>WEBSITE</small><strong>Private record</strong></div>
              <b aria-hidden="true">→</b>
              <div><small>AGENT</small><strong>Readable context</strong></div>
              <b aria-hidden="true">→</b>
              <div><small>ACTION</small><strong>Tool or provider</strong></div>
              <b aria-hidden="true">→</b>
              <div><small>RESIDUE</small><strong>History and traces</strong></div>
            </div>
          </article>

          <article className="boundary-lane protected-lane">
            <div className="lane-copy">
              <span>WITH MIRROR</span>
              <strong>The website keeps custody of the record.</strong>
              <p>The agent receives a capability limited by user, session, origin, tool, purpose and expiry.</p>
            </div>
            <div className="boundary-route" aria-label="Private data retained by the website while the agent receives a restricted capability">
              <div><small>WEBSITE</small><strong>Private record</strong></div>
              <b aria-hidden="true">→</b>
              <div className="protected-node"><small>MIRROR</small><strong>Restricted handle</strong></div>
              <b aria-hidden="true">→</b>
              <div><small>AGENT</small><strong>Bounded action</strong></div>
              <b aria-hidden="true">→</b>
              <div className="released-node"><small>RESULT</small><strong>Approved release</strong></div>
            </div>
          </article>
        </div>

        <div className="demo-intro">
          <p className="eyebrow">SEE IT IN ONE REAL WORKFLOW</p>
          <h2>One buyer. One seller. Only the agreed offer crosses.</h2>
          <p>Procurement is one example. The same boundary can protect financial profiles, patient records, legal conflicts and private evaluations.</p>
        </div>
      </section>

      <section className="workspace">
        <div className="panel buyer-panel">
          <div className="panel-heading"><span>LOCAL</span><div><h2>Buyer boundary</h2><p>Enter private requirements directly into the website, never into agent chat.</p></div></div>
          <div className="form-grid">
            <label>Accelerators<input type="number" min="4" max="64" value={requirements.quantity} onChange={(event) => updateNumber("quantity", event.target.value)} /></label>
            <label>Delivery within days<input type="number" min="7" max="60" value={requirements.deliveryDays} onChange={(event) => updateNumber("deliveryDays", event.target.value)} /></label>
            <label>Private unit-price ceiling<input type="number" min="1000" max="5000" value={requirements.maxUnitPrice} onChange={(event) => updateNumber("maxUnitPrice", event.target.value)} /></label>
            <label>Required assurance<select value={requirements.requiredCertifications.join(",")} onChange={(event) => setRequirements((current) => ({ ...current, requiredCertifications: event.target.value.split(",") }))}><option value="iso27001,soc2">ISO 27001 + SOC 2</option><option value="iso27001,soc2,pci">ISO 27001 + SOC 2 + PCI</option></select></label>
            <label className="wide">Private note<textarea value={requirements.privateNotes} onChange={(event) => setRequirements((current) => ({ ...current, privateNotes: event.target.value }))} /></label>
          </div>
          <button className="primary" disabled={!ready || running} onClick={seal}>{requirementsHandle ? "Reseal requirements" : "Seal requirements"}</button>
          <div className="boundary-line"><span>Agent receives</span><code>{visibleHandle(requirementsHandle) || "No handle created"}</code></div>
        </div>

        <div className="panel agent-panel">
          <div className="panel-heading"><span>BOUNDARY</span><div><h2>Agent collaboration</h2><p>Run the same registered tools used by a native browser agent.</p></div></div>
          <div className="agent-identities">
            <div><span>USER AGENT</span><strong>Codex / WebMCP</strong><small>Sees tool schemas and handles</small></div>
            <div><span>SELLER AGENT</span><strong>Mirror encrypted inference</strong><small>Sees the allow-listed handoff as ciphertext</small></div>
          </div>
          <button className="primary inverse" disabled={!requirementsHandle || running} onClick={runAgents}>{running ? "Agents collaborating…" : "Run private negotiation"}</button>
          <ul className="privacy-list">
            <li><span>Budget received by seller agent</span><strong>NO</strong></li>
            <li><span>Browser handle received by seller agent</span><strong>NO</strong></li>
            <li><span>Seller price floor returned</span><strong>NO</strong></li>
          </ul>
        </div>
      </section>

      <section className="evidence-section">
        <div className="section-title"><h2>See exactly what each agent receives.</h2></div>
        <div className="trace">
          {events.length === 0 ? <p className="empty">Seal the private requirements to begin.</p> : events.map((event, index) => (
            <article key={`${event.tool}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><small>{event.label}</small><h3>{event.tool}</h3><pre>{event.args}</pre>{event.result && <details><summary>{event.state === "failed" ? "Failure" : "Bounded result"}</summary><pre>{event.result}</pre></details>}</div>
              <b className={event.state}>{event.state}</b>
            </article>
          ))}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {released && (
        <section className="proposal-section">
          <div><h2>{released.offer.product}</h2><p>{released.offer.rationale}</p></div>
          <dl><div><dt>Quantity</dt><dd>{released.offer.quantity}</dd></div><div><dt>Unit price</dt><dd>€{released.offer.unitPrice.toLocaleString()}</dd></div><div><dt>Total</dt><dd>€{released.offer.totalPrice.toLocaleString()}</dd></div><div><dt>Delivery</dt><dd>{released.offer.deliveryDays} days</dd></div></dl>
          {released.offer.protectedInference && <div className="encrypted-proof"><span>ENCRYPTED INFERENCE</span><strong>{released.offer.protectedInference.model}</strong><small>{released.offer.protectedInference.ciphertextBytes.toLocaleString()} ciphertext bytes · {released.offer.protectedInference.compute} compute · {released.offer.protectedInference.roundTripSeconds}s</small></div>}
          <button className="primary" disabled={running || Boolean(receipt)} onClick={accept}>{receipt ? "Proposal accepted" : "Approve and accept"}</button>
          {receipt && <p className="receipt">Receipt {receipt.receiptId} · buyer fields returned: {receipt.buyerPrivateFieldsReturned}</p>}
        </section>
      )}

      <section className="integration-section">
        <div><h2>Add the boundary without shipping the private SDK.</h2><p>The public adapter is under 7 KB. It reads a same-origin manifest, joins the authenticated site session, and registers these tools. Handle state, keys, policy, and protected services remain behind the endpoints.</p></div>
        <pre><code>{`<script defer
  src="/mirror-webmcp-v1.js"
  data-mirror-webmcp
  data-site="mirror_site_public_id"
  data-manifest="/.well-known/mirror-webmcp.json">
</script>`}</code></pre>
        <ol>{toolNames.map((name) => <li key={name}><span>TOOL</span><code>{name}</code></li>)}</ol>
      </section>

      <section className="catalog-section">
        <h2>Public catalogue used by the match</h2>
        <div>{PUBLIC_CATALOG.map((product) => <article key={product.sku}><span>{product.sku}</span><h3>{product.name}</h3><p>{product.summary}</p><small>From €{product.listUnitPrice.toLocaleString()} · {product.deliveryDays} days</small></article>)}</div>
      </section>
    </main>
  );
}
