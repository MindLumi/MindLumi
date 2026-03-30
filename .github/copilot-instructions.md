# Copilot Instructions — Lumi

## What is Lumi

Lumi is an AI therapy coaching platform providing evidence-based psychological support (CBT, DBT, ACT, mindfulness, somatic, IFS, narrative). It is **not** a replacement for licensed therapy — this distinction must be maintained in all user-facing text.

**Read `Skill.md`** at the repo root before making significant changes. It is the comprehensive development reference covering schema, API contracts, prompt engineering, and safety protocols.

## Architecture

```
React/Next.js frontend
  → Supabase Edge Functions (Deno/TypeScript)
    → OpenAI Assistants API (one thread per therapy session)
    → pgvector RAG (text-embedding-3-small, 1536 dims, HNSW index)
    → PostgreSQL (Supabase-managed, RLS on all user-facing tables)
```

- **Edge Functions** (`supabase/functions/`): `chat/`, `session/`, `mood/`, `admin/`
- **Shared code** (`supabase/functions/_shared/`): `cors.ts`, `auth.ts`, `response.ts`, `supabase-admin.ts`, `openai-client.ts`, `rag-pipeline.ts`, `prompt-builder.ts`, `safety-guard.ts`, `ingest.ts`
- **Frontend**: React/Next.js with Supabase Auth (JWT), `callEdgeFunction()` helper for all API calls

## Safety System — Non-Negotiable

Every chat message passes through a tiered safety check before AI processing:

| Level | Meaning | Action |
|-------|---------|--------|
| 0 | Normal | Proceed with coaching |
| 1 | Mild distress | Increase warmth, log event |
| 2 | Moderate crisis | Send crisis resources, pause coaching, log event |
| 3 | Acute crisis | Crisis response only, no coaching, escalate |

**Rules:**
- Never remove or weaken safety checks in `safety-guard.ts`
- Safety events are always logged to `safety_events` table
- At level ≥ 2, the system returns a hardcoded crisis response — the AI assistant is **not** called
- Crisis keywords exist in both English and Arabic

## Key Commands

```bash
# Local development
supabase start                              # Start local Supabase
supabase db reset                           # Apply all migrations fresh
supabase functions serve --env-file .env.local  # Serve edge functions locally

# Deploy
supabase functions deploy                   # Deploy all edge functions
supabase functions deploy chat              # Deploy single function
supabase db push --project-ref <ref>        # Push migrations to production
supabase secrets set KEY=value --project-ref <ref>  # Set production secrets

# Logs
supabase functions logs chat --project-ref <ref>

# Setup scripts (Deno)
deno run --allow-env --allow-net scripts/setup.ts
deno run --allow-env --allow-net scripts/seed-knowledge-base.ts
```

## Conventions

### Edge Functions
- Every edge function starts with CORS handling (`handleCors`), then JWT auth (`authenticateRequest`)
- Use `successResponse()` / `errorResponse()` from `_shared/response.ts` — never construct raw `Response` objects
- Use `supabaseAdmin` (service role) for DB operations in edge functions, not the per-user client
- Action-based routing via `?action=` query parameter (not separate endpoints)

### Database
- All user-facing tables have RLS enabled — users can only access their own data
- Use `uuid_generate_v4()` for primary keys
- Timestamps are `TIMESTAMPTZ DEFAULT NOW()`
- Arrays (`TEXT[]`) for multi-value fields: `primary_concerns`, `key_themes`, `modality`, `stress_triggers`
- The `knowledge_chunks.embedding` column is `VECTOR(1536)` with an HNSW index using `vector_cosine_ops`

### RAG Pipeline
1. Multi-query expansion via `gpt-4o-mini` (generates 3 alternative search queries)
2. Embed each query with `text-embedding-3-small`
3. Search via `search_knowledge_base()` RPC (pgvector cosine similarity, threshold ~0.68)
4. Deduplicate chunks across queries, sort by similarity
5. Inject top-k chunks into the user message sent to the OpenAI thread

### AI / Prompts
- One OpenAI Assistants API thread per `therapy_session` — stored in `openai_thread_id`
- System prompt is built dynamically per request via `buildSystemPrompt()` based on modality, language, safety level, and user context
- Modality-specific prompt templates are in `MODALITY_PROMPTS` map in `prompt-builder.ts`
- RAG context is appended to the user message, not the system prompt

### Privacy & Logging
- **Never log therapy message content** to application logs — only structured metadata
- Safety event `trigger_content` is truncated to 200 chars
- Use the structured logger from `_shared/logger.ts`

### Bilingual Support
- Primary languages: English (`en`) and Arabic (`ar`)
- Language preference stored in `user_profiles.preferred_language`
- Knowledge base is filtered by language during RAG; falls back to English if no content in target language
- Arabic content requires cultural adaptation (collectivist values, spiritual wellbeing, dialect awareness)

## Environment Variables

```
OPENAI_API_KEY              — OpenAI access (edge functions)
SUPABASE_URL                — Auto-available in edge functions
SUPABASE_ANON_KEY           — Public frontend key
SUPABASE_SERVICE_ROLE_KEY   — Admin access in edge functions
ADMIN_SECRET_KEY            — Protects /admin endpoints (x-admin-key header)
NEXT_PUBLIC_SUPABASE_URL    — Frontend env
NEXT_PUBLIC_SUPABASE_ANON_KEY — Frontend env
```
