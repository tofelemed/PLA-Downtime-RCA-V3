--
-- Fixture: a dump that creates an extension member in public (rewrite-schema.py must refuse it)
--

SELECT pg_catalog.set_config('search_path', '', false);
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid
    LANGUAGE sql
    AS $$ SELECT NULL::uuid $$;

CREATE TABLE public.units (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL
);
