DROP TABLE IF EXISTS public.safety_events CASCADE;

CREATE TABLE public.safety_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID REFERENCES public.therapy_sessions(id),
  message_id UUID REFERENCES public.session_messages(id),
  safety_level INTEGER NOT NULL CHECK (safety_level BETWEEN 1 AND 3),
  trigger_keywords TEXT[],
  trigger_content TEXT,
  response_action TEXT,
  escalated_to_human BOOLEAN DEFAULT FALSE,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_safety_events_user_id ON public.safety_events(user_id);
CREATE INDEX idx_safety_events_safety_level ON public.safety_events(safety_level);
CREATE INDEX idx_safety_events_reviewed ON public.safety_events(reviewed) WHERE reviewed = FALSE;
