# Deployment

The public adapter is hosting-neutral. The reference application uses Vercel for the same-origin website surface and the hosted production path uses a private Cloudflare gateway for durable enforcement.

## Public reference mode

Use this mode for local development, code review and protocol integration.

```text
Browser or WebMCP client
        |
        v
Website page and same-origin routes
        |
        v
Application logic or developer-supplied server model route
```

The included process-local handle and approval stores are not atomic across serverless instances. Do not treat them as production replay protection.

## Mirror hosted mode

```text
Browser or WebMCP client
        |
        v
Vercel page and thin same-origin routes
        |
        | signed request
        v
Private Cloudflare gateway and per-session durable state
        |
        v
Approved application or protected Mirror capability
        |
        v
Minimum result through the website release policy
```

Configure the Vercel server routes with:

```text
MIRROR_WEBMCP_GATEWAY_URL
MIRROR_WEBMCP_GATEWAY_SECRET
```

If the tool uses Mirror encrypted inference, also configure the protected service according to the hosted integration. Never prefix these variables with `NEXT_PUBLIC_` and never return them through a page, context endpoint or tool result.

The hosted values are issued by Mirror. They are not generated from this repository. Request an integration through <https://mirrorsecurity.io/etf/>.

## Platform checklist

### Vercel

- Keep all service configuration in encrypted server environment variables.
- Exclude source maps for the reviewed browser adapter.
- Authenticate the application principal before forwarding.
- Preserve `Cache-Control: private, no-store` on session and tool responses.
- Set a server deadline that is shorter than the outer platform deadline and return a structured retryable error.

### Cloudflare

- Verify method, path, origin, timestamp, nonce and body digest before dispatch.
- Store handle and approval state per session in a Durable Object or equivalent atomic store.
- Reject duplicate ingress nonces, handle use and approval use.
- Keep the gateway unavailable to unsigned browser requests.

### Any platform

- Enforce exact input schemas and reject extra fields.
- Apply application authorization again at the destination.
- Use an idempotency key and authoritative ledger for consequential actions.
- Log only safe request references, stages and outcome codes.
- Run the browser-boundary audit after every production build.
