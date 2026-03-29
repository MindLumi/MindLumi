import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { successResponse, errorResponse } from "../_shared/response.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import {
  sendMessage,
  getProvider,
  type SessionAIContext,
} from "../_shared/ai-provider.ts";
import { retrieveTherapyContext } from "../_shared/rag-pipeline.ts";
import { buildSystemPrompt, type PromptContext } from "../_shared/prompt-builder.ts";
import {
  assessSafety,
  buildCrisisResponse,
  logSafetyEvent,
} from "../_shared/safety-guard.ts";

Deno.serve(async (req: Request) => {
  // CORS preflight
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    // Auth
    const { user } = await authenticateRequest(req);

    // Parse body
    const { session_id, message } = await req.json();
    if (!session_id || !message) {
      return errorResponse("session_id and message are required");
    }

    // Load session
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from("therapy_sessions")
      .select("*")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .single();

    if (sessionErr || !session) {
      return errorResponse("Session not found", 404);
    }

    if (session.status !== "active") {
      return errorResponse("Session is not active", 400);
    }

    // ---- Safety check (runs BEFORE any AI call) ----
    const safety = assessSafety(message);

    // Load user profile for language preference
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("preferred_language, display_name, primary_concerns")
      .eq("id", user.id)
      .single();

    const language = profile?.preferred_language ?? "en";

    // Store the user message
    const { data: userMsg } = await supabaseAdmin
      .from("session_messages")
      .insert({
        session_id,
        user_id: user.id,
        role: "user",
        content: message,
        content_language: language,
        safety_score: safety.level,
        crisis_keywords: safety.keywords,
        safety_response_triggered: safety.requiresCrisisResponse,
      })
      .select("id")
      .single();

    // Log safety event if level > 0
    if (safety.level > 0) {
      await logSafetyEvent({
        userId: user.id,
        sessionId: session_id,
        messageId: userMsg?.id,
        level: safety.level,
        keywords: safety.keywords,
        triggerContent: message,
        responseAction:
          safety.level >= 2 ? "crisis_response" : "increased_warmth",
      });
    }

    // Update session safety level if escalated
    if (safety.level > session.safety_level) {
      await supabaseAdmin
        .from("therapy_sessions")
        .update({
          safety_level: safety.level,
          crisis_detected: safety.level >= 2,
          crisis_handled_at:
            safety.level >= 2 ? new Date().toISOString() : null,
        })
        .eq("id", session_id);
    }

    // ---- Crisis response (no AI) ----
    if (safety.requiresCrisisResponse) {
      const crisisContent = buildCrisisResponse(language);

      await supabaseAdmin.from("session_messages").insert({
        session_id,
        user_id: user.id,
        role: "assistant",
        content: crisisContent,
        content_language: language,
        safety_score: safety.level,
        safety_response_triggered: true,
      });

      await supabaseAdmin
        .from("therapy_sessions")
        .update({ message_count: (session.message_count ?? 0) + 2 })
        .eq("id", session_id);

      return successResponse({
        reply: crisisContent,
        safety_level: safety.level,
        crisis_response: true,
      });
    }

    // ---- RAG context retrieval ----
    const { context: ragContext, chunks } = await retrieveTherapyContext(
      message,
      { modality: session.modality, language }
    );

    // Build user message with RAG context appended
    const enrichedMessage = ragContext
      ? `${message}${ragContext}`
      : message;

    // ---- Build system prompt ----
    const promptCtx: PromptContext = {
      modality: session.modality ?? "mixed",
      language,
      safetyLevel: safety.level,
      userName: profile?.display_name ?? undefined,
      sessionGoal: session.session_goal ?? undefined,
      primaryConcerns: profile?.primary_concerns ?? undefined,
      keyThemes: session.key_themes ?? undefined,
    };
    const systemPrompt = buildSystemPrompt(promptCtx);

    // ---- Call AI provider ----
    const aiContext: SessionAIContext = {
      sessionId: session_id,
      userId: user.id,
      previousResponseId:
        session.provider_state?.previous_response_id ?? null,
    };

    const aiResponse = await sendMessage(
      systemPrompt,
      enrichedMessage,
      aiContext
    );

    // ---- Store assistant message ----
    await supabaseAdmin.from("session_messages").insert({
      session_id,
      user_id: user.id,
      role: "assistant",
      content: aiResponse.content,
      content_language: language,
      provider_message_id: aiResponse.providerId,
      rag_chunks_used: chunks.length,
      knowledge_sources: chunks.map((c) => c.documentTitle),
    });

    // Update message count
    await supabaseAdmin
      .from("therapy_sessions")
      .update({ message_count: (session.message_count ?? 0) + 2 })
      .eq("id", session_id);

    return successResponse({
      reply: aiResponse.content,
      provider: aiResponse.provider,
      model: aiResponse.model,
      safety_level: safety.level,
      rag_sources: chunks.length,
    });
  } catch (err) {
    console.error("Chat function error:", (err as Error).message);
    return errorResponse("Internal error", 500);
  }
});
