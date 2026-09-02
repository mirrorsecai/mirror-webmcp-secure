# Compatibility

## Current support surface

| Component | Current contract |
| --- | --- |
| Protocol | `mirror.webmcp.*.v1` envelopes |
| Node.js | 20 or newer; CI runs Node.js 22 |
| Reference framework | Next.js 16 and React 19 |
| Native WebMCP | Feature-detected `registerTool()` model-context API |
| Ordinary browser | Supported through the reference page's local invocation controls |
| Hosting | Same-origin endpoints on any platform; Vercel reference and private Cloudflare hosted path documented |

The loader detects a usable model context rather than trusting a browser version string. If the native API is absent, the page remains usable for ordinary-browser integration testing but the external agent will not discover native Site Tools.

The current page API does not provide server-verifiable model identity. Do not authorize a tool based on the model name returned by browser state.

Protocol v1 is pre-1.0 software. Pin the repository commit or package release used by your application and review the changelog before upgrading.
