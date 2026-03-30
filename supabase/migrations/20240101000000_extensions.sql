-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA extensions;

-- Clean up stale objects that depend on the old vector extension
DROP FUNCTION IF EXISTS public.search_knowledge_base(extensions.vector, double precision, integer, text, text) CASCADE;
DROP TABLE IF EXISTS public.knowledge_chunks CASCADE;

-- vector must be in public so VECTOR type is available unqualified
DROP EXTENSION IF EXISTS "vector";
CREATE EXTENSION "vector" SCHEMA public;
