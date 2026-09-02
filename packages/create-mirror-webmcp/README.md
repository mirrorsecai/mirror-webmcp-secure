# create-mirror-webmcp

Checked-in scaffolder for the Mirror WebMCP procurement reference site.

The generator is not published on npm yet. Run it from a clone of the public repository:

```sh
node packages/create-mirror-webmcp/bin/create-mirror-webmcp.mjs /tmp/my-private-site
cd /tmp/my-private-site
npm run check
npm run dev
```

The starter contains the public-safe loader, same-origin manifest, session bootstrap, private handles, narrow tool endpoints, approval boundaries, tests and a browser-bundle audit. It contains no private Mirror SDK or Mirror WASM.

This is a concrete procurement reference, not a universal application generator. Replace `applicationUserId`, the tool manifest, dispatch logic, private record and release policy for your use case. Read [site-owner integration](../../docs/SITE_OWNER_INTEGRATION.md) and [authentication](../../docs/AUTHENTICATION.md) first.

The command refuses to modify a non-empty directory and does not deploy, publish or initialize a remote repository.
