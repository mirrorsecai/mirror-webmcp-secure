# Troubleshooting

The loader reports safe diagnostics without including private arguments, handles, approval tokens or provider responses.

## Read a failure

`MirrorWebMcpRequestError` provides:

- `stage`: which boundary failed.
- `code`: a stable machine-readable reason.
- `requestId`: an optional non-secret correlation reference.
- `status`: the HTTP status.
- `retryable`: whether a later retry may succeed.

The loader also emits `mirror:webmcp-error` for startup failures and `mirror:webmcp-call` for each tool invocation. Failed call events contain the same safe diagnostic fields.

## Common failures

| Symptom | Meaning | Check |
| --- | --- | --- |
| `manifest` failure | The tool declaration could not be loaded or validated | Site ID, schema, allowed origin and same-origin URLs |
| `session` failure | The browser did not join an authenticated first-party session | Cookies, origin checks and application login |
| `approval` failure | User consent or the bound approval token failed | Exact arguments, expiry, user and session |
| `tool:<name>` with `http_400` | The endpoint returned no stable public code | Server validation logs using a safe request reference |
| `protected_inference` unavailable | The protected model route did not complete | Hosted endpoint configuration, deadline and service health |
| Native tools are absent | The browser does not expose the current WebMCP registration API | Use local preview or a supported WebMCP client |

## Safe browser logging

```js
addEventListener("mirror:webmcp-call", (event) => {
  const { tool, state, code, stage, requestId, retryable } = event.detail;
  console.info({ tool, state, code, stage, requestId, retryable });
});
```

Do not add arguments, raw result bodies, handles, approval tokens, session cookies or provider envelopes to browser telemetry.

## Reporting a security issue

Follow [SECURITY.md](../SECURITY.md). Do not attach a private record, active token, raw handle or production provider response to a public issue.
