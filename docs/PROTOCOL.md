# Protocol v1

Mirror WebMCP Secure uses small same-origin JSON envelopes. The browser adapter performs transport and registration only. Authentication, private record resolution, authorization, approval and result release remain server responsibilities.

The complete machine-readable contract is [protocol-v1.schema.json](../schemas/protocol-v1.schema.json). A generic manifest is available in [example-site-manifest.json](../schemas/example-site-manifest.json).

## Request sequence

```text
GET  /.well-known/mirror-webmcp.json  load declared tools
GET  /api/mirror/context              join the first-party session
POST /api/mirror/approve              obtain exact-argument approval when required
POST /api/mirror/tool                 invoke one declared tool
```

All endpoint URLs declared in the manifest must resolve to the page origin. Cookies remain `HttpOnly`; the adapter does not accept a browser bearer token from the context response.

## Stable schema identifiers

| Envelope | Schema identifier |
| --- | --- |
| Site manifest | `mirror.webmcp.site_manifest.v1` |
| Session | `mirror.webmcp.session.v1` |
| Tool call | `mirror.webmcp.tool_call.v1` |
| Tool result | `mirror.webmcp.tool_result.v1` |
| Approval request | `mirror.webmcp.approval_request.v1` |
| Approval result | `mirror.webmcp.approval.v1` |
| Safe error | `mirror.webmcp.error.v1` |

## Safe errors

Endpoints should return a stable code, processing stage, optional request reference and retry hint. They must not return private values, handles, approval tokens, provider bodies or stack traces.

```json
{
  "schema": "mirror.webmcp.error.v1",
  "error": {
    "code": "protected_service_unavailable",
    "stage": "protected_inference",
    "requestId": "req_public_17",
    "retryable": true
  }
}
```

The loader throws `MirrorWebMcpRequestError`. Applications can inspect `code`, `stage`, `requestId`, `status` and `retryable`. The message is safe to display. A request reference is for correlation only and must not encode a user, session, private handle or secret.

Recommended stages are `manifest`, `session`, `approval`, `tool:<tool-name>`, `authorization`, `protected_inference`, `release` and `commit`.

## Compatibility

Protocol v1 rejects an unknown top-level schema and cross-origin endpoints. Add optional fields only when older v1 consumers can safely ignore them. Use a new schema identifier for a breaking envelope or security-semantic change.
