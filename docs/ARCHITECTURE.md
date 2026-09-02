# Architecture and data flow

## Purpose

Mirror WebMCP Secure separates an agent's authority to request an action from its ability to read all data used by that action.

WebMCP provides tool discovery and invocation. The Mirror layer adds private-value protection, context binding, restricted resolution and explicit release.

## End-to-end flow

```text
Customer or application
        |
        | raw private value
        v
Website-owned protection boundary
        |
        | encrypted record + opaque handle
        v
Codex or another WebMCP client
        |
        | tool name + handle + public parameters
        v
Registered Site Tool
        |
        | validate origin, user, session, model,
        | purpose, allowed tool, expiry and revocation
        v
Approved private operation
        |
        | private handle or minimum candidate result
        v
Website-owned release policy
        |
        | optional human approval
        v
Codex receives the agreed result
```

## Components

### Website application

Owns authentication, authorization, the current user and session, approval UI, input validation and business policy. The site must be trusted because same-origin JavaScript can access browser state.

### `@mirror/webmcp-secure`

Provides the integration API used to protect values, bind handles, register tool packs, resolve handles inside allowed handlers, apply release policy and emit bounded evidence.

### Native model context

The adapter uses an explicitly supplied model context or detects the supported `document.modelContext` interface, with `navigator.modelContext` as a compatibility fallback. It selects only an object that implements `registerTool` so an incomplete browser stub cannot mask the native interface.

### Standalone browser boundary

The public package contains WebMCP registration, browser-local WebCrypto handles, context binding, explicit release, approvals, revocation and bounded evidence. It does not contain Mirror SDK, ETF, FHE, DCR or a general-purpose Mirror WASM.

### Hosted or application capability

A Site Tool can call a same-origin application endpoint or a hosted Mirror capability for encrypted inference, search, memory, DCR or evaluation. Credentials, authoritative policy, key material and protected execution remain behind that endpoint.

### Reference website

The reference Vercel example registers four tools through the one-line loader and connects a user-controlled WebMCP agent to a protected seller agent. In the hosted configuration, the seller selection runs through Mirror encrypted inference. A Vercel AI SDK route is retained as an explicit server-side fallback for independent site-owner testing.

## Handle binding

A protected value is scoped to:

- Website origin
- Application session
- Application user, when supplied
- Active model, when supplied
- Data kind
- Declared purpose
- Allowed tool names
- Expiration time
- Revocation state

A mismatch fails before the handler receives the private value.

## Result types

A handler can produce:

1. A public non-sensitive result.
2. A sensitive result released after website-owned approval.
3. Another private handle for a later tool in the chain.

Returning a value opened from a private handle without an explicit release path is rejected.

## Reference product workflow

```text
private buyer requirements
          |
          | website protection boundary
          v
requirements handle
          |
          | procurement.find_private_matches
          v
private match handle
          |
          | procurement.request_seller_proposal
          v
allow-listed handoff -> encrypted seller inference
          |
          v
private proposal handle
          |
          | approved release and commit
          v
offer and receipt, zero buyer fields
```

The match does not return product names or buyer fields. The seller model receives the allow-listed handoff through encrypted ingress. The site keeps pricing policy deterministic and private. The final offer crosses only after approval.

## Threat tests

The reference application executes eight misuse attempts:

- Cross-session replay
- Cross-user replay
- Model substitution
- Origin substitution
- Tool substitution
- Purpose drift
- Raw-result exfiltration
- Revoked capability use

Each attempt is checked against a stable reason code so the boundary is testable rather than described only in documentation.

## Deployment boundary

Browser JavaScript delivered to a visitor is inspectable. The public build contains the small loader but no Mirror SDK, Mirror WASM, provider key, production secret, decryption key or privileged server implementation. Production deployments must use HTTPS, CSP, framing denial, safe caching and no source maps.
