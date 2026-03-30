/**
 * OpenAI Responses API client for Lumi therapy chat.
 *
 * Uses POST /v1/responses with `previous_response_id` for multi-turn
 * conversation continuity — replaces the deprecated Assistants API.
 */

const OPENAI_API_URL = "https://api.openai.com/v1/responses";

export interface OpenAIResponseResult {
  responseId: string;
  content: string;
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * Send a message via OpenAI Responses API.
 *
 * @param systemPrompt  - Dynamic system instructions (modality, language, safety)
 * @param userMessage   - The user's message (may include RAG context appended)
 * @param previousResponseId - For multi-turn: the last response ID from this session
 * @param model         - Model to use (default: gpt-4o)
 * @param temperature   - Sampling temperature (default: 0.7)
 */
export async function sendOpenAIMessage(
  systemPrompt: string,
  userMessage: string,
  previousResponseId?: string | null,
  model = "gpt-4o",
  temperature = 0.7
): Promise<OpenAIResponseResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const body: Record<string, unknown> = {
    model,
    instructions: systemPrompt,
    input: [
      { role: "user", content: userMessage },
    ],
    temperature,
  };

  if (previousResponseId) {
    body.previous_response_id = previousResponseId;
  }

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI Responses API error (${res.status}): ${err}`);
  }

  const data = await res.json();

  // Extract the assistant text from the output items
  const outputMessage = data.output?.find(
    (item: { type: string }) => item.type === "message"
  );
  const content =
    outputMessage?.content
      ?.filter((c: { type: string }) => c.type === "output_text")
      .map((c: { text: string }) => c.text)
      .join("") ?? "";

  return {
    responseId: data.id,
    content,
    model: data.model,
    usage: data.usage
      ? {
          input_tokens: data.usage.input_tokens,
          output_tokens: data.usage.output_tokens,
        }
      : undefined,
  };
}
