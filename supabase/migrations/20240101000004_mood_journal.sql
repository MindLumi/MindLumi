DROP TABLE IF EXISTS public.mood_journal CASCADE;

CREATE TABLE public.mood_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.therapy_sessions(id),

  -- Mood data
  mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 10),
  mood_label TEXT,
  mood_notes TEXT,

  -- Context
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
  stress_triggers TEXT[],

  -- Timing
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  time_of_day TEXT CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'night'))
);

CREATE INDEX idx_mood_journal_user_id ON public.mood_journal(user_id);
CREATE INDEX idx_mood_journal_recorded_at ON public.mood_journal(recorded_at DESC);
