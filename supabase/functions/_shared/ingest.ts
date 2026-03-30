/**
 * Knowledge base ingestion pipeline.
 *
 * Chunks documents → embeds with OpenAI text-embedding-3-small → stores in pgvector.
 * Always uses OpenAI for embeddings regardless of chat provider.
 */

import { supabaseAdmin } from "./supabase-admin.ts";
import { embedQuery } from "./rag-pipeline.ts";

const TARGET_CHUNK_TOKENS = 400;
const CHUNK_OVERLAP_TOKENS = 50;
const BATCH_SIZE = 50;

// --- Text chunking ---

export function chunkText(
  text: string,
  targetTokens = TARGET_CHUNK_TOKENS,
  overlapTokens = CHUNK_OVERLAP_TOKENS
): string[] {
  // Approximate tokens as words * 1.3
  const words = text.split(/\s+/);
  const targetWords = Math.floor(targetTokens / 1.3);
  const overlapWords = Math.floor(overlapTokens / 1.3);

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + targetWords, words.length);
    const chunk = words.slice(start, end).join(" ").trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    start = end - overlapWords;
    if (start >= words.length - overlapWords) break;
  }

  return chunks;
}

// --- Batch embed ---

export async function batchEmbed(texts: string[]): Promise<number[][]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: batch,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Batch embedding error (${res.status}): ${err}`);
    }

    const data = await res.json();
    for (const item of data.data) {
      results.push(item.embedding);
    }

    // Rate limiting pause between batches
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}

// --- Full ingestion pipeline ---

export async function ingestDocument(params: {
  title: string;
  content: string;
  contentType?: string;
  modality?: string[];
  language?: string;
  tags?: string[];
  sourceUrl?: string;
}): Promise<{ documentId: string; chunksCreated: number }> {
  // 1. Insert document record
  const { data: doc, error: docError } = await supabaseAdmin
    .from("knowledge_documents")
    .insert({
      title: params.title,
      content_type: params.contentType ?? "article",
      modality: params.modality ?? [],
      language: params.language ?? "en",
      tags: params.tags ?? [],
      source_url: params.sourceUrl ?? null,
    })
    .select("id")
    .single();

  if (docError || !doc) {
    throw new Error(`Failed to create document: ${docError?.message}`);
  }

  // 2. Chunk text
  const chunks = chunkText(params.content);
  if (chunks.length === 0) {
    return { documentId: doc.id, chunksCreated: 0 };
  }

  // 3. Embed all chunks
  const embeddings = await batchEmbed(chunks);

  // 4. Insert chunks with embeddings
  const rows = chunks.map((content, i) => ({
    document_id: doc.id,
    chunk_index: i,
    content,
    content_language: params.language ?? "en",
    embedding: JSON.stringify(embeddings[i]),
    token_count: Math.ceil(content.split(/\s+/).length * 1.3),
  }));

  const { error: chunkError } = await supabaseAdmin
    .from("knowledge_chunks")
    .insert(rows);

  if (chunkError) {
    throw new Error(`Failed to insert chunks: ${chunkError.message}`);
  }

  return { documentId: doc.id, chunksCreated: chunks.length };
}
