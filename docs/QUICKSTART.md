# Quick start

This path verifies the public adapter, reference application and release boundary without requiring the private Mirror SDK.

## Requirements

- Node.js 20 or newer.
- npm 10 or newer.
- A browser for local preview.
- A supported WebMCP browser client only if you want native tool discovery.

## Clone and verify

```sh
git clone https://github.com/mirrorsecai/mirror-webmcp-secure.git
cd mirror-webmcp-secure
npm ci --ignore-scripts
npm --prefix examples/private-procurement-vercel ci --ignore-scripts
npm run release:check
```

A successful check verifies:

- Manifest loading and native tool registration.
- Same-origin endpoint enforcement.
- Handle and approval binding.
- Cross-session, cross-tool, modified-token and expiry failures.
- The browser bundle contains no Mirror SDK, WASM, source map, service credential or seller policy.

## Run the reference site

```sh
npm --prefix examples/private-procurement-vercel run dev
```

Open <http://localhost:4210>.

The page should load four endpoint-backed tools. An ordinary browser exposes the local preview controls. A supported WebMCP browser client can discover the same tools natively.

The application can create and validate private handles without a private dependency. The seller-model step requires one real server-side route:

- Mirror hosted encrypted inference using `MIRROR_WEBMCP_FHE_URL` and `MIRROR_WEBMCP_FHE_TOKEN`.
- The explicit Vercel AI Gateway fallback supported by the example.

Without one of those routes, the seller step fails closed. The reference application never substitutes a synthetic proposal.

## Generate a separate reference site

The generator is not published on npm yet. Run it from the checkout:

```sh
node packages/create-mirror-webmcp/bin/create-mirror-webmcp.mjs /tmp/my-private-site
cd /tmp/my-private-site
npm run check
npm run dev
```

The generated project is a procurement reference, not a universal application scaffold. Replace its application identity, manifest, dispatcher, private record, release policy and durable storage before production.

## Try the complete hosted flow

The public reference deployment is at <https://mirror-webmcp-secure.vercel.app/>. Hosted gateway credentials and protected inference endpoints are service credentials, not repository artifacts. Contact Mirror through <https://mirrorsecurity.io/etf/> to evaluate that path in your own application.

Next: [integrate an existing site](./SITE_OWNER_INTEGRATION.md).
