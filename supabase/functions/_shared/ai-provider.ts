/**
 * AI Provider abstraction — unified interface for therapy chat.
 *
 * The factory reads AI_PROVIDER env var ("openai" | "claude") and returns
 * the appropriate sendMessage implementation. Both providers share the same
 * RAG pipeline (OpenAI embeddings) and safety system.
 */

import {
  sendOpenAIMessage,
  type OpenAIResponseResult,
} from "./openai-responses.ts";
import {
  sendClaudeMessage,
  type ClaudeMessage,
  type ClaudeResponseResult,
} from "./claude-client.ts";
import { supabaseAdmin } from "./supabase-admin.ts";

// --- Unified types ---

export type AIProvider = "openai" | "claude";

export interface AIResponse {
  content: string;
  provider: AIProvider;
  providerId: string;       // response ID (OpenAI) or message ID (Claude)
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export interface SessionAIContext {
  sessionId: string;
  userId: string;
  previousResponseId?: string | null; // OpenAI only — from provider_state
}

// --- Provider detection ---

export function getProvider(): AIProvider {
  const env = (Deno.env.get("AI_PROVIDER") ?? "openai").toLowerCase();
  if (env === "claude") return "claude";
  return "openai";
}

// --- Conversation history loader (for Claude) ---

async function loadConversationHistory(
  sessionId: string
): Promise<ClaudeMessage[]> {
  const { data, error } = await supabaseAdmin
    .from("session_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load conversation history:", error.message);
    return [];
  }

  return (data ?? []).map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

// --- Unified send ---

export async function sendMessage(
  systemPrompt: string,
  userMessage: string,
  context: SessionAIContext,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<AIResponse> {
  const provider = getProvider();

  if (provider === "openai") {
    const result: OpenAIResponseResult = await sendOpenAIMessage(
      systemPrompt,
      userMessage,
      context.previousResponseId,
      options?.model ?? "gpt-4o",
      options?.temperature ?? 0.7
    );

    // Persist the new response ID for next turn
    await supabaseAdmin
      .from("therapy_sessions")
      .update({
        provider_state: { previous_response_id: result.responseId },
        last_active_at: new Date().toISOString(),
      })
      .eq("id", context.sessionId);

    return {
      content: result.content,
      provider: "openai",
      providerId: result.responseId,
      model: result.model,
      usage: result.usage,
    };
  }

  // Claude — rebuild history from DB
  const history = await loadConversationHistory(context.sessionId);

  const result: ClaudeResponseResult = await sendClaudeMessage(
    systemPrompt,
    userMessage,
    history,
    options?.model ?? "claude-sonnet-4-5",
    options?.temperature ?? 0.7,
    options?.maxTokens ?? 1024
  );

  await supabaseAdmin
    .from("therapy_sessions")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", context.sessionId);

  return {
    content: result.content,
    provider: "claude",
    providerId: result.messageId,
    model: result.model,
    usage: result.usage,
  };
}
