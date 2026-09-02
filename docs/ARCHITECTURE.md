# Architecture and data flow

## Security idea

An agent needs authority to request an operation. It does not automatically need the private record used by that operation.

Mirror WebMCP Secure separates those two things. WebMCP exposes a useful action surface. The application replaces private records with narrow handles, resolves them only in approved tools, and releases only the agreed result.

## Public submission architecture

```text
ChatGPT built-in browser
  sees tool schema, opaque handle and approved result
                 |
                 | document.modelContext.registerTool()
                 v
Under 6 KB same-origin adapter in the Vercel page
  contains registration and request transport only
                 |
                 | authenticated /api/mirror/* request
                 v
Website server boundary
  authenticates user and session
  checks exact schema, origin, tool, purpose and expiry
  issues argument-bound approval tokens
                 |
                 | private operation or narrow handoff
                 v
Application or hosted capability
  deterministic service, Vercel AI SDK, Cloudflare Agent,
  encrypted inference, private search, memory or evaluation
                 |
                 | private handle or minimum result
                 v
Website release policy and user approval
                 |
                 v
ChatGPT receives the agreed result
```

The complete public reference application can run using its included server implementation. It does not require the private Mirror SDK.

## Hardened hosted deployment

The private production option separates hosting from enforcement:

```text
ChatGPT
   |
   v
Vercel UI and thin same-origin API proxy
   |  signed method + path + origin + timestamp + nonce + body digest
   v
Cloudflare Worker
   |  verifies proxy identity and allowed origin
   v
Per-session Durable Object
   |  stores opaque handle state
   |  enforces user/session/tool/purpose/expiry
   |  rejects replay and atomically consumes approvals
   v
Private Mirror capability endpoint
   |  SDK, WASM, keys and full receipts stay here
   v
Minimum result returns through the same path
```

Direct access to the private Worker fails without the Vercel-held request signature. Changing the method, route, origin or body invalidates that signature. Handle and approval replay is checked inside a single per-session Durable Object, avoiding a distributed check-then-use race.

## Reference tool chain

| Step | Agent receives | Website keeps |
| --- | --- | --- |
| Protect requirements | Opaque requirements handle | Budget, certifications and private note |
| Find private matches | Match count and a new handle | Buyer record and rejected products |
| Request proposal | Proposal-ready status and a new handle | Seller rules and proposal terms |
| Release proposal | One approved offer | Buyer fields and seller price floor |
| Accept proposal | Minimum receipt | Private workflow state and full audit record |

The seller handoff is deliberately smaller than the buyer record: eligible SKU identifiers, quantity and delivery window. The browser handle itself never enters the seller-agent request.

## Approval boundary

For a sensitive tool, the browser first asks the user. After consent, it requests a short-lived approval token from the same-origin server. That token is bound to the authenticated user, session, origin, tool and canonical argument digest. The tool endpoint rejects a missing, expired, modified or swapped approval.

The hardened Cloudflare path makes the approval one-use. The public Vercel reference demonstrates argument and context binding without requiring a private state service.

## What is public

- WebMCP registration adapter and types.
- Manifest and endpoint protocol.
- Complete reference UI and server example.
- Starter generator, tests and documentation.

## What remains private

- Mirror SDK and protected-compute clients.
- Mirror WASM and tokenizer artifacts.
- Provider and model credentials.
- Decryption and customer key material.
- Authoritative policy, entitlements and private seller rules.
- Full internal receipts and protected audit storage.
- The optional Cloudflare production gateway implementation.

Browser JavaScript is inspectable by design. Security never relies on hiding the small adapter.

## Tested failures

- Cross-origin manifest or endpoint.
- Cross-session and cross-user handle use.
- Modified handle.
- Tool and purpose substitution.
- Missing, expired, modified or argument-swapped approval.
- Signed Vercel request path or body substitution.
- Duplicate Worker ingress nonce.
- Duplicate handle use for the same tool.
- Duplicate approval use.
- Unexpected fields and private seller-handoff fields.
- Browser bundle containing SDK, WASM, secret markers or seller policy.
