import {
  SITE_ID,
  applicationUserId,
  assertSameOrigin,
  newSession,
  readSession,
  sessionCookie
} from "../../../../lib/server-context.js";
import { proxyMirrorGateway } from "../../../../lib/mirror-gateway-proxy.js";
import { publicErrorResponse } from "../../../../lib/public-error.js";

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
      userId: applicationUserId(request),
      model: "user-controlled-agent"
    }, {
      headers: {
        "Cache-Control": "private, no-store",
        "Set-Cookie": sessionCookie(sessionId, { secure: new URL(origin).protocol === "https:" })
      }
    });
  } catch (error) {
    return publicErrorResponse(error, { stage: "session", status: 403 });
  }
}
