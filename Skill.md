# Lumi — AI Therapy Coaching Platform: Comprehensive Development Reference

> **Domain:** Psychological healing, therapy coaching, mental wellness
> **Stack:** Supabase (PostgreSQL + pgvector + Edge Functions) · OpenAI Responses API · Anthropic Claude Messages API · TypeScript/Deno · React/Next.js
> **Safety Note:** This system operates in a mental health context. Safety guardrails, crisis detection, and ethical boundaries are non-negotiable features, not optional enhancements.

---

## Table of Contents

0. [Quick Start (New Machine Setup)](#0-quick-start-new-machine-setup)
1. [App Identity & Domain Context](#1-app-identity--domain-context)
2. [System Architecture](#2-system-architecture)
3. [Database Schema](#3-database-schema)
4. [AI & RAG Patterns](#4-ai--rag-patterns)
5. [Edge Functions](#5-edge-functions)
6. [Auth & Security](#6-auth--security)
7. [Frontend Patterns](#7-frontend-patterns)
8. [Deployment & Operations](#8-deployment--operations)
9. [Knowledge Base Strategy](#9-knowledge-base-strategy)

---

## 0. Quick Start (New Machine Setup)

> **Repository:** [https://github.com/MindLumi/MindLumi](https://github.com/MindLumi/MindLumi) (private)

### Prerequisites
- Git
- Deno (>= 1.40) — for Supabase Edge Functions
- Supabase CLI (>= 2.75) — `brew install supabase/tap/supabase` or `npm install -g supabase`
- Node.js (>= 18) — for LumiUI and tooling
- OpenAI API key
- Anthropic API key (for Claude provider)

### Clone & Configure
```bash
git clone https://github.com/MindLumi/MindLumi.git
cd MindLumi

# Copy and fill in your secrets
cp .env.example .env.local
# Edit .env.local with your API keys and Supabase credentials
```

### Supabase Setup
```bash
# Link to the Supabase project
supabase link --project-ref <your-project-ref>

# Push all migrations
supabase db push

# Set secrets on remote
supabase secrets set --env-file .env.local --project-ref <ref>

# Deploy all edge functions
supabase functions deploy chat --no-verify-jwt --project-ref <ref>
supabase functions deploy session --no-verify-jwt --project-ref <ref>
supabase functions deploy mood --no-verify-jwt --project-ref <ref>
supabase functions deploy admin --no-verify-jwt --project-ref <ref>

# For local development
supabase start
supabase functions serve --env-file .env.local
```

### LumiUI (Test Console)
```bash
cd lumi-ui
npx vercel  # Deploy to Vercel (or serve locally)
```

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key (for Responses API + embeddings) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key (for Claude provider) |
| `AI_PROVIDER` | Yes | `"openai"` or `"claude"` — active chat provider |
| `SUPABASE_URL` | Auto | Supabase project URL |
| `SUPABASE_ANON_KEY` | Auto | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (edge functions) |
| `ADMIN_SECRET_KEY` | Yes | Protects /admin endpoints |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |

---

## 1. App Identity & Domain Context

### 1.1 Purpose & Value Proposition

Lumi is an AI-powered therapy coaching platform that provides accessible, on-demand psychological support. It bridges the gap between traditional therapy (expensive, hard to access) and doing nothing, by offering evidence-based, conversational coaching grounded in CBT, DBT, ACT, and mindfulness modalities.

**Target users:**
- Individuals seeking emotional support between therapy sessions
- People who cannot afford or access regular therapy
- Those exploring mental health support for the first time
- Users working through specific challenges (anxiety, grief, relationship issues, burnout)

**Core value proposition:**
- Always available, never judgmental
- Evidence-based frameworks (not generic chatbot advice)
- Tracks progress over time (mood, patterns, breakthroughs)
- Multilingual support (Arabic + English as primary)
- Warm, grounding presence — not clinical coldness

### 1.2 Therapy Domain Terminology

| Term | Definition in Lumi context |
|------|---------------------------|
| **Session** | A bounded conversation with therapeutic intent (has start/end, topic, goals) |
| **Journey** | A user's long-term arc across multiple sessions |
| **Modality** | Therapeutic framework used (CBT, DBT, ACT, mindfulness, somatic) |
| **Check-in** | Brief mood/state assessment at session start |
| **Reflection** | AI-generated synthesis of patterns, insights from past sessions |
| **Safety signal** | Indicator of potential crisis (self-harm ideation, suicidal thought) |
| **Grounding** | Techniques to anchor user to present moment (5-4-3-2-1, breathing) |
| **Reframe** | CBT technique to shift perspective on negative thought patterns |
| **Validation** | Acknowledging emotions without judgment before offering tools |

### 1.3 Ethical & Safety Constraints

**Non-negotiables:**
1. Lumi is NOT a replacement for licensed therapy — always disclaim this
2. Crisis situations (suicidal ideation, self-harm, abuse) must trigger safety protocols
3. Never diagnose — offer frameworks and tools, not clinical diagnoses
4. Respect user autonomy — never push, shame, or pressure
5. Data privacy is paramount — therapy content is among the most sensitive data

**Safety response hierarchy:**
```
Level 0: Normal coaching conversation
Level 1: Distress detected → increase warmth, offer grounding
Level 2: Moderate crisis signals → provide crisis resources, pause coaching
Level 3: Acute crisis → emergency resources, human escalation, session pause
```

**Scope boundaries:**
- IN scope: Emotional processing, coping skills, psychoeducation, goal-setting, reflection
- OUT of scope: Medication advice, clinical diagnosis, legal advice, medical emergencies
- ALWAYS add: "I'm an AI coaching tool, not a licensed therapist"

### 1.4 Supported Therapeutic Modalities

```typescript
type TherapyModality =
  | 'CBT'           // Cognitive Behavioral Therapy — thought-feeling-behavior triangle
  | 'DBT'           // Dialectical Behavior Therapy — distress tolerance, emotion regulation
  | 'ACT'           // Acceptance and Commitment Therapy — values-based action
  | 'mindfulness'   // Present-moment awareness, meditation
  | 'somatic'       // Body-based awareness, nervous system regulation
  | 'IFS'           // Internal Family Systems — parts work
  | 'narrative'     // Rewriting personal story
  | 'psychoeducation'; // Teaching about mental health concepts
```

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│  React/Next.js Web App  ·  LumiUI Test Console (Vercel) │
│  Chat UI · Session Manager · Progress Dashboard         │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS / WebSocket
┌─────────────────────▼───────────────────────────────────┐
│                  EDGE FUNCTION LAYER                     │
│           Supabase Edge Functions (Deno)                 │
│  /chat · /session · /mood · /admin                      │
│  CORS (origin allowlist) · JWT Auth · Safety Check      │
└──────┬──────────────┬──────────────┬────────────────────┘
       │              │              │
┌──────▼──────────┐ ┌─▼──────────┐ ┌▼──────────────────────┐
│  AI Provider    │ │  pgvector  │ │  PostgreSQL            │
│  Abstraction    │ │  Semantic  │ │  (Supabase)            │
│  ┌────────────┐ │ │  Search    │ │  Users · Sessions      │
│  │ OpenAI     │ │ │  RAG       │ │  Messages · Mood       │
│  │ Responses  │ │ │  HNSW idx  │ │  Progress · KBase      │
│  │ API        │ │ │            │ │                        │
│  ├────────────┤ │ ├────────────┤ │  provider_state JSONB  │
│  │ Claude     │ │ │  OpenAI    │ │  ai_provider TEXT      │
│  │ Messages   │ │ │  Embeddings│ │                        │
│  │ API        │ │ │  (always)  │ │                        │
│  └────────────┘ │ └────────────┘ └───────────────────────┘
└─────────────────┘
```

Key shared modules:
- `_shared/ai-provider.ts` — Unified provider interface + factory
- `_shared/openai-responses.ts` — OpenAI Responses API client
- `_shared/claude-client.ts` — Claude Messages API client
- `_shared/rag-pipeline.ts` — Multi-query expansion + pgvector search
- `_shared/prompt-builder.ts` — Dynamic system prompt with input sanitization
- `_shared/safety-guard.ts` — Tiered crisis detection with Unicode normalization
- `_shared/cors.ts` — Origin-allowlist CORS
- `_shared/auth.ts` — JWT auth + UUID validation
- `_shared/response.ts` — Standard JSON response helpers
- `_shared/ingest.ts` — Document chunking + batch embedding
- `_shared/supabase-admin.ts` — Service role client

### 2.2 Component Responsibilities

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **Frontend** | User interaction, session UI, mood tracking | React/Next.js or LumiUI test console |
| **Edge Functions** | API logic, auth enforcement, AI orchestration | Deno (Supabase Edge) |
| **AI Provider Layer** | Dual-provider chat (OpenAI or Claude) | `_shared/ai-provider.ts` abstraction |
| **OpenAI Responses API** | Multi-turn conversation via `previous_response_id` | GPT-4o via Responses API |
| **Claude Messages API** | Stateless conversation (history rebuilt from DB) | Claude via Messages API |
| **OpenAI Embeddings** | Embedding for RAG (always, regardless of chat provider) | `text-embedding-3-small` (1536 dims) |
| **pgvector** | Semantic search over knowledge base | PostgreSQL extension |
| **PostgreSQL** | All persistent data (users, sessions, messages) | Supabase managed Postgres |
| **Supabase Auth** | JWT-based auth, social login, session tokens | Supabase Auth |
| **Storage** | Documents, audio, user uploads | Supabase Storage |

### 2.3 Technology Stack Decisions

**Why Supabase:**
- Single platform: auth + DB + storage + edge functions + realtime
- pgvector built-in for RAG without separate vector DB
- RLS for fine-grained data access control (critical for sensitive therapy data)
- Realtime subscriptions for live conversation updates

**Why Dual AI Providers (OpenAI + Claude):**
- Provider flexibility — switch between models for cost, quality, or latency tradeoffs
- Controlled via `AI_PROVIDER` env var (`"openai"` | `"claude"`)
- OpenAI Responses API: `previous_response_id` for multi-turn (server-managed context)
- Claude Messages API: stateless — full conversation history rebuilt from `session_messages` each request
- RAG embeddings always use OpenAI `text-embedding-3-small` regardless of chat provider

**Why OpenAI Responses API (not Assistants API):**
- Simpler than Assistants: no threads, runs, or polling — single request/response
- `previous_response_id` gives multi-turn context without manual history management
- `instructions` parameter allows per-request system prompt overrides
- Lower latency than Assistants API (no run polling loop)

**Why Deno Edge Functions:**
- Co-located with Supabase data (low latency)
- TypeScript native
- Secure by default (no file system access unless granted)

**Why NOT a separate vector DB (e.g., Pinecone):**
- pgvector with HNSW index is sufficient for therapy knowledge base scale (< 1M vectors)
- Reduces infrastructure complexity
- Joins between knowledge and user data are trivial in SQL

### 2.4 Data Flow: Chat Message

```
User sends message
       ↓
Frontend → POST /functions/v1/chat
       ↓
Edge Function: validate JWT, extract user_id
       ↓
Safety check: normalize Unicode (NFKD) + strip zero-width chars → scan for crisis signals
       ↓ (if safe)
Load session context (therapy_session record, including ai_provider)
       ↓
RAG: embed message (OpenAI text-embedding-3-small) → pgvector search → top-k chunks
       ↓
Build system prompt (modality + context + safety rules) with input sanitization
       ↓
Route to AI provider:
  → OpenAI: POST /v1/responses with previous_response_id from provider_state
  → Claude: POST /v1/messages with full history rebuilt from session_messages
       ↓
Store assistant reply in session_messages
       ↓
Update session metadata (last_active, message_count, provider_state)
       ↓
Return response to frontend
```

---

## 3. Database Schema

### 3.1 Schema Overview

```sql
-- Core tables
users (auth.users extension)
user_profiles (demographic, preferences, onboarding)
therapy_sessions (bounded conversation containers)
session_messages (individual messages within sessions)
mood_journal (periodic mood check-ins)
progress_tracking (milestones, insights, patterns)

-- Knowledge base
knowledge_documents (source documents)
knowledge_chunks (chunked + embedded text)

-- Configuration
assistant_config (AI provider settings, prompts)
safety_events (crisis signals log)
```

### 3.2 Extensions Setup

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search
```

### 3.3 User Profiles Table

```sql
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'ar', 'fr')),
  timezone TEXT DEFAULT 'UTC',

  -- Onboarding data
  onboarding_completed BOOLEAN DEFAULT FALSE,
  primary_concerns TEXT[], -- ['anxiety', 'depression', 'relationships', 'grief', 'burnout']
  preferred_modalities TEXT[], -- ['CBT', 'mindfulness', 'DBT']
  therapy_experience TEXT CHECK (therapy_experience IN ('none', 'some', 'ongoing', 'past')),

  -- Safety
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  safety_plan_acknowledged BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 3.4 Therapy Sessions Table

```sql
CREATE TABLE public.therapy_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- AI provider binding
  ai_provider TEXT NOT NULL DEFAULT 'openai', -- 'openai' or 'claude'
  provider_state JSONB DEFAULT '{}'::JSONB, -- OpenAI: { previous_response_id: "..." }, Claude: {}

  -- Session metadata
  title TEXT, -- Auto-generated or user-set
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  modality TEXT DEFAULT 'CBT' CHECK (modality IN ('CBT', 'DBT', 'ACT', 'mindfulness', 'somatic', 'IFS', 'narrative', 'psychoeducation', 'mixed')),

  -- Session goals and context
  session_goal TEXT, -- User-defined intent for the session
  initial_mood_score INTEGER CHECK (initial_mood_score BETWEEN 1 AND 10),
  final_mood_score INTEGER CHECK (final_mood_score BETWEEN 1 AND 10),
  key_themes TEXT[], -- Extracted themes: ['anxiety', 'work_stress', 'relationships']

  -- Safety tracking
  safety_level INTEGER DEFAULT 0 CHECK (safety_level BETWEEN 0 AND 3),
  crisis_detected BOOLEAN DEFAULT FALSE,
  crisis_handled_at TIMESTAMPTZ,

  -- Stats
  message_count INTEGER DEFAULT 0,
  duration_minutes INTEGER,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_therapy_sessions_user_id ON public.therapy_sessions(user_id);
CREATE INDEX idx_therapy_sessions_status ON public.therapy_sessions(status);
CREATE INDEX idx_therapy_sessions_last_active ON public.therapy_sessions(last_active_at DESC);
```

### 3.5 Session Messages Table

```sql
CREATE TABLE public.session_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  content_language TEXT DEFAULT 'en',

  -- AI provider references
  openai_message_id TEXT, -- Response ID from OpenAI Responses API (if OpenAI provider)
  openai_run_id TEXT,     -- Deprecated; kept for historical data

  -- Safety metadata
  safety_score INTEGER DEFAULT 0 CHECK (safety_score BETWEEN 0 AND 3),
  crisis_keywords TEXT[], -- Detected crisis keywords if any
  safety_response_triggered BOOLEAN DEFAULT FALSE,

  -- Therapy metadata
  technique_used TEXT, -- 'reframing', 'grounding', 'validation', 'psychoeducation'
  emotion_detected TEXT[], -- ['anxious', 'sad', 'frustrated', 'hopeful']

  -- RAG context used
  rag_chunks_used INTEGER DEFAULT 0,
  knowledge_sources TEXT[], -- Source document names used

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_messages_session_id ON public.session_messages(session_id);
CREATE INDEX idx_session_messages_created_at ON public.session_messages(created_at DESC);
CREATE INDEX idx_session_messages_safety ON public.session_messages(safety_score) WHERE safety_score > 0;
```

### 3.6 Mood Journal Table

```sql
CREATE TABLE public.mood_journal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.therapy_sessions(id), -- Optional session link

  -- Mood data
  mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 10),
  mood_label TEXT, -- 'anxious', 'sad', 'calm', 'hopeful', 'frustrated', 'grateful'
  mood_notes TEXT, -- Free-form user note

  -- Context
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
  stress_triggers TEXT[], -- ['work', 'relationships', 'health', 'finances']

  -- Timing
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  time_of_day TEXT CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'night'))
);

CREATE INDEX idx_mood_journal_user_id ON public.mood_journal(user_id);
CREATE INDEX idx_mood_journal_recorded_at ON public.mood_journal(recorded_at DESC);
```

### 3.7 Progress Tracking Table

```sql
CREATE TABLE public.progress_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.therapy_sessions(id),

  -- Progress entry type
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'milestone',      -- User achieved something meaningful
    'insight',        -- Breakthrough realization
    'skill_learned',  -- New coping skill acquired
    'pattern',        -- Identified recurring pattern
    'goal_set',       -- New goal defined
    'goal_achieved',  -- Goal completed
    'reflection'      -- Weekly/monthly reflection summary
  )),

  -- Content
  title TEXT NOT NULL,
  description TEXT,
  evidence TEXT, -- What demonstrated this progress
  related_themes TEXT[],
  related_modality TEXT,

  -- AI-generated vs user-set
  ai_generated BOOLEAN DEFAULT FALSE,
  user_acknowledged BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_progress_tracking_user_id ON public.progress_tracking(user_id);
CREATE INDEX idx_progress_tracking_entry_type ON public.progress_tracking(entry_type);
```

### 3.8 Knowledge Base Tables

```sql
-- Source documents
CREATE TABLE public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT CHECK (content_type IN ('article', 'exercise', 'psychoeducation', 'script', 'worksheet')),
  modality TEXT[], -- Which therapy modalities this supports
  language TEXT DEFAULT 'en',
  tags TEXT[],
  source_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chunked + embedded content
CREATE TABLE public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL, -- Position within document
  content TEXT NOT NULL,
  content_language TEXT DEFAULT 'en',
  embedding VECTOR(1536), -- text-embedding-3-small dimensions
  token_count INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX idx_knowledge_chunks_embedding
  ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Full-text search index
CREATE INDEX idx_knowledge_chunks_content_fts
  ON public.knowledge_chunks
  USING gin(to_tsvector('english', content));

-- Function for semantic similarity search
CREATE OR REPLACE FUNCTION search_knowledge_base(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  filter_modality TEXT DEFAULT NULL,
  filter_language TEXT DEFAULT 'en'
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT,
  metadata JSONB,
  document_title TEXT,
  document_modality TEXT[]
)
LANGUAGE SQL STABLE AS $$
  SELECT
    kc.id,
    kc.document_id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) AS similarity,
    kc.metadata,
    kd.title AS document_title,
    kd.modality AS document_modality
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kc.document_id = kd.id
  WHERE
    kd.is_active = TRUE
    AND kc.content_language = filter_language
    AND (filter_modality IS NULL OR filter_modality = ANY(kd.modality))
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### 3.9 Assistant Configuration Table

```sql
CREATE TABLE public.assistant_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  provider TEXT DEFAULT 'openai', -- 'openai' or 'claude'
  model TEXT DEFAULT 'gpt-4o', -- e.g. 'gpt-4o', 'claude-sonnet-4-20250514'
  system_prompt TEXT NOT NULL,
  temperature FLOAT DEFAULT 0.7,
  modality TEXT, -- Which therapy modality this config serves
  language TEXT DEFAULT 'en',
  is_active BOOLEAN DEFAULT TRUE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.10 Safety Events Log

```sql
CREATE TABLE public.safety_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID REFERENCES public.therapy_sessions(id),
  message_id UUID REFERENCES public.session_messages(id),
  safety_level INTEGER NOT NULL CHECK (safety_level BETWEEN 1 AND 3),
  trigger_keywords TEXT[],
  trigger_content TEXT, -- Anonymized portion of triggering content
  response_action TEXT, -- What Lumi did in response
  escalated_to_human BOOLEAN DEFAULT FALSE,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_safety_events_user_id ON public.safety_events(user_id);
CREATE INDEX idx_safety_events_safety_level ON public.safety_events(safety_level);
CREATE INDEX idx_safety_events_reviewed ON public.safety_events(reviewed) WHERE reviewed = FALSE;
```

### 3.11 Row Level Security Policies

```sql
-- Enable RLS on all user-facing tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_events ENABLE ROW LEVEL SECURITY;

-- user_profiles: users can only see/edit their own
CREATE POLICY "users_own_profile" ON public.user_profiles
  FOR ALL USING (auth.uid() = id);

-- therapy_sessions: users own their sessions
CREATE POLICY "users_own_sessions" ON public.therapy_sessions
  FOR ALL USING (auth.uid() = user_id);

-- session_messages: users own their messages
CREATE POLICY "users_own_messages" ON public.session_messages
  FOR ALL USING (auth.uid() = user_id);

-- mood_journal: users own their mood data
CREATE POLICY "users_own_mood_journal" ON public.mood_journal
  FOR ALL USING (auth.uid() = user_id);

-- progress_tracking: users own their progress
CREATE POLICY "users_own_progress" ON public.progress_tracking
  FOR ALL USING (auth.uid() = user_id);

-- safety_events: users can only read (not modify) their safety events
CREATE POLICY "users_read_safety_events" ON public.safety_events
  FOR SELECT USING (auth.uid() = user_id);

-- knowledge_documents and chunks: public read (service role manages writes)
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_knowledge_docs" ON public.knowledge_documents
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "public_read_knowledge_chunks" ON public.knowledge_chunks
  FOR SELECT USING (TRUE);
```

---

## 4. AI & RAG Patterns

### 4.1 Dual AI Provider Architecture

Lumi supports two AI providers, switchable via the `AI_PROVIDER` environment variable. Both providers share the same safety, RAG, and prompt-building pipeline — only the final chat call differs.

**Provider Abstraction:**

```typescript
// _shared/ai-provider.ts

export type AIProvider = 'openai' | 'claude';

export interface ProviderResponse {
  content: string;
  providerState: Record<string, unknown>; // Updated state to persist
  tokensUsed?: number;
}

export function getProvider(): AIProvider {
  const provider = Deno.env.get('AI_PROVIDER') || 'openai';
  if (provider !== 'openai' && provider !== 'claude') {
    throw new Error(`Invalid AI_PROVIDER: ${provider}`);
  }
  return provider;
}

export async function sendMessage(
  provider: AIProvider,
  systemPrompt: string,
  userMessage: string,
  providerState: Record<string, unknown>,
  sessionMessages?: { role: string; content: string }[]
): Promise<ProviderResponse> {
  switch (provider) {
    case 'openai':
      return sendOpenAIMessage(systemPrompt, userMessage, providerState);
    case 'claude':
      return sendClaudeMessage(systemPrompt, userMessage, sessionMessages || []);
  }
}
```

**OpenAI Responses API (`POST /v1/responses`):**

- Uses `previous_response_id` for multi-turn context (server-managed)
- System prompt passed via `instructions` parameter per request
- No threads, runs, or polling — single request/response
- `provider_state` stores `{ "previous_response_id": "resp_abc123" }`

```typescript
// _shared/openai-responses.ts

export async function sendOpenAIMessage(
  systemPrompt: string,
  userMessage: string,
  providerState: Record<string, unknown>
): Promise<ProviderResponse> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')!;
  const previousResponseId = providerState.previous_response_id as string | undefined;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      instructions: systemPrompt,
      input: userMessage,
      ...(previousResponseId && { previous_response_id: previousResponseId }),
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OpenAI Responses API error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const outputText = data.output?.filter((o: any) => o.type === 'message')
    .flatMap((o: any) => o.content)
    .filter((c: any) => c.type === 'output_text')
    .map((c: any) => c.text)
    .join('') || '';

  return {
    content: outputText,
    providerState: { previous_response_id: data.id },
    tokensUsed: data.usage?.total_tokens,
  };
}
```

**Claude Messages API (`POST /v1/messages`):**

- Stateless — full conversation history rebuilt from `session_messages` table each request
- System prompt passed via top-level `system` parameter
- `provider_state` is `{}` (no server-side state needed)

```typescript
// _shared/claude-client.ts

export async function sendClaudeMessage(
  systemPrompt: string,
  userMessage: string,
  sessionMessages: { role: string; content: string }[]
): Promise<ProviderResponse> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

  // Build messages array from session history + new message
  const messages = [
    ...sessionMessages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Claude API error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const outputText = data.content
    ?.filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('') || '';

  return {
    content: outputText,
    providerState: {}, // Claude is stateless
    tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
  };
}
```

**Provider state persistence:**

| Provider | `provider_state` stores | Multi-turn mechanism |
|----------|------------------------|---------------------|
| OpenAI | `{ "previous_response_id": "resp_..." }` | Server-managed via Responses API |
| Claude | `{}` | Full history rebuilt from `session_messages` table |

### 4.2 RAG Pipeline

```typescript
// lib/rag-pipeline.ts
import { openai } from './openai-client.ts';
import { supabaseAdmin } from './supabase-admin.ts';

export interface RAGContext {
  chunks: RAGChunk[];
  contextText: string;
  sourceDocs: string[];
}

export interface RAGChunk {
  content: string;
  similarity: number;
  documentTitle: string;
  modality: string[];
}

// Step 1: Embed the query
export async function embedQuery(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float',
  });
  return response.data[0].embedding;
}

// Step 2: Multi-query expansion (improves recall)
export async function expandQuery(
  userMessage: string,
  modality: string,
  language: string
): Promise<string[]> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a ${modality} therapy assistant. Generate 3 search queries to find relevant therapeutic knowledge for this user message. Return as JSON array of strings. Language: ${language}.`,
      },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message.content!);
    return [userMessage, ...(parsed.queries || [])].slice(0, 4);
  } catch {
    return [userMessage];
  }
}

// Step 3: Search knowledge base for each query, deduplicate
export async function searchKnowledgeBase(
  queries: string[],
  modality: string,
  language: string,
  matchCount = 5,
  matchThreshold = 0.68
): Promise<RAGChunk[]> {
  const allResults = new Map<string, RAGChunk>();

  for (const query of queries) {
    const embedding = await embedQuery(query);

    const { data, error } = await supabaseAdmin.rpc('search_knowledge_base', {
      query_embedding: embedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      filter_modality: modality !== 'mixed' ? modality : null,
      filter_language: language,
    });

    if (error) {
      console.error('Knowledge search error:', error);
      continue;
    }

    for (const row of data || []) {
      if (!allResults.has(row.id)) {
        allResults.set(row.id, {
          content: row.content,
          similarity: row.similarity,
          documentTitle: row.document_title,
          modality: row.document_modality || [],
        });
      }
    }
  }

  // Sort by similarity, return top results
  return Array.from(allResults.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);
}

// Step 4: Build context string from chunks
export function buildContextString(chunks: RAGChunk[]): string {
  if (chunks.length === 0) return '';

  return chunks
    .map((chunk, i) => `[${i + 1}] From "${chunk.document_title}":\n${chunk.content}`)
    .join('\n\n---\n\n');
}

// Full RAG pipeline
export async function retrieveTherapyContext(
  userMessage: string,
  modality: string,
  language: string
): Promise<RAGContext> {
  const queries = await expandQuery(userMessage, modality, language);
  const chunks = await searchKnowledgeBase(queries, modality, language);
  const contextText = buildContextString(chunks);
  const sourceDocs = [...new Set(chunks.map(c => c.documentTitle))];

  return { chunks, contextText, sourceDocs };
}
```

### 4.3 Prompt Engineering for Therapy Domain

```typescript
// lib/prompt-builder.ts

export interface SessionContext {
  modality: string;
  language: string;
  sessionGoal?: string;
  userConcerns?: string[];
  sessionHistory?: string; // Brief summary of past sessions
  currentSafetyLevel: number;
}

export function buildSystemPrompt(ctx: SessionContext): string {
  const languageInstruction = ctx.language === 'ar'
    ? 'Respond in Arabic. Be culturally sensitive to Arabic-speaking contexts.'
    : 'Respond in English.';

  const modalityGuidance = MODALITY_PROMPTS[ctx.modality] || MODALITY_PROMPTS['CBT'];

  const safetyLayer = ctx.currentSafetyLevel > 0
    ? `\n\nSAFETY ALERT: This user has shown distress signals (level ${ctx.currentSafetyLevel}/3). Prioritize emotional safety. Do not push therapeutic techniques. Offer grounding and resources.`
    : '';

  return `You are Lumi, a compassionate AI therapy coaching companion. You are NOT a licensed therapist and make this clear when appropriate.

IDENTITY:
- Warm, non-judgmental, curious presence
- Evidence-based but conversational — not clinical
- You hold space without rushing to fix
- You validate before you guide

${languageInstruction}

THERAPEUTIC APPROACH — ${ctx.modality}:
${modalityGuidance}

${ctx.sessionGoal ? `SESSION GOAL: The user wants to work on: ${ctx.sessionGoal}` : ''}
${ctx.userConcerns?.length ? `USER'S PRIMARY CONCERNS: ${ctx.userConcerns.join(', ')}` : ''}
${ctx.sessionHistory ? `PREVIOUS SESSION CONTEXT:\n${ctx.sessionHistory}` : ''}

RESPONSE GUIDELINES:
1. Start with validation/empathy before any technique or advice
2. Ask one open-ended question at a time — don't overwhelm
3. Use the provided knowledge base context naturally, without citing it mechanically
4. Keep responses focused (150-300 words unless user needs more)
5. End with a gentle prompt or reflection question when appropriate

SCOPE BOUNDARIES:
- Never diagnose or prescribe medication
- If asked for medical/legal advice, redirect kindly
- Always include: "Remember, I'm an AI coaching tool — a licensed therapist can provide deeper support"
- Crisis protocol: If user expresses suicidal ideation or self-harm, immediately provide crisis resources

CRISIS RESOURCES (include when safety_level >= 2):
- International: Crisis Text Line — Text HOME to 741741
- Arabic speakers: mention local resources
- Always: encourage reaching out to a trusted person or emergency services if in immediate danger
${safetyLayer}`;
}

const MODALITY_PROMPTS: Record<string, string> = {
  CBT: `Use Cognitive Behavioral Therapy frameworks:
- Help identify automatic thoughts and cognitive distortions
- Explore the thought-feeling-behavior triangle
- Offer gentle cognitive reframing
- Support behavioral activation and homework`,

  DBT: `Use Dialectical Behavior Therapy frameworks:
- Balance acceptance and change ("you're doing the best you can AND you can do better")
- Teach TIPP, DEAR MAN, FAST, GIVE skills when relevant
- Focus on distress tolerance for crisis moments
- Build emotion regulation vocabulary`,

  ACT: `Use Acceptance and Commitment Therapy frameworks:
- Help identify personal values
- Support psychological flexibility and defusion from thoughts
- Encourage committed action aligned with values
- Use metaphors and experiential exercises`,

  mindfulness: `Use mindfulness-based approaches:
- Guide present-moment awareness exercises
- Offer grounding techniques (5-4-3-2-1, breath awareness)
- Encourage non-judgmental observation of thoughts/feelings
- Integrate body awareness`,

  somatic: `Use somatic/body-based approaches:
- Draw attention to physical sensations and where emotions live in the body
- Offer nervous system regulation techniques (box breathing, shaking, grounding)
- Support polyvagal awareness (safe/social vs. fight/flight vs. freeze)
- Move slowly and check in about physical experience`,

  IFS: `Use Internal Family Systems framework:
- Help identify and name "parts" of self (the critic, the scared child, etc.)
- Approach all parts with curiosity and compassion
- Work toward Self-led responses
- Avoid "blending" — maintain differentiation between Self and parts`,

  narrative: `Use Narrative Therapy frameworks:
- Help externalize the problem ("the anxiety" vs. "I am anxious")
- Explore alternative stories and exceptions to the dominant narrative
- Identify unique outcomes that contradict the problem story
- Support re-authoring of life narrative`,

  psychoeducation: `Focus on psychoeducation:
- Explain mental health concepts clearly and accessibly
- Normalize emotional experiences
- Provide information about common conditions without diagnosing
- Build mental health literacy`,

  mixed: `Draw flexibly from multiple therapeutic modalities based on what the user needs in the moment. Blend validation, psychoeducation, CBT reframing, and mindfulness as appropriate.`,
};
```

### 4.4 Safety Guardrails

```typescript
// lib/safety-guard.ts

export interface SafetyAssessment {
  level: 0 | 1 | 2 | 3;
  triggeredKeywords: string[];
  response?: string; // Override response for high safety levels
  shouldPauseCoaching: boolean;
  shouldLogEvent: boolean;
}

// Tiered keyword lists (expand based on clinical guidance)
const CRISIS_KEYWORDS = {
  level3: [
    'kill myself', 'end my life', 'want to die', 'suicide', 'suicidal',
    'self-harm', 'hurt myself', 'cutting myself', 'overdose', 'not want to live',
    // Arabic equivalents
    'اقتل نفسي', 'انتحار', 'إيذاء النفس', 'لا أريد العيش',
  ],
  level2: [
    'hopeless', 'no reason to live', 'everyone would be better off without me',
    'can\'t go on', 'give up on life', 'disappear forever',
    'يائس', 'لا أمل', 'الجميع أفضل بدوني',
  ],
  level1: [
    'worthless', 'terrible person', 'hate myself', 'can\'t do anything right',
    'want to disappear', 'exhausted with life',
    'عديم القيمة', 'أكره نفسي', 'أريد الاختفاء',
  ],
};

export function assessSafety(message: string): SafetyAssessment {
  // Unicode normalization (NFKD) to prevent bypass via zero-width chars
  const normalized = message.normalize('NFKD').replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '');
  const lower = normalized.toLowerCase();
  const triggered: string[] = [];

  // Check level 3 (acute crisis)
  for (const kw of CRISIS_KEYWORDS.level3) {
    if (lower.includes(kw.toLowerCase())) {
      triggered.push(kw);
    }
  }
  if (triggered.length > 0) {
    return {
      level: 3,
      triggeredKeywords: triggered,
      response: buildCrisisResponse(3),
      shouldPauseCoaching: true,
      shouldLogEvent: true,
    };
  }

  // Check level 2 (significant distress)
  for (const kw of CRISIS_KEYWORDS.level2) {
    if (lower.includes(kw.toLowerCase())) {
      triggered.push(kw);
    }
  }
  if (triggered.length > 0) {
    return {
      level: 2,
      triggeredKeywords: triggered,
      response: buildCrisisResponse(2),
      shouldPauseCoaching: true,
      shouldLogEvent: true,
    };
  }

  // Check level 1 (distress signals)
  for (const kw of CRISIS_KEYWORDS.level1) {
    if (lower.includes(kw.toLowerCase())) {
      triggered.push(kw);
    }
  }
  if (triggered.length > 0) {
    return {
      level: 1,
      triggeredKeywords: triggered,
      shouldPauseCoaching: false,
      shouldLogEvent: true,
    };
  }

  return {
    level: 0,
    triggeredKeywords: [],
    shouldPauseCoaching: false,
    shouldLogEvent: false,
  };
}

function buildCrisisResponse(level: 2 | 3): string {
  if (level === 3) {
    return `I hear you, and I'm genuinely concerned about your safety right now.

What you're feeling is real, and you don't have to face this alone. Please reach out for immediate support:

🆘 **Crisis Text Line**: Text HOME to 741741 (US/Canada)
📞 **International Association for Suicide Prevention**: https://www.iasp.info/resources/Crisis_Centres/
🚑 **If you're in immediate danger**: Call emergency services (911, 999, 112)

I'm an AI and I'm not able to provide the real-time human connection you deserve right now. A real person is waiting to help.

Are you safe right now?`;
  }

  return `I'm hearing that things feel really heavy right now, and I want to make sure you're okay.

If you're having thoughts of harming yourself, please know that support is available:

- **Crisis Text Line**: Text HOME to 741741
- **Crisis Hotline**: Look up your local crisis line at iasp.info

You don't have to go through this alone. Would you like to talk about what's coming up for you, or would it help to pause and take a few breaths together first?`;
}

// AI-based safety check (for nuanced cases keyword matching misses)
export async function aiSafetyCheck(
  message: string,
  openaiClient: OpenAI
): Promise<number> {
  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a safety classifier for a mental health app. Rate the safety risk of this message from 0-3: 0=safe, 1=mild distress, 2=moderate crisis signals, 3=acute crisis/suicidal ideation. Return only a JSON object: {"level": 0}',
      },
      { role: 'user', content: message },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 20,
  });

  try {
    const parsed = JSON.parse(response.choices[0].message.content!);
    return Math.min(3, Math.max(0, parseInt(parsed.level)));
  } catch {
    return 0;
  }
}
```

### 4.5 Knowledge Base Ingestion Pipeline

```typescript
// scripts/ingest-knowledge-base.ts
import { openai } from '../lib/openai-client.ts';
import { supabaseAdmin } from '../lib/supabase-admin.ts';

interface IngestDocument {
  title: string;
  description: string;
  content: string;
  contentType: 'article' | 'exercise' | 'psychoeducation' | 'script' | 'worksheet';
  modality: string[];
  language: string;
  tags: string[];
}

const CHUNK_SIZE = 400; // tokens approximately
const CHUNK_OVERLAP = 50;

// Simple text chunker (replace with tiktoken for exact token counts)
function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 50) { // Skip tiny chunks
      chunks.push(chunk);
    }
  }

  return chunks;
}

// Batch embed chunks (OpenAI supports up to 2048 inputs per call)
async function batchEmbed(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    });
    allEmbeddings.push(...response.data.map(d => d.embedding));

    // Rate limit guard
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return allEmbeddings;
}

export async function ingestDocument(doc: IngestDocument): Promise<void> {
  console.log(`Ingesting: ${doc.title}`);

  // 1. Insert document record
  const { data: docRecord, error: docError } = await supabaseAdmin
    .from('knowledge_documents')
    .insert({
      title: doc.title,
      description: doc.description,
      content_type: doc.contentType,
      modality: doc.modality,
      language: doc.language,
      tags: doc.tags,
    })
    .select('id')
    .single();

  if (docError || !docRecord) {
    throw new Error(`Failed to insert document: ${docError?.message}`);
  }

  // 2. Chunk the content
  const chunks = chunkText(doc.content);
  console.log(`  → ${chunks.length} chunks`);

  // 3. Embed all chunks
  const embeddings = await batchEmbed(chunks);

  // 4. Insert chunks with embeddings
  const chunkRows = chunks.map((content, i) => ({
    document_id: docRecord.id,
    chunk_index: i,
    content,
    content_language: doc.language,
    embedding: embeddings[i],
    token_count: content.split(/\s+/).length, // Approximate
  }));

  const { error: chunksError } = await supabaseAdmin
    .from('knowledge_chunks')
    .insert(chunkRows);

  if (chunksError) {
    throw new Error(`Failed to insert chunks: ${chunksError.message}`);
  }

  console.log(`  ✓ Ingested ${chunks.length} chunks for "${doc.title}"`);
}
```

---

## 5. Edge Functions

### 5.1 Shared Infrastructure

```typescript
// supabase/functions/_shared/cors.ts

function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim());
  }
  // Permissive fallback for local development
  return ['*'];
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = req.headers.get('Origin') || '';

  let allowOrigin = '';
  if (allowedOrigins.includes('*')) {
    allowOrigin = '*';
  } else if (allowedOrigins.includes(requestOrigin)) {
    allowOrigin = requestOrigin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, x-admin-key, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  return null;
}
```

```typescript
// supabase/functions/_shared/auth.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

export async function authenticateRequest(req: Request): Promise<{
  userId: string;
  supabase: ReturnType<typeof createClient>;
}> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authHeader } },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  return { userId: user.id, supabase };
}
```

```typescript
// supabase/functions/_shared/response.ts
import { getCorsHeaders } from './cors.ts';

// Note: response helpers accept the original request to compute correct CORS origin
export function successResponse(data: unknown, status = 200, req?: Request): Response {
  const headers = req ? getCorsHeaders(req) : { 'Access-Control-Allow-Origin': '*' };
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400, req?: Request): Response {
  const headers = req ? getCorsHeaders(req) : { 'Access-Control-Allow-Origin': '*' };
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
```

```typescript
// supabase/functions/_shared/supabase-admin.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

### 5.2 Chat Function

```typescript
// supabase/functions/chat/index.ts
import { handleCors } from '../_shared/cors.ts';
import { authenticateRequest, isValidUUID } from '../_shared/auth.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { supabaseAdmin } from '../_shared/supabase-admin.ts';
import { assessSafety } from '../_shared/safety-guard.ts';
import { retrieveTherapyContext } from '../_shared/rag-pipeline.ts';
import { buildSystemPrompt } from '../_shared/prompt-builder.ts';
import { getProvider, sendMessage } from '../_shared/ai-provider.ts';

interface ChatRequest {
  sessionId: string;
  message: string;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { userId } = await authenticateRequest(req);
    const { sessionId, message } = await req.json() as ChatRequest;

    if (!sessionId || !message?.trim()) {
      return errorResponse('sessionId and message are required');
    }
    if (!isValidUUID(sessionId)) {
      return errorResponse('Invalid sessionId format');
    }

    // 1. Load session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('therapy_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return errorResponse('Session not found', 404);
    }

    if (session.status !== 'active') {
      return errorResponse('Session is not active');
    }

    // 2. Safety check (with Unicode normalization)
    const safety = assessSafety(message);

    if (safety.shouldLogEvent) {
      await supabaseAdmin.from('safety_events').insert({
        user_id: userId,
        session_id: sessionId,
        safety_level: safety.level,
        trigger_keywords: safety.triggeredKeywords,
        trigger_content: message.slice(0, 200), // Truncate for storage
        response_action: safety.level >= 2 ? 'crisis_response_sent' : 'logged',
      });

      // Update session safety level
      await supabaseAdmin
        .from('therapy_sessions')
        .update({
          safety_level: Math.max(session.safety_level, safety.level),
          crisis_detected: safety.level >= 2,
        })
        .eq('id', sessionId);
    }

    // 3. Store user message
    const { data: userMsg } = await supabaseAdmin
      .from('session_messages')
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: 'user',
        content: message,
        safety_score: safety.level,
        crisis_keywords: safety.triggeredKeywords,
        safety_response_triggered: safety.shouldPauseCoaching,
      })
      .select('id')
      .single();

    // 4. If crisis level >= 2, return safety response without AI coaching
    if (safety.shouldPauseCoaching && safety.response) {
      await supabaseAdmin.from('session_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role: 'assistant',
        content: safety.response,
        safety_score: safety.level,
      });

      return successResponse({
        reply: safety.response,
        safetyLevel: safety.level,
        sessionId,
        crisisResponseTriggered: true,
      });
    }

    // 5. Load user profile for context
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('preferred_language, primary_concerns, preferred_modalities')
      .eq('id', userId)
      .single();

    const language = profile?.preferred_language || 'en';

    // 6. RAG: retrieve relevant therapy knowledge (always uses OpenAI embeddings)
    const ragContext = await retrieveTherapyContext(
      message,
      session.modality,
      language
    );

    // 7. Build system prompt
    const systemPrompt = buildSystemPrompt({
      modality: session.modality,
      language,
      sessionGoal: session.session_goal,
      userConcerns: profile?.primary_concerns,
      currentSafetyLevel: safety.level,
    });

    // 8. Determine AI provider and send message
    const provider = session.ai_provider || getProvider();
    const providerState = session.provider_state || {};

    // For Claude: load conversation history from session_messages
    let sessionMessages: { role: string; content: string }[] = [];
    if (provider === 'claude') {
      const { data: history } = await supabaseAdmin
        .from('session_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: true });
      sessionMessages = history || [];
    }

    // Append RAG context to user message for the provider
    const messageWithContext = ragContext.contextText
      ? `${message}\n\n---\n[Relevant context from knowledge base]\n${ragContext.contextText}`
      : message;

    const aiResponse = await sendMessage(
      provider,
      systemPrompt,
      messageWithContext,
      providerState,
      sessionMessages
    );

    // 9. Store assistant reply
    await supabaseAdmin.from('session_messages').insert({
      session_id: sessionId,
      user_id: userId,
      role: 'assistant',
      content: aiResponse.content,
      content_language: language,
      rag_chunks_used: ragContext.chunks.length,
      knowledge_sources: ragContext.sourceDocs,
    });

    // 10. Update session stats and provider state
    await supabaseAdmin
      .from('therapy_sessions')
      .update({
        message_count: session.message_count + 2,
        last_active_at: new Date().toISOString(),
        provider_state: aiResponse.providerState,
      })
      .eq('id', sessionId);

    return successResponse({
      reply: aiResponse.content,
      safetyLevel: safety.level,
      sessionId,
      sourceDocs: ragContext.sourceDocs,
    });

  } catch (err) {
    console.error('Chat function error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});
```

### 5.3 Session Management Function

```typescript
// supabase/functions/session/index.ts
import { handleCors } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { supabaseAdmin } from '../_shared/supabase-admin.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { userId } = await authenticateRequest(req).catch(() => ({ userId: null }));
  if (!userId) return errorResponse('Unauthorized', 401);

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  // POST /session?action=create
  if (req.method === 'POST' && action === 'create') {
    const body = await req.json();
    const { modality = 'CBT', sessionGoal, initialMoodScore } = body;

    const { data, error } = await supabaseAdmin
      .from('therapy_sessions')
      .insert({
        user_id: userId,
        modality,
        session_goal: sessionGoal,
        initial_mood_score: initialMoodScore,
        status: 'active',
      })
      .select('*')
      .single();

    if (error) return errorResponse(error.message, 500);
    return successResponse({ session: data }, 201);
  }

  // POST /session?action=complete
  if (req.method === 'POST' && action === 'complete') {
    const { sessionId, finalMoodScore, keyThemes } = await req.json();

    const { data, error } = await supabaseAdmin
      .from('therapy_sessions')
      .update({
        status: 'completed',
        final_mood_score: finalMoodScore,
        key_themes: keyThemes,
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) return errorResponse(error.message, 500);
    return successResponse({ session: data });
  }

  // GET /session?action=list
  if (req.method === 'GET' && action === 'list') {
    const status = url.searchParams.get('status') || 'active';
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const { data, error } = await supabaseAdmin
      .from('therapy_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .order('last_active_at', { ascending: false })
      .limit(limit);

    if (error) return errorResponse(error.message, 500);
    return successResponse({ sessions: data });
  }

  // GET /session?action=messages&sessionId=...
  if (req.method === 'GET' && action === 'messages') {
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) return errorResponse('sessionId required');

    const { data, error } = await supabaseAdmin
      .from('session_messages')
      .select('id, role, content, created_at, technique_used')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) return errorResponse(error.message, 500);
    return successResponse({ messages: data });
  }

  return errorResponse('Unknown action', 400);
});
```

### 5.4 Mood Journal Function

```typescript
// supabase/functions/mood/index.ts
import { handleCors } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { supabaseAdmin } from '../_shared/supabase-admin.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { userId } = await authenticateRequest(req).catch(() => ({ userId: null }));
  if (!userId) return errorResponse('Unauthorized', 401);

  // POST: Log a mood entry
  if (req.method === 'POST') {
    const body = await req.json();
    const {
      moodScore, moodLabel, moodNotes,
      energyLevel, sleepQuality, stressTriggers,
      sessionId, timeOfDay,
    } = body;

    if (!moodScore || moodScore < 1 || moodScore > 10) {
      return errorResponse('moodScore must be between 1 and 10');
    }

    const { data, error } = await supabaseAdmin
      .from('mood_journal')
      .insert({
        user_id: userId,
        session_id: sessionId,
        mood_score: moodScore,
        mood_label: moodLabel,
        mood_notes: moodNotes,
        energy_level: energyLevel,
        sleep_quality: sleepQuality,
        stress_triggers: stressTriggers,
        time_of_day: timeOfDay,
      })
      .select('*')
      .single();

    if (error) return errorResponse(error.message, 500);
    return successResponse({ entry: data }, 201);
  }

  // GET: Retrieve mood history
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('mood_journal')
      .select('mood_score, mood_label, stress_triggers, time_of_day, recorded_at')
      .eq('user_id', userId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true });

    if (error) return errorResponse(error.message, 500);

    // Compute basic stats
    const scores = (data || []).map(e => e.mood_score);
    const avgMood = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;

    return successResponse({
      entries: data,
      stats: {
        averageMood: avgMood ? Math.round(avgMood * 10) / 10 : null,
        totalEntries: scores.length,
        trend: computeTrend(scores),
      },
    });
  }

  return errorResponse('Method not allowed', 405);
});

function computeTrend(scores: number[]): 'improving' | 'declining' | 'stable' | 'insufficient_data' {
  if (scores.length < 4) return 'insufficient_data';
  const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const diff = secondAvg - firstAvg;
  if (diff > 0.5) return 'improving';
  if (diff < -0.5) return 'declining';
  return 'stable';
}
```

### 5.5 Admin Function (Knowledge Base Management)

```typescript
// supabase/functions/admin/index.ts
// Protected by timing-safe admin key comparison

import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { supabaseAdmin } from '../_shared/supabase-admin.ts';
import { ingestDocument } from '../_shared/ingest.ts';

async function isAdminRequest(req: Request): Promise<boolean> {
  const adminKey = req.headers.get('x-admin-key');
  const expected = Deno.env.get('ADMIN_SECRET_KEY');
  if (!adminKey || !expected) return false;

  // Timing-safe comparison to prevent timing attacks
  const encoder = new TextEncoder();
  const a = encoder.encode(adminKey);
  const b = encoder.encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (!(await isAdminRequest(req))) {
    return errorResponse('Unauthorized', 401);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  // POST /admin?action=ingest — Add knowledge base document
  if (req.method === 'POST' && action === 'ingest') {
    const doc = await req.json();
    await ingestDocument(doc);
    return successResponse({ message: 'Document ingested successfully' });
  }

  // GET /admin?action=safety-events — Review unhandled safety events
  if (req.method === 'GET' && action === 'safety-events') {
    const { data, error } = await supabaseAdmin
      .from('safety_events')
      .select('*, therapy_sessions(user_id)')
      .eq('reviewed', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return errorResponse(error.message, 500);
    return successResponse({ events: data });
  }

  // POST /admin?action=setup-config — Create/update AI provider config
  if (req.method === 'POST' && action === 'setup-config') {
    const { name, systemPrompt, modality, language, model = 'gpt-4o', provider = 'openai' } = await req.json();

    await supabaseAdmin.from('assistant_config').upsert({
      name,
      provider,
      model,
      system_prompt: systemPrompt,
      modality,
      language,
      is_active: true,
    });

    return successResponse({ name, provider, model });
  }

  return errorResponse('Unknown action', 400);
});
```

---

## 6. Auth & Security

### 6.1 Supabase Auth Integration

```typescript
// Frontend: auth/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Sign up with email
export async function signUp(email: string, password: string, displayName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });
  return { data, error };
}

// Sign in
export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

// Get current session token (for API calls)
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// Authenticated API call helper
export async function callEdgeFunction(
  functionName: string,
  body?: unknown,
  method = 'POST'
): Promise<unknown> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${functionName}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'API call failed');
  }

  return response.json();
}
```

### 6.2 Auth State Management (React)

```typescript
// hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../auth/supabase-client';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, loading };
}
```

### 6.3 Data Privacy Considerations

**Sensitive data handling:**
```sql
-- Anonymize safety event trigger content
-- Store only first 200 chars, never full message
-- Trigger content is for safety review only, not training data

-- Audit log for data access (optional but recommended)
CREATE TABLE public.data_access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  accessed_by UUID REFERENCES auth.users(id), -- For therapist access
  resource_type TEXT, -- 'session', 'message', 'mood_entry'
  resource_id UUID,
  access_type TEXT, -- 'read', 'export', 'delete'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**HIPAA-awareness (if targeting US healthcare):**
- Implement data retention policies (auto-delete after N years)
- Provide data export functionality (GDPR/CCPA compliance)
- Log all data access by admin/support roles
- Use encrypted fields for especially sensitive content
- Never log full therapy message content to application logs

```typescript
// Data export utility
export async function exportUserData(userId: string) {
  const [profile, sessions, moods, progress] = await Promise.all([
    supabaseAdmin.from('user_profiles').select('*').eq('id', userId).single(),
    supabaseAdmin.from('therapy_sessions').select('*').eq('user_id', userId),
    supabaseAdmin.from('mood_journal').select('*').eq('user_id', userId),
    supabaseAdmin.from('progress_tracking').select('*').eq('user_id', userId),
  ]);

  // Messages are heavy — paginate for large exports
  const { data: messages } = await supabaseAdmin
    .from('session_messages')
    .select('session_id, role, content, created_at')
    .eq('user_id', userId)
    .order('created_at');

  return {
    exportedAt: new Date().toISOString(),
    profile: profile.data,
    sessions: sessions.data,
    messages,
    moodJournal: moods.data,
    progress: progress.data,
  };
}
```

### 6.4 Rate Limiting Pattern

```typescript
// supabase/functions/_shared/rate-limit.ts
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

// Simple in-memory rate limiter (use Redis/Upstash for production)
const requestCounts = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(userId, { count: 1, windowStart: now });
    return true; // allowed
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false; // rate limited
  }

  entry.count++;
  return true; // allowed
}
```

### 6.5 Security Hardening

**CORS origin allowlist:**

CORS is controlled via the `ALLOWED_ORIGINS` environment variable (comma-separated list of allowed origins). Falls back to permissive `*` for local development when unset.

```bash
# Production example
ALLOWED_ORIGINS=https://lumi-ui.vercel.app,https://app.mindlumi.com
```

**Timing-safe admin key comparison:**

The admin endpoint uses `crypto.subtle.timingSafeEqual` to compare the `x-admin-key` header against the stored secret, preventing timing-based side-channel attacks.

**Unicode normalization in safety guard:**

Safety keyword matching normalizes input with Unicode NFKD decomposition and strips zero-width characters (`\u200B-\u200F`, `\u2028-\u202F`, `\uFEFF`) before scanning. This prevents bypass attempts using homoglyphs, combining characters, or invisible Unicode.

**Input sanitization in prompt builder:**

The `buildSystemPrompt()` and message pipeline sanitize user inputs before inclusion:
- Collapse multiple newlines to single newline
- Strip markdown/HTML markup from user-provided values (session goals, concern lists)
- Length cap on user-provided fields injected into system prompt (prevents prompt inflation)

**UUID validation on all ID parameters:**

All edge functions validate that `sessionId`, `userId`, and other ID parameters match UUID format (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) before database queries.
```

---

## 7. Frontend Patterns

### 7.1 Chat Interface Component

```typescript
// components/ChatInterface.tsx
import { useState, useRef, useEffect } from 'react';
import { callEdgeFunction } from '../auth/supabase-client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  safetyLevel?: number;
  crisisResponseTriggered?: boolean;
}

interface ChatInterfaceProps {
  sessionId: string;
  initialMessages?: Message[];
  onSessionEnd?: () => void;
}

export function ChatInterface({ sessionId, initialMessages = [], onSessionEnd }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await callEdgeFunction('chat', {
        sessionId,
        message: input.trim(),
      }) as {
        reply: string;
        safetyLevel: number;
        crisisResponseTriggered?: boolean;
      };

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.reply,
        createdAt: new Date().toISOString(),
        safetyLevel: response.safetyLevel,
        crisisResponseTriggered: response.crisisResponseTriggered,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove the optimistically added user message on error
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && <TypingIndicator />}
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Share what's on your mind..."
            className="flex-1 resize-none rounded-lg border p-3 text-sm focus:outline-none focus:ring-2"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Lumi is an AI coaching tool, not a licensed therapist. In crisis? Call 988 or text HOME to 741741.
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isCrisis = message.crisisResponseTriggered;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? 'bg-primary text-white rounded-br-sm'
            : isCrisis
            ? 'bg-red-50 border border-red-200 text-gray-800 rounded-bl-sm'
            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-600">✕</button>
    </div>
  );
}
```

### 7.2 Session Start Flow

```typescript
// components/NewSessionFlow.tsx
import { useState } from 'react';
import { callEdgeFunction } from '../auth/supabase-client';

type Modality = 'CBT' | 'DBT' | 'ACT' | 'mindfulness' | 'mixed';

const MODALITY_DESCRIPTIONS: Record<Modality, { label: string; description: string; emoji: string }> = {
  CBT: {
    label: 'Cognitive Behavioral',
    description: 'Identify and reframe unhelpful thought patterns',
    emoji: '🧠',
  },
  DBT: {
    label: 'Dialectical Behavior',
    description: 'Balance acceptance with change, build emotion regulation skills',
    emoji: '⚖️',
  },
  ACT: {
    label: 'Values-Based Action',
    description: 'Act in alignment with your values, accept difficult feelings',
    emoji: '🧭',
  },
  mindfulness: {
    label: 'Mindfulness',
    description: 'Present-moment awareness, grounding, and meditation',
    emoji: '🌱',
  },
  mixed: {
    label: 'Let Lumi decide',
    description: 'Lumi will adapt the approach to what you need',
    emoji: '✨',
  },
};

interface NewSessionFlowProps {
  onSessionCreated: (sessionId: string) => void;
}

export function NewSessionFlow({ onSessionCreated }: NewSessionFlowProps) {
  const [step, setStep] = useState<'mood' | 'goal' | 'modality'>('mood');
  const [moodScore, setMoodScore] = useState(5);
  const [sessionGoal, setSessionGoal] = useState('');
  const [modality, setModality] = useState<Modality>('mixed');
  const [loading, setLoading] = useState(false);

  const createSession = async () => {
    setLoading(true);
    try {
      const response = await callEdgeFunction('session?action=create', {
        modality,
        sessionGoal: sessionGoal || undefined,
        initialMoodScore: moodScore,
      }) as { session: { id: string } };

      onSessionCreated(response.session.id);
    } catch (err) {
      console.error('Failed to create session:', err);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'mood') {
    return (
      <div className="space-y-6 p-6">
        <h2 className="text-xl font-semibold">How are you feeling right now?</h2>
        <MoodSlider value={moodScore} onChange={setMoodScore} />
        <button onClick={() => setStep('goal')} className="w-full btn-primary">
          Continue
        </button>
      </div>
    );
  }

  if (step === 'goal') {
    return (
      <div className="space-y-6 p-6">
        <h2 className="text-xl font-semibold">What would you like to focus on today?</h2>
        <textarea
          value={sessionGoal}
          onChange={e => setSessionGoal(e.target.value)}
          placeholder="e.g., 'I've been feeling anxious about work deadlines' or 'I want to process something that happened with my family'"
          className="w-full rounded-lg border p-3 text-sm h-28 resize-none"
        />
        <p className="text-sm text-gray-500">Optional — you can also just start talking</p>
        <button onClick={() => setStep('modality')} className="w-full btn-primary">
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-xl font-semibold">Choose an approach</h2>
      <div className="grid grid-cols-1 gap-3">
        {(Object.keys(MODALITY_DESCRIPTIONS) as Modality[]).map(m => (
          <button
            key={m}
            onClick={() => setModality(m)}
            className={`p-4 rounded-xl border text-left transition-all ${
              modality === m ? 'border-primary bg-primary/5' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{MODALITY_DESCRIPTIONS[m].emoji}</span>
              <div>
                <div className="font-medium">{MODALITY_DESCRIPTIONS[m].label}</div>
                <div className="text-sm text-gray-500">{MODALITY_DESCRIPTIONS[m].description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <button onClick={createSession} disabled={loading} className="w-full btn-primary">
        {loading ? 'Starting session...' : 'Begin Session'}
      </button>
    </div>
  );
}

function MoodSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const MOOD_LABELS = ['', 'Very Low', 'Low', 'Below Avg', 'Somewhat Low', 'Neutral', 'Okay', 'Good', 'Pretty Good', 'Great', 'Excellent'];

  return (
    <div className="space-y-3">
      <div className="text-4xl text-center">{getMoodEmoji(value)}</div>
      <div className="text-center font-medium">{MOOD_LABELS[value]}</div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>1 — Very low</span>
        <span>10 — Excellent</span>
      </div>
    </div>
  );
}

function getMoodEmoji(score: number): string {
  if (score <= 2) return '😔';
  if (score <= 4) return '😟';
  if (score <= 6) return '😐';
  if (score <= 8) return '🙂';
  return '😊';
}
```

### 7.3 Mood Dashboard Component

```typescript
// components/MoodDashboard.tsx
import { useEffect, useState } from 'react';
import { callEdgeFunction } from '../auth/supabase-client';

interface MoodEntry {
  mood_score: number;
  mood_label: string;
  recorded_at: string;
  time_of_day: string;
}

interface MoodStats {
  averageMood: number | null;
  totalEntries: number;
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
}

export function MoodDashboard() {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [stats, setStats] = useState<MoodStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callEdgeFunction('mood?days=30', undefined, 'GET')
      .then((res: any) => {
        setEntries(res.entries || []);
        setStats(res.stats);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  const trendConfig = {
    improving: { label: 'Improving', color: 'text-green-600', emoji: '📈' },
    declining: { label: 'Needs attention', color: 'text-orange-500', emoji: '📉' },
    stable: { label: 'Stable', color: 'text-blue-600', emoji: '➡️' },
    insufficient_data: { label: 'Keep tracking', color: 'text-gray-500', emoji: '📊' },
  };

  const trend = stats?.trend ?? 'insufficient_data';

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-semibold">Mood Journey</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-primary">
            {stats?.averageMood ?? '—'}
          </div>
          <div className="text-xs text-gray-500">Avg Mood</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold">{stats?.totalEntries ?? 0}</div>
          <div className="text-xs text-gray-500">Check-ins</div>
        </div>
        <div className={`bg-gray-50 rounded-xl p-3 text-center ${trendConfig[trend].color}`}>
          <div className="text-2xl">{trendConfig[trend].emoji}</div>
          <div className="text-xs">{trendConfig[trend].label}</div>
        </div>
      </div>

      {/* Mood Chart — simple bar chart */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-600">Last 30 Days</h3>
          <div className="flex items-end gap-1 h-24">
            {entries.slice(-30).map((entry, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-primary rounded-sm opacity-70 transition-all"
                  style={{ height: `${(entry.mood_score / 10) * 100}%` }}
                  title={`${entry.mood_score}/10 — ${new Date(entry.recorded_at).toLocaleDateString()}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-2">🌱</div>
          <p className="text-sm">Start logging your mood to track your journey</p>
        </div>
      )}
    </div>
  );
}
```

### 7.4 Onboarding Flow

```typescript
// components/Onboarding.tsx
const ONBOARDING_STEPS = [
  'welcome',
  'concerns',
  'experience',
  'language',
  'safety',
  'complete',
] as const;

type OnboardingStep = typeof ONBOARDING_STEPS[number];

const CONCERN_OPTIONS = [
  { id: 'anxiety', label: 'Anxiety', emoji: '😰' },
  { id: 'depression', label: 'Depression', emoji: '😔' },
  { id: 'relationships', label: 'Relationships', emoji: '💔' },
  { id: 'grief', label: 'Grief & Loss', emoji: '🕊️' },
  { id: 'burnout', label: 'Burnout', emoji: '🔥' },
  { id: 'trauma', label: 'Trauma', emoji: '🌊' },
  { id: 'self-esteem', label: 'Self-esteem', emoji: '🪞' },
  { id: 'stress', label: 'Stress', emoji: '⚡' },
];

// Onboarding saves to user_profiles via direct Supabase call
// (no edge function needed — RLS allows user to write own profile)
export async function saveOnboardingData(
  userId: string,
  concerns: string[],
  therapyExperience: string,
  language: string
) {
  return supabase
    .from('user_profiles')
    .update({
      primary_concerns: concerns,
      therapy_experience: therapyExperience,
      preferred_language: language,
      onboarding_completed: true,
    })
    .eq('id', userId);
}
```

---

## 8. Deployment & Operations

### 8.1 Project Structure

```
MindLumi/
├── supabase/
│   ├── functions/
│   │   ├── _shared/           # Shared utilities
│   │   │   ├── cors.ts            # Origin-allowlist CORS
│   │   │   ├── auth.ts            # JWT auth + UUID validation
│   │   │   ├── response.ts        # Standard JSON response helpers
│   │   │   ├── supabase-admin.ts  # Service role client
│   │   │   ├── ai-provider.ts     # Unified provider interface + factory
│   │   │   ├── openai-responses.ts # OpenAI Responses API client
│   │   │   ├── claude-client.ts   # Claude Messages API client
│   │   │   ├── rag-pipeline.ts    # Multi-query expansion + pgvector search
│   │   │   ├── prompt-builder.ts  # Dynamic system prompt + input sanitization
│   │   │   ├── safety-guard.ts    # Tiered crisis detection + Unicode normalization
│   │   │   └── ingest.ts          # Document chunking + batch embedding
│   │   ├── chat/
│   │   │   └── index.ts
│   │   ├── session/
│   │   │   └── index.ts
│   │   ├── mood/
│   │   │   └── index.ts
│   │   └── admin/
│   │       └── index.ts
│   ├── migrations/
│   │   ├── 20240101000000_extensions.sql
│   │   ├── 20240101000001_user_profiles.sql
│   │   ├── 20240101000002_therapy_sessions.sql
│   │   ├── 20240101000003_session_messages.sql
│   │   ├── 20240101000004_mood_journal.sql
│   │   ├── 20240101000005_progress_tracking.sql
│   │   ├── 20240101000006_knowledge_base.sql
│   │   ├── 20240101000007_assistant_config.sql
│   │   ├── 20240101000008_safety_events.sql
│   │   └── 20240101000009_rls_policies.sql
│   └── config.toml
├── lumi-ui/                   # Test console (Vercel-deployed)
│   ├── app/
│   ├── components/
│   ├── hooks/
│   └── auth/
├── knowledgebase/             # Source documents for ingestion
│   ├── en/
│   │   ├── cbt/
│   │   ├── dbt/
│   │   ├── mindfulness/
│   │   └── psychoeducation/
│   └── ar/
│       ├── cbt/
│       └── mindfulness/
├── scripts/
│   ├── setup.ts               # Initial config setup
│   ├── seed-knowledge-base.ts # Ingest initial KB documents
│   ├── export-user-data.ts    # GDPR data export
│   └── test-safety.ts         # Validate safety guardrails
├── .env.example               # Template for environment variables
├── .env.local                 # Local secrets (git-ignored)
├── Skill.md                   # This development reference
└── README.md
```

### 8.2 Environment Variables

```bash
# .env.local
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AI_PROVIDER=openai  # or "claude"
ADMIN_SECRET_KEY=your-secure-admin-key
ALLOWED_ORIGINS=https://lumi-ui.vercel.app

# Frontend (NEXT_PUBLIC_ prefix for Next.js)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

```bash
# supabase/config.toml — Edge function secrets
# Set via: supabase secrets set --env-file .env.local --project-ref <ref>
# Or Supabase Dashboard → Project Settings → Edge Functions → Secrets

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AI_PROVIDER=openai
ADMIN_SECRET_KEY=...
ALLOWED_ORIGINS=https://lumi-ui.vercel.app
SUPABASE_SERVICE_ROLE_KEY=...  # Auto-available in Edge Functions
```

### 8.3 Local Development Setup

> See [Quick Start](#0-quick-start-new-machine-setup) for first-time setup from scratch.

```bash
# 1. Install Supabase CLI
brew install supabase/tap/supabase  # or: npm install -g supabase

# 2. Start local Supabase
supabase start

# 3. Run migrations
supabase db reset  # Applies all migrations in order

# 4. Start Edge Functions locally
supabase functions serve --env-file .env.local

# 5. Test chat function
curl -X POST http://localhost:54321/functions/v1/chat \
  -H "Authorization: Bearer YOUR_LOCAL_ANON_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-session-id", "message": "I feel anxious today"}'
```

### 8.4 Deployment Commands

```bash
# Deploy all edge functions (--no-verify-jwt since auth is handled in code)
supabase functions deploy chat --no-verify-jwt --project-ref <ref>
supabase functions deploy session --no-verify-jwt --project-ref <ref>
supabase functions deploy mood --no-verify-jwt --project-ref <ref>
supabase functions deploy admin --no-verify-jwt --project-ref <ref>

# Set production secrets (all at once from env file)
supabase secrets set --env-file .env.local --project-ref <ref>

# Or set individually
supabase secrets set OPENAI_API_KEY=sk-... --project-ref <ref>
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <ref>
supabase secrets set AI_PROVIDER=openai --project-ref <ref>
supabase secrets set ADMIN_SECRET_KEY=... --project-ref <ref>
supabase secrets set ALLOWED_ORIGINS=https://lumi-ui.vercel.app --project-ref <ref>

# Push migrations to production
supabase db push --project-ref <ref>

# Check function logs
supabase functions logs chat --project-ref <ref>
```

### 8.5 Setup Script

```typescript
// scripts/setup.ts
// Run: deno run --allow-env --allow-net scripts/setup.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildSystemPrompt } from '../supabase/functions/_shared/prompt-builder.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function setupConfig() {
  const provider = Deno.env.get('AI_PROVIDER') || 'openai';
  const model = provider === 'claude' ? 'claude-sonnet-4-20250514' : 'gpt-4o';

  console.log(`Setting up ${provider} config (model: ${model})...`);

  const systemPrompt = buildSystemPrompt({
    modality: 'mixed',
    language: 'en',
    currentSafetyLevel: 0,
  });

  await supabase.from('assistant_config').upsert({
    name: 'lumi-main-en',
    provider,
    model,
    system_prompt: systemPrompt,
    modality: 'mixed',
    language: 'en',
    is_active: true,
  });

  console.log(`✓ Config created for ${provider} (${model})`);
}

// Run setup
setupConfig()
  .then(() => console.log('Setup complete.'))
  .catch(err => {
    console.error('Setup failed:', err);
    Deno.exit(1);
  });
```

### 8.6 Knowledge Base Seed Script

```typescript
// scripts/seed-knowledge-base.ts
import { ingestDocument } from '../supabase/functions/_shared/ingest.ts';

const INITIAL_DOCUMENTS = [
  {
    title: 'CBT Thought Record Guide',
    description: 'Step-by-step guide to completing a thought record',
    contentType: 'exercise' as const,
    modality: ['CBT'],
    language: 'en',
    tags: ['thought-record', 'cognitive-distortions', 'reframing'],
    content: `
# Thought Record: Identifying and Challenging Unhelpful Thoughts

A thought record helps you examine the connection between situations, thoughts, feelings, and behaviors.

## Step 1: Identify the Situation
Describe the specific situation that triggered the distressing emotion.
Ask: When did this happen? Where were you? Who was there?

## Step 2: Name the Emotions
List the emotions you felt and rate their intensity (0-100%).
Common emotions: anxious, sad, angry, ashamed, hopeless, frustrated, guilty.

## Step 3: Identify Automatic Thoughts
Write down the thoughts that went through your mind.
Ask: What was going through my mind just before I felt this way?
What does this mean about me? About my life? About my future?

## Step 4: Look for Evidence
Evidence FOR the automatic thought:
- What facts support this thought?

Evidence AGAINST the automatic thought:
- What facts contradict this thought?
- What would I tell a friend in this situation?
- Am I taking a small part of the picture and ignoring the rest?

## Step 5: Create a Balanced Thought
Write a more balanced, realistic thought that considers all the evidence.
This isn't about forced positivity — it's about accuracy.

## Step 6: Re-rate Your Emotions
Rate your emotion intensity again (0-100%). Even a small change is meaningful progress.

## Common Cognitive Distortions to Watch For:
- **All-or-nothing thinking**: "I always fail" / "Everything is ruined"
- **Catastrophizing**: Expecting the worst possible outcome
- **Mind reading**: Assuming you know what others are thinking
- **Emotional reasoning**: "I feel bad, therefore things ARE bad"
- **Should statements**: Rigid rules about how you/others must behave
- **Personalization**: Blaming yourself for things outside your control
    `,
  },
  {
    title: 'Grounding Techniques for Anxiety',
    description: 'Evidence-based grounding techniques to manage acute anxiety',
    contentType: 'exercise' as const,
    modality: ['mindfulness', 'DBT', 'somatic'],
    language: 'en',
    tags: ['grounding', 'anxiety', 'distress-tolerance', '5-4-3-2-1'],
    content: `
# Grounding Techniques for Anxiety and Overwhelm

Grounding brings your attention back to the present moment when anxiety carries you into worry about the future or rumination about the past.

## The 5-4-3-2-1 Technique
Use your senses to anchor yourself right now:
- **5 things you can see**: Name them out loud or in your head
- **4 things you can touch**: Notice the textures, temperatures
- **3 things you can hear**: Near and far sounds
- **2 things you can smell**: Or two things you like the smell of
- **1 thing you can taste**: Even the taste in your mouth right now

## Box Breathing (4-4-4-4)
1. Breathe IN for 4 counts
2. HOLD for 4 counts
3. Breathe OUT for 4 counts
4. HOLD for 4 counts
Repeat 4-6 times. This activates the parasympathetic nervous system.

## Cold Water Reset
Splash cold water on your face or hold ice cubes. Cold activates the diving reflex, slowing your heart rate and reducing anxiety. This is a DBT TIPP skill (Temperature).

## Body Scan Grounding
Start at your feet. Notice the sensation of ground beneath them.
Move slowly up: ankles, calves, knees, thighs, hips, belly, chest, shoulders, arms, hands, neck, face.
Just notice — don't try to change anything.

## Safe Place Visualization
Close your eyes and imagine a place where you feel completely safe and calm.
It can be real or imagined. Use all your senses — what do you see, hear, smell, feel?
Spend 2-3 minutes there.

## When to Use Grounding
- Before stressful situations
- During panic attacks
- When dissociating or feeling unreal
- Before bed when anxious thoughts escalate
- Any time you feel overwhelmed

Remember: Grounding doesn't eliminate anxiety permanently — it creates a pause so you can respond rather than react.
    `,
  },
];

async function seedKnowledgeBase() {
  for (const doc of INITIAL_DOCUMENTS) {
    try {
      await ingestDocument(doc);
    } catch (err) {
      console.error(`Failed to ingest "${doc.title}":`, err);
    }
  }
  console.log('Seeding complete!');
}

seedKnowledgeBase();
```

### 8.7 Monitoring & Logging Patterns

```typescript
// supabase/functions/_shared/logger.ts

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  function: string;
  message: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  duration?: number;
}

// Structured logging — visible in Supabase function logs
export function log(entry: LogEntry): void {
  const output = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  // Never log message content (therapy data is sensitive)
  console.log(JSON.stringify(output));
}

// Performance wrapper
export async function withTiming<T>(
  label: string,
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  const durationMs = Date.now() - start;
  return { result, durationMs };
}

// Usage in edge function:
// const { result: ragContext, durationMs } = await withTiming('rag-retrieval', () =>
//   retrieveTherapyContext(message, session.modality, language)
// );
// log({ level: 'info', function: 'chat', message: 'RAG complete', duration: durationMs });
```

### 8.8 Claude Code CLI Compatibility

This project is fully compatible with Claude Code CLI. The `.github/copilot-instructions.md`
and `Skill.md` provide context that AI coding assistants can use to understand the codebase.

Key commands for AI-assisted development:
```bash
supabase functions deploy <name> --no-verify-jwt --project-ref <ref>  # deploy a function
supabase db push                                                       # push migrations to remote
supabase secrets set KEY=value --project-ref <ref>                     # set production secrets
```

Edge functions use the Deno runtime — imports from `https://esm.sh/` and `jsr:` registries.

---

## 9. Knowledge Base Strategy

### 9.1 Content Categories

Organize knowledge base content into these categories for systematic coverage:

```
knowledgebase/
├── en/
│   ├── cbt/
│   │   ├── thought-records.md
│   │   ├── behavioral-activation.md
│   │   ├── cognitive-distortions.md
│   │   ├── problem-solving.md
│   │   └── exposure-hierarchy.md
│   ├── dbt/
│   │   ├── distress-tolerance.md
│   │   ├── emotion-regulation.md
│   │   ├── interpersonal-effectiveness.md
│   │   └── mindfulness-core.md
│   ├── act/
│   │   ├── values-clarification.md
│   │   ├── defusion-exercises.md
│   │   └── committed-action.md
│   ├── mindfulness/
│   │   ├── basic-meditation.md
│   │   ├── body-scan.md
│   │   └── mindful-breathing.md
│   ├── somatic/
│   │   ├── nervous-system-basics.md
│   │   ├── polyvagal-theory.md
│   │   └── somatic-exercises.md
│   ├── psychoeducation/
│   │   ├── anxiety-overview.md
│   │   ├── depression-overview.md
│   │   ├── grief-stages.md
│   │   ├── burnout-signs.md
│   │   └── trauma-responses.md
│   └── exercises/
│       ├── journaling-prompts.md
│       ├── self-compassion.md
│       └── gratitude-practices.md
└── ar/
    ├── cbt/  (Arabic translations + cultural adaptations)
    ├── psychoeducation/
    └── exercises/
```

### 9.2 Bilingual Knowledge Base Pattern

```typescript
// Bilingual document ingestion
interface BilingualDocument {
  en: IngestDocument;
  ar: IngestDocument;
}

async function ingestBilingual(docs: BilingualDocument): Promise<void> {
  await Promise.all([
    ingestDocument(docs.en),
    ingestDocument(docs.ar),
  ]);
}

// During RAG retrieval, language is a filter:
// filter_language = user's preferred_language from profile
// Falls back to 'en' if no Arabic content found
async function retrieveWithFallback(
  message: string,
  modality: string,
  language: string
): Promise<RAGContext> {
  const context = await retrieveTherapyContext(message, modality, language);

  // Fall back to English if no results in target language
  if (context.chunks.length === 0 && language !== 'en') {
    return retrieveTherapyContext(message, modality, 'en');
  }

  return context;
}
```

### 9.3 Document Quality Guidelines

When creating knowledge base content:

**Structure:**
- Lead with the core concept (what and why)
- Include step-by-step instructions where applicable
- Add examples that feel relatable (not clinical case studies)
- Close with when/how to apply in daily life
- Target 300-600 words per document (chunks at ~400 words)

**Tone:**
- Warm, accessible — written as if explaining to a curious friend
- Second person ("you") not third person ("the client")
- Normalize struggle: "Many people find..." / "It's common to..."
- Avoid jargon; explain terms when used

**Cultural adaptation for Arabic content:**
- Account for collectivist values (family, community, honor)
- Integrate concepts around spiritual wellbeing where relevant
- Avoid assumptions about nuclear family structure
- Use Gulf/Levantine dialect awareness in translations
- Consider gender dynamics and social context

### 9.4 Semantic Search Tuning

```sql
-- Test search quality with this query
SELECT
  content,
  similarity,
  document_title
FROM search_knowledge_base(
  -- Replace with actual embedding from your test query
  '[0.1, 0.2, ...]'::vector(1536),
  0.65,  -- Lower threshold = more results, less precise
  8,     -- Increase for broader coverage
  'CBT',
  'en'
)
ORDER BY similarity DESC;

-- Monitor search performance
EXPLAIN ANALYZE
SELECT * FROM search_knowledge_base(...)
-- Look for "Index Scan using idx_knowledge_chunks_embedding"
-- If not using index, check HNSW parameters
```

**Tuning guidelines:**
- `match_threshold 0.65-0.72`: Good for therapy domain (allow some semantic looseness)
- `match_count 5-8`: 5 for focused response, 8 for richer context
- If results are too broad: raise threshold to 0.75+
- If results are too narrow: lower threshold to 0.60
- Use multi-query expansion to improve recall before adjusting threshold

### 9.5 Knowledge Base Maintenance

```typescript
// scripts/kb-maintenance.ts

// List documents by modality
async function listDocuments(modality?: string) {
  const query = supabaseAdmin
    .from('knowledge_documents')
    .select('id, title, modality, language, created_at');

  if (modality) {
    query.contains('modality', [modality]);
  }

  const { data } = await query.order('created_at', { ascending: false });
  return data;
}

// Deactivate outdated document
async function deactivateDocument(documentId: string) {
  return supabaseAdmin
    .from('knowledge_documents')
    .update({ is_active: false })
    .eq('id', documentId);
}

// Re-embed document (if model changes)
async function reembedDocument(documentId: string) {
  const { data: chunks } = await supabaseAdmin
    .from('knowledge_chunks')
    .select('id, content')
    .eq('document_id', documentId);

  if (!chunks) return;

  const embeddings = await batchEmbed(chunks.map(c => c.content));

  for (let i = 0; i < chunks.length; i++) {
    await supabaseAdmin
      .from('knowledge_chunks')
      .update({ embedding: embeddings[i] })
      .eq('id', chunks[i].id);
  }
}

// When switching embedding models (e.g., text-embedding-3-small → large):
// 1. Add new column for new embedding
// 2. Re-embed all chunks in batches
// 3. Update search function to use new column
// 4. Test search quality
// 5. Drop old column
```

---

## Quick Reference

### Edge Function URLs
```
POST /functions/v1/chat              — Send message in session
POST /functions/v1/session?action=create   — Start new session
POST /functions/v1/session?action=complete — End session
GET  /functions/v1/session?action=list     — List sessions
GET  /functions/v1/session?action=messages — Get session messages
POST /functions/v1/mood              — Log mood entry
GET  /functions/v1/mood?days=30      — Get mood history
POST /functions/v1/admin?action=ingest       — Ingest KB document (admin)
POST /functions/v1/admin?action=setup-config — Create/update provider config (admin)
GET  /functions/v1/admin?action=safety-events — Review safety events (admin)
```

### Safety Level Reference
```
Level 0: Normal — proceed with coaching
Level 1: Mild distress — increase warmth, log event
Level 2: Moderate crisis — send crisis resources, pause coaching
Level 3: Acute crisis — crisis response only, no coaching, escalate
```

### Key Environment Variables
```
OPENAI_API_KEY           — OpenAI access (Responses API + embeddings)
ANTHROPIC_API_KEY        — Anthropic access (Claude Messages API)
AI_PROVIDER              — Active chat provider: "openai" or "claude"
SUPABASE_URL             — Project URL
SUPABASE_ANON_KEY        — Public frontend key
SUPABASE_SERVICE_ROLE_KEY — Admin edge function access
ADMIN_SECRET_KEY         — Admin endpoint protection (timing-safe comparison)
ALLOWED_ORIGINS          — Comma-separated CORS origins
```

### Database Quick Commands
```sql
-- Count active sessions today
SELECT COUNT(*) FROM therapy_sessions
WHERE DATE(created_at) = CURRENT_DATE AND status = 'active';

-- Recent safety events needing review
SELECT * FROM safety_events
WHERE reviewed = FALSE AND safety_level >= 2
ORDER BY created_at DESC LIMIT 10;

-- Knowledge base coverage by modality
SELECT unnest(modality) AS modality, COUNT(*) AS doc_count
FROM knowledge_documents WHERE is_active = TRUE
GROUP BY 1 ORDER BY 2 DESC;

-- Average mood score trend last 7 days
SELECT DATE(recorded_at) AS date, ROUND(AVG(mood_score)::numeric, 2) AS avg_mood
FROM mood_journal
WHERE recorded_at >= NOW() - INTERVAL '7 days'
GROUP BY 1 ORDER BY 1;
```

---

*Lumi — Building space for healing, one conversation at a time.*
