import { randomUUID } from "node:crypto";

export function publicErrorResponse(error, { stage, status = 400 } = {}) {
  const code = publicCode(error);
  const requestId = `req_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  return Response.json({
    schema: "mirror.webmcp.error.v1",
    error: {
      code,
      stage,
      requestId,
      retryable: ["protected_service_unavailable", "upstream_timeout"].includes(code)
    }
  }, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Request-ID": requestId
    }
  });
}

function publicCode(error) {
  const message = String(error instanceof Error ? error.message : "");
  if (/^[a-z0-9_.:-]{1,96}$/i.test(message)) return message;
  if (/context mismatch/i.test(message)) return "context_mismatch";
  if (/cross-origin|cross-site|unknown mirror site/i.test(message)) return "origin_denied";
  if (/session/i.test(message)) return "authentication_required";
  if (/expired/i.test(message)) return "expired";
  if (/approval/i.test(message)) return "approval_rejected";
  if (/timeout/i.test(message)) return "upstream_timeout";
  if (/encrypted seller failed|service unavailable/i.test(message)) return "protected_service_unavailable";
  if (/invalid|unexpected|missing|required|unsupported|not allowed/i.test(message)) return "invalid_request";
  return "request_rejected";
}
