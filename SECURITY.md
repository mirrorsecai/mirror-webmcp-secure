# Security boundary

Mirror WebMCP Secure reduces the private data that an agent and its tools receive. It does not turn an untrusted browser or application into a trusted environment.

## Protected by this layer

- Private values can be replaced with authenticated opaque handles before entering agent context.
- Handles are bound to their intended origin, session, user, model, purpose, allowed tools, and lifetime.
- A handler must satisfy the binding before resolving a value.
- Sensitive release can require an application-owned approval step.
- Evidence records contain bounded event facts rather than protected values.

## Application responsibilities

- Authenticate the current user and session.
- Authorize every underlying business action.
- Use narrow JSON schemas and validate all arguments.
- Keep provider credentials, decryption keys, and privileged execution on the server when they must remain secret.
- Apply CSP, dependency review, output encoding, and ordinary web security controls.
- Treat tool content as untrusted and defend against semantic prompt injection.

## Explicit non-goals

This package does not protect against compromised same-origin JavaScript, a malicious browser extension, device compromise, operating-system compromise, or a malicious application backend. Anything delivered to a browser, including JavaScript and WASM, can be downloaded and inspected. A private repository controls source distribution; it does not make shipped browser code secret.

Report suspected issues privately to the Mirror Security team. Do not open a public issue while the repository remains private.
