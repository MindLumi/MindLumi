/**
 * RAG pipeline — multi-query expansion + pgvector semantic search.
 *
 * Always uses OpenAI embeddings (text-embedding-3-small) regardless of
 * which AI provider handles the therapy chat.
 */

import { supabaseAdmin } from "./supabase-admin.ts";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EXPANSION_MODEL = "gpt-4o-mini";

// --- Embedding ---

export async function embedQuery(text: string): Promise<number[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

// --- Multi-query expansion ---

export async function expandQuery(query: string): Promise<string[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return [query];

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EXPANSION_MODEL,
        instructions:
          "Generate 3 alternative search queries for a therapy knowledge base. " +
          "Return ONLY the queries, one per line, no numbering.",
        input: [{ role: "user", content: query }],
        temperature: 0.8,
      }),
    });

    if (!res.ok) return [query];

    const data = await res.json();
    const outputMessage = data.output?.find(
      (item: { type: string }) => item.type === "message"
    );
    const text =
      outputMessage?.content
        ?.filter((c: { type: string }) => c.type === "output_text")
        .map((c: { text: string }) => c.text)
        .join("") ?? "";

    const alternatives = text
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    return [query, ...alternatives.slice(0, 3)];
  } catch {
    return [query];
  }
}

// --- Semantic search ---

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  content: string;
  similarity: number;
  documentTitle: string;
  documentModality: string[];
}

export async function searchKnowledgeBase(
  queryEmbedding: number[],
  options?: {
    threshold?: number;
    count?: number;
    modality?: string;
    language?: string;
  }
): Promise<KnowledgeChunk[]> {
  const { data, error } = await supabaseAdmin.rpc("search_knowledge_base", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: options?.threshold ?? 0.68,
    match_count: options?.count ?? 5,
    filter_modality: options?.modality ?? null,
    filter_language: options?.language ?? "en",
  });

  if (error) {
    console.error("Knowledge base search error:", error.message);
    return [];
  }

  return (data ?? []).map(
    (row: {
      id: string;
      document_id: string;
      content: string;
      similarity: number;
      document_title: string;
      document_modality: string[];
    }) => ({
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      similarity: row.similarity,
      documentTitle: row.document_title,
      documentModality: row.document_modality,
    })
  );
}

// --- Context builder ---

export function buildContextString(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return "";

  const sections = chunks.map(
    (c, i) =>
      `[Source ${i + 1}: ${c.documentTitle} (relevance: ${(c.similarity * 100).toFixed(0)}%)]\n${c.content}`
  );

  return (
    "\n\n--- Relevant Therapy Knowledge ---\n" +
    sections.join("\n\n") +
    "\n--- End Knowledge ---\n"
  );
}

// --- Full RAG pipeline ---

export async function retrieveTherapyContext(
  userMessage: string,
  options?: { modality?: string; language?: string }
): Promise<{ context: string; chunks: KnowledgeChunk[] }> {
  // 1. Expand the query
  const queries = await expandQuery(userMessage);

  // 2. Embed all queries
  const embeddings = await Promise.all(queries.map(embedQuery));

  // 3. Search for each embedding
  const allResults = await Promise.all(
    embeddings.map((emb) =>
      searchKnowledgeBase(emb, {
        modality: options?.modality,
        language: options?.language,
      })
    )
  );

  // 4. Deduplicate by chunk ID, keep highest similarity
  const seen = new Map<string, KnowledgeChunk>();
  for (const results of allResults) {
    for (const chunk of results) {
      const existing = seen.get(chunk.id);
      if (!existing || chunk.similarity > existing.similarity) {
        seen.set(chunk.id, chunk);
      }
    }
  }

  // 5. Sort by similarity descending, take top-k
  const chunks = Array.from(seen.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  return { context: buildContextString(chunks), chunks };
}
