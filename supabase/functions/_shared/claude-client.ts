/**
 * Anthropic Claude Messages API client for Lumi therapy chat.
 *
 * Claude is stateless — full conversation history is sent with each request.
 * History is rebuilt from session_messages in the database.
 */

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_API_VERSION = "2023-06-01";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResponseResult {
  messageId: string;
  content: string;
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
  stopReason?: string;
}

/**
 * Send a message via Claude Messages API.
 *
 * @param systemPrompt     - Dynamic system instructions
 * @param userMessage      - The current user message (may include RAG context)
 * @param conversationHistory - Prior messages from session_messages (oldest first)
 * @param model            - Model to use (default: claude-sonnet-4-5)
 * @param temperature      - Sampling temperature (default: 0.7)
 * @param maxTokens        - Max output tokens (default: 1024)
 */
export async function sendClaudeMessage(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: ClaudeMessage[] = [],
  model = "claude-sonnet-4-5",
  temperature = 0.7,
  maxTokens = 1024
): Promise<ClaudeResponseResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  // Build messages array: prior history + current user message
  const messages: ClaudeMessage[] = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": CLAUDE_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
      temperature,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude Messages API error (${res.status}): ${err}`);
  }

  const data = await res.json();

  const content =
    data.content
      ?.filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text)
      .join("") ?? "";

  return {
    messageId: data.id,
    content,
    model: data.model,
    usage: data.usage
      ? {
          input_tokens: data.usage.input_tokens,
          output_tokens: data.usage.output_tokens,
        }
      : undefined,
    stopReason: data.stop_reason,
  };
}
