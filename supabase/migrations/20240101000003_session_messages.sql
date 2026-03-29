DROP TABLE IF EXISTS public.session_messages CASCADE;

CREATE TABLE public.session_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  content_language TEXT DEFAULT 'en',

  -- Provider-agnostic references
  provider_message_id TEXT,  -- Response/message ID from the AI provider
  provider_run_id TEXT,      -- Run/response ID that generated this message

  -- Safety metadata
  safety_score INTEGER DEFAULT 0 CHECK (safety_score BETWEEN 0 AND 3),
  crisis_keywords TEXT[],
  safety_response_triggered BOOLEAN DEFAULT FALSE,

  -- Therapy metadata
  technique_used TEXT,
  emotion_detected TEXT[],

  -- RAG context used
  rag_chunks_used INTEGER DEFAULT 0,
  knowledge_sources TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_messages_session_id ON public.session_messages(session_id);
CREATE INDEX idx_session_messages_created_at ON public.session_messages(created_at DESC);
CREATE INDEX idx_session_messages_safety ON public.session_messages(safety_score) WHERE safety_score > 0;
