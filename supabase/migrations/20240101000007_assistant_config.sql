DROP TABLE IF EXISTS public.assistant_config CASCADE;

CREATE TABLE public.assistant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,

  -- Provider settings
  provider TEXT DEFAULT 'openai' CHECK (provider IN ('openai', 'claude')),
  model TEXT DEFAULT 'gpt-4o',
  system_prompt TEXT NOT NULL,
  temperature FLOAT DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1024,

  -- Therapy config
  modality TEXT,
  language TEXT DEFAULT 'en',

  -- State
  is_active BOOLEAN DEFAULT TRUE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
