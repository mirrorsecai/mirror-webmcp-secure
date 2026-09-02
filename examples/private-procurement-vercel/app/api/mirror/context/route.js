import {
  DEMO_USER_ID,
  SITE_ID,
  assertSameOrigin,
  newSession,
  readSession,
  sessionCookie
} from "../../../../lib/server-context.js";
import { proxyMirrorGateway } from "../../../../lib/mirror-gateway-proxy.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const gateway = await proxyMirrorGateway(request);
    if (gateway) return gateway;
    const origin = assertSameOrigin(request);
    let sessionId;
    try {
      sessionId = readSession(request);
    } catch {
      sessionId = newSession();
    }
    return Response.json({
      schema: "mirror.webmcp.session.v1",
      siteId: SITE_ID,
      sessionId,
      userId: DEMO_USER_ID,
      model: "user-controlled-agent"
    }, {
      headers: {
        "Cache-Control": "private, no-store",
        "Set-Cookie": sessionCookie(sessionId, { secure: new URL(origin).protocol === "https:" })
      }
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Session bootstrap failed." }, { status: 403 });
  }
}
