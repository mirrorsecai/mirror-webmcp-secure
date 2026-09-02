# Security boundary

Mirror WebMCP Secure reduces the private data that a browser agent and downstream tools receive. It does not turn an untrusted browser or application server into a trusted environment.

## Enforced by the reference flow

- Private values are replaced with authenticated handles before agent use.
- Handles are bound to origin, application user, session, purpose, allowed tools and lifetime.
- An endpoint satisfies the complete binding before it receives the private value.
- Sensitive release requires a short-lived approval bound to the exact tool arguments.
- Seller handoffs use an explicit allow-list and reject known private buyer fields.
- Browser builds are scanned for private SDK, client, WASM, key-name, source-map and seller-policy markers.

The private Cloudflare deployment adds server-stored opaque handles, signed Vercel requests, ingress nonce replay rejection, per-tool handle consumption and atomic one-use approvals.

## Application responsibilities

- Authenticate the current user and session.
- Authorize every underlying business action.
- Validate exact schemas and reject extra arguments.
- Keep provider credentials, decryption keys and privileged execution on the server.
- Apply CSP, dependency review, safe output encoding and normal web security controls.
- Treat tool descriptions, arguments and returned content as untrusted.
- Add idempotency and an authoritative transaction ledger for real financial or operational commitments.

## Not claimed

- The adapter cannot attest which ChatGPT model is active because the current WebMCP page API does not provide a server-verifiable model identity.
- The public Vercel fallback does not provide atomic replay state across serverless instances. The private Durable Object path does.
- This does not protect a compromised same-origin page, browser extension, device, operating system or application backend.
- A private repository does not make shipped browser code secret. Everything delivered to a browser can be inspected.

Report suspected issues privately to the Mirror Security team. Do not open a public issue before the repository is approved for publication.
