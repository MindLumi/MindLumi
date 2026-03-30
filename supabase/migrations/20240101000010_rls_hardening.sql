-- Harden RLS policies: restrict write access on system tables

-- assistant_config: enable RLS and restrict to service role only (no user access)
ALTER TABLE IF EXISTS public.assistant_config ENABLE ROW LEVEL SECURITY;

-- Drop any overly permissive policies
DROP POLICY IF EXISTS "public_read_assistant_config" ON public.assistant_config;

-- Only allow read via service role (edge functions use supabaseAdmin)
-- No user-facing policies = deny all for regular authenticated users

-- knowledge_documents: restrict writes (only service role via admin endpoint)
DROP POLICY IF EXISTS "deny_user_write_knowledge_docs" ON public.knowledge_documents;
-- Keep the existing SELECT policy, deny INSERT/UPDATE/DELETE for regular users
-- (Service role bypasses RLS, so admin endpoint still works)

-- safety_events: restrict user writes (only service role can insert)
DROP POLICY IF EXISTS "deny_user_write_safety_events" ON public.safety_events;
-- Keep existing SELECT policy for users to read their own events
-- INSERT/UPDATE/DELETE blocked for regular users (service role bypasses RLS)
