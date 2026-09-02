# Site-owner integration

A website can expose private Site Tools without putting the Mirror SDK or a service credential in browser JavaScript.

## Fastest path

The generator is currently distributed from the public source repository, not npm:

```sh
git clone https://github.com/mirrorsecai/mirror-webmcp-secure.git
cd mirror-webmcp-secure
npm ci --ignore-scripts
node packages/create-mirror-webmcp/bin/create-mirror-webmcp.mjs /tmp/my-private-site
cd /tmp/my-private-site
npm run check
npm run dev
```

The generated app includes the tool manifest, session bootstrap, server-bound handles, four reference tool endpoints, approval binding, tests and a browser-bundle audit. It creates no deployment or repository.

The generated workflow is intentionally a procurement example. The loader and protocol are not procurement-specific. Replace the manifest, tool dispatcher, application principal and release policy with those belonging to your site.

## Existing website

Copy the reviewed, under 7 KB adapter to the site's public assets and add one script tag:

```html
<script
  defer
  src="/mirror-webmcp-v1.js"
  data-mirror-webmcp
  data-site="mirror_site_public_id"
  data-manifest="/.well-known/mirror-webmcp.json">
</script>
```

Then provide four same-origin contracts:

1. `/.well-known/mirror-webmcp.json` describes the tools and endpoints.
2. `/api/mirror/context` joins the authenticated application session.
3. `/api/mirror/approve` issues short-lived, argument-bound approval tokens.
4. `/api/mirror/tool` authenticates, authorizes and executes a declared tool.

The adapter rejects a cross-origin manifest, context endpoint, approval endpoint or tool endpoint.

Start from [the generic manifest](../schemas/example-site-manifest.json) and validate all envelopes against [the protocol schema](../schemas/protocol-v1.schema.json).

## Five application decisions

Before writing a tool, identify:

1. The private record that must remain outside agent context.
2. The authenticated application user and session that own it.
3. The exact tools and purpose allowed to resolve its handle.
4. The minimum result an agent may receive.
5. The actions that need fresh, argument-bound user approval.

If any of these remain undefined, the tool is not ready for production.

## What the agent sees

- Tool names, descriptions and JSON input schemas.
- Opaque handles with no embedded plaintext.
- Minimum public status values.
- A result only after the declared release boundary.

## What the agent does not need

- The original private record.
- A handle decryption key.
- The Mirror SDK or WASM.
- A model or provider credential.
- Seller policy or unrestricted application credentials.
- Full internal receipts.

## Framework choices behind a Site Tool

The endpoint is framework-neutral. It may call:

- Normal application or database logic.
- A Vercel AI SDK agent.
- A Cloudflare Agent or Workflow.
- An MCP server.
- Mirror encrypted inference, encrypted search, memory or evaluation.
- Another organization's agent through a narrow signed handoff.

WebMCP remains the user-agent-to-website interface. Mirror governs what crosses into and out of the private operation.

## Production hardening

The included public server example is intentionally understandable and runnable. For a hosted production path, the Vercel routes can forward signed requests to a private Cloudflare gateway. The gateway stores handle state in Durable Objects and makes approval and replay checks atomic. Configure it with:

```text
MIRROR_WEBMCP_GATEWAY_URL
MIRROR_WEBMCP_GATEWAY_SECRET
```

Those variables are server-only. They must never use a `NEXT_PUBLIC_` prefix.

The values are issued as part of the Mirror hosted integration. They are not derived from the public repository. Use the [live application](https://mirror-webmcp-secure.vercel.app/) to evaluate the complete flow or contact Mirror through [Encrypted Token Factory](https://mirrorsecurity.io/etf/) for a hosted endpoint.

If you do not use the hosted gateway, provide an atomic store for one-use approvals and replay state. A process-local map is suitable only for development because separate serverless instances do not share it.

## Server checklist

Every tool request must:

1. Authenticate the user from the normal first-party session.
2. Reject untrusted origins and cross-site requests.
3. Validate an exact JSON schema and reject extra fields.
4. Re-check the handle's user, session, origin, purpose, tool and expiry.
5. Keep model credentials, keys and protected clients server-side.
6. Require a fresh, argument-bound approval for sensitive release or consequential action.
7. Return only the declared result envelope and safe receipt fields.
8. Avoid logging private bodies, resolved records, handles or approval tokens.

The browser layer is not a replacement for application authorization, CSP, safe rendering, dependency security or prompt-injection defenses.

Continue with [authentication](./AUTHENTICATION.md), [deployment](./DEPLOYMENT.md) and [troubleshooting](./TROUBLESHOOTING.md).
