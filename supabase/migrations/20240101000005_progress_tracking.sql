DROP TABLE IF EXISTS public.progress_tracking CASCADE;

CREATE TABLE public.progress_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.therapy_sessions(id),

  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'milestone', 'insight', 'skill_learned', 'pattern',
    'goal_set', 'goal_achieved', 'reflection'
  )),

  title TEXT NOT NULL,
  description TEXT,
  evidence TEXT,
  related_themes TEXT[],
  related_modality TEXT,

  ai_generated BOOLEAN DEFAULT FALSE,
  user_acknowledged BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_progress_tracking_user_id ON public.progress_tracking(user_id);
CREATE INDEX idx_progress_tracking_entry_type ON public.progress_tracking(entry_type);
