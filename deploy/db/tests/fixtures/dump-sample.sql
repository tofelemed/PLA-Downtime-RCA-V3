--
-- PostgreSQL database dump (hand-written fixture for test-rewrite-schema.sh)
--

\restrict FixtureRestrictKey0123456789

SET statement_timeout = 0;
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;
COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;
COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

CREATE TYPE public.units_status_enum AS ENUM ('active', 'inactive');

CREATE FUNCTION public.units_ensure_partition(p_at timestamp with time zone) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$ BEGIN IF to_regclass('public.' || 'units_y2026m10') IS NULL THEN PERFORM public.units_touch(); END IF; RETURN 'x'; END $$;

CREATE FUNCTION public.units_touch() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$ SELECT 1 FROM public.units $$;

CREATE TABLE public.units (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    status public.units_status_enum DEFAULT 'active'::public.units_status_enum NOT NULL
);

CREATE TABLE public.units_y2026m10 (id uuid NOT NULL);

CREATE INDEX "IDX_units_status" ON ONLY public.units USING btree (status);
ALTER TABLE ONLY public.units ADD CONSTRAINT "PK_units" PRIMARY KEY (id);
ALTER TABLE ONLY public.units_y2026m10 ADD CONSTRAINT units_y2026m10_pkey PRIMARY KEY (id);
ALTER INDEX public."PK_units" ATTACH PARTITION public.units_y2026m10_pkey;
GRANT SELECT ON TABLE public.units TO proact_rls_user;

\unrestrict FixtureRestrictKey0123456789
\connect traverse_forge
