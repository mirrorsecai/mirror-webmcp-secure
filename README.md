# Mirror WebMCP Secure

Give a browser agent the authority to use private website data without copying that data into agent chat or ordinary tool transcripts.

WebMCP tells an agent what a website can do. Mirror controls what each action may receive and what result may leave.

## The problem

A useful Site Tool may need a budget, account record, health history, legal playbook, private benchmark, or seller policy. Putting that record in the tool arguments gives the agent more data than it needs and expands the disclosure boundary.

Mirror replaces the private record with a short-lived handle. The handle is bound to the website, authenticated user, session, purpose, permitted tool and expiry. The agent can plan and chain tools with the handle, while the website performs the private operation behind its own boundary.

## Live reference application

The procurement example gives a buyer agent and a seller agent enough information to reach an offer without giving either side the other's private policy.

```text
Buyer enters private requirements into the website
                         |
                         v
Website returns an opaque, bound handle
                         |
                         v
ChatGPT calls procurement.find_private_matches
                         |
                         v
Website returns a private match handle
                         |
                         v
ChatGPT calls procurement.request_seller_proposal
                         |
                         v
Seller receives only eligible SKUs, quantity and delivery window
                         |
                         v
Buyer approves one offer; private fields and seller rules stay private
```

Try the current reference application at <https://mirror-webmcp-secure.vercel.app/>.

The WebMCP privacy pattern does not depend on a particular model. A Site Tool can call deterministic application logic, a Vercel AI SDK agent, a Cloudflare Agent, or a protected Mirror service. The hosted demonstration can additionally route the bounded seller request through encrypted inference, but that is a second protection layer rather than the reason WebMCP is useful.

## What this repository will publish

- An under 6 KB browser adapter that reads a same-origin manifest and registers imperative Site Tools.
- A complete Next.js reference application with four tools, server-bound handles and approval gates.
- A `create-mirror-webmcp` generator for a private-by-default starter.
- Unit, endpoint, build, browser-boundary and adversarial tests.
- Architecture and site-owner integration guides.
- The challenge description.

The public adapter contains no handle cryptography, Mirror SDK, FHE client, WASM, model credential, decryption key, seller policy or privileged receipt implementation. The complete reference app remains runnable from the published source with its local server implementation; optional hosted Mirror capabilities are reached through narrow server endpoints.

## Add it to an existing website

Serve the reviewed adapter from your own origin:

```html
<script
  defer
  src="/mirror-webmcp-v1.js"
  data-mirror-webmcp
  data-site="mirror_site_public_id"
  data-manifest="/.well-known/mirror-webmcp.json">
</script>
```

The adapter performs four jobs:

1. Read the site's same-origin tool manifest.
2. Join the site's authenticated browser session.
3. Register the declared tools with `document.modelContext.registerTool()`.
4. Send each call to its same-origin endpoint and return only the endpoint's declared result.

All sensitive work remains behind those endpoints. A site identifier selects public configuration and is never treated as a credential.

## Create a new site

After publication:

```sh
npx create-mirror-webmcp my-private-site
cd my-private-site
npm run check
npm run dev
```

Before publication, the checked-out generator can be tested directly:

```sh
node packages/create-mirror-webmcp/bin/create-mirror-webmcp.mjs /tmp/my-private-site
```

## Run the release gates

```sh
npm ci
npm --prefix examples/private-procurement-vercel ci
npm run release:check
```

An ordinary browser uses the same endpoint flow for local QA. A supported ChatGPT built-in browser discovers the four tools natively.

## Security boundary

Every server endpoint must repeat authentication, authorization, exact-schema, purpose, tool, expiry and release checks. Sensitive tools obtain a short-lived approval token bound to their exact arguments. The private Cloudflare deployment additionally stores handles server-side and consumes approvals atomically in a per-session Durable Object.

The browser adapter improves the agent boundary. It does not replace application authentication, CSP, device security, output validation or semantic prompt-injection defenses. Read [SECURITY.md](./SECURITY.md) before adapting the reference implementation.

## Release status

The work tree, packages and new Cloudflare enforcement service remain private. Publication, deployment changes and the final Devpost submission require owner approval.

## License

Apache License 2.0, subject to final release approval.
