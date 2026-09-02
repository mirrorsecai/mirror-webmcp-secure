# Authentication boundary

The reference application uses a fixed demo user so the public workflow is easy to inspect. A production site must replace it with the identity from its existing first-party application session.

## Required interface

Resolve the principal on the server for every context, protect, approval and tool request:

```js
export async function requireApplicationPrincipal(request) {
  const session = await yourApplicationSession(request);
  if (!session?.userId || !session?.sessionId) {
    throw new Error("authentication_required");
  }
  return {
    userId: session.userId,
    sessionId: session.sessionId
  };
}
```

Use the returned values when creating, resolving and revoking handles and when issuing or consuming approvals. The same principal must be checked again at the destination that performs the action.

## Do not trust

- A user identifier supplied in JSON tool arguments.
- A browser-controlled identity header sent directly to a public route.
- A handle as proof that the caller owns the underlying record.
- Agent text that claims the user approved an action.
- A session identifier without first-party authentication.

The Vercel to Mirror hosted path adds a signed `X-Mirror-Authenticated-User` header after Vercel has authenticated the application request. The private gateway accepts it only with the complete proxy signature. A public browser must never be allowed to mint that header as authority.

## Framework mapping

| Application stack | Integration point |
| --- | --- |
| Auth.js or NextAuth | Resolve the server session inside every route handler |
| Clerk | Resolve the authenticated server user and active session |
| Cloudflare Access | Validate the Access identity at the Worker, then bind it to durable state |
| Custom application session | Validate the signed, `HttpOnly`, same-site session cookie server-side |

Do not copy framework-specific examples without matching the framework version used by your application. The security requirement is stable: derive the principal from server-verified first-party state, never from tool arguments.
