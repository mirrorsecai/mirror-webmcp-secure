# Mirror WebMCP Secure

Let a browser agent act on private website data without copying that data into agent chat, tool arguments, or ordinary transcripts.

WebMCP tells an agent what a website can do. Mirror controls what data each tool may use and what result may leave.

## The problem

Useful Site Tools often need budgets, account records, health data, legal documents, private evaluations, or seller policy. Passing those values through the agent makes them part of the agent context and enlarges the disclosure boundary.

Mirror replaces private values with short-lived, context-bound handles. The agent can chain useful tools with those handles. Only an allowed site endpoint can open a handle, only for its declared purpose, and sensitive release or commitment requires approval.

## Live reference flow

The included procurement site demonstrates two agents with two private contexts:

```text
private buyer form
        |
        | protect and bind
        v
opaque requirements handle
        |
        | native WebMCP Site Tools
        v
private match inside the website
        |
        | allow-listed handoff only
        v
Mirror encrypted seller inference
        |
        | encrypted ingress, ciphertext compute, encrypted egress
        v
private proposal handle
        |
        | user approves release and commitment
        v
agreed offer and receipt
```

The hosted configuration uses `mirror/glm-5.3-flash`. The remote model receives ciphertext. The user agent receives handles and the approved offer. It does not receive the buyer's price ceiling, private note, compliance list, rejected products, or the seller's pricing rules.

Try the live reference application at <https://mirror-webmcp-secure.vercel.app/>.

## What is included

- `src/`: framework-neutral WebMCP privacy runtime and same-origin manifest loader.
- `examples/private-procurement-vercel/`: four native Site Tools, a real two-agent flow, protected seller integration and browser QA.
- `packages/create-mirror-webmcp/`: a generator for a complete Next.js starter.
- `tests/`: credential-free source tests.
- `docs/ARCHITECTURE.md`: trust boundary and end-to-end data flow.
- `docs/SITE_OWNER_INTEGRATION.md`: integration choices and server rules.
- `CHALLENGE_SUBMISSION.md`: submission narrative and recording sequence.

The browser receives only the WebMCP integration layer, opaque handles, and approved results. Cryptographic execution and policy enforcement remain server-side.

## Create a site

Once the generator is published:

```sh
npx create-mirror-webmcp my-private-site
cd my-private-site
npm run check
npm run dev
```

Before npm publication, run the checked-out generator directly:

```sh
node packages/create-mirror-webmcp/bin/create-mirror-webmcp.mjs /tmp/my-private-site
```

For an existing site, serve the generated loader from the same origin:

```html
<script
  defer
  src="/mirror-webmcp-v1.js"
  data-mirror-webmcp
  data-site="mirror_site_public_id"
  data-manifest="/.well-known/mirror-webmcp.json"
></script>
```

The loader is about 18 KB uncompressed. It reads a same-origin manifest, joins the authenticated site session, and registers imperative Site Tools through `document.modelContext.registerTool()`. The site id is public configuration, not a credential.

Sites that own custom browser handlers can install the package directly:

```sh
npm install @mirror/webmcp-secure
```

## The four-step contract

1. Protect the private value before it enters agent context.
2. Bind the handle to origin, user, session, model, purpose, tools and lifetime.
3. Resolve it only inside the exact allowed Site Tool.
4. Return another private handle or the minimum approved result.

Every server endpoint must repeat authentication, authorization, schema, purpose, expiry and release checks. Browser registration is not a substitute for server enforcement.

## Run locally

Credential-free release checks:

```sh
npm ci
npm run release:check
```

Run the procurement site:

```sh
npm --prefix examples/private-procurement-vercel ci
npm --prefix examples/private-procurement-vercel run dev
```

An ordinary browser shows a local preview. A supported ChatGPT built-in browser registers the same four tools natively. The seller route fails closed if neither the protected Mirror endpoint nor the optional Vercel AI Gateway fallback is configured.

## Security boundary

The reference implementation rejects cross-session replay, modified handles, wrong tools, wrong purposes, unexpected fields and implicit private-result release. The browser bundle audit rejects SDK markers, Mirror WASM, source maps and secret names.

This layer assumes trusted same-origin page code. It does not protect a compromised device, malicious extension, stolen authenticated session, or compromised application server. Read [SECURITY.md](./SECURITY.md) before adapting it.

## Release status

The audited source repository and hosted reference application are public. The npm packages remain publish-locked until the final native ChatGPT acceptance test and owner approval are complete.

## License

Apache License 2.0, subject to final release approval.
