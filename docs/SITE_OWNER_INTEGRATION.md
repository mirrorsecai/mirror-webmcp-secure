# Site-owner integration

A website should be able to add a private WebMCP boundary without receiving the private Mirror SDK or putting a Mirror secret in HTML.

## Three supported paths

### Complete starter

Use this for a new Next.js application:

```sh
npx create-mirror-webmcp my-private-site
```

The generated project includes the loader, same-origin manifest, session bootstrap, server-bound private handles, four example tools, approval boundaries, endpoint tests and a browser-bundle audit. It is private by default and creates no deployment or remote repository.

### One-line loader

Use this when Site Tools are backed by authenticated same-origin endpoints.

```html
<script
  defer
  src="/mirror-webmcp-v1.js"
  data-mirror-webmcp
  data-site="mirror_site_public_id"
  data-manifest="/.well-known/mirror-webmcp.json"
></script>
```

`data-site` selects public configuration. It is not a key. The website's authenticated context endpoint supplies a short-lived session token. Every tool endpoint verifies that token, the site, the user, the session, the requested tool, the purpose, and the handle again.

### npm package

Use this when the site owns custom browser handlers or wants direct control over approval and evidence UI.

```sh
npm install @mirror/webmcp-secure
```

The package contains the WebMCP boundary only. It uses WebCrypto for browser-local handles and has no dependency on the private Mirror SDK or Mirror WASM.

## Data flow

```text
private page state
      |
      | protect once
      v
context-bound handle
      |
      | WebMCP arguments
      v
user-controlled agent
      |
      | calls a narrow Site Tool
      v
website handler or same-origin endpoint
      |
      | approved application logic or hosted Mirror capability
      v
private handle, minimum public result, or approval request
      |
      v
user-controlled agent
```

The agent sees schemas, opaque handles, approved public previews, and released results. It does not receive the protected source value, decryption key, private SDK, policy implementation, or an unrestricted backend credential.

## Two-agent collaboration

The procurement example shows the useful boundary between a user agent and a website agent:

1. The user agent calls a WebMCP tool with a private buyer handle.
2. The website opens the handle only inside the allowed handler.
3. The website reduces the buyer data to an allow-listed handoff.
4. The hosted demo encrypts that handoff for the Mirror seller model. The remote model receives ciphertext, not the buyer profile or browser handle.
5. The seller proposal returns behind a new private handle.
6. The user approves release or commitment.

WebMCP is the user-agent-to-website interface. The website can use Mirror encrypted inference, Vercel AI SDK, Cloudflare Agents, an MCP server, a deterministic service, or another agent behind the Site Tool. Mirror controls what crosses between them.

## What the free layer contains

| Included in the site-owner layer | Kept behind Mirror or application servers |
| --- | --- |
| WebMCP tool registration | Mirror SDK and ETF client |
| Strict input schemas | FHE and encrypted-search execution |
| Local context-bound handles | Keys and authoritative policy |
| Approval callback | Entitlement, revocation, and metering services |
| Safe evidence events | Private memory, DCR, and evaluation services |
| Same-origin manifest protocol | Server receipts and protected audit storage |

## Server rules

The server must:

1. Authenticate the application user from the normal first-party session.
2. Treat the site id as public input.
3. Reject cross-origin manifests and tool endpoints.
4. Validate the exact JSON schema and reject extra properties.
5. Re-check purpose, tool, user, session, expiry, and revocation for every handle use.
6. Keep model and service credentials out of the browser.
7. Return only the declared result envelope and safe receipt fields.
8. Require a fresh user approval for sensitive release or consequential action.

The browser layer improves the agent boundary. It does not replace application authentication, authorization, CSP, browser security, output validation, or semantic prompt-injection defenses.

## Current proof gates

- A fresh generated project installs with zero audit findings and completes its tests, production build and browser-boundary scan.
- The standalone package clean-install test passes without Mirror SDK or WASM.
- The one-line loader bundle is under 50 KB uncompressed and contains no SDK, WASM, source map, or secret configuration.
- The procurement example runs its complete four-tool chain and client-bundle audit.
- The real browser QA registers all four tools through `document.modelContext`, completes a two-agent transaction and validates encrypted ingress, ciphertext compute and encrypted egress from `mirror/glm-5.3-flash`.
- The core lab runs all eight context, substitution, release, and revocation attacks.
- Publication and deployment remain disabled until owner approval.
