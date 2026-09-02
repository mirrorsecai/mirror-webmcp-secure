# Public and private release boundary

## Included in the open-source submission

- Thin WebMCP adapter and TypeScript declarations.
- Next.js reference application and local server implementation.
- Tool manifest, schemas and bounded buyer-to-seller handoff.
- Starter generator.
- Tests, build checks, security notes and challenge narrative.

## Excluded from the public export

- `private-runtime/` in full.
- Mirror SDK, Mirror client artifacts and WASM.
- Tokenizers and model-routing implementation.
- Cloudflare enforcement Worker source.
- Credentials, environment files and Vercel metadata.
- Source maps, local paths, Git history and internal evidence.

The export script copies an explicit allow-list into a new empty directory and fails if it finds a private credential pattern, local user path, protected client class, protected client method or Mirror FHE artifact marker.

## Security consequence

Anyone can inspect the public adapter and reference application. That is expected. They cannot derive a production key, invoke a private capability, open another session's handle, or bypass server authorization from those files alone.
