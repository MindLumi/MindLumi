-- Enable RLS on all user-facing tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- user_profiles: users own their profile
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

-- safety_events: users can only read their safety events
CREATE POLICY "users_read_safety_events" ON public.safety_events
  FOR SELECT USING (auth.uid() = user_id);

-- knowledge: public read access
CREATE POLICY "public_read_knowledge_docs" ON public.knowledge_documents
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "public_read_knowledge_chunks" ON public.knowledge_chunks
  FOR SELECT USING (TRUE);
