# Using the site with a browser agent

WebMCP tools belong to the website. The agent discovers them when it opens the deployed page in a browser environment that supports imperative Site Tools.

## Site-owner steps

1. Deploy the page and all declared endpoints on one HTTPS origin.
2. Put the deployment origin in `allowedOrigins` in the manifest.
3. Authenticate the application user before issuing a private handle.
4. Load the public adapter with the matching site ID.
5. Verify that the page reports native WebMCP registration without errors.
6. Exercise every tool and approval boundary with test records before enabling production data.

## User flow

1. Sign in to the website normally.
2. Open the page through the compatible browser agent.
3. Enter private information directly into the website, not the chat.
4. Ask the agent to complete the task using the site's registered tools.
5. Review any approval prompt and approve only the exact intended release or action.

The agent should receive tool schemas, opaque handles, minimum status and approved results. It should not receive the underlying private record, application session cookie, service credential or unrestricted provider response.

## Verification

Check the browser event stream or application UI for:

- Native registration succeeded.
- Tools ran in the expected order.
- Sensitive release produced a user approval prompt.
- The final result omitted the protected fields.
- Replay or argument substitution failed.

This is a usage guide, not a recording script. It applies to any compatible browser agent. Feature support should be detected through the WebMCP API rather than inferred from a product version string.
