# Contributing

Use a focused pull request and explain the security boundary affected by the change.

## Before opening a pull request

```sh
npm ci --ignore-scripts
npm --prefix examples/private-procurement-vercel ci --ignore-scripts
npm run release:check
```

Do not commit credentials, environment files, provider responses, active handles, approval tokens, production records, private Mirror artifacts, WASM or source maps.

Changes to authentication, handle binding, approval consumption, origin checks, result release or the public export require corresponding failure tests. Browser code must remain a thin endpoint adapter.

Report security vulnerabilities privately as described in [SECURITY.md](./SECURITY.md), not through a public issue.
