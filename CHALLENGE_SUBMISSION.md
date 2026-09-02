# OpenAI WebMCP Challenge submission

## Project

**Mirror WebMCP Secure**

## One-line pitch

Native Site Tools that let agents use private website data without copying it into agent context or tool transcripts.

## Submission description

WebMCP makes websites actionable. The most valuable actions often depend on data that should not become agent context: a buyer's budget, a patient's record, a legal conflict list, a private benchmark, or a seller's pricing policy.

Mirror WebMCP Secure gives the agent capability without giving it the underlying record.

A website protects private page state and returns a short-lived handle bound to the origin, user, session, model, purpose and allowed tools. ChatGPT or Codex discovers ordinary imperative Site Tools and chains them using the handle. The website opens it only inside the exact permitted endpoint. A result stays behind another handle until the user approves release or commitment.

The reference application makes this concrete with a buyer agent and a seller agent:

1. A buyer enters private accelerator requirements into the website, not agent chat.
2. The site replaces the form with a context-bound handle.
3. The browser agent calls `procurement.find_private_matches`.
4. The site performs the private match and returns a second handle.
5. The agent calls `procurement.request_seller_proposal`.
6. The site sends only eligible SKU identifiers, quantity and delivery window into a protected seller route.
7. `mirror/glm-5.3-flash` receives encrypted ingress, computes on ciphertext and returns encrypted egress.
8. The proposal remains private until the user approves release.
9. A second approval commits the proposal and returns a receipt.

The buyer agent never receives the raw requirements. The remote seller model never receives readable buyer data. The seller application never receives the browser handle. The buyer receives one approved offer, not seller pricing rules. The visible receipt confirms that zero buyer-private fields were returned.

## Why this needs WebMCP

This is not a chat wrapper. The website is the trust boundary and owns the private state, authenticated session, tools, approvals and business policy. WebMCP gives the user-controlled agent a live, discoverable action surface inside that website.

The agent can plan and chain actions without copying the page's private data into its prompt. The same site works with an ordinary browser preview and registers natively through `document.modelContext.registerTool()` in a supported ChatGPT built-in browser.

## New human-agent collaboration pattern

Conventional automation gives an agent both the task and the data. Mirror separates them:

- The human supplies private intent directly to the trusted website.
- The agent receives authority to invoke a narrow operation.
- The website and protected model compute with only the data each step needs.
- The human approves the information or action that crosses the boundary.

This pattern applies to procurement, finance, healthcare, legal intake, private evaluation, enterprise search and cross-company workflows.

## Implementation

- Four imperative WebMCP Site Tools loaded from a same-origin manifest.
- An approximately 18 KB browser loader with no private SDK, WASM, key or source map.
- Authenticated, expiring server handles bound to context, purpose and exact tool names.
- Strict JSON schemas that reject extra and known private fields.
- A bounded two-agent handoff.
- Real encrypted seller inference with `mirror/glm-5.3-flash` in the hosted configuration.
- Deterministic seller-side pricing. The model cannot choose or reveal the private price floor.
- Separate approval gates for proposal release and transaction commitment.
- Negative tests for replay, modified handles, wrong tool or purpose and private-result leakage.
- A complete `create-mirror-webmcp` Next.js starter for website owners.

## Links

- Live application: <https://mirror-webmcp-secure.vercel.app/>
- Public source: <https://github.com/mirrorsecai/mirror-webmcp-secure>
- Product: <https://mirrorsecurity.io/etf/>
- Demo video: add after the final native recording

## Demo script, 2 minutes 35 seconds

### 0:00 to 0:20 | The problem

Show the private buyer form beside the browser-agent panel.

Say: "WebMCP lets an agent act on a website. The privacy problem is that useful actions often need data we do not want copied into the agent's context."

### 0:20 to 0:45 | Native tools

Show **Native WebMCP connected** and the four registered tool names.

Say: "This page registers four real imperative Site Tools. The website keeps its authenticated state and the agent receives only tool schemas and handles."

### 0:45 to 1:10 | Protect the buyer

Click **Seal requirements**. Show the short handle fingerprint. Run `procurement.find_private_matches`.

Say: "The budget, certifications and private note never enter agent chat. The first tool privately finds compatible products and returns another handle."

### 1:10 to 1:40 | Two-agent encrypted handoff

Click **Run private negotiation**. Show the tool sequence advancing while the real protected call runs.

Say: "The seller path receives only eligible SKUs, quantity and delivery window. Mirror encrypts that bounded request before remote inference. The model computes on ciphertext and provider reasoning remains withheld."

### 1:40 to 2:05 | Human-controlled release

Approve the proposal release. Show the offer and encrypted-inference facts. Approve commitment and show the receipt.

Say: "The buyer receives one approved offer. The seller's price floor stays private, and the receipt shows that zero buyer fields were returned."

### 2:05 to 2:25 | Site-owner integration

Show the loader snippet and `npx create-mirror-webmcp my-private-site`.

Say: "A site owner can start from the generated Next.js app or add the same-origin loader. Keys, policy and protected execution stay behind server endpoints."

### 2:25 to 2:35 | Close

Say: "WebMCP defines what the agent can do. Mirror controls what private data those actions can receive, use and release."

## Accuracy boundary

The browser Site Tools, context-bound handles, approvals, seller handoff and encrypted model call are real. No synthetic success is returned. The protected route fails closed when it cannot prove encrypted ingress, ciphertext compute and encrypted egress. The private Mirror SDK and cryptographic runtime are server-side and are not part of the public browser bundle.
