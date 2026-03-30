DROP TABLE IF EXISTS public.therapy_sessions CASCADE;

CREATE TABLE public.therapy_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- AI provider binding (replaces openai_thread_id)
  ai_provider TEXT DEFAULT 'openai' CHECK (ai_provider IN ('openai', 'claude')),
  provider_state JSONB DEFAULT '{}'::jsonb,
  -- OpenAI: { "previous_response_id": "resp_xxx" }
  -- Claude: {} (stateless — history rebuilt from session_messages)

  -- Session metadata
  title TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  modality TEXT DEFAULT 'CBT' CHECK (modality IN ('CBT', 'DBT', 'ACT', 'mindfulness', 'somatic', 'IFS', 'narrative', 'psychoeducation', 'mixed')),

  -- Session goals and context
  session_goal TEXT,
  initial_mood_score INTEGER CHECK (initial_mood_score BETWEEN 1 AND 10),
  final_mood_score INTEGER CHECK (final_mood_score BETWEEN 1 AND 10),
  key_themes TEXT[],

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
