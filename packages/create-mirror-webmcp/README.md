# create-mirror-webmcp

Private release-candidate scaffolder for a Mirror-protected WebMCP website.

```sh
npx create-mirror-webmcp my-private-site
```

During private testing, run the checked-out command directly:

```sh
node packages/create-mirror-webmcp/bin/create-mirror-webmcp.mjs /tmp/my-private-site
```

The starter contains the public-safe loader, same-origin manifest, session bootstrap, authenticated private handles, narrow tool endpoints, approval boundaries, tests and a browser-bundle audit. It contains no private Mirror SDK or Mirror WASM.

The command refuses to modify a non-empty directory and does not deploy, publish or initialize a remote repository.
