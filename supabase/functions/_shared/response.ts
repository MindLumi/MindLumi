import { getCorsHeaders, corsHeaders } from "./cors.ts";

export function successResponse(data: unknown, status = 200, req?: Request): Response {
  const headers = req ? getCorsHeaders(req) : corsHeaders;
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export function errorResponse(
  message: string,
  status = 400,
  details?: unknown,
  req?: Request
): Response {
  const headers = req ? getCorsHeaders(req) : corsHeaders;
  return new Response(
    JSON.stringify({ success: false, error: message, details }),
    {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    }
  );
}
