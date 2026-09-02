# Private procurement with WebMCP and encrypted seller inference

This private reference application shows a user-controlled browser agent and a website-owned seller agent completing one bounded procurement transaction.

The buyer enters private requirements directly into the page. A same-origin endpoint returns an encrypted, context-bound handle before the browser agent sees them. The one-line `@mirror/webmcp-secure` loader registers the WebMCP tools from the site's manifest. The tool chain computes a private match, sends only an allow-listed handoff to the seller path, keeps the proposal behind a second handle, and releases or accepts it only after buyer approval.

The hosted configuration sends the bounded handoff to Mirror encrypted inference. `mirror/glm-5.3-flash` receives encrypted ingress, computes on ciphertext and returns encrypted egress. A Vercel AI SDK seller agent remains available as a server-side fallback for independent local testing.

## What each agent receives

| Actor | Receives | Does not receive |
| --- | --- | --- |
| User agent | Tool schemas, opaque handles, approved proposal and receipt | Raw budget, compliance list, private notes, rejected products, seller price floor |
| Seller application | Eligible SKU identifiers, quantity, delivery window and request ID | Browser handle, buyer budget, certification list, private notes |
| Remote seller model | Ciphertext for the bounded request | Readable buyer requirements, browser handle, seller price floor |
| Website | Its authenticated page state and normal business APIs | Unrelated user-agent context |

WebMCP is the browser collaboration surface. It is not used as an unrestricted backend agent-messaging bus. The website invokes its seller agent from inside one registered tool and validates the exact handoff first.

## Tool sequence

```text
procurement.find_private_matches
        -> private match handle
procurement.request_seller_proposal
        -> private proposal handle
procurement.release_proposal
        -> buyer-approved proposal
procurement.accept_proposal
        -> buyer-approved receipt
```

The tool definitions follow the upstream [`document.modelContext.registerTool()` contract](https://github.com/webmachinelearning/webmcp). The implementation uses imperative registration because that is the path currently supported by ChatGPT's built-in browser.

## Run locally

The package is private during review but is standalone. This example does not install the private Mirror SDK and does not ship Mirror WASM to the browser. The actual page uses the same one-line loader shown in its integration section.

```sh
cd examples/private-procurement-vercel
npm install
npm run dev
```

Open <http://localhost:4210>. A normal browser uses the built-in local invocation preview. Open the same page in a WebMCP-enabled built-in browser to discover the four native Site Tools.

The protected seller route is configured with server-only `MIRROR_WEBMCP_FHE_URL` and `MIRROR_WEBMCP_FHE_TOKEN`. These values never enter the browser bundle. The endpoint must return proof of encrypted ingress, ciphertext compute and encrypted egress or the request fails closed.

The optional Vercel AI SDK fallback requires a real AI Gateway identity:

- On Vercel, `VERCEL_OIDC_TOKEN` is provisioned automatically.
- For local development, run `vercel link && vercel env pull` or configure `AI_GATEWAY_API_KEY`.
- Set `PROPOSAL_SIGNING_KEY` in production. The development-only fallback refuses to run in production.
- Set `MIRROR_WEBMCP_HANDLE_KEY` in production. It authenticates endpoint-backed handles and never enters the browser bundle.

No live model fallback or synthetic proposal is returned when the seller agent cannot run. The route fails closed.

The default fallback is Vercel AI Gateway's tool-capable `poolside/laguna-s-2.1-free` model. Set `SELLER_AGENT_MODEL` to test another Gateway model.

## One-line integration surface

- `/.well-known/mirror-webmcp.json` declares four Site Tools and their same-origin endpoint.
- `/api/mirror/context` joins the loader to the authenticated first-party session.
- `/api/mirror/protect` converts the private form into a context-bound opaque handle.
- `/api/mirror/tool` verifies the site, origin, session, user, tool, kind, purpose, and expiry before each operation.
- `/api/seller-agent` receives only the reduced handoff and invokes the configured protected seller or the explicit Vercel AI SDK fallback.

The public site id selects configuration. It is not a credential.

## Trust boundary

The example's one-line path uses encrypted server handles so separate endpoint calls can share a narrow capability. The handles are never sent to `/api/seller-agent`. The approved Site Tool opens the match server-side and constructs this allow-listed handoff:

```json
{
  "requestId": "rfq_...",
  "eligibleSkuIds": ["gpu-flex-8"],
  "quantity": 12,
  "deliveryDays": 14,
  "publicObjective": "Return the best available compliant offer"
}
```

The endpoint rejects extra properties and known private buyer fields. The model selects only from eligible SKUs and supplies a bounded rationale. It does not choose prices. Seller-owned deterministic policy applies inventory and pricing rules, then issues a signed, expiring proposal.

This example assumes the page origin and its JavaScript are trusted. It does not protect against compromised same-origin code, a malicious browser extension, or a compromised device.

`npm run audit:client` fails the build if it finds a private SDK marker, Mirror WASM, source-only configuration, or seller policy in the browser assets.
