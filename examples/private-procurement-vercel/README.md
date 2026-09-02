# Private procurement WebMCP reference

This Next.js application lets a user-controlled browser agent and a website-owned seller agent reach one offer without exchanging both parties' private policy.

## What each side receives

| Side | Receives | Does not receive |
| --- | --- | --- |
| User agent | Tool schemas, opaque handles, approved offer and receipt | Price ceiling, certifications, private note, rejected products, seller price floor |
| Seller application | Eligible SKUs, quantity, delivery window and request ID | Browser handle, buyer ceiling, certification list or private note |
| Website | Authenticated site state and its own business APIs | Unrelated agent conversation state |

The optional Mirror seller route encrypts the bounded seller request before remote model execution. It is an additional protection layer, not a requirement for running the WebMCP application.

## Tool sequence

```text
procurement.find_private_matches
  -> private match handle

procurement.request_seller_proposal
  -> private proposal handle

procurement.release_proposal
  -> exact-argument approval -> one offer

procurement.accept_proposal
  -> separate approval -> receipt
```

## Run locally

```sh
npm ci
npm run test
npm run dev
```

Open <http://localhost:4210>. A normal browser uses the local invocation path. A supported ChatGPT built-in browser discovers the same four imperative tools through `document.modelContext.registerTool()`.

The seller step fails closed unless either of these server-side paths is configured:

- `MIRROR_WEBMCP_FHE_URL` and `MIRROR_WEBMCP_FHE_TOKEN` for the protected Mirror route.
- Vercel AI Gateway identity for the explicit AI SDK fallback.

No synthetic proposal is returned.

## Same-origin contracts

- `/.well-known/mirror-webmcp.json`: tool definitions and endpoint locations.
- `/api/mirror/context`: authenticated session bootstrap.
- `/api/mirror/protect`: private form to bound handle.
- `/api/mirror/approve`: short-lived approval bound to tool arguments.
- `/api/mirror/tool`: exact tool dispatch and release enforcement.

For the hardened hosted path, set `MIRROR_WEBMCP_GATEWAY_URL` and `MIRROR_WEBMCP_GATEWAY_SECRET`. Each route then signs and forwards the request to the private Cloudflare enforcement Worker. These variables are server-only.

## Verify

```sh
npm run check
```

This runs endpoint and policy tests, a production build and a browser-bundle audit. The audit fails if a private SDK marker, Mirror client, WASM, source map, secret name or seller rule enters browser assets.

This example assumes trusted same-origin code. Before adapting it to a real transaction, replace the demo user with application authentication and add an authoritative idempotent commit ledger.

The authentication replacement point is `applicationUserId` in `lib/server-context.js`. It must read a server-verified first-party session. Never replace it with a user identifier supplied by tool arguments or an unsigned browser header.

Endpoint failures follow `mirror.webmcp.error.v1`. They expose a safe code, stage and request reference without returning arguments, handles, tokens, provider bodies or stack traces. See [the protocol](../../docs/PROTOCOL.md) and [troubleshooting guide](../../docs/TROUBLESHOOTING.md).
