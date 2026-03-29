import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors } from "../_shared/cors.ts";
import { authenticateRequest, isValidUUID } from "../_shared/auth.ts";
import { successResponse, errorResponse } from "../_shared/response.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { getProvider } from "../_shared/ai-provider.ts";

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const { user } = await authenticateRequest(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "create";

    // ---- CREATE session ----
    if (action === "create") {
      const body = await req.json();
      const { modality, session_goal, initial_mood_score } = body;

      const { data: session, error } = await supabaseAdmin
        .from("therapy_sessions")
        .insert({
          user_id: user.id,
          ai_provider: getProvider(),
          modality: modality ?? "CBT",
          session_goal: session_goal ?? null,
          initial_mood_score: initial_mood_score ?? null,
        })
        .select("*")
        .single();

      if (error) return errorResponse(error.message, 500);
      return successResponse(session, 201);
    }

    // ---- LIST sessions ----
    if (action === "list") {
      const status = url.searchParams.get("status"); // optional filter
      let query = supabaseAdmin
        .from("therapy_sessions")
        .select("id, title, status, modality, ai_provider, message_count, started_at, last_active_at, completed_at")
        .eq("user_id", user.id)
        .order("last_active_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) return errorResponse(error.message, 500);
      return successResponse(data);
    }

    // ---- GET session detail ----
    if (action === "get") {
      const sessionId = url.searchParams.get("session_id");
      if (!isValidUUID(sessionId)) return errorResponse("Valid session_id required");

      const { data, error } = await supabaseAdmin
        .from("therapy_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .single();

      if (error) return errorResponse("Session not found", 404);
      return successResponse(data);
    }

    // ---- GET MESSAGES for a session ----
    if (action === "get-messages") {
      const sessionId = url.searchParams.get("session_id");
      if (!isValidUUID(sessionId)) return errorResponse("Valid session_id required");

      // Verify ownership
      const { data: session } = await supabaseAdmin
        .from("therapy_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .single();

      if (!session) return errorResponse("Session not found", 404);

      const { data, error } = await supabaseAdmin
        .from("session_messages")
        .select("id, role, content, content_language, safety_score, technique_used, emotion_detected, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) return errorResponse(error.message, 500);
      return successResponse(data);
    }

    // ---- COMPLETE session ----
    if (action === "complete") {
      const body = await req.json();
      const { session_id, final_mood_score } = body;
      if (!isValidUUID(session_id)) return errorResponse("Valid session_id required");

      const now = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from("therapy_sessions")
        .update({
          status: "completed",
          final_mood_score: final_mood_score ?? null,
          completed_at: now,
        })
        .eq("id", session_id)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (error) return errorResponse("Session not found", 404);
      return successResponse(data);
    }

    return errorResponse(`Unknown action: ${action}`, 400);
  } catch (err) {
    console.error("Session function error:", (err as Error).message);
    return errorResponse("Internal error", 500);
  }
});
