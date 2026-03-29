import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/response.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { ingestDocument } from "../_shared/ingest.ts";

function verifyAdminKey(req: Request): boolean {
  const adminKey = req.headers.get("x-admin-key") ?? "";
  const expected = Deno.env.get("ADMIN_SECRET_KEY") ?? "";
  if (!adminKey || !expected || adminKey.length !== expected.length) return false;
  // Timing-safe comparison
  const encoder = new TextEncoder();
  const a = encoder.encode(adminKey);
  const b = encoder.encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  if (!verifyAdminKey(req)) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "ingest";

    // ---- INGEST document ----
    if (action === "ingest") {
      const body = await req.json();
      const { title, content, content_type, modality, language, tags, source_url } = body;

      if (!title || !content) {
        return errorResponse("title and content are required");
      }

      const result = await ingestDocument({
        title,
        content,
        contentType: content_type,
        modality,
        language,
        tags,
        sourceUrl: source_url,
      });

      return successResponse(result, 201);
    }

    // ---- LIST safety events ----
    if (action === "safety-events") {
      const reviewed = url.searchParams.get("reviewed");
      const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50"), 1), 200);

      let query = supabaseAdmin
        .from("safety_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (reviewed === "false") {
        query = query.eq("reviewed", false);
      }

      const { data, error } = await query;
      if (error) return errorResponse(error.message, 500);
      return successResponse(data);
    }

    // ---- REVIEW safety event ----
    if (action === "review-safety-event") {
      const body = await req.json();
      const { event_id, reviewer_notes, escalated_to_human } = body;
      if (!event_id) return errorResponse("event_id required");

      const { data, error } = await supabaseAdmin
        .from("safety_events")
        .update({
          reviewed: true,
          reviewer_notes: reviewer_notes ?? null,
          escalated_to_human: escalated_to_human ?? false,
        })
        .eq("id", event_id)
        .select("*")
        .single();

      if (error) return errorResponse(error.message, 500);
      return successResponse(data);
    }

    // ---- LIST knowledge documents ----
    if (action === "list-documents") {
      const { data, error } = await supabaseAdmin
        .from("knowledge_documents")
        .select("id, title, content_type, modality, language, tags, is_active, created_at")
        .order("created_at", { ascending: false });

      if (error) return errorResponse(error.message, 500);
      return successResponse(data);
    }

    // ---- TOGGLE document active status ----
    if (action === "toggle-document") {
      const body = await req.json();
      const { document_id, is_active } = body;
      if (!document_id) return errorResponse("document_id required");

      const { data, error } = await supabaseAdmin
        .from("knowledge_documents")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", document_id)
        .select("*")
        .single();

      if (error) return errorResponse(error.message, 500);
      return successResponse(data);
    }

    return errorResponse(`Unknown action: ${action}`, 400);
  } catch (err) {
    console.error("Admin function error:", (err as Error).message);
    return errorResponse("Internal error", 500);
  }
});
