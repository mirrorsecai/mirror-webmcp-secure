# OpenAI WebMCP Challenge submission

## Project

**Mirror WebMCP Secure**

## One-line pitch

Give an agent the authority to use private website data without copying the underlying record into agent context.

## Short description

WebMCP makes websites actionable. The most valuable actions often depend on information that should not become part of an agent transcript, such as a buyer's ceiling price, a patient's record, a legal conflict list, a private benchmark, or a seller's pricing policy.

Mirror WebMCP Secure gives the agent a narrow capability instead of the raw record.

A person enters private information directly into the website. The site returns an opaque handle bound to the user, session, origin, purpose, allowed tool and expiry. ChatGPT discovers ordinary Site Tools and chains them with that handle. The website resolves the handle only inside the exact permitted action. Sensitive release and commitment require fresh approval bound to the exact tool arguments.

The reference application demonstrates this with private procurement. A buyer agent finds compatible products and requests a proposal from a seller agent. The buyer agent never receives the price ceiling, certifications or private note. The seller receives only eligible product identifiers, quantity and delivery window. The buyer approves one offer. Neither party receives the other's private policy.

## What happens in the live flow

1. The buyer enters requirements into the website, not agent chat.
2. The website returns a private requirements handle.
3. ChatGPT calls `procurement.find_private_matches` with that handle.
4. The site performs the match and returns a private match handle plus a minimum status.
5. ChatGPT calls `procurement.request_seller_proposal`.
6. The seller receives only the allow-listed handoff.
7. The site keeps the proposal behind another handle.
8. The buyer approves `procurement.release_proposal` and receives one offer.
9. A separate approval allows `procurement.accept_proposal` to return a receipt.

## Why this needs WebMCP

This is not a chat wrapper. The website owns the authenticated state, private records, tools, approvals and business policy. WebMCP lets the user's agent discover and use that live action surface without moving the full private page state into its prompt.

The person contributes private intent. The agent contributes planning and tool use. The website contributes trusted state and policy. Each participant sees only what it needs.

## Technical implementation

- Four imperative tools registered with `document.modelContext.registerTool()`.
- An under 6 KB same-origin browser adapter.
- No browser-side handle cryptography, private SDK, WASM, service key or seller policy.
- Context-bound, expiring server handles.
- Exact JSON schemas that reject unexpected and known private fields.
- A seller handoff restricted to eligible SKU identifiers, quantity and delivery window.
- Approval tokens bound to origin, user, session, tool and canonical argument digest.
- Minimum-result release and a separate commit receipt.
- Tests for cross-origin endpoints, handle modification, session replay, tool and purpose substitution, approval modification, approval argument swapping, expiry and browser-bundle leakage.

The public reference application is complete and runs without a proprietary dependency. An optional hosted configuration can send the bounded seller request to Mirror encrypted inference. This extra route is not required for the WebMCP experience or for running the open-source application.

## Deployment architecture

Vercel hosts the reference application and same-origin WebMCP surface. The hardened hosted path signs requests to a private Cloudflare Worker. A per-session Durable Object stores opaque handle state, rejects replay and consumes approvals atomically. Protected Mirror services remain behind narrow server endpoints.

The public repository contains all code required to run the WebMCP application. It does not publish Mirror's separate hosted cryptographic service, keys or proprietary SDK.

## Why it is useful beyond procurement

The same pattern applies wherever the website should retain custody of private state:

- Finance: evaluate eligibility without returning a financial profile.
- Healthcare: check care criteria without placing a patient record in agent chat.
- Legal: run conflict checks without returning the full client list.
- Enterprise search: answer from approved claims without releasing source documents.
- Evaluation: use hidden cases and return only an approved score.
- Cross-company workflows: let two agents transact without exchanging both parties' private rules.

## Judging fit

- **Useful:** lets agents complete actions that would otherwise require oversharing.
- **Original:** separates data custody from agent authority using handles and release boundaries.
- **Executed:** complete live app, native tools, approvals, endpoint tests and a clean starter.
- **Thoughtful WebMCP:** the agent plans and chains website-owned capabilities rather than scraping the UI.
- **Human-agent experience:** the person supplies private intent and approves disclosure; the agent handles the workflow.

## Links

- Live application: <https://mirror-webmcp-secure.vercel.app/>
- Source repository: <https://github.com/mirrorsecai/mirror-webmcp-secure>
- Mirror: <https://mirrorsecurity.io/etf/>
- Demo video: add after final recording

## Accuracy boundary

The Site Tools, server handles, two-agent handoff, approval binding and minimum-result release are real. No synthetic success is returned. The app fails closed when a configured seller route cannot complete. The optional Mirror encrypted-inference service is server-side and is not required to run the open-source WebMCP application.

## Final form checklist

- Project description: this document.
- Working live app: verify after final deployment.
- Public code repository: create from the reviewed allow-listed export.
- Demo video: record in ChatGPT's built-in browser and keep below three minutes.
- Submission: complete through Devpost before September 3, 2026 at 1:00 PM Pacific Time.
