# Lumi

**AI therapy coaching platform** providing evidence-based psychological support through CBT, DBT, ACT, mindfulness, somatic, IFS, and narrative modalities.

> ⚠️ **Lumi is an AI coaching tool, not a replacement for licensed therapy.** If you or someone you know is in crisis, please contact your local emergency services or a crisis hotline.

**Test Console:** [lumi-ui-rho.vercel.app](https://lumi-ui-rho.vercel.app)

---

## Repository Map

| Repo | Role | Status |
|------|------|--------|
| [`MindLumi/MindLumi`](https://github.com/MindLumi/MindLumi) (this repo) | **Backend** — edge functions, schema, RAG, safety, AI providers | Canonical |
| [`MindLumi/lumi-bece0d49`](https://github.com/MindLumi/lumi-bece0d49) | **Frontend** — React/Vite + shadcn, auth, chat UI, mood, Circle, narrative | Canonical (to be renamed `lumi-app`) |

> **Schema ownership:** This repo is the single source of truth for all database migrations. Frontend repos consume the schema — they do not redeclare tables. To propose a schema change, open a PR here.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        LumiUI (Vercel)                          │
│              React test console / Future Next.js app             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS + JWT
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Supabase Edge Functions (Deno)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  chat/   │  │ session/ │  │  mood/   │  │  admin/  │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │              │              │              │             │
│  ┌────┴──────────────┴──────────────┴──────────────┴───────┐    │
│  │                    _shared/ modules                      │    │
│  │  ai-provider.ts ─── openai-responses.ts                  │    │
│  │                 └── claude-client.ts                      │    │
│  │  safety-guard.ts   rag-pipeline.ts   prompt-builder.ts   │    │
│  │  auth.ts   cors.ts   response.ts   ingest.ts            │    │
│  │  supabase-admin.ts                                       │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────┬──────────────┬───────────────┬───────────────────────┘
           │              │               │
           ▼              ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│   OpenAI     │  │  Anthropic   │  │   Supabase       │
│  Responses   │  │   Claude     │  │   PostgreSQL     │
│  API         │  │  Messages    │  │  + pgvector      │
│  + Embeddings│  │   API        │  │  + Auth + RLS    │
└──────────────┘  └──────────────┘  └──────────────────┘
```

## Project Structure

```
MindLumi/
├── .env.example                    # Environment template
├── .gitignore
├── LICENSE
├── README.md                       # This file
├── Skill.md                        # Comprehensive dev reference (3000+ lines)
├── lumi-ui/                        # LumiUI test console
│   ├── public/index.html           # Single-page test app
│   ├── package.json
│   └── vercel.json
├── knowledgebase/                   # Source documents for RAG
├── supabase/
│   ├── config.toml
│   ├── migrations/                  # 11 PostgreSQL migrations
│   │   ├── 20240101000000_extensions.sql
│   │   ├── 20240101000001_user_profiles.sql
│   │   ├── 20240101000002_therapy_sessions.sql
│   │   ├── 20240101000003_session_messages.sql
│   │   ├── 20240101000004_mood_journal.sql
│   │   ├── 20240101000005_progress_tracking.sql
│   │   ├── 20240101000006_knowledge_base.sql
│   │   ├── 20240101000007_assistant_config.sql
│   │   ├── 20240101000008_safety_events.sql
│   │   ├── 20240101000009_rls_policies.sql
│   │   └── 20240101000010_rls_hardening.sql
│   └── functions/
│       ├── _shared/                 # Shared modules
│       │   ├── ai-provider.ts       # Dual-provider abstraction
│       │   ├── openai-responses.ts  # OpenAI Responses API client
│       │   ├── claude-client.ts     # Claude Messages API client
│       │   ├── rag-pipeline.ts      # Multi-query RAG with pgvector
│       │   ├── prompt-builder.ts    # Dynamic system prompt
│       │   ├── safety-guard.ts      # Tiered crisis detection
│       │   ├── auth.ts              # JWT auth + UUID validation
│       │   ├── cors.ts              # Origin-allowlist CORS
│       │   ├── response.ts          # JSON response helpers
│       │   ├── ingest.ts            # Document chunking + embedding
│       │   └── supabase-admin.ts    # Service role client
│       ├── chat/index.ts            # Main therapy chat
│       ├── session/index.ts         # Session lifecycle
│       ├── mood/index.ts            # Mood tracking
│       └── admin/index.ts           # Admin endpoints
└── test-app.html                    # Local test file (gitignored)
```

## Key Features

### Dual AI Provider Support

- **OpenAI Responses API** — uses `previous_response_id` for efficient multi-turn conversations
- **Anthropic Claude Messages API** — stateless, rebuilds full history from DB each request
- Runtime switchable via `AI_PROVIDER` env var (`"openai"` | `"claude"`)
- Provider abstraction in `ai-provider.ts` — unified `sendMessage()` interface

### RAG (Retrieval-Augmented Generation)

- OpenAI embeddings (`text-embedding-3-small`, 1536 dimensions) — used regardless of chat provider
- pgvector with HNSW index (cosine similarity, threshold ~0.68)
- Multi-query expansion via `gpt-4o-mini` (generates 3 alternative search queries)
- Deduplication across queries, top-k chunk injection into user message
- 19 documents ingested, ~308 vector chunks

### Safety System (Non-Negotiable)

Every message passes through tiered crisis detection **before** any AI call:

| Level | Meaning | Action |
|-------|---------|--------|
| 0 | Normal | Proceed with coaching |
| 1 | Mild distress | Increase warmth, log event |
| 2 | Moderate crisis | Hardcoded crisis response, AI **not** called, log event |
| 3 | Acute crisis | Crisis response only, AI **not** called, escalate |

- Unicode normalization (NFKD) prevents bypass via zero-width characters
- Crisis keywords in English + Arabic
- Safety events always logged to `safety_events` table

### Therapeutic Modalities

CBT, DBT, ACT, mindfulness, somatic, IFS, narrative, psychoeducation — each with specialized system prompts.

### 3-Factor Wellness Model

MindLumi reduces many raw data signals into **3 composite wellness dimensions** (inspired by factor analysis — see [`mindlumi-factor-analysis-explained.md`](mindlumi-factor-analysis-explained.md)):

| Factor | Signals | Purpose |
|--------|---------|---------|
| **Emotional Distress / Mood State** | Stress, anxiety, sadness, irritability, voice tone, facial tension, self-reported mood | Core therapy focus |
| **Physiological Regulation / Body Readiness** | HRV, sleep quality, resting HR, fatigue, recovery, activity level | Wearable-informed context |
| **Social & Behavioral Stability** | Isolation patterns, Circle engagement, missed check-ins, routine disruption | Buddy system intelligence |

These dimensions power:
- **Personalized baselines** — detect what's normal for each user
- **AI context injection** — therapist AI references dimensional patterns, not raw numbers
- **Circle / supporter insights** — meaningful summaries instead of raw metrics
- **Early risk detection** — multi-dimensional threshold alerts (e.g., emotional distress ↑ + recovery ↓ + social engagement ↓)

### Security Hardening

- CORS origin allowlist (via `ALLOWED_ORIGINS` env var)
- Timing-safe admin key comparison (`crypto.subtle.timingSafeEqual`)
- Input validation: UUID checks, numeric bounds, type enforcement
- Prompt injection mitigation: newline collapse, markup stripping, length caps
- RLS on all user-facing tables; system tables locked to service role
- No therapy message content in application logs

### Bilingual Support

- English (`en`) and Arabic (`ar`) as primary languages
- Knowledge base filtered by language during RAG
- Arabic content culturally adapted (collectivist values, spiritual wellbeing)

## Database Schema

| Table | Purpose |
|-------|---------|
| `user_profiles` | User preferences, concerns, language |
| `therapy_sessions` | Sessions with provider, modality, state |
| `session_messages` | All conversation messages |
| `mood_journal` | Mood scores, labels, triggers |
| `progress_tracking` | Session insights and milestones |
| `safety_events` | Crisis detection audit trail |
| `knowledge_documents` | RAG source documents |
| `knowledge_chunks` | Vectorized chunks (1536-dim embeddings) |
| `assistant_config` | System configuration (locked by RLS) |

## Quick Start

### Prerequisites

- **Deno** (≥ 1.40) — Supabase Edge Functions runtime
- **Supabase CLI** (≥ 2.75) — `brew install supabase/tap/supabase`
- **Node.js** (≥ 18) — for LumiUI tooling
- **OpenAI API key** — for Responses API + embeddings
- **Anthropic API key** — for Claude provider

### Setup

```bash
git clone https://github.com/MindLumi/MindLumi.git
cd MindLumi
cp .env.example .env.local
# Edit .env.local with your API keys

supabase link --project-ref <your-project-ref>
supabase db push
supabase secrets set --env-file .env.local --project-ref <ref>

# Deploy edge functions
for fn in chat session mood admin; do
  supabase functions deploy $fn --no-verify-jwt --project-ref <ref>
done

# Deploy test console
cd lumi-ui && npx vercel --prod
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `ANTHROPIC_API_KEY` | Yes | Anthropic Claude API key |
| `AI_PROVIDER` | Yes | `"openai"` or `"claude"` |
| `SUPABASE_URL` | Auto | Project URL (auto in edge functions) |
| `SUPABASE_ANON_KEY` | Auto | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key |
| `ADMIN_SECRET_KEY` | Yes | Admin endpoint protection |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |

## Edge Function Endpoints

| Function | Action | Method | Auth | Description |
|----------|--------|--------|------|-------------|
| `chat` | — | POST | JWT | Send therapy message |
| `session` | `create` | POST | JWT | Create new session |
| `session` | `list` | GET | JWT | List user's sessions |
| `session` | `get` | GET | JWT | Get session detail |
| `session` | `get-messages` | GET | JWT | Get session messages |
| `session` | `complete` | POST | JWT | Complete a session |
| `mood` | `log` | POST | JWT | Log mood entry |
| `mood` | `history` | GET | JWT | Mood history |
| `mood` | `trends` | GET | JWT | Mood trends/analytics |
| `admin` | `ingest` | POST | Admin key | Ingest knowledge doc |
| `admin` | `safety-events` | GET | Admin key | List safety events |
| `admin` | `list-documents` | GET | Admin key | List knowledge docs |

## Development

### Local Development

```bash
supabase start                                    # Start local Supabase
supabase db reset                                 # Apply all migrations fresh
supabase functions serve --env-file .env.local    # Serve edge functions locally
```

### Deployment

```bash
supabase functions deploy                         # Deploy all edge functions
supabase functions deploy chat                    # Deploy single function
supabase db push --project-ref <ref>              # Push migrations to production
supabase secrets set KEY=value --project-ref <ref> # Set production secrets
```

### Logs

```bash
supabase functions logs chat --project-ref <ref>
```

### Knowledge Base Ingestion

```bash
deno run --allow-env --allow-net scripts/setup.ts
deno run --allow-env --allow-net scripts/seed-knowledge-base.ts
```

## AI-Assisted Development

This project is fully compatible with Claude Code CLI and GitHub Copilot CLI. The [`Skill.md`](Skill.md) (3000+ lines) and [`.github/copilot-instructions.md`](.github/copilot-instructions.md) provide rich context for AI-assisted development.

## Roadmap

Active milestones are tracked in the frontend repo's [`docs/milestones/`](https://github.com/MindLumi/lumi-bece0d49/tree/main/docs/milestones):

- **M3 — Circle + Longitudinal Metrics** — turn the metrics/Circle schema into a usable product surface ([details](https://github.com/MindLumi/lumi-bece0d49/blob/main/docs/milestones/M3-circle-and-metrics.md))
- **Factor scoring pipeline** — nightly computation of composite wellness dimensions (#11)
- **Multi-modal signal extraction** — voice biomarkers + behavior patterns feeding into factors (#12)
- **Cross-repo consolidation** — tracked in #10

## Contributing

1. **Schema changes** → open a PR in this repo (`supabase/migrations/`).
2. **Edge function changes** → open a PR in this repo (`supabase/functions/`).
3. **Frontend changes** → open a PR in [`MindLumi/lumi-bece0d49`](https://github.com/MindLumi/lumi-bece0d49).
4. **Never log therapy message content** — only structured metadata.
5. **Safety system is non-negotiable** — do not weaken `safety-guard.ts`.

## License

See [LICENSE](LICENSE) for details.

---

**⚠️ Important:** Lumi is an AI coaching tool, not a replacement for licensed therapy. If you or someone you know is in crisis, please contact your local emergency services or a crisis hotline.
