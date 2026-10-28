-- V001 baseline: TypeORM migrations through 1794241400000 (144 files) exported 2026-10-28 from 518b86e7
-- 154 tables; the dev database's 155th is a runtime partition (measurement_samples_y2026m10)
--
-- PostgreSQL database dump
--


-- Dumped from database version 15.18
-- Dumped by pg_dump version 15.18

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
CREATE SCHEMA IF NOT EXISTS forge;
SET search_path = forge, public;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--



--
--



--
--



--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: accounting_policy_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.accounting_policy_kind AS ENUM (
    'coverage_gate',
    'source_authority',
    'oee_policy',
    'reconciliation_tolerance',
    'valuation_basis',
    'rca_policy',
    'month_close',
    'reconciliation_sla',
    'loss_accounting'
);


--
-- Name: accounting_revision_lifecycle; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.accounting_revision_lifecycle AS ENUM (
    'draft',
    'in_review',
    'approved',
    'cancelled'
);


--
-- Name: actuals_adjustment_basis; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.actuals_adjustment_basis AS ENUM (
    'measured',
    'estimated'
);


--
-- Name: actuals_adjustment_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.actuals_adjustment_kind AS ENUM (
    'gross',
    'good',
    'reject',
    'rework'
);


--
-- Name: actuals_adjustment_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.actuals_adjustment_state AS ENUM (
    'proposed',
    'approved',
    'rejected'
);


--
-- Name: actuals_job_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.actuals_job_kind AS ENUM (
    'recompute',
    'report_import'
);


--
-- Name: actuals_job_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.actuals_job_state AS ENUM (
    'queued',
    'running',
    'completed',
    'failed'
);


--
-- Name: actuals_result_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.actuals_result_method AS ENUM (
    'output_events',
    'counter_delta',
    'rate_integration',
    'manual',
    'external_report',
    'mixed'
);


--
-- Name: actuals_result_quality; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.actuals_result_quality AS ENUM (
    'complete',
    'partial',
    'missing',
    'conflict'
);


--
-- Name: approval_action_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.approval_action_kind AS ENUM (
    'save_draft',
    'submit',
    'approve',
    'reject',
    'revise',
    'cancel',
    'recompute',
    'stale',
    'bridge_review'
);


--
-- Name: bulk_job_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.bulk_job_kind AS ENUM (
    'bulk_code'
);


--
-- Name: bulk_job_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.bulk_job_state AS ENUM (
    'queued',
    'running',
    'completed',
    'partial',
    'failed'
);


--
-- Name: calculation_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.calculation_run_status AS ENUM (
    'queued',
    'running',
    'validated',
    'failed',
    'superseded'
);


--
-- Name: calendar_version_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.calendar_version_state AS ENUM (
    'draft',
    'published'
);


--
-- Name: code_library_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.code_library_kind AS ENUM (
    'reason',
    'impact',
    'oee',
    'failure',
    'loss_category'
);


--
-- Name: code_mapping_rule_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.code_mapping_rule_kind AS ENUM (
    'reason_to_oee',
    'reason_to_schedule_class',
    'reason_to_impact',
    'impact_to_valuation'
);


--
-- Name: demand_status_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.demand_status_state AS ENUM (
    'draft',
    'approved',
    'retired'
);


--
-- Name: event_relation_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.event_relation_type AS ENUM (
    'split_child_of',
    'merged_from',
    'correlated_with',
    'impact_of'
);


--
-- Name: event_review_item_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.event_review_item_kind AS ENUM (
    'source_vs_override_conflict',
    'late_correction',
    'retraction',
    'pending_source_confirmation',
    'declared_identity_mismatch',
    'declared_window_mismatch',
    'duplicate_declared_loss'
);


--
-- Name: event_review_item_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.event_review_item_state AS ENUM (
    'open',
    'kept_override',
    'accepted_source',
    'dismissed'
);


--
-- Name: event_revision_actor_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.event_revision_actor_kind AS ENUM (
    'user',
    'connector',
    'system'
);


--
-- Name: event_revision_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.event_revision_kind AS ENUM (
    'source',
    'user',
    'system',
    'retraction'
);


--
-- Name: export_format; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.export_format AS ENUM (
    'csv',
    'pdf',
    'xlsx'
);


--
-- Name: export_job_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.export_job_state AS ENUM (
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: export_report_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.export_report_type AS ENUM (
    'period_summary',
    'loss_lines',
    'rca_case',
    'ops_report'
);


--
-- Name: export_revision_selector; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.export_revision_selector AS ENUM (
    'published',
    'revision_ids',
    'case',
    'report'
);


--
-- Name: external_production_report_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.external_production_report_state AS ENUM (
    'current',
    'superseded'
);


--
-- Name: failure_code_group_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.failure_code_group_kind AS ENUM (
    'class',
    'problem',
    'cause',
    'remedy'
);


--
-- Name: fx_rate_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.fx_rate_state AS ENUM (
    'draft',
    'approved',
    'retired'
);


--
-- Name: ingestion_error_code; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.ingestion_error_code AS ENUM (
    'unknown_template',
    'unknown_code',
    'unknown_unit',
    'mapping_ambiguous',
    'mapping_invalid_target',
    'schema_invalid',
    'unit_conflict',
    'duration_conflict',
    'order_conflict',
    'no_handler',
    'processing_failed',
    'unknown_signal',
    'topic_shape',
    'not_json',
    'too_large',
    'unsupported_version',
    'identity_mismatch',
    'future_timestamp',
    'stale_timestamp',
    'topic_not_allowed',
    'unmapped_value'
);


--
-- Name: ingestion_exception_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.ingestion_exception_state AS ENUM (
    'open',
    'resolved',
    'irrecoverable'
);


--
-- Name: ingestion_job_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.ingestion_job_state AS ENUM (
    'created',
    'running',
    'paused',
    'draining',
    'stopped',
    'failed'
);


--
-- Name: integration_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.integration_source_type AS ENUM (
    'pi_web_api',
    'mqtt',
    'kafka',
    'opc_ua',
    'rest_import',
    'file_import',
    'db_import',
    'manual'
);


--
-- Name: kpi_metric; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.kpi_metric AS ENUM (
    'availability',
    'performance',
    'quality',
    'oee',
    'reconciled_availability',
    'reconciled_performance',
    'reconciled_quality',
    'reconciled_oee',
    'downtime_total',
    'downtime_planned',
    'downtime_unplanned',
    'downtime_equivalent',
    'downtime_in_schedule',
    'downtime_external',
    'downtime_maintenance_overrun',
    'coded_downtime_ratio',
    'microstop_time',
    'unknown_time',
    'stop_count',
    'carry_in_count',
    'mean_stop_duration',
    'scheduled_availability',
    'onstream_factor',
    'mtbf',
    'mttr',
    'mean_downtime_to_restore',
    'coverage',
    'state_coverage',
    'availability_lower_bound',
    'availability_upper_bound',
    'controllable_availability'
);


--
-- Name: kpi_quality; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.kpi_quality AS ENUM (
    'ok',
    'provisional',
    'unavailable',
    'exception'
);


--
-- Name: line_valuation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.line_valuation_status AS ENUM (
    'valued',
    'unvalued'
);


--
-- Name: loss_ledger; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.loss_ledger AS ENUM (
    'capacity',
    'plan'
);


--
-- Name: loss_line_basis; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.loss_line_basis AS ENUM (
    'sustained_rate',
    'planning_rate',
    'measured',
    'declared'
);


--
-- Name: loss_line_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.loss_line_kind AS ENUM (
    'schedule_exclusion',
    'availability',
    'performance',
    'quality',
    'residual',
    'gain',
    'tolerance_adjustment',
    'unaccounted_classified',
    'bridge',
    'transition_allowance',
    'transition_excess',
    'reversal'
);


--
-- Name: loss_line_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.loss_line_source AS ENUM (
    'auto',
    'manual',
    'candidate_superseded'
);


--
-- Name: loss_line_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.loss_line_state AS ENUM (
    'active',
    'superseded',
    'rejected'
);


--
-- Name: measurement_sample_quality; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.measurement_sample_quality AS ENUM (
    'good',
    'uncertain',
    'bad',
    'missing'
);


--
-- Name: outbox_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.outbox_state AS ENUM (
    'pending',
    'published',
    'failed'
);


--
-- Name: period_change_proposal_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.period_change_proposal_state AS ENUM (
    'open',
    'accepted',
    'dismissed'
);


--
-- Name: period_change_trigger; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.period_change_trigger AS ENUM (
    'event_change',
    'actuals_change',
    'plan_change',
    'rate_change',
    'calendar_change',
    'source_retraction',
    'recalculation',
    'manual_correction',
    'valuation_change'
);


--
-- Name: period_product_slice_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.period_product_slice_source AS ENUM (
    'plan',
    'profile_default'
);


--
-- Name: plan_generation_job_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.plan_generation_job_state AS ENUM (
    'queued',
    'running',
    'completed',
    'failed'
);


--
-- Name: plan_product_slice_stream; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.plan_product_slice_stream AS ENUM (
    'sequential',
    'independent',
    'shared'
);


--
-- Name: plan_version_approval_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.plan_version_approval_state AS ENUM (
    'draft',
    'submitted',
    'approved',
    'superseded'
);


--
-- Name: plan_version_basis; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.plan_version_basis AS ENUM (
    'time',
    'quantity',
    'manual'
);


--
-- Name: plan_version_distribution; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.plan_version_distribution AS ENUM (
    'scheduled_capacity',
    'explicit_weights',
    'equal'
);


--
-- Name: plan_version_target_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.plan_version_target_source AS ENUM (
    'generated',
    'entered',
    'imported'
);


--
-- Name: plant_flow_route_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.plant_flow_route_state AS ENUM (
    'draft',
    'approved',
    'retired'
);


--
-- Name: production_event_coding_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.production_event_coding_state AS ENUM (
    'uncoded',
    'coded',
    'reviewed'
);


--
-- Name: production_event_impact_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.production_event_impact_mode AS ENUM (
    'none',
    'full_stop',
    'fractional',
    'measured'
);


--
-- Name: production_event_oee_component; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.production_event_oee_component AS ENUM (
    'availability',
    'performance',
    'quality',
    'idle',
    'none'
);


--
-- Name: production_event_physical_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.production_event_physical_state AS ENUM (
    'open',
    'closed',
    'superseded',
    'retracted'
);


--
-- Name: production_event_physical_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.production_event_physical_type AS ENUM (
    'downtime',
    'slowdown',
    'quality_loss',
    'production_output',
    'advisory',
    'grade_transition',
    'production_loss'
);


--
-- Name: production_event_rca_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.production_event_rca_state AS ENUM (
    'none',
    'required',
    'linked',
    'completed'
);


--
-- Name: production_event_schedule_class; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.production_event_schedule_class AS ENUM (
    'planned',
    'unplanned',
    'external',
    'unknown'
);


--
-- Name: production_event_source_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.production_event_source_kind AS ENUM (
    'manual',
    'source',
    'derived',
    'imported'
);


--
-- Name: production_period_readiness; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.production_period_readiness AS ENUM (
    'open',
    'complete_inputs',
    'reconciled'
);


--
-- Name: production_profile_capacity_model; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.production_profile_capacity_model AS ENUM (
    'single_stream',
    'shared_capacity',
    'independent_streams'
);


--
-- Name: production_profile_rate_timebase; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.production_profile_rate_timebase AS ENUM (
    's',
    'min',
    'h',
    'd'
);


--
-- Name: production_profile_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.production_profile_state AS ENUM (
    'draft',
    'approved',
    'retired'
);


--
-- Name: rate_import_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.rate_import_kind AS ENUM (
    'budget',
    'forecast',
    'mpc'
);


--
-- Name: rate_import_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.rate_import_state AS ENUM (
    'queued',
    'completed',
    'failed'
);


--
-- Name: raw_observation_outcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.raw_observation_outcome AS ENUM (
    'accepted',
    'revision',
    'duplicate_content',
    'stale',
    'conflict',
    'invalid',
    'replayed'
);


--
-- Name: rca_action_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.rca_action_status AS ENUM (
    'open',
    'in_progress',
    'done',
    'cancelled'
);


--
-- Name: rca_link_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.rca_link_type AS ENUM (
    'event',
    'loss_line',
    'work_order',
    'occurrence'
);


--
-- Name: rca_trigger_fired_on; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.rca_trigger_fired_on AS ENUM (
    'threshold_crossed_open',
    'closed',
    'approved',
    'after_closure'
);


--
-- Name: rca_trigger_outcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.rca_trigger_outcome AS ENUM (
    'recommended',
    'case_created',
    'suppressed_duplicate',
    'linked_to_case'
);


--
-- Name: reconciliation_line_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.reconciliation_line_action AS ENUM (
    'accept',
    'adjust',
    'replace',
    'reject',
    'manual',
    'tolerance'
);


--
-- Name: replay_run_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.replay_run_state AS ENUM (
    'queued',
    'running',
    'completed',
    'failed'
);


--
-- Name: rule_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.rule_kind AS ENUM (
    'coding_default',
    'status_derivation',
    'rca_trigger_hint',
    'validation'
);


--
-- Name: rule_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.rule_state AS ENUM (
    'draft',
    'active',
    'retired'
);


--
-- Name: rule_version_origin; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.rule_version_origin AS ENUM (
    'activation',
    'rollback'
);


--
-- Name: signal_backfill_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.signal_backfill_state AS ENUM (
    'queued',
    'running',
    'completed',
    'failed'
);


--
-- Name: signal_interpolation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.signal_interpolation AS ENUM (
    'step',
    'linear'
);


--
-- Name: signal_rate_timebase; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.signal_rate_timebase AS ENUM (
    's',
    'min',
    'h',
    'd'
);


--
-- Name: signal_reset_policy; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.signal_reset_policy AS ENUM (
    'none',
    'known_instant',
    'detect_drop'
);


--
-- Name: signal_semantic_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.signal_semantic_type AS ENUM (
    'rate',
    'counter',
    'state',
    'quality',
    'level',
    'output_increment',
    'other'
);


--
-- Name: source_mapping_match_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.source_mapping_match_kind AS ENUM (
    'exact_id',
    'exact_path',
    'pattern',
    'af_binding'
);


--
-- Name: source_mapping_target_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.source_mapping_target_type AS ENUM (
    'unit',
    'asset'
);


--
-- Name: source_object_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.source_object_state AS ENUM (
    'active',
    'retracted',
    'deleted_confirmed'
);


--
-- Name: transition_standard_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.transition_standard_state AS ENUM (
    'draft',
    'approved',
    'retired'
);


--
-- Name: unit_impact_rule_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.unit_impact_rule_state AS ENUM (
    'draft',
    'approved',
    'retired'
);


--
-- Name: unit_product_rate_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.unit_product_rate_kind AS ENUM (
    'nameplate',
    'demonstrated',
    'sustained',
    'planning',
    'budget',
    'forecast'
);


--
-- Name: unit_product_rate_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.unit_product_rate_source AS ENUM (
    'manual',
    'import'
);


--
-- Name: unit_product_rate_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.unit_product_rate_state AS ENUM (
    'draft',
    'approved',
    'retired'
);


--
-- Name: unit_product_rate_timebase; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.unit_product_rate_timebase AS ENUM (
    's',
    'min',
    'h',
    'd'
);


--
-- Name: unit_stream_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.unit_stream_state AS ENUM (
    'draft',
    'approved',
    'retired'
);


--
-- Name: user_scope_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.user_scope_kind AS ENUM (
    'tenant',
    'site',
    'unit'
);


--
-- Name: valuation_rate_basis; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.valuation_rate_basis AS ENUM (
    'contribution_margin',
    'standard_cost',
    'cost_per_hour',
    'variable_cost',
    'salvage_value',
    'disposal_cost',
    'downgrade_price_difference',
    'rework_cost',
    'rework_yield'
);


--
-- Name: valuation_rate_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.valuation_rate_state AS ENUM (
    'draft',
    'approved',
    'retired'
);


--
-- Name: valuation_totals_view; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.valuation_totals_view AS ENUM (
    'contribution_margin',
    'standard_cost',
    'cost_per_hour',
    'economic_impact',
    'independent_components'
);


--
-- Name: valuation_view; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE forge.valuation_view AS ENUM (
    'contribution_margin',
    'standard_cost',
    'cost_per_hour',
    'economic_impact'
);


--
-- Name: accounting_lines_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.accounting_lines_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION '% rows are immutable (a recalculation writes a new calculation run)', TG_TABLE_NAME; END $$;


--
-- Name: accounting_revision_approved_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.accounting_revision_approved_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN IF OLD."lifecycle" = 'approved' THEN RAISE EXCEPTION 'approved accounting revision % is immutable (revise opens a new revision)', OLD."id"; END IF; IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;


--
-- Name: actuals_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.actuals_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION '% rows are immutable (a recalculation writes a new actuals run)', TG_TABLE_NAME; END $$;


--
-- Name: app_organization_user_by_email(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.app_organization_user_by_email(p_tenant_id uuid, p_email text) RETURNS TABLE(id uuid, name character varying, email character varying, role character varying, is_active boolean, tenant_id uuid, organization_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'forge', 'public'
    AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'a tenant is required' USING ERRCODE = '42501';
  END IF;
  IF forge.app_rls_tenant_ids() IS NOT NULL
     AND NOT (p_tenant_id::text = ANY (forge.app_rls_tenant_ids())) THEN
    RAISE EXCEPTION 'tenant % is not bound to this session', p_tenant_id USING ERRCODE = '42501';
  END IF;
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM forge.app_organization_user_rows(p_tenant_id, p_email);
END
$$;


--
-- Name: app_organization_user_rows(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.app_organization_user_rows(p_tenant_id uuid, p_email text) RETURNS TABLE(id uuid, name character varying, email character varying, role character varying, is_active boolean, tenant_id uuid, organization_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'forge', 'public'
    SET "app.tenant_ids" TO ''
    AS $$
  SELECT u.id, u.name, u.email, u.role, u.is_active, u.tenant_id, u.organization_id,
  u.created_at, u.updated_at
    FROM forge.users u
    JOIN forge.tenants plant ON plant.id = p_tenant_id AND plant.organization_id IS NOT NULL
    LEFT JOIN forge.tenants home ON home.id = u.tenant_id
   WHERE lower(u.email) = lower(btrim(p_email))
     AND COALESCE(u.organization_id, home.organization_id) = plant.organization_id
$$;


--
-- Name: app_plant_user_directory(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.app_plant_user_directory(p_tenant_id uuid, p_user_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(id uuid, name character varying, email character varying, role character varying, is_active boolean, tenant_id uuid, organization_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'forge', 'public'
    AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'a tenant is required' USING ERRCODE = '42501';
  END IF;
  IF forge.app_rls_tenant_ids() IS NOT NULL
     AND NOT (p_tenant_id::text = ANY (forge.app_rls_tenant_ids())) THEN
    RAISE EXCEPTION 'tenant % is not bound to this session', p_tenant_id USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM forge.app_plant_user_rows(p_tenant_id, p_user_ids);
END
$$;


--
-- Name: app_plant_user_rows(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.app_plant_user_rows(p_tenant_id uuid, p_user_ids uuid[]) RETURNS TABLE(id uuid, name character varying, email character varying, role character varying, is_active boolean, tenant_id uuid, organization_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'forge', 'public'
    SET "app.tenant_ids" TO ''
    AS $$
  SELECT u.id, u.name, u.email, u.role, u.is_active, u.tenant_id, u.organization_id,
  u.created_at, u.updated_at
    FROM forge.users u
   WHERE u.id IN (SELECT m.id FROM forge.users m WHERE m.tenant_id = p_tenant_id
                  UNION
                  SELECT s.user_id FROM forge.user_scopes s WHERE s.tenant_id = p_tenant_id)
     AND (p_user_ids IS NULL OR u.id = ANY (p_user_ids))
$$;


--
-- Name: app_rls_tenant_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.app_rls_tenant_ids() RETURNS text[]
    LANGUAGE sql STABLE
    AS $$
  SELECT CASE WHEN COALESCE(current_setting('app.tenant_ids', true), '') = '' THEN NULL
              ELSE string_to_array(current_setting('app.tenant_ids', true), ',') END
$$;


--
-- Name: audit_log_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.audit_log_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ DECLARE cutoff text := current_setting('app.audit_retention_cutoff', true); BEGIN IF TG_OP = 'DELETE' AND cutoff IS NOT NULL AND cutoff <> '' AND OLD."at" < cutoff::timestamptz THEN RETURN OLD; END IF; RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME; END $$;


--
-- Name: calendar_versions_published_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.calendar_versions_published_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN IF OLD."state" = 'published' AND (TG_OP = 'DELETE' OR NEW."state" IS DISTINCT FROM OLD."state" OR NEW."site_id" IS DISTINCT FROM OLD."site_id" OR NEW."unit_id" IS DISTINCT FROM OLD."unit_id" OR NEW."version" IS DISTINCT FROM OLD."version" OR NEW."timezone" IS DISTINCT FROM OLD."timezone" OR NEW."operational_day_start" IS DISTINCT FROM OLD."operational_day_start" OR NEW."shift_templates" IS DISTINCT FROM OLD."shift_templates" OR NEW."working_intervals" IS DISTINCT FROM OLD."working_intervals" OR NEW."holidays" IS DISTINCT FROM OLD."holidays" OR NEW."exclusions" IS DISTINCT FROM OLD."exclusions" OR NEW."effective_from" IS DISTINCT FROM OLD."effective_from" OR NEW."effective_to" IS DISTINCT FROM OLD."effective_to") THEN RAISE EXCEPTION 'published calendar versions are immutable (publish a new version)'; END IF; IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;


--
-- Name: export_job_completed_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.export_job_completed_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'export jobs are never deleted'; END IF; IF OLD."state" = 'completed' AND (NEW."state" IS DISTINCT FROM OLD."state" OR NEW."content_hash" IS DISTINCT FROM OLD."content_hash" OR NEW."size_bytes" IS DISTINCT FROM OLD."size_bytes" OR NEW."row_count" IS DISTINCT FROM OLD."row_count" OR NEW."filters" IS DISTINCT FROM OLD."filters" OR NEW."unit_ids" IS DISTINCT FROM OLD."unit_ids" OR NEW."generated_at" IS DISTINCT FROM OLD."generated_at" OR (NEW."object_key" IS NOT NULL AND NEW."object_key" IS DISTINCT FROM OLD."object_key")) THEN RAISE EXCEPTION 'completed export job % is immutable', OLD."id"; END IF; RETURN NEW; END $$;


--
-- Name: jalali_month_key(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.jalali_month_key(d date) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  WITH e AS (SELECT (d - DATE '1970-01-01') AS day),
  y AS (
    SELECT e.day, max(c.jy) AS jy
      FROM e, LATERAL generate_series(
             ((e.day + 492268) / 365.2422)::int - 1,
             ((e.day + 492268) / 365.2422)::int + 2) AS c(jy)
     WHERE -492268 + 365 * (c.jy - 1) + (8 * c.jy + 21) / 33 <= e.day
     GROUP BY e.day
  ),
  m AS (
    SELECT y.jy, y.day - (-492268 + 365 * (y.jy - 1) + (8 * y.jy + 21) / 33) AS doy FROM y
  )
  SELECT lpad(m.jy::text, 4, '0') || '-' ||
         lpad((CASE WHEN m.doy < 186 THEN m.doy / 31 + 1 ELSE (m.doy - 186) / 30 + 7 END)::text, 2, '0')
    FROM m
$$;


--
-- Name: measurement_samples_ensure_partition(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.measurement_samples_ensure_partition(p_at timestamp with time zone) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'forge', 'public', 'pg_temp'
    AS $$ DECLARE v_start timestamp := date_trunc('month', p_at AT TIME ZONE 'UTC'); v_name text := 'measurement_samples_y' || to_char(v_start, 'YYYY') || 'm' || to_char(v_start, 'MM'); BEGIN IF to_regclass('forge.' || v_name) IS NULL THEN EXECUTE format('CREATE TABLE %I PARTITION OF "measurement_samples" FOR VALUES FROM (%L) TO (%L)', v_name, (v_start AT TIME ZONE 'UTC'), ((v_start + interval '1 month') AT TIME ZONE 'UTC')); END IF; RETURN v_name; END $$;


--
-- Name: measurement_samples_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.measurement_samples_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION 'measurement_samples rows are immutable (a correction is a new revision)'; END $$;


--
-- Name: plan_periods_frozen(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.plan_periods_frozen() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ DECLARE frozen boolean; BEGIN SELECT "approval_state" IN ('approved', 'superseded') INTO frozen FROM "plan_versions" WHERE "id" = OLD."plan_version_id"; IF COALESCE(frozen, false) AND NOT (TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'shift_instance_id') = (to_jsonb(OLD) - 'shift_instance_id')) THEN RAISE EXCEPTION 'periods of an approved plan version are frozen (create a new plan version)'; END IF; IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;


--
-- Name: plan_versions_approved_kept(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.plan_versions_approved_kept() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN IF OLD."approval_state" IN ('approved', 'superseded') THEN RAISE EXCEPTION 'approved plan versions are never deleted'; END IF; RETURN OLD; END $$;


--
-- Name: production_events_default_occurrence(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.production_events_default_occurrence() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN NEW."occurrence_id" := COALESCE(NEW."occurrence_id", NEW."id"); RETURN NEW; END $$;


--
-- Name: raw_observations_ensure_partition(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.raw_observations_ensure_partition(p_at timestamp with time zone) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'forge', 'public', 'pg_temp'
    AS $$ DECLARE v_start timestamp := date_trunc('month', p_at AT TIME ZONE 'UTC'); v_name text := 'raw_observations_y' || to_char(v_start, 'YYYY') || 'm' || to_char(v_start, 'MM'); BEGIN IF to_regclass('forge.' || v_name) IS NULL THEN EXECUTE format('CREATE TABLE %I PARTITION OF "raw_observations" FOR VALUES FROM (%L) TO (%L)', v_name, (v_start AT TIME ZONE 'UTC'), ((v_start + interval '1 month') AT TIME ZONE 'UTC')); END IF; RETURN v_name; END $$;


--
-- Name: raw_observations_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.raw_observations_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION 'raw_observations rows are immutable (FND01)'; END $$;


--
-- Name: rca_child_tenant_follows_rca(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.rca_child_tenant_follows_rca() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    IF NEW."rca_id" IS NOT NULL THEN
      SELECT r."tenant_id" INTO NEW."tenant_id" FROM "rcas" r WHERE r."id" = NEW."rca_id";
    END IF;
    RETURN NEW;
  END $$;


--
-- Name: rca_shared_lessons(uuid, integer, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.rca_shared_lessons(p_tenant uuid, p_limit integer, p_before timestamp with time zone, p_before_id uuid) RETURNS TABLE(id uuid, source_plant character varying, title character varying, problem_statement text, root_cause text, recommendations text, failure_mode character varying, equipment_category character varying, lesson_status character varying, shared_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'forge', 'public'
    AS $$
  SELECT kb."id", t."name", kb."title", kb."problem_statement", kb."root_cause", kb."recommendations",
         kb."failure_mode", kb."equipment_category", kb."lesson_status", kb."shared_at"
    FROM "rca_knowledge_base" kb
    JOIN "tenants" t ON t."id" = kb."tenant_id" AND t."is_active"
   WHERE (app_rls_tenant_ids() IS NULL OR p_tenant::text = ANY (app_rls_tenant_ids()))
     AND t."organization_id" = (SELECT c."organization_id" FROM "tenants" c WHERE c."id" = p_tenant)
     AND kb."tenant_id" <> p_tenant
     AND kb."share_scope" = 'organization' AND kb."is_published" AND kb."shared_at" IS NOT NULL
     AND (p_before IS NULL OR (kb."shared_at", kb."id") < (p_before, p_before_id))
   ORDER BY kb."shared_at" DESC, kb."id" DESC
   LIMIT p_limit
$$;


--
-- Name: rca_tenant_propagates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.rca_tenant_propagates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    UPDATE "fmea_analyses" SET "tenant_id" = NEW."tenant_id" WHERE "rca_id" = NEW."id";
    UPDATE "five_why_analyses" SET "tenant_id" = NEW."tenant_id" WHERE "rca_id" = NEW."id";
    UPDATE "fault_tree_analyses" SET "tenant_id" = NEW."tenant_id" WHERE "rca_id" = NEW."id";
    UPDATE "fishbone_diagrams" SET "tenant_id" = NEW."tenant_id" WHERE "rca_id" = NEW."id";
    UPDATE "barrier_analyses" SET "tenant_id" = NEW."tenant_id" WHERE "rca_id" = NEW."id";
    UPDATE "change_analyses" SET "tenant_id" = NEW."tenant_id" WHERE "rca_id" = NEW."id";
    UPDATE "rca_fmea_analyses" SET "tenant_id" = NEW."tenant_id" WHERE "rca_id" = NEW."id";
    UPDATE "rca_fault_tree_analyses" SET "tenant_id" = NEW."tenant_id" WHERE "rca_id" = NEW."id";
    UPDATE "rca_fishbone_diagrams" SET "tenant_id" = NEW."tenant_id" WHERE "rca_id" = NEW."id";
    UPDATE "rca_barrier_analyses" SET "tenant_id" = NEW."tenant_id" WHERE "rca_id" = NEW."id";
    UPDATE "rca_change_analyses" SET "tenant_id" = NEW."tenant_id" WHERE "rca_id" = NEW."id";
    UPDATE "rca_five_why_analyses" SET "tenant_id" = NEW."tenant_id" WHERE "rca_id" = NEW."id";
    UPDATE "rca_knowledge_base" SET "tenant_id" = NEW."tenant_id" WHERE "rca_id" = NEW."id";
    RETURN NEW;
  END $$;


--
-- Name: workflow_rows_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION forge.workflow_rows_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME; END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounting_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.accounting_policies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    policy_kind forge.accounting_policy_kind NOT NULL,
    unit_id uuid,
    scope_key character varying(64) NOT NULL,
    version integer NOT NULL,
    body jsonb NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    approved_by uuid,
    approved_at timestamp with time zone,
    notes text,
    rejected_by uuid,
    rejected_at timestamp with time zone,
    rejection_reason text,
    based_on_id uuid,
    requested_effective_from timestamp with time zone,
    backdate_reason text,
    restate_approved boolean DEFAULT false NOT NULL,
    CONSTRAINT "CHK_accounting_policies_backdate" CHECK (((requested_effective_from IS NULL) = (backdate_reason IS NULL))),
    CONSTRAINT "CHK_accounting_policies_decision" CHECK (((approved_at IS NULL) OR (rejected_at IS NULL))),
    CONSTRAINT "CHK_accounting_policies_effective" CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT "CHK_accounting_policies_restate_approved" CHECK (((NOT restate_approved) OR (backdate_reason IS NOT NULL)))
);

ALTER TABLE ONLY forge.accounting_policies FORCE ROW LEVEL SECURITY;


--
-- Name: accounting_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.accounting_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    period_id uuid NOT NULL,
    revision integer NOT NULL,
    lifecycle forge.accounting_revision_lifecycle DEFAULT 'draft'::forge.accounting_revision_lifecycle NOT NULL,
    supersedes_id uuid,
    input_hash character varying(64),
    current_run_id uuid,
    current_line_set_id uuid,
    submitted_by uuid,
    submitted_at timestamp with time zone,
    submitted_hash character varying(64),
    submitted_run_id uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    approval_snapshot_id uuid,
    rejected_by uuid,
    rejected_at timestamp with time zone,
    reject_reason text,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    is_stale boolean DEFAULT false NOT NULL,
    stale_reason text,
    comment text,
    after_close boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY forge.accounting_revisions FORCE ROW LEVEL SECURITY;


--
-- Name: actuals_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.actuals_adjustments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    slice_id uuid NOT NULL,
    period_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    kind forge.actuals_adjustment_kind NOT NULL,
    quantity numeric(24,8) NOT NULL,
    uom character varying(50),
    basis forge.actuals_adjustment_basis NOT NULL,
    reason text NOT NULL,
    evidence_ref text NOT NULL,
    window_from timestamp with time zone,
    window_to timestamp with time zone,
    author_id uuid NOT NULL,
    state forge.actuals_adjustment_state DEFAULT 'proposed'::forge.actuals_adjustment_state NOT NULL,
    decided_by uuid,
    decided_at timestamp with time zone,
    decision_reason text,
    super_admin_override boolean DEFAULT false NOT NULL,
    CONSTRAINT "CHK_actuals_adjustments_independent" CHECK (((decided_by IS NULL) OR (decided_by <> author_id) OR super_admin_override)),
    CONSTRAINT "CHK_actuals_adjustments_window" CHECK ((((window_from IS NULL) = (window_to IS NULL)) AND ((window_from IS NULL) OR (window_to > window_from))))
);

ALTER TABLE ONLY forge.actuals_adjustments FORCE ROW LEVEL SECURITY;


--
-- Name: actuals_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.actuals_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    kind forge.actuals_job_kind NOT NULL,
    state forge.actuals_job_state DEFAULT 'queued'::forge.actuals_job_state NOT NULL,
    period_id uuid,
    request jsonb NOT NULL,
    result jsonb,
    error_code character varying(64),
    error_message text,
    requested_by uuid,
    lease_owner text,
    lease_expiry timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    finished_at timestamp with time zone
);

ALTER TABLE ONLY forge.actuals_jobs FORCE ROW LEVEL SECURITY;


--
-- Name: actuals_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.actuals_results (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    actuals_run_id uuid NOT NULL,
    period_id uuid NOT NULL,
    slice_id uuid NOT NULL,
    gross numeric(24,8),
    good numeric(24,8),
    reject numeric(24,8),
    rework_accepted numeric(24,8),
    uom character varying(50),
    basis character varying(8) NOT NULL,
    method forge.actuals_result_method,
    coverage_ratio numeric(9,8),
    measured_qty numeric(24,8),
    estimated_qty numeric(24,8),
    quality_state forge.actuals_result_quality NOT NULL,
    source_segments jsonb NOT NULL,
    exceptions jsonb NOT NULL,
    coverage jsonb NOT NULL,
    adjustment_ids jsonb NOT NULL,
    computed_at timestamp with time zone NOT NULL,
    quality_classes jsonb,
    substitution jsonb
);

ALTER TABLE ONLY forge.actuals_results FORCE ROW LEVEL SECURITY;


--
-- Name: actuals_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.actuals_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    period_id uuid NOT NULL,
    trigger character varying(64) NOT NULL,
    input_hash character varying(64) NOT NULL,
    engine_version character varying(32) NOT NULL,
    policy_versions jsonb NOT NULL,
    requested_by uuid,
    supersedes_run_id uuid,
    computed_at timestamp with time zone NOT NULL
);

ALTER TABLE ONLY forge.actuals_runs FORCE ROW LEVEL SECURITY;


--
-- Name: af_bindings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.af_bindings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    organization_id character varying(36),
    web_id character varying(255),
    local_id character varying(36),
    bound_type character varying(100),
    mapping_config text,
    is_active boolean DEFAULT true NOT NULL
);

ALTER TABLE ONLY forge.af_bindings FORCE ROW LEVEL SECURITY;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.app_settings (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    tenant_id uuid,
    user_id uuid
);

ALTER TABLE ONLY forge.app_settings FORCE ROW LEVEL SECURITY;


--
-- Name: approval_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.approval_actions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    revision_id uuid NOT NULL,
    period_id uuid NOT NULL,
    action forge.approval_action_kind NOT NULL,
    from_lifecycle character varying(16) NOT NULL,
    to_lifecycle character varying(16) NOT NULL,
    actor_id uuid,
    service character varying(64),
    reason text,
    submitted_hash character varying(64),
    correlation_id character varying(128),
    detail jsonb DEFAULT '{}'::jsonb NOT NULL
);

ALTER TABLE ONLY forge.approval_actions FORCE ROW LEVEL SECURITY;


--
-- Name: approval_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.approval_snapshots (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    revision_id uuid NOT NULL,
    period_id uuid NOT NULL,
    content jsonb NOT NULL,
    content_hash character varying(64) NOT NULL,
    submitted_hash character varying(64) NOT NULL
);

ALTER TABLE ONLY forge.approval_snapshots FORCE ROW LEVEL SECURITY;


--
-- Name: approved_loss_line_valuations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.approved_loss_line_valuations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    approved_line_id uuid NOT NULL,
    view forge.valuation_view NOT NULL,
    currency character varying(3) NOT NULL,
    amount numeric(28,8),
    status character varying(16) NOT NULL,
    reason character varying(64),
    provisional boolean DEFAULT false NOT NULL,
    components jsonb
);

ALTER TABLE ONLY forge.approved_loss_line_valuations FORCE ROW LEVEL SECURITY;


--
-- Name: approved_loss_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.approved_loss_lines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    revision_id uuid NOT NULL,
    period_id uuid NOT NULL,
    slice_id uuid NOT NULL,
    source character varying(16) NOT NULL,
    source_id uuid NOT NULL,
    cause_event_id uuid,
    kind forge.loss_line_kind NOT NULL,
    oee_component character varying(16),
    reason_code_id uuid,
    impact_code_id uuid,
    uom character varying(50),
    quantity numeric(24,8) NOT NULL
);

ALTER TABLE ONLY forge.approved_loss_lines FORCE ROW LEVEL SECURITY;


--
-- Name: approved_valuation_totals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.approved_valuation_totals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    revision_id uuid NOT NULL,
    period_id uuid NOT NULL,
    slice_id uuid NOT NULL,
    kind forge.loss_line_kind NOT NULL,
    view forge.valuation_totals_view NOT NULL,
    currency character varying(3) NOT NULL,
    uom character varying(50),
    amount numeric(28,8),
    native_amount numeric(28,8) NOT NULL,
    valued_lines integer NOT NULL,
    unvalued_lines integer NOT NULL,
    fx_missing_lines integer NOT NULL,
    unvalued_quantity numeric(24,8) NOT NULL,
    unvalued_seconds numeric(24,8) NOT NULL,
    status character varying(16) NOT NULL,
    reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    fx_rate_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    fx_provisional_lines integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY forge.approved_valuation_totals FORCE ROW LEVEL SECURITY;


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.assets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    unit_id character varying(36) NOT NULL,
    description text,
    asset_type character varying(50),
    manufacturer character varying(255),
    model character varying(255),
    serial_number character varying(255),
    criticality character varying(50),
    status character varying(50),
    location character varying(255),
    installation_date timestamp with time zone,
    last_maintenance_date timestamp with time zone,
    next_maintenance_date timestamp with time zone,
    tenant_id uuid,
    organization_id character varying(36),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    row_version integer DEFAULT 1 NOT NULL,
    retired_at timestamp with time zone
);

ALTER TABLE ONLY forge.assets FORCE ROW LEVEL SECURITY;


--
-- Name: attribute_mapping_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.attribute_mapping_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    connection_id uuid,
    template_name character varying(255) NOT NULL,
    version integer NOT NULL,
    field_rules jsonb NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone
);

ALTER TABLE ONLY forge.attribute_mapping_versions FORCE ROW LEVEL SECURITY;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.audit_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    actor_id uuid,
    service character varying(64),
    action character varying(64) NOT NULL,
    entity_type character varying(64) NOT NULL,
    entity_id uuid NOT NULL,
    revision integer,
    before_hash character varying(64),
    after_hash character varying(64),
    reason text,
    correlation_id character varying(128),
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY forge.audit_log FORCE ROW LEVEL SECURITY;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id character varying(36) NOT NULL,
    details text,
    organization_id character varying(36),
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    "timestamp" timestamp with time zone NOT NULL
);

ALTER TABLE ONLY forge.audit_logs FORCE ROW LEVEL SECURITY;


--
-- Name: auth_refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.auth_refresh_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    family_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    revoke_reason character varying(32),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: buffer_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.buffer_levels (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    from_unit_id uuid NOT NULL,
    to_unit_id uuid NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    level numeric(24,8) NOT NULL,
    uom character varying(50) NOT NULL,
    source character varying(16) DEFAULT 'manual'::character varying NOT NULL,
    notes text,
    CONSTRAINT "CHK_buffer_levels_level" CHECK ((level >= (0)::numeric)),
    CONSTRAINT "CHK_buffer_levels_source" CHECK (((source)::text = ANY ((ARRAY['manual'::character varying, 'signal'::character varying, 'import'::character varying])::text[])))
);

ALTER TABLE ONLY forge.buffer_levels FORCE ROW LEVEL SECURITY;


--
-- Name: bulk_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.bulk_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    kind forge.bulk_job_kind NOT NULL,
    state forge.bulk_job_state DEFAULT 'queued'::forge.bulk_job_state NOT NULL,
    total integer NOT NULL,
    processed integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    chunks jsonb DEFAULT '[]'::jsonb NOT NULL,
    payload jsonb NOT NULL,
    requested_by uuid,
    finished_at timestamp with time zone,
    lease_owner text,
    lease_expiry timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY forge.bulk_jobs FORCE ROW LEVEL SECURITY;


--
-- Name: calculation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.calculation_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    period_id uuid NOT NULL,
    revision_id uuid NOT NULL,
    actuals_run_id uuid,
    trigger character varying(64) NOT NULL,
    engine_version character varying(32) NOT NULL,
    policy_versions jsonb NOT NULL,
    input_fingerprint jsonb NOT NULL,
    input_hash character varying(64) NOT NULL,
    status forge.calculation_run_status NOT NULL,
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    error jsonb,
    stats jsonb DEFAULT '{}'::jsonb NOT NULL,
    requested_by uuid,
    supersedes_run_id uuid,
    valuation_context jsonb
);

ALTER TABLE ONLY forge.calculation_runs FORCE ROW LEVEL SECURITY;


--
-- Name: calendar_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.calendar_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    site_id uuid NOT NULL,
    unit_id uuid,
    version integer NOT NULL,
    state forge.calendar_version_state DEFAULT 'draft'::forge.calendar_version_state NOT NULL,
    timezone character varying(64) NOT NULL,
    operational_day_start time without time zone NOT NULL,
    shift_templates jsonb NOT NULL,
    working_intervals jsonb DEFAULT '[]'::jsonb NOT NULL,
    holidays jsonb DEFAULT '[]'::jsonb NOT NULL,
    exclusions jsonb DEFAULT '[]'::jsonb NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    published_by uuid,
    published_at timestamp with time zone,
    republish_reason text,
    CONSTRAINT "CHK_calendar_versions_effective" CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT "CHK_calendar_versions_published_at" CHECK (((state = 'draft'::forge.calendar_version_state) OR (published_at IS NOT NULL)))
);

ALTER TABLE ONLY forge.calendar_versions FORCE ROW LEVEL SECURITY;


--
-- Name: code_mapping_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.code_mapping_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    rule_kind forge.code_mapping_rule_kind NOT NULL,
    source_code_id uuid NOT NULL,
    target_value character varying(64),
    target_code_id uuid,
    version integer NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone
);

ALTER TABLE ONLY forge.code_mapping_rules FORCE ROW LEVEL SECURITY;


--
-- Name: code_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.code_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    library forge.code_library_kind NOT NULL,
    code_id uuid NOT NULL,
    version integer NOT NULL,
    code character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    parent_id uuid,
    snapshot jsonb NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone
);

ALTER TABLE ONLY forge.code_versions FORCE ROW LEVEL SECURITY;


--
-- Name: crew_rotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.crew_rotations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    crew_id uuid NOT NULL,
    pattern jsonb NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    CONSTRAINT "CHK_crew_rotations_effective" CHECK (((effective_to IS NULL) OR (effective_to > effective_from)))
);

ALTER TABLE ONLY forge.crew_rotations FORCE ROW LEVEL SECURITY;


--
-- Name: crews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.crews (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    site_id uuid NOT NULL,
    name character varying(100) NOT NULL
);

ALTER TABLE ONLY forge.crews FORCE ROW LEVEL SECURITY;


--
-- Name: custom_attribute_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.custom_attribute_definitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    organization_id character varying(36),
    entity_type character varying(100) NOT NULL,
    attribute_name character varying(255) NOT NULL,
    display_name character varying(255),
    description text,
    data_type character varying(50),
    is_required boolean DEFAULT false NOT NULL,
    default_value text,
    validation_rules text,
    select_options text,
    display_order integer,
    is_active boolean DEFAULT true NOT NULL,
    created_by character varying(255)
);

ALTER TABLE ONLY forge.custom_attribute_definitions FORCE ROW LEVEL SECURITY;


--
-- Name: custom_attribute_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.custom_attribute_values (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    organization_id character varying(36),
    entity_id character varying(36) NOT NULL,
    entity_type character varying(100) NOT NULL,
    attribute_definition_id character varying(36) NOT NULL,
    value text
);

ALTER TABLE ONLY forge.custom_attribute_values FORCE ROW LEVEL SECURITY;


--
-- Name: demand_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.demand_statuses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    product_id uuid NOT NULL,
    status character varying(20) NOT NULL,
    evidence text NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    version integer NOT NULL,
    state forge.demand_status_state DEFAULT 'draft'::forge.demand_status_state NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    CONSTRAINT "CHK_demand_statuses_approved_at" CHECK (((state <> 'approved'::forge.demand_status_state) OR (approved_at IS NOT NULL))),
    CONSTRAINT "CHK_demand_statuses_effective" CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT "CHK_demand_statuses_status" CHECK (((status)::text = ANY ((ARRAY['demand_constrained'::character varying, 'not_constrained'::character varying])::text[])))
);

ALTER TABLE ONLY forge.demand_statuses FORCE ROW LEVEL SECURITY;


--
-- Name: event_coding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.event_coding (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    event_id uuid NOT NULL,
    revision integer NOT NULL,
    reason_code_id uuid,
    impact_code_id uuid,
    oee_code_id uuid,
    schedule_class forge.production_event_schedule_class NOT NULL,
    oee_component forge.production_event_oee_component NOT NULL,
    impact_mode forge.production_event_impact_mode NOT NULL,
    impact_fraction numeric(9,8),
    comment text,
    is_override boolean DEFAULT false NOT NULL,
    overrides_source_revision integer,
    old_values jsonb NOT NULL,
    new_values jsonb NOT NULL,
    reason text,
    author_id uuid,
    reason_code_version_id uuid,
    impact_code_version_id uuid,
    oee_code_version_id uuid,
    reason_weights jsonb,
    CONSTRAINT "CHK_event_coding_reason_weights" CHECK (((reason_weights IS NULL) OR (jsonb_typeof(reason_weights) = 'array'::text)))
);

ALTER TABLE ONLY forge.event_coding FORCE ROW LEVEL SECURITY;


--
-- Name: event_impacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.event_impacts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    event_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    mode character varying(16) NOT NULL,
    fraction numeric(9,8),
    basis character varying(24) NOT NULL,
    rule_id uuid,
    rule_version integer,
    standby_record_id uuid,
    resolved_at timestamp with time zone NOT NULL,
    CONSTRAINT "CHK_event_impacts_basis" CHECK (((basis)::text = ANY ((ARRAY['default'::character varying, 'stated'::character varying, 'unit_rule'::character varying, 'standby_takeover'::character varying])::text[])))
);

ALTER TABLE ONLY forge.event_impacts FORCE ROW LEVEL SECURITY;


--
-- Name: event_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.event_relations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    from_event_id uuid NOT NULL,
    to_event_id uuid NOT NULL,
    relation_type forge.event_relation_type NOT NULL,
    occurrence_id uuid,
    confidence numeric(5,4),
    approved_by uuid,
    CONSTRAINT "CHK_event_relations_not_self" CHECK ((from_event_id <> to_event_id))
);

ALTER TABLE ONLY forge.event_relations FORCE ROW LEVEL SECURITY;


--
-- Name: event_review_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.event_review_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    event_id uuid NOT NULL,
    kind forge.event_review_item_kind NOT NULL,
    field character varying(64),
    source_revision_id uuid,
    coding_revision_id uuid,
    state forge.event_review_item_state DEFAULT 'open'::forge.event_review_item_state NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone
);

ALTER TABLE ONLY forge.event_review_items FORCE ROW LEVEL SECURITY;


--
-- Name: event_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.event_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    event_id uuid NOT NULL,
    revision integer NOT NULL,
    kind forge.event_revision_kind NOT NULL,
    source_facts jsonb,
    effective_facts jsonb NOT NULL,
    change_reason text,
    actor_id uuid,
    actor_kind forge.event_revision_actor_kind NOT NULL,
    source_revision character varying(255)
);

ALTER TABLE ONLY forge.event_revisions FORCE ROW LEVEL SECURITY;


--
-- Name: evidence_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.evidence_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category_name character varying(255) NOT NULL,
    description text,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY forge.evidence_categories FORCE ROW LEVEL SECURITY;


--
-- Name: evidence_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.evidence_locations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    location_name character varying(255) NOT NULL,
    description text,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY forge.evidence_locations FORCE ROW LEVEL SECURITY;


--
-- Name: export_job_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.export_job_sources (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    export_job_id uuid NOT NULL,
    "position" integer NOT NULL,
    period_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    unit_name character varying(255),
    revision_id uuid NOT NULL,
    snapshot_id uuid NOT NULL,
    slice_products jsonb DEFAULT '{}'::jsonb NOT NULL
);

ALTER TABLE ONLY forge.export_job_sources FORCE ROW LEVEL SECURITY;


--
-- Name: export_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.export_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    report_type forge.export_report_type NOT NULL,
    format forge.export_format NOT NULL,
    revision_selector forge.export_revision_selector NOT NULL,
    filters jsonb NOT NULL,
    unit_ids uuid[],
    requested_by uuid NOT NULL,
    state forge.export_job_state DEFAULT 'queued'::forge.export_job_state NOT NULL,
    counts jsonb NOT NULL,
    partial boolean DEFAULT false NOT NULL,
    cancel_requested boolean DEFAULT false NOT NULL,
    object_key character varying(255),
    content_hash character varying(64),
    size_bytes bigint,
    row_count integer,
    generated_at timestamp with time zone,
    expires_at timestamp with time zone,
    download_count integer DEFAULT 0 NOT NULL,
    error_code character varying(64),
    error_message text,
    attempts integer DEFAULT 0 NOT NULL,
    lease_owner character varying(128),
    lease_expiry timestamp with time zone,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    presentation jsonb,
    labels jsonb,
    case_content jsonb,
    report_content jsonb
);

ALTER TABLE ONLY forge.export_jobs FORCE ROW LEVEL SECURITY;


--
-- Name: external_production_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.external_production_reports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    connection_id uuid,
    external_report_id character varying(128) NOT NULL,
    external_revision character varying(64) NOT NULL,
    site_id uuid NOT NULL,
    local_production_date date NOT NULL,
    timezone character varying(64) NOT NULL,
    utc_start timestamp with time zone NOT NULL,
    utc_end timestamp with time zone NOT NULL,
    lines jsonb NOT NULL,
    basis character varying(8) NOT NULL,
    source_status character varying(64) NOT NULL,
    certified_eligible boolean NOT NULL,
    approved_at_source timestamp with time zone,
    evidence_ref text,
    state forge.external_production_report_state DEFAULT 'current'::forge.external_production_report_state NOT NULL,
    superseded_by_id uuid,
    imported_at timestamp with time zone NOT NULL,
    imported_by uuid,
    source_system character varying(64) DEFAULT 'import'::character varying NOT NULL,
    status_mapping_id uuid,
    source_figures jsonb,
    CONSTRAINT "CHK_external_production_reports_window" CHECK ((utc_end > utc_start))
);

ALTER TABLE ONLY forge.external_production_reports FORCE ROW LEVEL SECURITY;


--
-- Name: failure_code_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.failure_code_groups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    group_kind forge.failure_code_group_kind NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    parent_id uuid,
    path text,
    level integer DEFAULT 0 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    effective_from timestamp with time zone,
    effective_to timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL
);

ALTER TABLE ONLY forge.failure_code_groups FORCE ROW LEVEL SECURITY;


--
-- Name: failure_dictionary_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.failure_dictionary_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    entry_kind character varying(32) NOT NULL,
    equipment_class character varying(50) DEFAULT ''::character varying NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    asset_types jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_pending boolean DEFAULT false NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    CONSTRAINT "CHK_failure_dictionary_entries_class" CHECK ((((equipment_class)::text = ''::text) OR ((entry_kind)::text = ANY ((ARRAY['maintainable_item'::character varying, 'failure_mode'::character varying])::text[])))),
    CONSTRAINT "CHK_failure_dictionary_entries_interval" CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT "CHK_failure_dictionary_entries_kind" CHECK (((entry_kind)::text = ANY ((ARRAY['equipment_class'::character varying, 'maintainable_item'::character varying, 'failure_mode'::character varying, 'failure_mechanism'::character varying, 'failure_cause'::character varying, 'detection_method'::character varying])::text[])))
);

ALTER TABLE ONLY forge.failure_dictionary_entries FORCE ROW LEVEL SECURITY;


--
-- Name: production_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.production_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id character varying(255),
    plan_id uuid,
    unit_id uuid NOT NULL,
    asset_id uuid,
    impact_code_id uuid,
    oee_code_id uuid,
    description text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    source character varying(50),
    quantity numeric(24,8),
    cost numeric(24,8),
    status character varying(50),
    rca_id uuid,
    event_type character varying(50),
    parameter character varying(255),
    value numeric(15,4),
    limit_value numeric(10,2),
    limit_type character varying(10),
    breach_duration integer,
    sol_type character varying(50),
    apm_type character varying(100),
    severity character varying(50),
    recommended_action text,
    work_order_id character varying(255),
    failure_mode character varying(255),
    defective_quantity numeric(10,2),
    shift character varying(50),
    crew character varying(100),
    audit_trail text,
    loss_category character varying(100),
    operator_name character varying(255),
    reason_code_id uuid,
    duration numeric(10,2),
    tenant_id uuid,
    organization_id character varying(36),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    row_version integer DEFAULT 1 NOT NULL,
    duration_seconds numeric(18,3) GENERATED ALWAYS AS (
CASE
    WHEN (end_time IS NULL) THEN NULL::numeric
    ELSE EXTRACT(epoch FROM (end_time - start_time))
END) STORED,
    physical_type forge.production_event_physical_type DEFAULT 'advisory'::forge.production_event_physical_type NOT NULL,
    schedule_class forge.production_event_schedule_class DEFAULT 'unknown'::forge.production_event_schedule_class NOT NULL,
    oee_component forge.production_event_oee_component DEFAULT 'none'::forge.production_event_oee_component NOT NULL,
    impact_mode forge.production_event_impact_mode DEFAULT 'none'::forge.production_event_impact_mode NOT NULL,
    physical_state forge.production_event_physical_state DEFAULT 'open'::forge.production_event_physical_state NOT NULL,
    coding_state forge.production_event_coding_state DEFAULT 'uncoded'::forge.production_event_coding_state NOT NULL,
    rca_state forge.production_event_rca_state DEFAULT 'none'::forge.production_event_rca_state NOT NULL,
    source_kind forge.production_event_source_kind DEFAULT 'manual'::forge.production_event_source_kind NOT NULL,
    impact_fraction numeric(9,8),
    quantity_uom character varying(32),
    canonical_id uuid,
    legacy_duration numeric(10,2),
    legacy_duration_unit_assumed character varying(8),
    legacy_end_sentinel timestamp with time zone,
    current_source_revision integer DEFAULT 0 NOT NULL,
    current_coding_revision integer DEFAULT 0 NOT NULL,
    retracted_at timestamp with time zone,
    duplicate_deliveries integer DEFAULT 0 NOT NULL,
    user_overrides jsonb DEFAULT '{}'::jsonb NOT NULL,
    classification_basis jsonb,
    occurrence_id uuid NOT NULL,
    superseded_by_event_id uuid,
    origin_unit_id uuid,
    origin_asset_id uuid,
    planned_end_time timestamp with time zone,
    failure_severity character varying(16),
    maintainable_item character varying(100),
    failure_mechanism character varying(100),
    failure_cause character varying(100),
    detection_method character varying(100),
    from_product_id uuid,
    to_product_id uuid,
    recovery_of_event_id uuid,
    disposition_class character varying(32),
    investigation_pending boolean DEFAULT false NOT NULL,
    verified_by uuid,
    verified_at timestamp with time zone,
    validated_by uuid,
    validated_at timestamp with time zone,
    catalyst_family character varying(64),
    operating_mode character varying(64),
    stream_code character varying(64),
    lot_code character varying(64),
    impact_basis character varying(24) DEFAULT 'default'::character varying NOT NULL,
    reason_weights jsonb,
    declared_figures jsonb,
    CONSTRAINT "CHK_production_events_disposition_class" CHECK (((disposition_class IS NULL) OR ((physical_type = 'quality_loss'::forge.production_event_physical_type) AND ((disposition_class)::text = ANY ((ARRAY['downgrade'::character varying, 'scrap'::character varying, 'rework'::character varying])::text[]))))),
    CONSTRAINT "CHK_production_events_failure_severity" CHECK (((failure_severity IS NULL) OR ((failure_severity)::text = ANY ((ARRAY['critical'::character varying, 'degraded'::character varying, 'incipient'::character varying])::text[])))),
    CONSTRAINT "CHK_production_events_impact_basis" CHECK (((impact_basis)::text = ANY ((ARRAY['default'::character varying, 'stated'::character varying, 'unit_rule'::character varying, 'standby_takeover'::character varying])::text[]))),
    CONSTRAINT "CHK_production_events_impact_fraction" CHECK (((impact_fraction IS NULL) OR ((impact_fraction >= (0)::numeric) AND (impact_fraction <= (1)::numeric)))),
    CONSTRAINT "CHK_production_events_interval" CHECK (((end_time IS NULL) OR (end_time > start_time))),
    CONSTRAINT "CHK_production_events_planned_end" CHECK (((planned_end_time IS NULL) OR (planned_end_time > start_time))),
    CONSTRAINT "CHK_production_events_reason_weights" CHECK (((reason_weights IS NULL) OR (jsonb_typeof(reason_weights) = 'array'::text))),
    CONSTRAINT "CHK_production_events_recovery_not_self" CHECK (((recovery_of_event_id IS NULL) OR (recovery_of_event_id <> id))),
    CONSTRAINT "CHK_production_events_transition_products" CHECK ((((from_product_id IS NULL) = (to_product_id IS NULL)) AND ((from_product_id IS NULL) OR (from_product_id <> to_product_id)))),
    CONSTRAINT "CHK_production_events_verification" CHECK ((((verified_by IS NULL) = (verified_at IS NULL)) AND ((validated_by IS NULL) = (validated_at IS NULL))))
);

ALTER TABLE ONLY forge.production_events FORCE ROW LEVEL SECURITY;


--
-- Name: failure_events_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW forge.failure_events_v AS
 SELECT e.tenant_id,
    e.unit_id,
    e.occurrence_id,
    (array_agg(e.asset_id ORDER BY e.start_time, e.id) FILTER (WHERE (e.asset_id IS NOT NULL)))[1] AS asset_id,
    min(e.start_time) AS start_time,
        CASE
            WHEN bool_or((e.end_time IS NULL)) THEN NULL::timestamp with time zone
            ELSE max(e.end_time)
        END AS restored_at,
    NULL::timestamp with time zone AS repair_start,
    NULL::timestamp with time zone AS repair_end,
        CASE
            WHEN bool_or(((e.physical_type = 'downtime'::forge.production_event_physical_type) AND (e.schedule_class = 'unplanned'::forge.production_event_schedule_class) AND (((e.failure_severity)::text = ANY (ARRAY[('critical'::character varying)::text, ('degraded'::character varying)::text])) OR ((e.failure_severity IS NULL) AND (NULLIF(btrim((e.failure_mode)::text), ''::text) IS NOT NULL))))) THEN 'unplanned_stop_with_failure_code'::text
            ELSE 'failure_work_order'::text
        END AS source,
    min(NULLIF(btrim((e.failure_mode)::text), ''::text)) AS failure_mode,
    min((e.work_order_id)::text) AS work_order_id,
    (array_agg(e.failure_severity ORDER BY e.start_time, e.id) FILTER (WHERE (e.failure_severity IS NOT NULL)))[1] AS failure_severity
   FROM forge.production_events e
  WHERE ((e.physical_state = ANY (ARRAY['open'::forge.production_event_physical_state, 'closed'::forge.production_event_physical_state])) AND (((e.event_type)::text = 'FailureWO'::text) OR (e.physical_type = 'downtime'::forge.production_event_physical_type)))
  GROUP BY e.tenant_id, e.unit_id, e.occurrence_id
 HAVING (bool_or(((e.event_type)::text = 'FailureWO'::text)) OR bool_or(((e.physical_type = 'downtime'::forge.production_event_physical_type) AND (e.schedule_class = 'unplanned'::forge.production_event_schedule_class) AND (((e.failure_severity)::text = ANY (ARRAY[('critical'::character varying)::text, ('degraded'::character varying)::text])) OR ((e.failure_severity IS NULL) AND (NULLIF(btrim((e.failure_mode)::text), ''::text) IS NOT NULL))))));


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.feature_flags (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    key character varying(64) NOT NULL,
    enabled boolean NOT NULL
);

ALTER TABLE ONLY forge.feature_flags FORCE ROW LEVEL SECURITY;


--
-- Name: fx_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.fx_rates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    from_currency character varying(3) NOT NULL,
    to_currency character varying(3) NOT NULL,
    rate numeric(24,10) NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    version integer NOT NULL,
    state forge.fx_rate_state DEFAULT 'draft'::forge.fx_rate_state NOT NULL,
    source text,
    approved_by uuid,
    approved_at timestamp with time zone,
    rate_type character varying(20) DEFAULT 'economic'::character varying NOT NULL,
    provisional boolean DEFAULT false NOT NULL,
    CONSTRAINT "CHK_fx_rates_approved_at" CHECK (((state <> 'approved'::forge.fx_rate_state) OR (approved_at IS NOT NULL))),
    CONSTRAINT "CHK_fx_rates_currencies" CHECK ((((from_currency)::text ~ '^[A-Z]{3}$'::text) AND ((to_currency)::text ~ '^[A-Z]{3}$'::text) AND ((from_currency)::text <> (to_currency)::text))),
    CONSTRAINT "CHK_fx_rates_effective" CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT "CHK_fx_rates_rate_positive" CHECK ((rate > (0)::numeric)),
    CONSTRAINT "CHK_fx_rates_rate_type" CHECK (((rate_type)::text = ANY ((ARRAY['economic'::character varying, 'group_reporting'::character varying, 'budget'::character varying])::text[])))
);

ALTER TABLE ONLY forge.fx_rates FORCE ROW LEVEL SECURITY;


--
-- Name: idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.idempotency_keys (
    tenant_id uuid NOT NULL,
    key character varying(255) NOT NULL,
    request_hash character varying(64) NOT NULL,
    response_status integer NOT NULL,
    response_body jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
)
WITH (fillfactor='80');

ALTER TABLE ONLY forge.idempotency_keys FORCE ROW LEVEL SECURITY;


--
-- Name: impact_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.impact_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(50),
    cost_per_unit numeric(15,4),
    cost_per_hour numeric(15,4),
    cost_basis character varying(20),
    severity character varying(50),
    color character varying(7),
    is_active boolean DEFAULT true NOT NULL,
    tenant_id uuid,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    effective_from timestamp with time zone,
    effective_to timestamp with time zone
);

ALTER TABLE ONLY forge.impact_codes FORCE ROW LEVEL SECURITY;


--
-- Name: inbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.inbox (
    delivery_key text NOT NULL,
    tenant_id uuid NOT NULL,
    scope character varying(64) NOT NULL,
    type character varying(64) NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
)
WITH (fillfactor='80');

ALTER TABLE ONLY forge.inbox FORCE ROW LEVEL SECURITY;


--
-- Name: ingestion_exceptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.ingestion_exceptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    connection_id uuid NOT NULL,
    source_object_id text NOT NULL,
    raw_id uuid NOT NULL,
    raw_received_at timestamp with time zone NOT NULL,
    error_code forge.ingestion_error_code NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    state forge.ingestion_exception_state DEFAULT 'open'::forge.ingestion_exception_state NOT NULL,
    owner_id uuid,
    first_seen timestamp with time zone NOT NULL,
    last_seen timestamp with time zone NOT NULL,
    occurrences integer DEFAULT 1 NOT NULL,
    resolution jsonb,
    replay_run_id uuid
);

ALTER TABLE ONLY forge.ingestion_exceptions FORCE ROW LEVEL SECURITY;


--
-- Name: ingestion_job_transitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.ingestion_job_transitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    job_id uuid NOT NULL,
    action character varying(32) NOT NULL,
    from_state character varying(16) NOT NULL,
    to_state character varying(16) NOT NULL,
    actor_id uuid,
    runner text,
    detail jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY forge.ingestion_job_transitions FORCE ROW LEVEL SECURITY;


--
-- Name: ingestion_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.ingestion_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    connection_id uuid NOT NULL,
    scope jsonb DEFAULT '{}'::jsonb NOT NULL,
    scope_hash character varying(64) NOT NULL,
    state forge.ingestion_job_state DEFAULT 'created'::forge.ingestion_job_state NOT NULL,
    lease_owner text,
    lease_expiry timestamp with time zone,
    heartbeat_at timestamp with time zone,
    committed_cursor jsonb,
    last_observation_at timestamp with time zone,
    last_success_at timestamp with time zone,
    retry_count integer DEFAULT 0 NOT NULL,
    last_error text,
    cadence jsonb DEFAULT '{"intervalSeconds": 60}'::jsonb NOT NULL,
    recovery jsonb,
    next_run_at timestamp with time zone DEFAULT now(),
    health jsonb DEFAULT '{}'::jsonb NOT NULL
)
WITH (fillfactor='80');

ALTER TABLE ONLY forge.ingestion_jobs FORCE ROW LEVEL SECURITY;


--
-- Name: integration_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.integration_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    source_type forge.integration_source_type NOT NULL,
    display_name character varying(255) NOT NULL,
    endpoint_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    secret_ref text,
    capabilities jsonb DEFAULT '{}'::jsonb NOT NULL,
    config_version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);

ALTER TABLE ONLY forge.integration_connections FORCE ROW LEVEL SECURITY;


--
-- Name: kpi_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.kpi_results (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    run_id uuid NOT NULL,
    period_id uuid NOT NULL,
    scope jsonb NOT NULL,
    metric forge.kpi_metric NOT NULL,
    policy_id uuid,
    numerator numeric(24,8),
    denominator numeric(24,8),
    value numeric(24,10),
    unit character varying(8) NOT NULL,
    quality forge.kpi_quality NOT NULL,
    reason text,
    cohort jsonb,
    as_of timestamp with time zone NOT NULL
);

ALTER TABLE ONLY forge.kpi_results FORCE ROW LEVEL SECURITY;


--
-- Name: loss_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.loss_lines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    run_id uuid NOT NULL,
    revision_id uuid NOT NULL,
    period_id uuid NOT NULL,
    slice_id uuid NOT NULL,
    segment_start timestamp with time zone NOT NULL,
    segment_end timestamp with time zone NOT NULL,
    ledger forge.loss_ledger NOT NULL,
    kind forge.loss_line_kind NOT NULL,
    quantity numeric(24,8) NOT NULL,
    uom character varying(50),
    basis forge.loss_line_basis NOT NULL,
    rate_version_id uuid,
    reason_code_id uuid,
    impact_code_id uuid,
    oee_component character varying(16),
    schedule_class character varying(16),
    failure_codes jsonb,
    loss_category_def_id uuid,
    source forge.loss_line_source NOT NULL,
    auto_key text,
    state forge.loss_line_state NOT NULL,
    comment text,
    author_id uuid,
    valuation jsonb,
    cause_event_id uuid,
    occurrence_id uuid,
    flags jsonb DEFAULT '[]'::jsonb NOT NULL,
    applied_rate numeric,
    applied_rate_timebase character varying(8),
    CONSTRAINT "CHK_loss_lines_segment" CHECK ((segment_end > segment_start))
);

ALTER TABLE ONLY forge.loss_lines FORCE ROW LEVEL SECURITY;


--
-- Name: period_product_slices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.period_product_slices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    period_id uuid NOT NULL,
    product_id uuid NOT NULL,
    profile_id uuid,
    plan_period_id uuid,
    source forge.period_product_slice_source NOT NULL,
    window_from timestamp with time zone NOT NULL,
    window_to timestamp with time zone NOT NULL,
    campaign_from timestamp with time zone,
    campaign_to timestamp with time zone,
    quantity_uom character varying(50),
    actuals_policy_id uuid,
    superseded_at timestamp with time zone,
    CONSTRAINT "CHK_period_product_slices_window" CHECK ((window_to > window_from))
);

ALTER TABLE ONLY forge.period_product_slices FORCE ROW LEVEL SECURITY;


--
-- Name: production_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.production_periods (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    shift_instance_id uuid,
    calendar_version_id uuid,
    utc_start timestamp with time zone NOT NULL,
    utc_end timestamp with time zone NOT NULL,
    local_date date NOT NULL,
    shift_name character varying(64),
    is_excluded boolean DEFAULT false NOT NULL,
    exclusion_kind character varying(32),
    selected_plan_version_id uuid,
    state_readiness forge.production_period_readiness DEFAULT 'open'::forge.production_period_readiness NOT NULL,
    current_actuals_run_id uuid,
    slices_resolved_at timestamp with time zone,
    warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT "CHK_production_periods_interval" CHECK ((utc_end > utc_start))
);

ALTER TABLE ONLY forge.production_periods FORCE ROW LEVEL SECURITY;


--
-- Name: loss_categories_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW forge.loss_categories_v AS
 SELECT l.id AS loss_line_id,
    l.tenant_id,
    p.unit_id,
    l.period_id,
    l.slice_id,
    s.product_id,
    l.run_id,
    (l.kind)::text AS category,
    l.reason_code_id,
    l.impact_code_id,
    l.oee_component,
    l.schedule_class,
    l.quantity,
    l.uom,
    l.basis,
    l.source,
    l.cause_event_id,
    l.segment_start,
    l.segment_end
   FROM (((forge.production_periods p
     LEFT JOIN LATERAL ( SELECT ar.current_run_id
           FROM forge.accounting_revisions ar
          WHERE ((ar.period_id = p.id) AND (ar.lifecycle = ANY (ARRAY['approved'::forge.accounting_revision_lifecycle, 'draft'::forge.accounting_revision_lifecycle])) AND (ar.current_run_id IS NOT NULL))
          ORDER BY (ar.lifecycle = 'approved'::forge.accounting_revision_lifecycle) DESC, ar.revision DESC
         LIMIT 1) cur ON (true))
     JOIN forge.loss_lines l ON ((l.run_id = cur.current_run_id)))
     JOIN forge.period_product_slices s ON ((s.id = l.slice_id)))
  WHERE ((l.ledger = 'plan'::forge.loss_ledger) AND (l.state = 'active'::forge.loss_line_state) AND (l.kind <> 'residual'::forge.loss_line_kind));


--
-- Name: loss_category_defs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.loss_category_defs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    parent_id uuid,
    path text,
    level integer DEFAULT 0 NOT NULL,
    report_order integer DEFAULT 0 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    effective_from timestamp with time zone,
    effective_to timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL
);

ALTER TABLE ONLY forge.loss_category_defs FORCE ROW LEVEL SECURITY;


--
-- Name: loss_line_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.loss_line_evidence (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    loss_line_id uuid NOT NULL,
    event_id uuid,
    event_revision_id uuid,
    observation_id uuid,
    occurrence_id uuid,
    share numeric(9,8) NOT NULL,
    clipped_start timestamp with time zone NOT NULL,
    clipped_end timestamp with time zone NOT NULL
);

ALTER TABLE ONLY forge.loss_line_evidence FORCE ROW LEVEL SECURITY;


--
-- Name: loss_line_valuations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.loss_line_valuations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    run_id uuid NOT NULL,
    loss_line_id uuid NOT NULL,
    period_id uuid NOT NULL,
    slice_id uuid NOT NULL,
    ledger forge.loss_ledger NOT NULL,
    view forge.valuation_view NOT NULL,
    currency character varying(3) NOT NULL,
    amount numeric(28,8),
    native boolean NOT NULL,
    status forge.line_valuation_status NOT NULL,
    reason character varying(64),
    rate_version_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    fx_rate_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    valuation_date timestamp with time zone NOT NULL,
    provisional boolean DEFAULT false NOT NULL,
    components jsonb
);

ALTER TABLE ONLY forge.loss_line_valuations FORCE ROW LEVEL SECURITY;


--
-- Name: lot_dispositions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.lot_dispositions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    product_id uuid NOT NULL,
    lot_code character varying(64) NOT NULL,
    disposition_class character varying(32) NOT NULL,
    quantity numeric(24,8) NOT NULL,
    uom character varying(50) NOT NULL,
    production_start timestamp with time zone NOT NULL,
    production_end timestamp with time zone NOT NULL,
    lab_released_at timestamp with time zone,
    recovery_of_id uuid,
    remeasured boolean DEFAULT false NOT NULL,
    production_event_id uuid,
    supersedes_id uuid,
    reason text,
    evidence_ref text,
    author_id uuid NOT NULL,
    state character varying(16) DEFAULT 'proposed'::character varying NOT NULL,
    decided_by uuid,
    decided_at timestamp with time zone,
    decision_reason text,
    superseded_at timestamp with time zone,
    super_admin_override boolean DEFAULT false NOT NULL,
    CONSTRAINT "CHK_lot_dispositions_class" CHECK (((disposition_class)::text = ANY ((ARRAY['wide_spec'::character varying, 'downgrade'::character varying, 'transition_off_grade'::character varying, 'scrap'::character varying, 'rework'::character varying, 'recovered'::character varying])::text[]))),
    CONSTRAINT "CHK_lot_dispositions_independent" CHECK (((decided_by IS NULL) OR (decided_by <> author_id) OR super_admin_override)),
    CONSTRAINT "CHK_lot_dispositions_interval" CHECK ((production_end > production_start)),
    CONSTRAINT "CHK_lot_dispositions_quantity" CHECK ((quantity > (0)::numeric)),
    CONSTRAINT "CHK_lot_dispositions_recovery" CHECK (((((disposition_class)::text = 'recovered'::text) = (recovery_of_id IS NOT NULL)) AND ((remeasured = false) OR ((disposition_class)::text = 'recovered'::text)))),
    CONSTRAINT "CHK_lot_dispositions_state" CHECK (((state)::text = ANY ((ARRAY['proposed'::character varying, 'approved'::character varying, 'rejected'::character varying, 'superseded'::character varying])::text[])))
);

ALTER TABLE ONLY forge.lot_dispositions FORCE ROW LEVEL SECURITY;


--
-- Name: measurement_samples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.measurement_samples (
    id uuid NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    signal_id uuid NOT NULL,
    value numeric(24,8),
    state_name text,
    state_value integer,
    quality forge.measurement_sample_quality NOT NULL,
    quality_flags jsonb,
    raw_id uuid NOT NULL,
    raw_received_at timestamp with time zone NOT NULL,
    source_revision text NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
)
PARTITION BY RANGE (observed_at);

ALTER TABLE ONLY forge.measurement_samples FORCE ROW LEVEL SECURITY;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE forge.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE forge.migrations_id_seq OWNED BY forge.migrations.id;


--
-- Name: month_close_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.month_close_actions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    month_close_id uuid NOT NULL,
    action character varying(32) NOT NULL,
    from_state character varying(24) NOT NULL,
    to_state character varying(24) NOT NULL,
    actor_id uuid,
    reason text,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL
);

ALTER TABLE ONLY forge.month_close_actions FORCE ROW LEVEL SECURITY;


--
-- Name: month_closes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.month_closes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    calendar character varying(16) NOT NULL,
    month_key character varying(7) NOT NULL,
    first_date date NOT NULL,
    end_date date NOT NULL,
    state character varying(24) DEFAULT 'open'::character varying NOT NULL,
    policy_id uuid NOT NULL,
    policy_version integer NOT NULL,
    quantities_closed_by uuid,
    quantities_closed_at timestamp with time zone,
    finance_signed_off_by uuid,
    finance_signed_off_at timestamp with time zone,
    materiality_required boolean DEFAULT false NOT NULL,
    materiality_reviewed_by uuid,
    materiality_reviewed_at timestamp with time zone,
    locked_by uuid,
    locked_at timestamp with time zone,
    reopen_count integer DEFAULT 0 NOT NULL,
    comment text,
    CONSTRAINT "CHK_month_closes_dates" CHECK ((end_date > first_date)),
    CONSTRAINT "CHK_month_closes_state" CHECK (((state)::text = ANY ((ARRAY['open'::character varying, 'quantities_closed'::character varying, 'finance_signed_off'::character varying, 'locked'::character varying])::text[])))
);

ALTER TABLE ONLY forge.month_closes FORCE ROW LEVEL SECURITY;


--
-- Name: oee_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.oee_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    impact_type character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    tenant_id uuid,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    effective_from timestamp with time zone,
    effective_to timestamp with time zone
);

ALTER TABLE ONLY forge.oee_codes FORCE ROW LEVEL SECURITY;


--
-- Name: plan_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.plan_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    plan_id uuid NOT NULL,
    version integer NOT NULL,
    scenario_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    valid_from timestamp with time zone NOT NULL,
    valid_to timestamp with time zone NOT NULL,
    basis forge.plan_version_basis NOT NULL,
    calendar_version_id uuid,
    header_target numeric(24,8),
    target_source forge.plan_version_target_source DEFAULT 'generated'::forge.plan_version_target_source NOT NULL,
    distribution forge.plan_version_distribution DEFAULT 'scheduled_capacity'::forge.plan_version_distribution NOT NULL,
    approval_state forge.plan_version_approval_state DEFAULT 'draft'::forge.plan_version_approval_state NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    supersedes_version_id uuid,
    change_reason text,
    manual_targets jsonb,
    periods_generated_at timestamp with time zone,
    generation_warnings jsonb,
    generation_error jsonb,
    CONSTRAINT "CHK_plan_versions_approved_at" CHECK (((approval_state <> ALL (ARRAY['approved'::forge.plan_version_approval_state, 'superseded'::forge.plan_version_approval_state])) OR (approved_at IS NOT NULL))),
    CONSTRAINT "CHK_plan_versions_window" CHECK ((valid_to > valid_from))
);

ALTER TABLE ONLY forge.plan_versions FORCE ROW LEVEL SECURITY;


--
-- Name: oee_summaries_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW forge.oee_summaries_v AS
 SELECT p.id,
    p.id AS period_id,
    p.tenant_id,
    p.unit_id,
    pv.plan_id,
    ((p.local_date)::text || COALESCE((' '::text || (p.shift_name)::text), ''::text)) AS period,
    p.utc_start,
    p.utc_end,
    cur.current_run_id AS calculation_run_id,
    (cur.lifecycle)::text AS revision_lifecycle,
    round((a.value * (100)::numeric), 2) AS availability,
    round((pf.value * (100)::numeric), 2) AS performance,
    round((q.value * (100)::numeric), 2) AS quality,
    round((o.value * (100)::numeric), 2) AS oee,
    round((a.denominator / (60)::numeric), 2) AS planned_production_time,
    round((a.numerator / (60)::numeric), 2) AS actual_production_time,
    round(((a.denominator - a.numerator) / (60)::numeric), 2) AS downtime,
    NULL::uuid AS organization_id,
    r.created_at,
    r.created_at AS updated_at
   FROM (((((((forge.production_periods p
     JOIN LATERAL ( SELECT ar.current_run_id,
            ar.lifecycle
           FROM forge.accounting_revisions ar
          WHERE ((ar.period_id = p.id) AND (ar.current_run_id IS NOT NULL) AND (ar.lifecycle = ANY (ARRAY['approved'::forge.accounting_revision_lifecycle, 'draft'::forge.accounting_revision_lifecycle, 'in_review'::forge.accounting_revision_lifecycle])))
          ORDER BY (ar.lifecycle = 'approved'::forge.accounting_revision_lifecycle) DESC, ar.revision DESC
         LIMIT 1) cur ON (true))
     JOIN forge.calculation_runs r ON ((r.id = cur.current_run_id)))
     LEFT JOIN forge.plan_versions pv ON ((pv.id = p.selected_plan_version_id)))
     LEFT JOIN forge.kpi_results a ON (((a.run_id = cur.current_run_id) AND (a.metric = 'availability'::forge.kpi_metric) AND ((a.scope ->> 'level'::text) = 'period'::text))))
     LEFT JOIN forge.kpi_results pf ON (((pf.run_id = cur.current_run_id) AND (pf.metric = 'performance'::forge.kpi_metric) AND ((pf.scope ->> 'level'::text) = 'period'::text))))
     LEFT JOIN forge.kpi_results q ON (((q.run_id = cur.current_run_id) AND (q.metric = 'quality'::forge.kpi_metric) AND ((q.scope ->> 'level'::text) = 'period'::text))))
     LEFT JOIN forge.kpi_results o ON (((o.run_id = cur.current_run_id) AND (o.metric = 'oee'::forge.kpi_metric) AND ((o.scope ->> 'level'::text) = 'period'::text))));


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.organizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    address character varying(500),
    contact_email character varying(255),
    contact_phone character varying(50),
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    row_version integer DEFAULT 1 NOT NULL
);


--
-- Name: outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.outbox (
    id bigint NOT NULL,
    tenant_id uuid NOT NULL,
    aggregate_type character varying(64) NOT NULL,
    aggregate_id character varying(128) NOT NULL,
    type character varying(64) NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    payload jsonb NOT NULL,
    scope character varying(128),
    state forge.outbox_state DEFAULT 'pending'::forge.outbox_state NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone
);

ALTER TABLE ONLY forge.outbox FORCE ROW LEVEL SECURITY;


--
-- Name: outbox_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE forge.outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: outbox_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE forge.outbox_id_seq OWNED BY forge.outbox.id;


--
-- Name: period_change_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.period_change_proposals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    period_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    approved_revision_id uuid NOT NULL,
    trigger forge.period_change_trigger NOT NULL,
    state forge.period_change_proposal_state DEFAULT 'open'::forge.period_change_proposal_state NOT NULL,
    input_hash character varying(64),
    before jsonb NOT NULL,
    after jsonb,
    affected_reports jsonb DEFAULT '[]'::jsonb NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    resolution_reason text,
    created_revision_id uuid
);

ALTER TABLE ONLY forge.period_change_proposals FORCE ROW LEVEL SECURITY;


--
-- Name: period_data_holds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.period_data_holds (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    period_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    kind character varying(16) NOT NULL,
    reason text NOT NULL,
    started_at timestamp with time zone NOT NULL,
    started_by uuid,
    ended_at timestamp with time zone,
    ended_by uuid,
    end_note text,
    CONSTRAINT "CHK_period_data_holds_interval" CHECK (((ended_at IS NULL) OR (ended_at >= started_at))),
    CONSTRAINT "CHK_period_data_holds_kind" CHECK (((kind)::text = ANY ((ARRAY['lab'::character varying, 'source'::character varying, 'other'::character varying])::text[])))
);

ALTER TABLE ONLY forge.period_data_holds FORCE ROW LEVEL SECURITY;


--
-- Name: period_ledger_totals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.period_ledger_totals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    run_id uuid NOT NULL,
    period_id uuid NOT NULL,
    slice_id uuid NOT NULL,
    ledger forge.loss_ledger NOT NULL,
    uom character varying(50),
    capacity_qty numeric(24,8),
    exclusion_qty numeric(24,8),
    availability_qty numeric(24,8),
    performance_qty numeric(24,8),
    quality_qty numeric(24,8),
    good_qty numeric(24,8),
    gain_qty numeric(24,8),
    attributed_qty numeric(24,8),
    residual_qty numeric(24,8),
    target_qty numeric(24,8),
    actual_qty numeric(24,8),
    gap_qty numeric(24,8),
    overproduction_qty numeric(24,8),
    over_accounted_qty numeric(24,8),
    flags jsonb DEFAULT '[]'::jsonb NOT NULL,
    planned_transition_qty numeric(24,8)
);

ALTER TABLE ONLY forge.period_ledger_totals FORCE ROW LEVEL SECURITY;


--
-- Name: period_valuation_totals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.period_valuation_totals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    run_id uuid NOT NULL,
    period_id uuid NOT NULL,
    slice_id uuid NOT NULL,
    ledger forge.loss_ledger NOT NULL,
    kind forge.loss_line_kind NOT NULL,
    view forge.valuation_totals_view NOT NULL,
    currency character varying(3) NOT NULL,
    uom character varying(50),
    amount numeric(28,8),
    native_amount numeric(28,8) NOT NULL,
    valued_lines integer NOT NULL,
    unvalued_lines integer NOT NULL,
    fx_missing_lines integer NOT NULL,
    unvalued_quantity numeric(24,8) NOT NULL,
    unvalued_seconds numeric(24,8) NOT NULL,
    status character varying(16) NOT NULL,
    reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    fx_rate_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    fx_provisional_lines integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY forge.period_valuation_totals FORCE ROW LEVEL SECURITY;


--
-- Name: pi_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.pi_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    organization_id character varying(36),
    connection_name character varying(255) NOT NULL,
    pi_web_api_url character varying(500) NOT NULL,
    username character varying(255),
    password_encrypted text,
    af_database_path character varying(500),
    connection_config text,
    is_active boolean DEFAULT true NOT NULL,
    last_sync_time timestamp with time zone
);

ALTER TABLE ONLY forge.pi_connections FORCE ROW LEVEL SECURITY;


--
-- Name: pi_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.pi_mappings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    organization_id character varying(36),
    source_type character varying(100),
    source_id character varying(255),
    target_type character varying(100),
    target_id character varying(36),
    mapping_rules text,
    is_active boolean DEFAULT true NOT NULL
);

ALTER TABLE ONLY forge.pi_mappings FORCE ROW LEVEL SECURITY;


--
-- Name: pi_open_frames; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.pi_open_frames (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    web_id text NOT NULL,
    start_time timestamp with time zone NOT NULL,
    raw_end_time text,
    last_polled_at timestamp with time zone,
    first_seen timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY forge.pi_open_frames FORCE ROW LEVEL SECURITY;


--
-- Name: pi_page_manifests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.pi_page_manifests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    job_id uuid NOT NULL,
    window_start timestamp with time zone NOT NULL,
    window_end timestamp with time zone NOT NULL,
    page_index integer NOT NULL,
    start_index integer NOT NULL,
    item_count integer,
    outcome character varying(16) NOT NULL,
    attempts integer DEFAULT 1 NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY forge.pi_page_manifests FORCE ROW LEVEL SECURITY;


--
-- Name: pi_sync_job_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.pi_sync_job_links (
    pi_sync_job_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    ingestion_job_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY forge.pi_sync_job_links FORCE ROW LEVEL SECURITY;


--
-- Name: pi_sync_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.pi_sync_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    organization_id character varying(36),
    job_name character varying(255),
    job_type character varying(100),
    schedule character varying(255),
    last_run_time timestamp with time zone,
    next_run_time timestamp with time zone,
    status character varying(50),
    error_message text,
    job_config text,
    is_active boolean DEFAULT true NOT NULL
);

ALTER TABLE ONLY forge.pi_sync_jobs FORCE ROW LEVEL SECURITY;


--
-- Name: pi_sync_watermarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.pi_sync_watermarks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    organization_id character varying(36),
    sync_type character varying(100),
    last_sync_timestamp timestamp with time zone,
    last_sync_marker character varying(255),
    sync_status character varying(50)
);

ALTER TABLE ONLY forge.pi_sync_watermarks FORCE ROW LEVEL SECURITY;


--
-- Name: plan_generation_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.plan_generation_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    plan_id uuid NOT NULL,
    plan_version_id uuid NOT NULL,
    state forge.plan_generation_job_state DEFAULT 'queued'::forge.plan_generation_job_state NOT NULL,
    request jsonb NOT NULL,
    result jsonb,
    error_code character varying(64),
    error_message text,
    requested_by uuid,
    lease_owner text,
    lease_expiry timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    finished_at timestamp with time zone
);

ALTER TABLE ONLY forge.plan_generation_jobs FORCE ROW LEVEL SECURITY;


--
-- Name: plan_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.plan_periods (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    plan_version_id uuid NOT NULL,
    slice_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    shift_instance_id uuid,
    calendar_version_id uuid,
    utc_start timestamp with time zone NOT NULL,
    utc_end timestamp with time zone NOT NULL,
    local_date date NOT NULL,
    shift_name character varying(64) NOT NULL,
    scheduled_seconds integer NOT NULL,
    target numeric(24,8) NOT NULL,
    planning_capacity_qty numeric(24,8),
    sustained_capacity_qty numeric(24,8),
    quantity_uom character varying(50),
    profile_id uuid,
    planning_rate_version_id uuid,
    sustained_rate_version_id uuid,
    is_excluded boolean DEFAULT false NOT NULL,
    exclusion_kind character varying(32),
    CONSTRAINT "CHK_plan_periods_interval" CHECK ((utc_end > utc_start)),
    CONSTRAINT "CHK_plan_periods_target" CHECK ((target >= (0)::numeric))
);

ALTER TABLE ONLY forge.plan_periods FORCE ROW LEVEL SECURITY;


--
-- Name: plan_product_slices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.plan_product_slices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    plan_version_id uuid NOT NULL,
    "position" integer NOT NULL,
    product_id uuid NOT NULL,
    profile_id uuid,
    campaign_from timestamp with time zone,
    campaign_to timestamp with time zone,
    weight numeric(12,8),
    target numeric(24,8),
    stream forge.plan_product_slice_stream DEFAULT 'sequential'::forge.plan_product_slice_stream NOT NULL,
    scenario_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    active_from timestamp with time zone NOT NULL,
    active_to timestamp with time zone NOT NULL,
    is_approved boolean DEFAULT false NOT NULL,
    CONSTRAINT "CHK_plan_product_slices_active" CHECK ((active_to > active_from)),
    CONSTRAINT "CHK_plan_product_slices_campaign" CHECK (((campaign_from IS NULL) OR (campaign_to IS NULL) OR (campaign_to > campaign_from)))
);

ALTER TABLE ONLY forge.plan_product_slices FORCE ROW LEVEL SECURITY;


--
-- Name: plan_scenarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.plan_scenarios (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_accounting_baseline boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY forge.plan_scenarios FORCE ROW LEVEL SECURITY;


--
-- Name: plant_flow_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.plant_flow_routes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    from_unit_id uuid NOT NULL,
    to_unit_id uuid NOT NULL,
    route_role character varying(16) DEFAULT 'feed'::character varying NOT NULL,
    yield_factor numeric(12,8) DEFAULT 1 NOT NULL,
    buffer_name character varying(255),
    usable_inventory numeric(24,8),
    min_operating_level numeric(24,8),
    max_operating_level numeric(24,8),
    inventory_uom character varying(50),
    draw_rate_per_hour numeric(24,8),
    notes text,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    version integer NOT NULL,
    state forge.plant_flow_route_state DEFAULT 'draft'::forge.plant_flow_route_state NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    CONSTRAINT "CHK_plant_flow_routes_approved_at" CHECK (((state <> 'approved'::forge.plant_flow_route_state) OR (approved_at IS NOT NULL))),
    CONSTRAINT "CHK_plant_flow_routes_buffer" CHECK (((((usable_inventory IS NULL) AND (max_operating_level IS NULL)) OR ((inventory_uom IS NOT NULL) AND (draw_rate_per_hour IS NOT NULL))) AND ((usable_inventory IS NULL) OR (usable_inventory >= (0)::numeric)) AND ((draw_rate_per_hour IS NULL) OR (draw_rate_per_hour > (0)::numeric)))),
    CONSTRAINT "CHK_plant_flow_routes_effective" CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT "CHK_plant_flow_routes_limits" CHECK (((min_operating_level IS NULL) OR (max_operating_level IS NULL) OR (max_operating_level > min_operating_level))),
    CONSTRAINT "CHK_plant_flow_routes_role" CHECK (((route_role)::text = ANY ((ARRAY['feed'::character varying, 'alternate'::character varying])::text[]))),
    CONSTRAINT "CHK_plant_flow_routes_units" CHECK ((from_unit_id <> to_unit_id)),
    CONSTRAINT "CHK_plant_flow_routes_yield" CHECK ((yield_factor > (0)::numeric))
);

ALTER TABLE ONLY forge.plant_flow_routes FORCE ROW LEVEL SECURITY;


--
-- Name: production_day_certifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.production_day_certifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    local_date date NOT NULL,
    state character varying(16) DEFAULT 'certified'::character varying NOT NULL,
    revisions jsonb NOT NULL,
    rollup_hash character varying(64) NOT NULL,
    certified_by uuid NOT NULL,
    certified_at timestamp with time zone NOT NULL,
    comment text,
    reopened_by uuid,
    reopened_at timestamp with time zone,
    reopen_reason text,
    CONSTRAINT "CHK_production_day_certifications_state" CHECK (((state)::text = ANY ((ARRAY['certified'::character varying, 'reopened'::character varying])::text[])))
);

ALTER TABLE ONLY forge.production_day_certifications FORCE ROW LEVEL SECURITY;


--
-- Name: production_losses_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW forge.production_losses_v AS
 SELECT s.id AS slice_id,
    p.id AS period_id,
    p.tenant_id,
    p.unit_id,
    s.product_id,
    pv.plan_id,
    p.local_date,
    p.shift_name,
    ((p.local_date)::text || COALESCE((' '::text || (p.shift_name)::text), ''::text)) AS period,
    p.utc_start,
    p.utc_end,
    r.good AS actual,
    r.gross AS actual_gross,
    r.uom AS actual_uom,
    r.quality_state AS actual_quality,
    r.coverage_ratio,
    pp.target AS short_range_plan,
    pp.quantity_uom AS plan_uom,
    p.current_actuals_run_id AS actuals_run_id,
    cur.current_run_id AS calculation_run_id,
    t.attributed_qty AS losses,
    t.residual_qty AS unaccounted_loss,
    t.gap_qty AS gap,
    t.overproduction_qty AS overproduction,
    t.flags AS plan_flags,
    NULL::text AS action
   FROM ((((((forge.production_periods p
     JOIN forge.period_product_slices s ON (((s.period_id = p.id) AND (s.superseded_at IS NULL))))
     LEFT JOIN forge.plan_periods pp ON ((pp.id = s.plan_period_id)))
     LEFT JOIN forge.plan_versions pv ON ((pv.id = pp.plan_version_id)))
     LEFT JOIN forge.actuals_results r ON (((r.actuals_run_id = p.current_actuals_run_id) AND (r.slice_id = s.id))))
     LEFT JOIN LATERAL ( SELECT ar.current_run_id
           FROM forge.accounting_revisions ar
          WHERE ((ar.period_id = p.id) AND (ar.lifecycle = ANY (ARRAY['approved'::forge.accounting_revision_lifecycle, 'draft'::forge.accounting_revision_lifecycle])) AND (ar.current_run_id IS NOT NULL))
          ORDER BY (ar.lifecycle = 'approved'::forge.accounting_revision_lifecycle) DESC, ar.revision DESC
         LIMIT 1) cur ON (true))
     LEFT JOIN forge.period_ledger_totals t ON (((t.run_id = cur.current_run_id) AND (t.slice_id = s.id) AND (t.ledger = 'plan'::forge.loss_ledger))));


--
-- Name: production_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.production_plans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    plan_name character varying(255) NOT NULL,
    unit_id character varying(36) NOT NULL,
    product_id character varying(36),
    tenant_id uuid,
    organization_id character varying(36),
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    target_quantity numeric(15,4),
    actual_quantity numeric(15,4),
    status character varying(50),
    tolerance_limit numeric(15,4),
    plan_basis character varying(255),
    useful_production_time text,
    recurrence character varying(100),
    data_entry_frequency character varying(100),
    shift character varying(50),
    crew character varying(100),
    planner_notes text,
    comments text,
    approval_status character varying(50),
    submitted_by character varying(36),
    submitted_at timestamp with time zone,
    reviewed_by character varying(36),
    reviewed_at timestamp with time zone,
    approved_by character varying(36),
    approved_at timestamp with time zone,
    rejection_reason text,
    custom_attributes text,
    audit_trail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    legacy_id uuid,
    scenario_id uuid,
    current_version integer,
    unit_ref_id uuid,
    product_ref_id uuid
);

ALTER TABLE ONLY forge.production_plans FORCE ROW LEVEL SECURITY;


--
-- Name: production_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.production_profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    product_id uuid NOT NULL,
    operating_mode character varying(64) DEFAULT 'normal'::character varying NOT NULL,
    quantity_uom character varying(50),
    rate_timebase forge.production_profile_rate_timebase,
    capacity_model forge.production_profile_capacity_model DEFAULT 'single_stream'::forge.production_profile_capacity_model NOT NULL,
    actuals_policy_id uuid,
    oee_policy_id uuid,
    valuation_policy_id uuid,
    product_mix_constraints jsonb,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    version integer NOT NULL,
    state forge.production_profile_state DEFAULT 'draft'::forge.production_profile_state NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    legacy_values jsonb,
    CONSTRAINT "CHK_production_profiles_approved_at" CHECK (((state <> 'approved'::forge.production_profile_state) OR (approved_at IS NOT NULL))),
    CONSTRAINT "CHK_production_profiles_effective" CHECK (((effective_to IS NULL) OR (effective_to > effective_from)))
);

ALTER TABLE ONLY forge.production_profiles FORCE ROW LEVEL SECURITY;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.products (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    uom character varying(50),
    description text,
    standard_rate numeric(15,4),
    tenant_id uuid,
    organization_id character varying(36),
    unit_id character varying(36),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    row_version integer DEFAULT 1 NOT NULL
);

ALTER TABLE ONLY forge.products FORCE ROW LEVEL SECURITY;


--
-- Name: rate_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rate_imports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    kind forge.rate_import_kind NOT NULL,
    external_id character varying(255) NOT NULL,
    revision integer NOT NULL,
    file_ref character varying(500),
    state forge.rate_import_state DEFAULT 'queued'::forge.rate_import_state NOT NULL,
    payload jsonb NOT NULL,
    counts jsonb,
    report jsonb,
    imported_by uuid,
    finished_at timestamp with time zone
);

ALTER TABLE ONLY forge.rate_imports FORCE ROW LEVEL SECURITY;


--
-- Name: raw_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.raw_identities (
    tenant_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    message_id text NOT NULL,
    raw_id uuid NOT NULL,
    received_at timestamp with time zone NOT NULL,
    duplicate_count integer DEFAULT 0 NOT NULL,
    last_duplicate_at timestamp with time zone
);

ALTER TABLE ONLY forge.raw_identities FORCE ROW LEVEL SECURITY;


--
-- Name: raw_observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.raw_observations (
    id uuid NOT NULL,
    received_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    message_id text NOT NULL,
    source_object_id text NOT NULL,
    source_revision text,
    content_hash text NOT NULL,
    kind character varying(32),
    operation character varying(16),
    event_time timestamp with time zone,
    payload jsonb,
    payload_ref text,
    payload_size integer NOT NULL,
    quality jsonb,
    source_cursor jsonb,
    mapping_version integer DEFAULT 0 NOT NULL,
    correlation_id text,
    replay_run_id uuid,
    original_raw_id uuid,
    outcome forge.raw_observation_outcome NOT NULL
)
PARTITION BY RANGE (received_at);

ALTER TABLE ONLY forge.raw_observations FORCE ROW LEVEL SECURITY;


--
-- Name: raw_observations_y2026m09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.raw_observations_y2026m09 (
    id uuid NOT NULL,
    received_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    message_id text NOT NULL,
    source_object_id text NOT NULL,
    source_revision text,
    content_hash text NOT NULL,
    kind character varying(32),
    operation character varying(16),
    event_time timestamp with time zone,
    payload jsonb,
    payload_ref text,
    payload_size integer NOT NULL,
    quality jsonb,
    source_cursor jsonb,
    mapping_version integer DEFAULT 0 NOT NULL,
    correlation_id text,
    replay_run_id uuid,
    original_raw_id uuid,
    outcome forge.raw_observation_outcome NOT NULL
);


--
-- Name: raw_observations_y2026m10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.raw_observations_y2026m10 (
    id uuid NOT NULL,
    received_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    message_id text NOT NULL,
    source_object_id text NOT NULL,
    source_revision text,
    content_hash text NOT NULL,
    kind character varying(32),
    operation character varying(16),
    event_time timestamp with time zone,
    payload jsonb,
    payload_ref text,
    payload_size integer NOT NULL,
    quality jsonb,
    source_cursor jsonb,
    mapping_version integer DEFAULT 0 NOT NULL,
    correlation_id text,
    replay_run_id uuid,
    original_raw_id uuid,
    outcome forge.raw_observation_outcome NOT NULL
);


--
-- Name: raw_observations_y2026m11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.raw_observations_y2026m11 (
    id uuid NOT NULL,
    received_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    message_id text NOT NULL,
    source_object_id text NOT NULL,
    source_revision text,
    content_hash text NOT NULL,
    kind character varying(32),
    operation character varying(16),
    event_time timestamp with time zone,
    payload jsonb,
    payload_ref text,
    payload_size integer NOT NULL,
    quality jsonb,
    source_cursor jsonb,
    mapping_version integer DEFAULT 0 NOT NULL,
    correlation_id text,
    replay_run_id uuid,
    original_raw_id uuid,
    outcome forge.raw_observation_outcome NOT NULL
);


--
-- Name: raw_observations_y2026m12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.raw_observations_y2026m12 (
    id uuid NOT NULL,
    received_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    message_id text NOT NULL,
    source_object_id text NOT NULL,
    source_revision text,
    content_hash text NOT NULL,
    kind character varying(32),
    operation character varying(16),
    event_time timestamp with time zone,
    payload jsonb,
    payload_ref text,
    payload_size integer NOT NULL,
    quality jsonb,
    source_cursor jsonb,
    mapping_version integer DEFAULT 0 NOT NULL,
    correlation_id text,
    replay_run_id uuid,
    original_raw_id uuid,
    outcome forge.raw_observation_outcome NOT NULL
);


--
-- Name: rca_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rca_actions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    rca_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    owner_id uuid,
    due_date timestamp with time zone,
    status forge.rca_action_status NOT NULL,
    completion_evidence_ref text,
    completed_at timestamp with time zone,
    verification_window_start timestamp with time zone,
    verification_window_end timestamp with time zone,
    baseline jsonb,
    post_action jsonb,
    claimed_avoided_loss numeric(24,8),
    claimed_currency character varying(3),
    action_type character varying(32),
    completion_verified_by uuid,
    completion_attachments jsonb,
    cancel_reason text,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    recommendation_id character varying(64),
    task_completed_at timestamp with time zone,
    verification_method text,
    verifier_id uuid,
    CONSTRAINT "CHK_rca_actions_action_type" CHECK (((action_type IS NULL) OR ((action_type)::text = ANY ((ARRAY['repair'::character varying, 'design_change'::character varying, 'procedure_change'::character varying, 'instrument_change'::character varying, 'training'::character varying, 'other'::character varying])::text[])))),
    CONSTRAINT "CHK_rca_actions_window" CHECK (((verification_window_end IS NULL) OR (verification_window_end > verification_window_start)))
);

ALTER TABLE ONLY forge.rca_actions FORCE ROW LEVEL SECURITY;


--
-- Name: rca_barrier_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rca_barrier_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    organization_id character varying(36),
    rca_id uuid NOT NULL,
    hazard character varying(255) NOT NULL,
    barriers text NOT NULL,
    row_version integer DEFAULT 1 NOT NULL
);

ALTER TABLE ONLY forge.rca_barrier_analyses FORCE ROW LEVEL SECURITY;


--
-- Name: rca_case_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rca_case_links (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    rca_id uuid NOT NULL,
    link_type forge.rca_link_type NOT NULL,
    target_id character varying(255) NOT NULL,
    target_revision integer,
    unit_id uuid,
    source character varying(16) NOT NULL,
    linked_by uuid,
    linked_at timestamp with time zone NOT NULL,
    reason text,
    evidence jsonb
);

ALTER TABLE ONLY forge.rca_case_links FORCE ROW LEVEL SECURITY;


--
-- Name: rca_cause_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rca_cause_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    tenant_id uuid,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_id uuid,
    row_version integer DEFAULT 1 NOT NULL
);

ALTER TABLE ONLY forge.rca_cause_codes FORCE ROW LEVEL SECURITY;


--
-- Name: rca_causes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rca_causes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    rca_id uuid NOT NULL,
    kind character varying(16) NOT NULL,
    cause_code_id uuid,
    statement text NOT NULL,
    evidence_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    node_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT "CHK_rca_causes_kind" CHECK (((kind)::text = ANY ((ARRAY['direct'::character varying, 'contributing'::character varying, 'root'::character varying])::text[])))
);

ALTER TABLE ONLY forge.rca_causes FORCE ROW LEVEL SECURITY;


--
-- Name: rca_change_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rca_change_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    organization_id character varying(36),
    rca_id uuid NOT NULL,
    question character varying(255) NOT NULL,
    changes text NOT NULL,
    row_version integer DEFAULT 1 NOT NULL
);

ALTER TABLE ONLY forge.rca_change_analyses FORCE ROW LEVEL SECURITY;


--
-- Name: rca_fault_tree_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rca_fault_tree_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    organization_id character varying(36),
    rca_id uuid NOT NULL,
    top_event character varying(255) NOT NULL,
    nodes text NOT NULL,
    minimum_cut_sets text,
    row_version integer DEFAULT 1 NOT NULL
);

ALTER TABLE ONLY forge.rca_fault_tree_analyses FORCE ROW LEVEL SECURITY;


--
-- Name: rca_fishbone_diagrams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rca_fishbone_diagrams (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    organization_id character varying(36),
    rca_id uuid NOT NULL,
    effect text NOT NULL,
    categories text NOT NULL,
    row_version integer DEFAULT 1 NOT NULL
);

ALTER TABLE ONLY forge.rca_fishbone_diagrams FORCE ROW LEVEL SECURITY;


--
-- Name: rca_five_why_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rca_five_why_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    organization_id character varying(36),
    rca_id uuid NOT NULL,
    problem text NOT NULL,
    why_levels text NOT NULL,
    root_cause text NOT NULL,
    verified_by character varying(255),
    verified_date timestamp with time zone,
    row_version integer DEFAULT 1 NOT NULL
);

ALTER TABLE ONLY forge.rca_five_why_analyses FORCE ROW LEVEL SECURITY;


--
-- Name: rca_fmea_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rca_fmea_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    organization_id character varying(36),
    rca_id uuid NOT NULL,
    failure_mode character varying(255) NOT NULL,
    effects text NOT NULL,
    causes text NOT NULL,
    row_version integer DEFAULT 1 NOT NULL
);

ALTER TABLE ONLY forge.rca_fmea_analyses FORCE ROW LEVEL SECURITY;


--
-- Name: rca_knowledge_base; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rca_knowledge_base (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    organization_id character varying(36),
    rca_id uuid,
    title character varying(255) NOT NULL,
    description text,
    problem_statement text,
    event_type character varying(100),
    unit_id character varying(36),
    unit_name character varying(255),
    asset_id character varying(36),
    asset_name character varying(255),
    equipment_category character varying(150),
    category character varying(100),
    symptoms text,
    impact_codes text,
    oee_codes text,
    root_cause text,
    root_cause_category character varying(150),
    contributing_factors text,
    recommendations text,
    recurrence_count integer DEFAULT 0 NOT NULL,
    effectiveness double precision DEFAULT '0'::double precision NOT NULL,
    cost_saved numeric(28,8),
    downtime_reduced double precision,
    keywords text,
    tags text,
    content text,
    related_rcas text,
    author character varying(36),
    is_published boolean DEFAULT false NOT NULL,
    times_referenced integer DEFAULT 0 NOT NULL,
    helpful_votes integer DEFAULT 0 NOT NULL,
    closed_date character varying(50),
    row_version integer DEFAULT 1 NOT NULL,
    published_at timestamp with time zone,
    published_by character varying(36),
    failure_mode character varying(255),
    share_scope character varying(16) DEFAULT 'tenant'::character varying NOT NULL,
    shared_by uuid,
    shared_at timestamp with time zone,
    lesson_status character varying(24),
    CONSTRAINT "CHK_rca_knowledge_base_lesson_status" CHECK (((lesson_status IS NULL) OR ((lesson_status)::text = ANY ((ARRAY['verified_practice'::character varying, 'caution'::character varying, 'unverified'::character varying])::text[])))),
    CONSTRAINT "CHK_rca_knowledge_base_share_scope" CHECK (((share_scope)::text = ANY ((ARRAY['tenant'::character varying, 'organization'::character varying])::text[])))
);

ALTER TABLE ONLY forge.rca_knowledge_base FORCE ROW LEVEL SECURITY;


--
-- Name: rca_knowledge_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rca_knowledge_votes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    entry_id uuid NOT NULL,
    user_id uuid NOT NULL,
    helpful boolean NOT NULL
);

ALTER TABLE ONLY forge.rca_knowledge_votes FORCE ROW LEVEL SECURITY;


--
-- Name: rca_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rca_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    template_name character varying(255) NOT NULL,
    description text,
    template_type character varying(100),
    template_data text,
    is_active boolean DEFAULT true NOT NULL,
    organization_id uuid NOT NULL,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    row_version integer DEFAULT 1 NOT NULL
);

ALTER TABLE ONLY forge.rca_templates FORCE ROW LEVEL SECURITY;


--
-- Name: rca_trigger_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rca_trigger_evaluations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    idempotency_key character varying(200) NOT NULL,
    source_kind character varying(16) NOT NULL,
    source_id uuid NOT NULL,
    source_version integer NOT NULL,
    trigger character varying(16) NOT NULL,
    event_id uuid NOT NULL,
    occurrence_id uuid,
    unit_id uuid NOT NULL,
    fired_on forge.rca_trigger_fired_on NOT NULL,
    provisional boolean NOT NULL,
    outcome forge.rca_trigger_outcome NOT NULL,
    state character varying(16) NOT NULL,
    rca_id uuid,
    detail jsonb NOT NULL,
    fired_at timestamp with time zone NOT NULL,
    confirmed_at timestamp with time zone,
    resolved_by uuid,
    resolved_at timestamp with time zone
);

ALTER TABLE ONLY forge.rca_trigger_evaluations FORCE ROW LEVEL SECURITY;


--
-- Name: rcas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rcas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id uuid,
    title character varying(255) NOT NULL,
    description text,
    status character varying(50),
    team_lead_id uuid,
    team_members text,
    priority character varying(50),
    target_completion_date timestamp with time zone,
    actual_completion_date timestamp with time zone,
    root_cause text,
    recommendations text,
    logic_tree text,
    evidence text,
    template_id uuid,
    team_charter text,
    event_diagram text,
    pre_failure_rate numeric(5,2),
    post_failure_rate numeric(5,2),
    failure_cost_per_incident numeric(10,2),
    implementation_cost numeric(10,2),
    time_to_resolution numeric(10,2),
    time_to_implementation numeric(10,2),
    effectiveness_score numeric(5,2),
    last_updated timestamp with time zone,
    tracking_notes text,
    phase_timeline text,
    calculated_roi numeric(10,2),
    cost_savings numeric(10,2),
    downtime_reduction numeric(5,2),
    productivity_improvement numeric(5,2),
    tenant_id uuid,
    organization_id character varying(36),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    unit_id uuid,
    asset_id uuid,
    row_version integer DEFAULT 1 NOT NULL,
    created_by uuid,
    consequence_class character varying(16),
    residual_risk text,
    closure_requested_by uuid,
    closure_requested_at timestamp with time zone,
    closure_approved_by uuid,
    closure_approved_at timestamp with time zone,
    closure_note text,
    effectiveness_verdict character varying(24),
    investigator_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    coded_root_cause_required boolean DEFAULT true NOT NULL,
    CONSTRAINT "CHK_rcas_consequence_class" CHECK (((consequence_class IS NULL) OR ((consequence_class)::text = ANY ((ARRAY['minor'::character varying, 'significant'::character varying, 'major'::character varying, 'critical'::character varying])::text[])))),
    CONSTRAINT "CHK_rcas_effectiveness_verdict" CHECK (((effectiveness_verdict IS NULL) OR ((effectiveness_verdict)::text = ANY ((ARRAY['effective'::character varying, 'not_effective'::character varying, 'insufficient_evidence'::character varying])::text[]))))
);

ALTER TABLE ONLY forge.rcas FORCE ROW LEVEL SECURITY;


--
-- Name: reason_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.reason_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    tenant_id uuid,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_id uuid,
    path text,
    level integer DEFAULT 0 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    effective_from timestamp with time zone,
    effective_to timestamp with time zone,
    default_oee_component forge.production_event_oee_component,
    default_schedule_class forge.production_event_schedule_class,
    default_impact_code_id uuid
);

ALTER TABLE ONLY forge.reason_codes FORCE ROW LEVEL SECURITY;


--
-- Name: reconciliation_line_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.reconciliation_line_sets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    revision_id uuid NOT NULL,
    period_id uuid NOT NULL,
    version integer NOT NULL,
    base_run_id uuid NOT NULL,
    origin character varying(32) NOT NULL
);

ALTER TABLE ONLY forge.reconciliation_line_sets FORCE ROW LEVEL SECURITY;


--
-- Name: reconciliation_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.reconciliation_lines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    line_set_id uuid NOT NULL,
    period_id uuid NOT NULL,
    slice_id uuid NOT NULL,
    "position" integer NOT NULL,
    action forge.reconciliation_line_action NOT NULL,
    auto_key text,
    kind forge.loss_line_kind,
    quantity numeric(24,8),
    base_quantity numeric(24,8),
    uom character varying(50),
    basis forge.loss_line_basis,
    reason_code_id uuid,
    impact_code_id uuid,
    evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    adjustment_id uuid,
    missing_code boolean DEFAULT false NOT NULL,
    missing_event boolean DEFAULT false NOT NULL,
    reason text,
    comment text,
    author_id uuid,
    classification character varying(32),
    evidence_type character varying(32),
    evidence_ref character varying(200),
    reverses_line_id uuid
);

ALTER TABLE ONLY forge.reconciliation_lines FORCE ROW LEVEL SECURITY;


--
-- Name: replay_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.replay_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    connection_id uuid NOT NULL,
    from_time timestamp with time zone,
    to_time timestamp with time zone,
    scopes jsonb DEFAULT '{}'::jsonb NOT NULL,
    reason text NOT NULL,
    dry_run boolean DEFAULT false NOT NULL,
    state forge.replay_run_state DEFAULT 'queued'::forge.replay_run_state NOT NULL,
    counts jsonb DEFAULT '{}'::jsonb NOT NULL,
    requested_by uuid,
    lease_owner text,
    lease_expiry timestamp with time zone,
    cursor text,
    last_error text,
    finished_at timestamp with time zone
);

ALTER TABLE ONLY forge.replay_runs FORCE ROW LEVEL SECURITY;


--
-- Name: restatement_postings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.restatement_postings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    revision_id uuid NOT NULL,
    period_id uuid NOT NULL,
    operational_effective_date date NOT NULL,
    posting_date date NOT NULL,
    treatment character varying(24) NOT NULL,
    note text,
    decided_by uuid NOT NULL,
    decided_at timestamp with time zone NOT NULL,
    CONSTRAINT "CHK_restatement_postings_treatment" CHECK (((treatment)::text = ANY ((ARRAY['correction'::character varying, 'estimate_change'::character varying, 'other_adjustment'::character varying, 'no_posting'::character varying])::text[])))
);

ALTER TABLE ONLY forge.restatement_postings FORCE ROW LEVEL SECURITY;


--
-- Name: role_delegations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.role_delegations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    delegator_id uuid NOT NULL,
    delegate_id uuid NOT NULL,
    role character varying(50) NOT NULL,
    scope_kind character varying(16) NOT NULL,
    scope_id uuid NOT NULL,
    valid_from timestamp with time zone NOT NULL,
    valid_until timestamp with time zone NOT NULL,
    reason text NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revoke_reason text,
    CONSTRAINT "CHK_role_delegations_interval" CHECK ((valid_until > valid_from)),
    CONSTRAINT "CHK_role_delegations_parties" CHECK ((delegate_id <> delegator_id)),
    CONSTRAINT "CHK_role_delegations_role" CHECK (((role)::text = ANY ((ARRAY['manager_approver'::character varying, 'production_accountant'::character varying, 'finance_approver'::character varying, 'quality_approver'::character varying, 'metrology_approver'::character varying])::text[]))),
    CONSTRAINT "CHK_role_delegations_scope_kind" CHECK (((scope_kind)::text = ANY ((ARRAY['tenant'::character varying, 'site'::character varying, 'unit'::character varying])::text[])))
);

ALTER TABLE ONLY forge.role_delegations FORCE ROW LEVEL SECURITY;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    permissions text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rule_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rule_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    rule_id uuid NOT NULL,
    version integer,
    definition jsonb NOT NULL,
    sample_scope jsonb NOT NULL,
    results jsonb NOT NULL,
    ran_at timestamp with time zone NOT NULL
);

ALTER TABLE ONLY forge.rule_runs FORCE ROW LEVEL SECURITY;


--
-- Name: rule_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rule_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    rule_id uuid NOT NULL,
    version integer NOT NULL,
    definition jsonb NOT NULL,
    origin forge.rule_version_origin NOT NULL,
    restored_version integer,
    authored_by uuid,
    approved_by uuid NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    reason text
);

ALTER TABLE ONLY forge.rule_versions FORCE ROW LEVEL SECURITY;


--
-- Name: rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    kind forge.rule_kind NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    priority integer DEFAULT 100 NOT NULL,
    state forge.rule_state NOT NULL,
    active_version integer,
    draft_definition jsonb,
    draft_author uuid,
    draft_updated_at timestamp with time zone,
    retired_at timestamp with time zone
);

ALTER TABLE ONLY forge.rules FORCE ROW LEVEL SECURITY;


--
-- Name: secrets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.secrets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    kind character varying(32) NOT NULL,
    ciphertext text NOT NULL
);

ALTER TABLE ONLY forge.secrets FORCE ROW LEVEL SECURITY;


--
-- Name: shift_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.shift_instances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    calendar_version_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    local_date date NOT NULL,
    shift_name character varying(64) NOT NULL,
    utc_start timestamp with time zone NOT NULL,
    utc_end timestamp with time zone NOT NULL,
    utc_offset_start integer NOT NULL,
    utc_offset_end integer NOT NULL,
    local_start character varying(32) NOT NULL,
    local_end character varying(32) NOT NULL,
    is_excluded boolean DEFAULT false NOT NULL,
    exclusion_kind character varying(32),
    exclusion_reason text,
    crew_id uuid,
    CONSTRAINT "CHK_shift_instances_exclusion" CHECK ((is_excluded = (exclusion_kind IS NOT NULL))),
    CONSTRAINT "CHK_shift_instances_interval" CHECK ((utc_end > utc_start))
);

ALTER TABLE ONLY forge.shift_instances FORCE ROW LEVEL SECURITY;


--
-- Name: shift_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.shift_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    local_date date NOT NULL,
    shift_name character varying(64) NOT NULL,
    body text NOT NULL,
    CONSTRAINT "CHK_shift_notes_body" CHECK (((length(body) >= 1) AND (length(body) <= 2000)))
);

ALTER TABLE ONLY forge.shift_notes FORCE ROW LEVEL SECURITY;


--
-- Name: signal_backfill_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.signal_backfill_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    signal_id uuid NOT NULL,
    from_time timestamp with time zone NOT NULL,
    to_time timestamp with time zone NOT NULL,
    state forge.signal_backfill_state DEFAULT 'queued'::forge.signal_backfill_state NOT NULL,
    reason character varying(32) NOT NULL,
    ingestion_job_id uuid,
    detail jsonb,
    CONSTRAINT "CHK_signal_backfill_runs_interval" CHECK ((to_time > from_time))
);

ALTER TABLE ONLY forge.signal_backfill_runs FORCE ROW LEVEL SECURITY;


--
-- Name: signal_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.signal_summaries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    signal_id uuid NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    total numeric(24,8),
    summary_type character varying(32) NOT NULL,
    calculation_basis character varying(32) NOT NULL,
    timebase character varying(8) NOT NULL,
    quality forge.measurement_sample_quality NOT NULL,
    raw_id uuid NOT NULL,
    raw_received_at timestamp with time zone NOT NULL,
    source_revision text NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CHK_signal_summaries_period" CHECK ((period_end > period_start))
);

ALTER TABLE ONLY forge.signal_summaries FORCE ROW LEVEL SECURITY;


--
-- Name: signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.signals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    connection_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    source_key text NOT NULL,
    source_binding jsonb DEFAULT '{}'::jsonb NOT NULL,
    unit_id uuid NOT NULL,
    asset_id uuid,
    product_id uuid,
    semantic_type forge.signal_semantic_type NOT NULL,
    canonical_uom character varying(32),
    rate_timebase forge.signal_rate_timebase,
    interpolation forge.signal_interpolation DEFAULT 'step'::forge.signal_interpolation NOT NULL,
    max_gap_seconds integer DEFAULT 900 NOT NULL,
    reset_policy forge.signal_reset_policy DEFAULT 'none'::forge.signal_reset_policy NOT NULL,
    rollover_modulus numeric(24,8),
    expected_min numeric(24,8),
    expected_max numeric(24,8),
    cadence_seconds integer,
    quality_policy jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_authority boolean DEFAULT false NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT "CHK_signals_effective_interval" CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT "CHK_signals_max_gap_positive" CHECK ((max_gap_seconds > 0))
);

ALTER TABLE ONLY forge.signals FORCE ROW LEVEL SECURITY;


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.sites (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    timezone character varying(64) NOT NULL,
    timezone_fallback boolean DEFAULT false NOT NULL,
    operational_day_start time without time zone NOT NULL,
    is_default boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY forge.sites FORCE ROW LEVEL SECURITY;


--
-- Name: source_hierarchy_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.source_hierarchy_mappings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    source_type character varying(50) NOT NULL,
    source_connection_id uuid,
    source_identifier character varying(1000) NOT NULL,
    source_path character varying(1000),
    target_type character varying(50) NOT NULL,
    target_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id character varying(36),
    is_pattern boolean DEFAULT false NOT NULL,
    pattern character varying(500),
    priority integer DEFAULT 50 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY forge.source_hierarchy_mappings FORCE ROW LEVEL SECURITY;


--
-- Name: source_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.source_mappings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    connection_id uuid,
    source_system character varying(50) DEFAULT 'PI'::character varying NOT NULL,
    match_kind forge.source_mapping_match_kind NOT NULL,
    match_value text NOT NULL,
    normalized_value text NOT NULL,
    precedence integer DEFAULT 0 NOT NULL,
    target_type forge.source_mapping_target_type NOT NULL,
    target_id uuid NOT NULL,
    effective_from timestamp with time zone,
    effective_to timestamp with time zone,
    version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    description text,
    legacy_mapping_id uuid
);

ALTER TABLE ONLY forge.source_mappings FORCE ROW LEVEL SECURITY;


--
-- Name: source_objects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.source_objects (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    connection_id uuid NOT NULL,
    source_object_id text NOT NULL,
    kind character varying(32) NOT NULL,
    canonical_event_id uuid,
    signal_id uuid,
    latest_raw_id uuid NOT NULL,
    latest_received_at timestamp with time zone NOT NULL,
    latest_revision text,
    latest_hash text NOT NULL,
    latest_observed_at timestamp with time zone NOT NULL,
    normalized_raw_id uuid,
    first_seen timestamp with time zone NOT NULL,
    last_seen timestamp with time zone NOT NULL,
    state forge.source_object_state DEFAULT 'active'::forge.source_object_state NOT NULL
);

ALTER TABLE ONLY forge.source_objects FORCE ROW LEVEL SECURITY;


--
-- Name: source_status_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.source_status_mappings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    source_system character varying(64) NOT NULL,
    version integer NOT NULL,
    statuses jsonb NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    state character varying(16) DEFAULT 'draft'::character varying NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    notes text,
    CONSTRAINT "CHK_source_status_mappings_effective" CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT "CHK_source_status_mappings_state" CHECK (((state)::text = ANY ((ARRAY['draft'::character varying, 'approved'::character varying, 'retired'::character varying])::text[])))
);

ALTER TABLE ONLY forge.source_status_mappings FORCE ROW LEVEL SECURITY;


--
-- Name: standby_equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.standby_equipment (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    asset_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    evaluation character varying(24) NOT NULL,
    notes text,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    CONSTRAINT "CHK_standby_equipment_evaluation" CHECK (((evaluation)::text = ANY ((ARRAY['demand'::character varying, 'running'::character varying, 'demand_and_running'::character varying])::text[]))),
    CONSTRAINT "CHK_standby_equipment_interval" CHECK (((effective_to IS NULL) OR (effective_to > effective_from)))
);

ALTER TABLE ONLY forge.standby_equipment FORCE ROW LEVEL SECURITY;


--
-- Name: standby_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.standby_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    asset_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    record_kind character varying(16) NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    outcome character varying(24) NOT NULL,
    event_id uuid,
    external_ref character varying(100),
    notes text,
    CONSTRAINT "CHK_standby_records_interval" CHECK (((ended_at IS NULL) OR (ended_at >= started_at))),
    CONSTRAINT "CHK_standby_records_kind" CHECK (((record_kind)::text = ANY ((ARRAY['demand'::character varying, 'test'::character varying, 'run'::character varying])::text[]))),
    CONSTRAINT "CHK_standby_records_outcome" CHECK ((((outcome)::text = ANY ((ARRAY['success'::character varying, 'failed_start'::character varying, 'failed_while_running'::character varying])::text[])) AND (((outcome)::text <> 'failed_while_running'::text) OR ((record_kind)::text = 'run'::text)) AND (((outcome)::text <> 'failed_start'::text) OR ((record_kind)::text <> 'run'::text))))
);

ALTER TABLE ONLY forge.standby_records FORCE ROW LEVEL SECURITY;


--
-- Name: state_engine_cursors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.state_engine_cursors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    mapping_id uuid NOT NULL,
    processed_through timestamp with time zone NOT NULL,
    samples_seen_through timestamp with time zone NOT NULL
);

ALTER TABLE ONLY forge.state_engine_cursors FORCE ROW LEVEL SECURITY;


--
-- Name: stop_incident_breaks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.stop_incident_breaks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    occurrence_id uuid NOT NULL,
    reason text NOT NULL
);

ALTER TABLE ONLY forge.stop_incident_breaks FORCE ROW LEVEL SECURITY;


--
-- Name: stop_incident_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.stop_incident_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    incident_id uuid NOT NULL,
    occurrence_id uuid NOT NULL
);

ALTER TABLE ONLY forge.stop_incident_members FORCE ROW LEVEL SECURITY;


--
-- Name: stop_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.stop_incidents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    asset_id uuid,
    reason_code_id uuid NOT NULL,
    first_occurrence_id uuid NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    stop_count integer NOT NULL,
    stopped_seconds numeric(18,3) NOT NULL,
    window_seconds integer NOT NULL,
    policy_version_id uuid,
    CONSTRAINT "CHK_stop_incidents_count" CHECK ((stop_count >= 2)),
    CONSTRAINT "CHK_stop_incidents_interval" CHECK (((end_time IS NULL) OR (end_time >= start_time)))
);

ALTER TABLE ONLY forge.stop_incidents FORCE ROW LEVEL SECURITY;


--
-- Name: stop_reconciliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.stop_reconciliations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    kept_event_id uuid NOT NULL,
    evidence_event_id uuid NOT NULL,
    state character varying(16) NOT NULL,
    mode character varying(16) NOT NULL,
    suggestion_reason character varying(32),
    start_delta_seconds numeric(18,3) NOT NULL,
    end_delta_seconds numeric(18,3),
    tolerance_seconds integer NOT NULL,
    conflicts jsonb DEFAULT '[]'::jsonb NOT NULL,
    copied jsonb DEFAULT '{}'::jsonb NOT NULL,
    evidence_occurrence_id uuid,
    policy_version_id uuid,
    decided_by uuid,
    decided_at timestamp with time zone,
    decision_reason text,
    CONSTRAINT "CHK_stop_reconciliations_mode" CHECK (((mode)::text = ANY ((ARRAY['auto'::character varying, 'manual'::character varying])::text[]))),
    CONSTRAINT "CHK_stop_reconciliations_not_self" CHECK ((kept_event_id <> evidence_event_id)),
    CONSTRAINT "CHK_stop_reconciliations_state" CHECK (((state)::text = ANY ((ARRAY['suggested'::character varying, 'merged'::character varying, 'rejected'::character varying, 'undone'::character varying, 'expired'::character varying])::text[])))
);

ALTER TABLE ONLY forge.stop_reconciliations FORCE ROW LEVEL SECURITY;


--
-- Name: stream_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.stream_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    stream_code character varying(64) NOT NULL,
    product_id uuid NOT NULL,
    lot_code character varying(64),
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    notes text,
    CONSTRAINT "CHK_stream_runs_interval" CHECK (((end_time IS NULL) OR (end_time > start_time))),
    CONSTRAINT "CHK_stream_runs_lot" CHECK (((lot_code IS NULL) OR ((lot_code)::text <> ''::text)))
);

ALTER TABLE ONLY forge.stream_runs FORCE ROW LEVEL SECURITY;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    assigned_to character varying(36) NOT NULL,
    assigned_by character varying(36) NOT NULL,
    priority character varying(50) NOT NULL,
    status character varying(50) NOT NULL,
    due_date timestamp with time zone,
    completed_date timestamp with time zone,
    entity_type character varying(100),
    entity_id character varying(36),
    organization_id character varying(36) NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rca_action_id uuid
);

ALTER TABLE ONLY forge.tasks FORCE ROW LEVEL SECURITY;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.tenants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    organization_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    address character varying(500),
    contact_person character varying(255),
    contact_email character varying(255),
    contact_phone character varying(50),
    timezone character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    calendar_system character varying(16) DEFAULT 'gregorian'::character varying NOT NULL,
    digits character varying(8) DEFAULT 'latin'::character varying NOT NULL,
    week_start character varying(16) DEFAULT 'monday'::character varying NOT NULL,
    row_version integer DEFAULT 1 NOT NULL,
    CONSTRAINT "CHK_tenants_calendar_system" CHECK (((calendar_system)::text = ANY ((ARRAY['gregorian'::character varying, 'persian'::character varying])::text[]))),
    CONSTRAINT "CHK_tenants_digits" CHECK (((digits)::text = ANY ((ARRAY['latin'::character varying, 'persian'::character varying])::text[]))),
    CONSTRAINT "CHK_tenants_week_start" CHECK (((week_start)::text = ANY ((ARRAY['monday'::character varying, 'tuesday'::character varying, 'wednesday'::character varying, 'thursday'::character varying, 'friday'::character varying, 'saturday'::character varying, 'sunday'::character varying])::text[])))
);


--
-- Name: transition_standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.transition_standards (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    from_product_id uuid NOT NULL,
    to_product_id uuid NOT NULL,
    reference_seconds numeric(14,3) NOT NULL,
    reference_offgrade_qty numeric(24,8),
    offgrade_uom character varying(50),
    sample_count integer,
    evidence text,
    notes text,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    version integer NOT NULL,
    state forge.transition_standard_state DEFAULT 'draft'::forge.transition_standard_state NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    catalyst_family character varying(64),
    operating_mode character varying(64),
    CONSTRAINT "CHK_transition_standards_approved_at" CHECK (((state <> 'approved'::forge.transition_standard_state) OR (approved_at IS NOT NULL))),
    CONSTRAINT "CHK_transition_standards_context" CHECK ((((catalyst_family IS NULL) OR ((catalyst_family)::text <> ''::text)) AND ((operating_mode IS NULL) OR ((operating_mode)::text <> ''::text)))),
    CONSTRAINT "CHK_transition_standards_effective" CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT "CHK_transition_standards_offgrade" CHECK (((reference_offgrade_qty IS NULL) OR ((reference_offgrade_qty >= (0)::numeric) AND (offgrade_uom IS NOT NULL)))),
    CONSTRAINT "CHK_transition_standards_products" CHECK ((from_product_id <> to_product_id)),
    CONSTRAINT "CHK_transition_standards_samples" CHECK (((sample_count IS NULL) OR (sample_count > 0))),
    CONSTRAINT "CHK_transition_standards_seconds" CHECK ((reference_seconds > (0)::numeric))
);

ALTER TABLE ONLY forge.transition_standards FORCE ROW LEVEL SECURITY;


--
-- Name: typeorm_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.typeorm_metadata (
    type character varying NOT NULL,
    database character varying,
    schema character varying,
    "table" character varying,
    name character varying,
    value text
);


--
-- Name: uncertainty_budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.uncertainty_budgets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    boundary character varying(64) NOT NULL,
    uom character varying(50) NOT NULL,
    components jsonb NOT NULL,
    correlations jsonb DEFAULT '[]'::jsonb NOT NULL,
    coverage_factor numeric(6,3) NOT NULL,
    combined_standard_uncertainty numeric(24,8) NOT NULL,
    expanded_uncertainty numeric(24,8) NOT NULL,
    calibration_ref text NOT NULL,
    review_due_at timestamp with time zone NOT NULL,
    evidence_ref text,
    notes text,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    author_id uuid NOT NULL,
    state character varying(16) DEFAULT 'proposed'::character varying NOT NULL,
    decided_by uuid,
    decided_at timestamp with time zone,
    decision_reason text,
    super_admin_override boolean DEFAULT false NOT NULL,
    CONSTRAINT "CHK_uncertainty_budgets_independent" CHECK (((decided_by IS NULL) OR (decided_by <> author_id) OR super_admin_override)),
    CONSTRAINT "CHK_uncertainty_budgets_interval" CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT "CHK_uncertainty_budgets_state" CHECK (((state)::text = ANY ((ARRAY['proposed'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT "CHK_uncertainty_budgets_values" CHECK (((coverage_factor > (0)::numeric) AND (combined_standard_uncertainty >= (0)::numeric) AND (expanded_uncertainty >= (0)::numeric)))
);

ALTER TABLE ONLY forge.uncertainty_budgets FORCE ROW LEVEL SECURITY;


--
-- Name: unit_impact_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.unit_impact_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    mode character varying(16) NOT NULL,
    fraction numeric(9,8),
    standby_asset_id uuid,
    takeover_seconds integer DEFAULT 60 NOT NULL,
    reason text NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    version integer NOT NULL,
    state forge.unit_impact_rule_state DEFAULT 'draft'::forge.unit_impact_rule_state NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    CONSTRAINT "CHK_unit_impact_rules_approved_at" CHECK (((state <> 'approved'::forge.unit_impact_rule_state) OR (approved_at IS NOT NULL))),
    CONSTRAINT "CHK_unit_impact_rules_effective" CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT "CHK_unit_impact_rules_fraction" CHECK (((((mode)::text = 'fractional'::text) = (fraction IS NOT NULL)) AND ((fraction IS NULL) OR ((fraction > (0)::numeric) AND (fraction <= (1)::numeric))))),
    CONSTRAINT "CHK_unit_impact_rules_mode" CHECK (((mode)::text = ANY ((ARRAY['full_stop'::character varying, 'fractional'::character varying, 'none'::character varying])::text[]))),
    CONSTRAINT "CHK_unit_impact_rules_standby" CHECK (((standby_asset_id IS NULL) OR (standby_asset_id <> asset_id))),
    CONSTRAINT "CHK_unit_impact_rules_takeover" CHECK ((takeover_seconds >= 0))
);

ALTER TABLE ONLY forge.unit_impact_rules FORCE ROW LEVEL SECURITY;


--
-- Name: unit_product_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.unit_product_rates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    profile_id uuid NOT NULL,
    rate_kind forge.unit_product_rate_kind NOT NULL,
    rate numeric(24,8) NOT NULL,
    timebase forge.unit_product_rate_timebase NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    version integer NOT NULL,
    state forge.unit_product_rate_state DEFAULT 'draft'::forge.unit_product_rate_state NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    source forge.unit_product_rate_source DEFAULT 'manual'::forge.unit_product_rate_source NOT NULL,
    external_id character varying(255),
    rate_import_id uuid,
    CONSTRAINT "CHK_unit_product_rates_approved_at" CHECK (((state <> 'approved'::forge.unit_product_rate_state) OR (approved_at IS NOT NULL))),
    CONSTRAINT "CHK_unit_product_rates_effective" CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT "CHK_unit_product_rates_rate" CHECK ((rate >= (0)::numeric))
);

ALTER TABLE ONLY forge.unit_product_rates FORCE ROW LEVEL SECURITY;


--
-- Name: unit_state_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.unit_state_mappings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    signal_id uuid NOT NULL,
    rules jsonb NOT NULL,
    expected_interval_seconds integer NOT NULL,
    jitter_seconds integer DEFAULT 0 NOT NULL,
    stale_after_intervals integer DEFAULT 3 NOT NULL,
    is_heartbeat boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    notes text,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    thresholds jsonb,
    CONSTRAINT "CHK_unit_state_mappings_heartbeat" CHECK (((expected_interval_seconds > 0) AND (jitter_seconds >= 0) AND (stale_after_intervals >= 1))),
    CONSTRAINT "CHK_unit_state_mappings_interval" CHECK (((effective_to IS NULL) OR (effective_to > effective_from)))
);

ALTER TABLE ONLY forge.unit_state_mappings FORCE ROW LEVEL SECURITY;


--
-- Name: unit_streams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.unit_streams (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    unit_id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(255) NOT NULL,
    capacity_share numeric(9,8) NOT NULL,
    notes text,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    version integer NOT NULL,
    state forge.unit_stream_state DEFAULT 'draft'::forge.unit_stream_state NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    CONSTRAINT "CHK_unit_streams_approved_at" CHECK (((state <> 'approved'::forge.unit_stream_state) OR (approved_at IS NOT NULL))),
    CONSTRAINT "CHK_unit_streams_code" CHECK (((code)::text <> ''::text)),
    CONSTRAINT "CHK_unit_streams_effective" CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT "CHK_unit_streams_share" CHECK (((capacity_share > (0)::numeric) AND (capacity_share <= (1)::numeric)))
);

ALTER TABLE ONLY forge.unit_streams FORCE ROW LEVEL SECURITY;


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.units (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    capacity numeric(15,4),
    unit_of_measure character varying(50),
    ideal_cycle_time numeric(10,2),
    tenant_id uuid NOT NULL,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    site_id uuid,
    row_version integer DEFAULT 1 NOT NULL,
    retired_at timestamp with time zone
);

ALTER TABLE ONLY forge.units FORCE ROW LEVEL SECURITY;


--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.user_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    user_id uuid NOT NULL,
    kind character varying(32) NOT NULL,
    dedupe_key character varying(200) NOT NULL,
    entity_type character varying(64) NOT NULL,
    entity_id uuid NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    read_at timestamp with time zone,
    work_item_key character varying(200),
    resolved_at timestamp with time zone,
    resolution character varying(32),
    CONSTRAINT "CHK_user_notifications_kind" CHECK (((kind)::text = ANY ((ARRAY['sla_reminder'::character varying, 'sla_escalation'::character varying, 'source_fallback'::character varying, 'rca_action_due'::character varying, 'rca_action_overdue'::character varying, 'task_due'::character varying, 'task_overdue'::character varying, 'uncoded_backlog'::character varying, 'long_open_stop'::character varying])::text[]))),
    CONSTRAINT "CHK_user_notifications_resolution" CHECK ((((resolved_at IS NULL) AND (resolution IS NULL)) OR ((resolved_at IS NOT NULL) AND ((resolution)::text = ANY ((ARRAY['completed'::character varying, 'superseded'::character varying])::text[])))))
);

ALTER TABLE ONLY forge.user_notifications FORCE ROW LEVEL SECURITY;


--
-- Name: user_scopes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.user_scopes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    user_id uuid NOT NULL,
    scope_kind forge.user_scope_kind NOT NULL,
    scope_id uuid NOT NULL,
    role character varying(50) NOT NULL
);

ALTER TABLE ONLY forge.user_scopes FORCE ROW LEVEL SECURITY;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    tenant_id uuid,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY forge.users FORCE ROW LEVEL SECURITY;


--
-- Name: valuation_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.valuation_rates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    profile_id uuid,
    impact_code_id uuid,
    basis forge.valuation_rate_basis NOT NULL,
    value numeric(24,8) NOT NULL,
    currency character varying(3),
    per_uom character varying(50) NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    version integer NOT NULL,
    state forge.valuation_rate_state DEFAULT 'draft'::forge.valuation_rate_state NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    CONSTRAINT "CHK_valuation_rates_approved_at" CHECK (((state <> 'approved'::forge.valuation_rate_state) OR (approved_at IS NOT NULL))),
    CONSTRAINT "CHK_valuation_rates_currency" CHECK (((currency)::text ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT "CHK_valuation_rates_effective" CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT "CHK_valuation_rates_owner" CHECK (((profile_id IS NOT NULL) <> (impact_code_id IS NOT NULL))),
    CONSTRAINT "CHK_valuation_rates_ratio_currency" CHECK ((((basis)::text = 'rework_yield'::text) = (currency IS NULL))),
    CONSTRAINT "CHK_valuation_rates_yield_range" CHECK ((((basis)::text <> 'rework_yield'::text) OR ((value > (0)::numeric) AND (value <= (1)::numeric))))
);

ALTER TABLE ONLY forge.valuation_rates FORCE ROW LEVEL SECURITY;


--
-- Name: verification_status_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.verification_status_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    tenant_id uuid,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    color character varying(50),
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    row_version integer DEFAULT 1 NOT NULL
);

ALTER TABLE ONLY forge.verification_status_codes FORCE ROW LEVEL SECURITY;


--
-- Name: work_order_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE forge.work_order_operations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    row_version integer NOT NULL,
    work_order_id character varying(100) NOT NULL,
    operation_id character varying(50) NOT NULL,
    unit_id uuid NOT NULL,
    asset_id uuid,
    event_id uuid,
    operation_kind character varying(16) NOT NULL,
    description text,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    waiting_seconds integer DEFAULT 0 NOT NULL,
    waiting_reason character varying(100),
    source character varying(50) DEFAULT 'import'::character varying NOT NULL,
    CONSTRAINT "CHK_work_order_operations_interval" CHECK (((ended_at IS NULL) OR (ended_at >= started_at))),
    CONSTRAINT "CHK_work_order_operations_kind" CHECK (((operation_kind)::text = ANY ((ARRAY['diagnosis'::character varying, 'repair'::character varying, 'test'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT "CHK_work_order_operations_waiting" CHECK ((waiting_seconds >= 0))
);

ALTER TABLE ONLY forge.work_order_operations FORCE ROW LEVEL SECURITY;


--
-- Name: raw_observations_y2026m09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.raw_observations ATTACH PARTITION forge.raw_observations_y2026m09 FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');


--
-- Name: raw_observations_y2026m10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.raw_observations ATTACH PARTITION forge.raw_observations_y2026m10 FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');


--
-- Name: raw_observations_y2026m11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.raw_observations ATTACH PARTITION forge.raw_observations_y2026m11 FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');


--
-- Name: raw_observations_y2026m12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.raw_observations ATTACH PARTITION forge.raw_observations_y2026m12 FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.migrations ALTER COLUMN id SET DEFAULT nextval('forge.migrations_id_seq'::regclass);


--
-- Name: outbox id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.outbox ALTER COLUMN id SET DEFAULT nextval('forge.outbox_id_seq'::regclass);


--
-- Name: demand_statuses EX_demand_statuses_approved_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.demand_statuses
    ADD CONSTRAINT "EX_demand_statuses_approved_no_overlap" EXCLUDE USING gist (tenant_id WITH =, product_id WITH =, tstzrange(effective_from, effective_to, '[)'::text) WITH &&) WHERE ((state = 'approved'::forge.demand_status_state));


--
-- Name: fx_rates EX_fx_rates_approved_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.fx_rates
    ADD CONSTRAINT "EX_fx_rates_approved_no_overlap" EXCLUDE USING gist (tenant_id WITH =, rate_type WITH =, from_currency WITH =, to_currency WITH =, tstzrange(effective_from, effective_to, '[)'::text) WITH &&) WHERE (((state = 'approved'::forge.fx_rate_state) AND (NOT provisional)));


--
-- Name: fx_rates EX_fx_rates_provisional_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.fx_rates
    ADD CONSTRAINT "EX_fx_rates_provisional_no_overlap" EXCLUDE USING gist (tenant_id WITH =, rate_type WITH =, from_currency WITH =, to_currency WITH =, tstzrange(effective_from, effective_to, '[)'::text) WITH &&) WHERE (((state = 'approved'::forge.fx_rate_state) AND provisional));


--
-- Name: plan_product_slices EX_plan_product_slices_approved_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_product_slices
    ADD CONSTRAINT "EX_plan_product_slices_approved_no_overlap" EXCLUDE USING gist (scenario_id WITH =, unit_id WITH =, product_id WITH =, tstzrange(active_from, active_to, '[)'::text) WITH &&) WHERE (is_approved);


--
-- Name: plant_flow_routes EX_plant_flow_routes_approved_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plant_flow_routes
    ADD CONSTRAINT "EX_plant_flow_routes_approved_no_overlap" EXCLUDE USING gist (from_unit_id WITH =, to_unit_id WITH =, tstzrange(effective_from, effective_to, '[)'::text) WITH &&) WHERE ((state = 'approved'::forge.plant_flow_route_state));


--
-- Name: production_periods EX_production_periods_unit_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_periods
    ADD CONSTRAINT "EX_production_periods_unit_no_overlap" EXCLUDE USING gist (unit_id WITH =, tstzrange(utc_start, utc_end, '[)'::text) WITH &&);


--
-- Name: production_profiles EX_production_profiles_approved_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_profiles
    ADD CONSTRAINT "EX_production_profiles_approved_no_overlap" EXCLUDE USING gist (unit_id WITH =, product_id WITH =, operating_mode WITH =, tstzrange(effective_from, effective_to, '[)'::text) WITH &&) WHERE ((state = 'approved'::forge.production_profile_state));


--
-- Name: shift_instances EX_shift_instances_unit_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.shift_instances
    ADD CONSTRAINT "EX_shift_instances_unit_no_overlap" EXCLUDE USING gist (unit_id WITH =, tstzrange(utc_start, utc_end, '[)'::text) WITH &&);


--
-- Name: stream_runs EX_stream_runs_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.stream_runs
    ADD CONSTRAINT "EX_stream_runs_no_overlap" EXCLUDE USING gist (unit_id WITH =, stream_code WITH =, tstzrange(start_time, end_time, '[)'::text) WITH &&);


--
-- Name: transition_standards EX_transition_standards_approved_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.transition_standards
    ADD CONSTRAINT "EX_transition_standards_approved_no_overlap" EXCLUDE USING gist (unit_id WITH =, from_product_id WITH =, to_product_id WITH =, COALESCE(catalyst_family, ''::character varying) WITH =, COALESCE(operating_mode, ''::character varying) WITH =, tstzrange(effective_from, effective_to, '[)'::text) WITH &&) WHERE ((state = 'approved'::forge.transition_standard_state));


--
-- Name: unit_impact_rules EX_unit_impact_rules_approved_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_impact_rules
    ADD CONSTRAINT "EX_unit_impact_rules_approved_no_overlap" EXCLUDE USING gist (unit_id WITH =, asset_id WITH =, tstzrange(effective_from, effective_to, '[)'::text) WITH &&) WHERE ((state = 'approved'::forge.unit_impact_rule_state));


--
-- Name: unit_product_rates EX_unit_product_rates_approved_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_product_rates
    ADD CONSTRAINT "EX_unit_product_rates_approved_no_overlap" EXCLUDE USING gist (profile_id WITH =, rate_kind WITH =, tstzrange(effective_from, effective_to, '[)'::text) WITH &&) WHERE ((state = 'approved'::forge.unit_product_rate_state));


--
-- Name: unit_streams EX_unit_streams_approved_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_streams
    ADD CONSTRAINT "EX_unit_streams_approved_no_overlap" EXCLUDE USING gist (unit_id WITH =, code WITH =, tstzrange(effective_from, effective_to, '[)'::text) WITH &&) WHERE ((state = 'approved'::forge.unit_stream_state));


--
-- Name: valuation_rates EX_valuation_rates_approved_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.valuation_rates
    ADD CONSTRAINT "EX_valuation_rates_approved_no_overlap" EXCLUDE USING gist (COALESCE(profile_id, impact_code_id) WITH =, basis WITH =, tstzrange(effective_from, effective_to, '[)'::text) WITH &&) WHERE ((state = 'approved'::forge.valuation_rate_state));


--
-- Name: custom_attribute_values PK_03ad98b91a6e738144a780bde41; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.custom_attribute_values
    ADD CONSTRAINT "PK_03ad98b91a6e738144a780bde41" PRIMARY KEY (id);


--
-- Name: signals PK_04eeac09c09b65bc55c628c101d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.signals
    ADD CONSTRAINT "PK_04eeac09c09b65bc55c628c101d" PRIMARY KEY (id);


--
-- Name: audit_log PK_07fefa57f7f5ab8fc3f52b3ed0b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.audit_log
    ADD CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY (id);


--
-- Name: products PK_0806c755e0aca124e67c0cf6d7d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.products
    ADD CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY (id);


--
-- Name: pi_open_frames PK_08b129fae6af357741cca7746f6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_open_frames
    ADD CONSTRAINT "PK_08b129fae6af357741cca7746f6" PRIMARY KEY (id);


--
-- Name: signal_backfill_runs PK_08c7c642764f982d330ad3345c1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.signal_backfill_runs
    ADD CONSTRAINT "PK_08c7c642764f982d330ad3345c1" PRIMARY KEY (id);


--
-- Name: reconciliation_lines PK_09ad4523a3b76ca30c8c022161f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.reconciliation_lines
    ADD CONSTRAINT "PK_09ad4523a3b76ca30c8c022161f" PRIMARY KEY (id);


--
-- Name: stream_runs PK_0b2daa88d6e68084f021db44ccb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.stream_runs
    ADD CONSTRAINT "PK_0b2daa88d6e68084f021db44ccb" PRIMARY KEY (id);


--
-- Name: rules PK_10fef696a7d61140361b1b23608; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rules
    ADD CONSTRAINT "PK_10fef696a7d61140361b1b23608" PRIMARY KEY (id);


--
-- Name: restatement_postings PK_1247696beb2d3ae84c162e66ddf; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.restatement_postings
    ADD CONSTRAINT "PK_1247696beb2d3ae84c162e66ddf" PRIMARY KEY (id);


--
-- Name: production_plans PK_171d3990efc1882102b85f3b71e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_plans
    ADD CONSTRAINT "PK_171d3990efc1882102b85f3b71e" PRIMARY KEY (id);


--
-- Name: audit_logs PK_1bb179d048bbc581caa3b013439; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.audit_logs
    ADD CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY (id);


--
-- Name: export_job_sources PK_1d5c6273964ed5f4eedc5211182; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.export_job_sources
    ADD CONSTRAINT "PK_1d5c6273964ed5f4eedc5211182" PRIMARY KEY (id);


--
-- Name: rate_imports PK_1d7b96edf1e2949b7b09298fd85; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rate_imports
    ADD CONSTRAINT "PK_1d7b96edf1e2949b7b09298fd85" PRIMARY KEY (id);


--
-- Name: ingestion_exceptions PK_211ed48b041aa386662207192f6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.ingestion_exceptions
    ADD CONSTRAINT "PK_211ed48b041aa386662207192f6" PRIMARY KEY (id);


--
-- Name: approved_loss_lines PK_224640870b4d07807ccf518276f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.approved_loss_lines
    ADD CONSTRAINT "PK_224640870b4d07807ccf518276f" PRIMARY KEY (id);


--
-- Name: rca_fmea_analyses PK_251fce5d03bc898689efda27262; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_fmea_analyses
    ADD CONSTRAINT "PK_251fce5d03bc898689efda27262" PRIMARY KEY (id);


--
-- Name: unit_impact_rules PK_2a0a192d1081a24e1e600f99f19; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_impact_rules
    ADD CONSTRAINT "PK_2a0a192d1081a24e1e600f99f19" PRIMARY KEY (id);


--
-- Name: crew_rotations PK_2a1c78f8352704430ad3965dbf6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.crew_rotations
    ADD CONSTRAINT "PK_2a1c78f8352704430ad3965dbf6" PRIMARY KEY (id);


--
-- Name: source_hierarchy_mappings PK_2c866d3bc72058309481c3d36cf; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.source_hierarchy_mappings
    ADD CONSTRAINT "PK_2c866d3bc72058309481c3d36cf" PRIMARY KEY (id);


--
-- Name: export_jobs PK_3044ce6f1c6af24058ee609e063; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.export_jobs
    ADD CONSTRAINT "PK_3044ce6f1c6af24058ee609e063" PRIMARY KEY (id);


--
-- Name: buffer_levels PK_30968fb597a4b4d698656b5c7b7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.buffer_levels
    ADD CONSTRAINT "PK_30968fb597a4b4d698656b5c7b7" PRIMARY KEY (id);


--
-- Name: af_bindings PK_3253600520c1b5087dd810f612b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.af_bindings
    ADD CONSTRAINT "PK_3253600520c1b5087dd810f612b" PRIMARY KEY (id);


--
-- Name: outbox PK_340ab539f309f03bdaa14aa7649; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.outbox
    ADD CONSTRAINT "PK_340ab539f309f03bdaa14aa7649" PRIMARY KEY (id);


--
-- Name: shift_instances PK_345c381a2cb26a0d881deebf78d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.shift_instances
    ADD CONSTRAINT "PK_345c381a2cb26a0d881deebf78d" PRIMARY KEY (id);


--
-- Name: pi_sync_job_links PK_39f1f21950ed2ad2d7e5f8ab845; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_sync_job_links
    ADD CONSTRAINT "PK_39f1f21950ed2ad2d7e5f8ab845" PRIMARY KEY (pi_sync_job_id);


--
-- Name: pi_page_manifests PK_3e357eb62ca124f225fe223bdd8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_page_manifests
    ADD CONSTRAINT "PK_3e357eb62ca124f225fe223bdd8" PRIMARY KEY (id);


--
-- Name: pi_connections PK_40888c881beaf673504c899a8d5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_connections
    ADD CONSTRAINT "PK_40888c881beaf673504c899a8d5" PRIMARY KEY (id);


--
-- Name: failure_code_groups PK_40cf6d405479f4279147894018f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.failure_code_groups
    ADD CONSTRAINT "PK_40cf6d405479f4279147894018f" PRIMARY KEY (id);


--
-- Name: source_mappings PK_416b3a7ce8cd3fbf4347ffaee2c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.source_mappings
    ADD CONSTRAINT "PK_416b3a7ce8cd3fbf4347ffaee2c" PRIMARY KEY (id);


--
-- Name: crews PK_4316f43ffc0d2bbb0c4c767ba5c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.crews
    ADD CONSTRAINT "PK_4316f43ffc0d2bbb0c4c767ba5c" PRIMARY KEY (id);


--
-- Name: ingestion_job_transitions PK_43d71cca3c167b9ad1440c30c3d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.ingestion_job_transitions
    ADD CONSTRAINT "PK_43d71cca3c167b9ad1440c30c3d" PRIMARY KEY (id);


--
-- Name: evidence_locations PK_45d3400a5784cab15ad44761689; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.evidence_locations
    ADD CONSTRAINT "PK_45d3400a5784cab15ad44761689" PRIMARY KEY (id);


--
-- Name: pi_mappings PK_47985c609cdcbe0c5c483b036e0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_mappings
    ADD CONSTRAINT "PK_47985c609cdcbe0c5c483b036e0" PRIMARY KEY (id);


--
-- Name: signal_summaries PK_4cfd39df2e89e2727e2574cdd53; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.signal_summaries
    ADD CONSTRAINT "PK_4cfd39df2e89e2727e2574cdd53" PRIMARY KEY (id);


--
-- Name: measurement_samples PK_4d03c08dea906212173c500a637; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.measurement_samples
    ADD CONSTRAINT "PK_4d03c08dea906212173c500a637" PRIMARY KEY (id, observed_at);


--
-- Name: sites PK_4f5eccb1dfde10c9170502595a7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.sites
    ADD CONSTRAINT "PK_4f5eccb1dfde10c9170502595a7" PRIMARY KEY (id);


--
-- Name: rule_runs PK_4f745fc3fa413d75d7dc13b2c51; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rule_runs
    ADD CONSTRAINT "PK_4f745fc3fa413d75d7dc13b2c51" PRIMARY KEY (id);


--
-- Name: accounting_revisions PK_511d0c4a2824bba3c86457db603; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.accounting_revisions
    ADD CONSTRAINT "PK_511d0c4a2824bba3c86457db603" PRIMARY KEY (id);


--
-- Name: oee_codes PK_536c1d9ccef5ff5c263b4846e25; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.oee_codes
    ADD CONSTRAINT "PK_536c1d9ccef5ff5c263b4846e25" PRIMARY KEY (id);


--
-- Name: tenants PK_53be67a04681c66b87ee27c9321; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.tenants
    ADD CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY (id);


--
-- Name: rca_fishbone_diagrams PK_551c262c49bbf0d50d594452354; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_fishbone_diagrams
    ADD CONSTRAINT "PK_551c262c49bbf0d50d594452354" PRIMARY KEY (id);


--
-- Name: user_notifications PK_569622b0fd6e6ab3661de985a2b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.user_notifications
    ADD CONSTRAINT "PK_569622b0fd6e6ab3661de985a2b" PRIMARY KEY (id);


--
-- Name: kpi_results PK_57be4620ae2c0aa403040be0c4e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.kpi_results
    ADD CONSTRAINT "PK_57be4620ae2c0aa403040be0c4e" PRIMARY KEY (id);


--
-- Name: loss_category_defs PK_58f8f76c344820a6cb3d6ed23ce; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.loss_category_defs
    ADD CONSTRAINT "PK_58f8f76c344820a6cb3d6ed23ce" PRIMARY KEY (id);


--
-- Name: units PK_5a8f2f064919b587d93936cb223; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.units
    ADD CONSTRAINT "PK_5a8f2f064919b587d93936cb223" PRIMARY KEY (id);


--
-- Name: replay_runs PK_5bc70c62a4cf238fd561292fa2e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.replay_runs
    ADD CONSTRAINT "PK_5bc70c62a4cf238fd561292fa2e" PRIMARY KEY (id);


--
-- Name: verification_status_codes PK_5cae70cab49bac4d6f1e8f46e2e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.verification_status_codes
    ADD CONSTRAINT "PK_5cae70cab49bac4d6f1e8f46e2e" PRIMARY KEY (id);


--
-- Name: plan_generation_jobs PK_5ffe2878e7b7d4d6af52c8a6273; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_generation_jobs
    ADD CONSTRAINT "PK_5ffe2878e7b7d4d6af52c8a6273" PRIMARY KEY (id);


--
-- Name: approved_loss_line_valuations PK_6064c69c2f87a872a2d2bf2ab0f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.approved_loss_line_valuations
    ADD CONSTRAINT "PK_6064c69c2f87a872a2d2bf2ab0f" PRIMARY KEY (id);


--
-- Name: rca_templates PK_61a07aeb26e387f734cd18e5967; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_templates
    ADD CONSTRAINT "PK_61a07aeb26e387f734cd18e5967" PRIMARY KEY (id);


--
-- Name: unit_streams PK_61b4c7198cf7b89aab95b9346f2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_streams
    ADD CONSTRAINT "PK_61b4c7198cf7b89aab95b9346f2" PRIMARY KEY (id);


--
-- Name: reason_codes PK_64e9bc3e20d2e61416a5134650f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.reason_codes
    ADD CONSTRAINT "PK_64e9bc3e20d2e61416a5134650f" PRIMARY KEY (id);


--
-- Name: accounting_policies PK_6ac566af742d7022c0edebce82b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.accounting_policies
    ADD CONSTRAINT "PK_6ac566af742d7022c0edebce82b" PRIMARY KEY (id);


--
-- Name: organizations PK_6b031fcd0863e3f6b44230163f9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.organizations
    ADD CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY (id);


--
-- Name: uncertainty_budgets PK_6bdfc74540088790b4b5006e43b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.uncertainty_budgets
    ADD CONSTRAINT "PK_6bdfc74540088790b4b5006e43b" PRIMARY KEY (id);


--
-- Name: production_periods PK_6e8349bf58f04fb63b10edb241c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_periods
    ADD CONSTRAINT "PK_6e8349bf58f04fb63b10edb241c" PRIMARY KEY (id);


--
-- Name: period_valuation_totals PK_6eab802064fbfe1206ea387b8e8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_valuation_totals
    ADD CONSTRAINT "PK_6eab802064fbfe1206ea387b8e8" PRIMARY KEY (id);


--
-- Name: period_change_proposals PK_6fa32fe23618527feeb81cb2463; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_change_proposals
    ADD CONSTRAINT "PK_6fa32fe23618527feeb81cb2463" PRIMARY KEY (id);


--
-- Name: state_engine_cursors PK_7409fbc95f74ec50457e2d3df70; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.state_engine_cursors
    ADD CONSTRAINT "PK_7409fbc95f74ec50457e2d3df70" PRIMARY KEY (id);


--
-- Name: rca_cause_codes PK_7469109ba189e280ad139ebed8c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_cause_codes
    ADD CONSTRAINT "PK_7469109ba189e280ad139ebed8c" PRIMARY KEY (id);


--
-- Name: unit_state_mappings PK_76274cb1f9c2cd7df6f2fab0638; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_state_mappings
    ADD CONSTRAINT "PK_76274cb1f9c2cd7df6f2fab0638" PRIMARY KEY (id);


--
-- Name: ingestion_jobs PK_78a3cba789582043cfc8ba82edd; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.ingestion_jobs
    ADD CONSTRAINT "PK_78a3cba789582043cfc8ba82edd" PRIMARY KEY (id);


--
-- Name: loss_line_valuations PK_7b0cf92210c093d1b6c567cf463; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.loss_line_valuations
    ADD CONSTRAINT "PK_7b0cf92210c093d1b6c567cf463" PRIMARY KEY (id);


--
-- Name: reconciliation_line_sets PK_7b4e53e5a058f89d2c9dc02d962; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.reconciliation_line_sets
    ADD CONSTRAINT "PK_7b4e53e5a058f89d2c9dc02d962" PRIMARY KEY (id);


--
-- Name: attribute_mapping_versions PK_7f599418a14f8f02391b1fb4589; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.attribute_mapping_versions
    ADD CONSTRAINT "PK_7f599418a14f8f02391b1fb4589" PRIMARY KEY (id);


--
-- Name: actuals_runs PK_7fce742d837e1d0d36274047ed6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.actuals_runs
    ADD CONSTRAINT "PK_7fce742d837e1d0d36274047ed6" PRIMARY KEY (id);


--
-- Name: pi_sync_watermarks PK_8265039f1043d909c7e2b99875f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_sync_watermarks
    ADD CONSTRAINT "PK_8265039f1043d909c7e2b99875f" PRIMARY KEY (id);


--
-- Name: work_order_operations PK_8610d0dbf2b2145d9933bad5263; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.work_order_operations
    ADD CONSTRAINT "PK_8610d0dbf2b2145d9933bad5263" PRIMARY KEY (id);


--
-- Name: code_mapping_rules PK_89445c96c7c3a11405e5bf03c4f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.code_mapping_rules
    ADD CONSTRAINT "PK_89445c96c7c3a11405e5bf03c4f" PRIMARY KEY (id);


--
-- Name: rca_actions PK_8952ced73b485f388cf6b4c003a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_actions
    ADD CONSTRAINT "PK_8952ced73b485f388cf6b4c003a" PRIMARY KEY (id);


--
-- Name: month_close_actions PK_8c7142cff543e0d1c58adf15c73; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.month_close_actions
    ADD CONSTRAINT "PK_8c7142cff543e0d1c58adf15c73" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: tasks PK_8d12ff38fcc62aaba2cab748772; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.tasks
    ADD CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY (id);


--
-- Name: rca_knowledge_votes PK_8eb3d07d00d510ba22541e13deb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_knowledge_votes
    ADD CONSTRAINT "PK_8eb3d07d00d510ba22541e13deb" PRIMARY KEY (id);


--
-- Name: plan_scenarios PK_8f5639fc3724a8084bfeb2e5f80; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_scenarios
    ADD CONSTRAINT "PK_8f5639fc3724a8084bfeb2e5f80" PRIMARY KEY (id);


--
-- Name: transition_standards PK_8fedcdec1899deb25c88982f711; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.transition_standards
    ADD CONSTRAINT "PK_8fedcdec1899deb25c88982f711" PRIMARY KEY (id);


--
-- Name: fx_rates PK_94eb17e7eddb6df0cec5985ea5f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.fx_rates
    ADD CONSTRAINT "PK_94eb17e7eddb6df0cec5985ea5f" PRIMARY KEY (id);


--
-- Name: source_status_mappings PK_954d690256ab55e3de08ff36410; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.source_status_mappings
    ADD CONSTRAINT "PK_954d690256ab55e3de08ff36410" PRIMARY KEY (id);


--
-- Name: shift_notes PK_975613d39b81dfc86921df8bc70; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.shift_notes
    ADD CONSTRAINT "PK_975613d39b81dfc86921df8bc70" PRIMARY KEY (id);


--
-- Name: app_settings PK_975c2db59c65c05fd9c6b63a2ab; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.app_settings
    ADD CONSTRAINT "PK_975c2db59c65c05fd9c6b63a2ab" PRIMARY KEY (key);


--
-- Name: period_data_holds PK_99b5f79b4108263a735c19952cf; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_data_holds
    ADD CONSTRAINT "PK_99b5f79b4108263a735c19952cf" PRIMARY KEY (id);


--
-- Name: inbox PK_99eaf0d82ae7cfa0844a03e2272; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.inbox
    ADD CONSTRAINT "PK_99eaf0d82ae7cfa0844a03e2272" PRIMARY KEY (delivery_key);


--
-- Name: event_impacts PK_9a724f3320514ee621b09fd6932; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_impacts
    ADD CONSTRAINT "PK_9a724f3320514ee621b09fd6932" PRIMARY KEY (id);


--
-- Name: evidence_categories PK_9b65089011c8ec5f49e5ce6f1dd; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.evidence_categories
    ADD CONSTRAINT "PK_9b65089011c8ec5f49e5ce6f1dd" PRIMARY KEY (id);


--
-- Name: rcas PK_9bdfb12ad025954407386c84352; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rcas
    ADD CONSTRAINT "PK_9bdfb12ad025954407386c84352" PRIMARY KEY (id);


--
-- Name: actuals_results PK_9df2bde0b097a5cc5402f6e7189; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.actuals_results
    ADD CONSTRAINT "PK_9df2bde0b097a5cc5402f6e7189" PRIMARY KEY (id);


--
-- Name: plan_periods PK_9f671e5a7495ba16a4cea196982; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_periods
    ADD CONSTRAINT "PK_9f671e5a7495ba16a4cea196982" PRIMARY KEY (id);


--
-- Name: standby_records PK_9fd2e96011ec87b2a9708d98a9c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.standby_records
    ADD CONSTRAINT "PK_9fd2e96011ec87b2a9708d98a9c" PRIMARY KEY (id);


--
-- Name: calculation_runs PK_a0d6310fa195c78851778ee88f0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.calculation_runs
    ADD CONSTRAINT "PK_a0d6310fa195c78851778ee88f0" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: stop_incidents PK_a470dc2679f9fa88a838e446625; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.stop_incidents
    ADD CONSTRAINT "PK_a470dc2679f9fa88a838e446625" PRIMARY KEY (id);


--
-- Name: external_production_reports PK_a55512bb35a39d793893aa82c87; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.external_production_reports
    ADD CONSTRAINT "PK_a55512bb35a39d793893aa82c87" PRIMARY KEY (id);


--
-- Name: raw_observations PK_a75cc6d8710913a02fefb609f97; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.raw_observations
    ADD CONSTRAINT "PK_a75cc6d8710913a02fefb609f97" PRIMARY KEY (id, received_at);


--
-- Name: stop_incident_members PK_a8b2ea20ebc85b39c137ba85e80; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.stop_incident_members
    ADD CONSTRAINT "PK_a8b2ea20ebc85b39c137ba85e80" PRIMARY KEY (id);


--
-- Name: stop_incident_breaks PK_a8e27b39c6b76d57244f9cc2a69; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.stop_incident_breaks
    ADD CONSTRAINT "PK_a8e27b39c6b76d57244f9cc2a69" PRIMARY KEY (id);


--
-- Name: approval_snapshots PK_a97613260c950996b24a999d5ef; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.approval_snapshots
    ADD CONSTRAINT "PK_a97613260c950996b24a999d5ef" PRIMARY KEY (id);


--
-- Name: rca_case_links PK_ac990f1d722b3d6f81c7f5a0e83; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_case_links
    ADD CONSTRAINT "PK_ac990f1d722b3d6f81c7f5a0e83" PRIMARY KEY (id);


--
-- Name: demand_statuses PK_addaa378e68e83164d949f8611a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.demand_statuses
    ADD CONSTRAINT "PK_addaa378e68e83164d949f8611a" PRIMARY KEY (id);


--
-- Name: event_relations PK_b04840f1dc7caec6d69351c951f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_relations
    ADD CONSTRAINT "PK_b04840f1dc7caec6d69351c951f" PRIMARY KEY (id);


--
-- Name: integration_connections PK_b1ec518bfa5fa7404045412de2e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.integration_connections
    ADD CONSTRAINT "PK_b1ec518bfa5fa7404045412de2e" PRIMARY KEY (id);


--
-- Name: calendar_versions PK_b4305e70ef56d38c702630470db; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.calendar_versions
    ADD CONSTRAINT "PK_b4305e70ef56d38c702630470db" PRIMARY KEY (id);


--
-- Name: idempotency_keys PK_b5c6db50392003e35d51ef7aba7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.idempotency_keys
    ADD CONSTRAINT "PK_b5c6db50392003e35d51ef7aba7" PRIMARY KEY (tenant_id, key);


--
-- Name: production_events PK_b60ec956f8e608ebfbffe05d093; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_events
    ADD CONSTRAINT "PK_b60ec956f8e608ebfbffe05d093" PRIMARY KEY (id);


--
-- Name: rca_trigger_evaluations PK_b62ebb64058426dbba70269677c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_trigger_evaluations
    ADD CONSTRAINT "PK_b62ebb64058426dbba70269677c" PRIMARY KEY (id);


--
-- Name: valuation_rates PK_b9ad46c0ffe25fc459a49554363; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.valuation_rates
    ADD CONSTRAINT "PK_b9ad46c0ffe25fc459a49554363" PRIMARY KEY (id);


--
-- Name: custom_attribute_definitions PK_bc25a5e0aaca1b8bd0a8cf33e3c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.custom_attribute_definitions
    ADD CONSTRAINT "PK_bc25a5e0aaca1b8bd0a8cf33e3c" PRIMARY KEY (id);


--
-- Name: raw_identities PK_bdce205305a10fd75b145869f6e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.raw_identities
    ADD CONSTRAINT "PK_bdce205305a10fd75b145869f6e" PRIMARY KEY (tenant_id, connection_id, message_id);


--
-- Name: stop_reconciliations PK_c0ab33cd688e85bfb68bdf05ecf; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.stop_reconciliations
    ADD CONSTRAINT "PK_c0ab33cd688e85bfb68bdf05ecf" PRIMARY KEY (id);


--
-- Name: roles PK_c1433d71a4838793a49dcad46ab; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.roles
    ADD CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY (id);


--
-- Name: failure_dictionary_entries PK_c448a871a0e5d0c8d6baa8b05b1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.failure_dictionary_entries
    ADD CONSTRAINT "PK_c448a871a0e5d0c8d6baa8b05b1" PRIMARY KEY (id);


--
-- Name: month_closes PK_c546e0803f7db7ff4d0ec62bd46; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.month_closes
    ADD CONSTRAINT "PK_c546e0803f7db7ff4d0ec62bd46" PRIMARY KEY (id);


--
-- Name: plant_flow_routes PK_c70f555c6ef5ffb14b38c995e21; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plant_flow_routes
    ADD CONSTRAINT "PK_c70f555c6ef5ffb14b38c995e21" PRIMARY KEY (id);


--
-- Name: rca_change_analyses PK_c7ade9f85999597b5addf8889f9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_change_analyses
    ADD CONSTRAINT "PK_c7ade9f85999597b5addf8889f9" PRIMARY KEY (id);


--
-- Name: production_day_certifications PK_c933a977da283e40aa1b96c3d0c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_day_certifications
    ADD CONSTRAINT "PK_c933a977da283e40aa1b96c3d0c" PRIMARY KEY (id);


--
-- Name: rca_knowledge_base PK_c971545b619ef871835d0f6e352; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_knowledge_base
    ADD CONSTRAINT "PK_c971545b619ef871835d0f6e352" PRIMARY KEY (id);


--
-- Name: period_ledger_totals PK_c9eae16a0b6304c86b90b6fd593; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_ledger_totals
    ADD CONSTRAINT "PK_c9eae16a0b6304c86b90b6fd593" PRIMARY KEY (id);


--
-- Name: plan_product_slices PK_caf7dc14b895c594d808ee321df; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_product_slices
    ADD CONSTRAINT "PK_caf7dc14b895c594d808ee321df" PRIMARY KEY (id);


--
-- Name: bulk_jobs PK_ce068dac8365125a4ce2f94c23e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.bulk_jobs
    ADD CONSTRAINT "PK_ce068dac8365125a4ce2f94c23e" PRIMARY KEY (id);


--
-- Name: actuals_adjustments PK_ce4e440829ca0243d436d872576; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.actuals_adjustments
    ADD CONSTRAINT "PK_ce4e440829ca0243d436d872576" PRIMARY KEY (id);


--
-- Name: approved_valuation_totals PK_cf55f933e1b9572d6b32346fe7c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.approved_valuation_totals
    ADD CONSTRAINT "PK_cf55f933e1b9572d6b32346fe7c" PRIMARY KEY (id);


--
-- Name: lot_dispositions PK_d1e3f3f4121fb9c4b4665bef579; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.lot_dispositions
    ADD CONSTRAINT "PK_d1e3f3f4121fb9c4b4665bef579" PRIMARY KEY (id);


--
-- Name: rca_five_why_analyses PK_d3bef094d46b53fac64e6bec875; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_five_why_analyses
    ADD CONSTRAINT "PK_d3bef094d46b53fac64e6bec875" PRIMARY KEY (id);


--
-- Name: secrets PK_d4ff48ddba1883d4dc142b9c697; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.secrets
    ADD CONSTRAINT "PK_d4ff48ddba1883d4dc142b9c697" PRIMARY KEY (id);


--
-- Name: standby_equipment PK_d68ac11a2eb8d5a720422ceec9f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.standby_equipment
    ADD CONSTRAINT "PK_d68ac11a2eb8d5a720422ceec9f" PRIMARY KEY (id);


--
-- Name: loss_lines PK_d6f9933b9fccb13ce8e23c4e356; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.loss_lines
    ADD CONSTRAINT "PK_d6f9933b9fccb13ce8e23c4e356" PRIMARY KEY (id);


--
-- Name: assets PK_da96729a8b113377cfb6a62439c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.assets
    ADD CONSTRAINT "PK_da96729a8b113377cfb6a62439c" PRIMARY KEY (id);


--
-- Name: impact_codes PK_dac4bfca776b3ccf9c5698a5c25; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.impact_codes
    ADD CONSTRAINT "PK_dac4bfca776b3ccf9c5698a5c25" PRIMARY KEY (id);


--
-- Name: feature_flags PK_db657d344e9caacfc9d5cf8bbac; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.feature_flags
    ADD CONSTRAINT "PK_db657d344e9caacfc9d5cf8bbac" PRIMARY KEY (id);


--
-- Name: approval_actions PK_dcf156731ecc8b420b6c39d22c8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.approval_actions
    ADD CONSTRAINT "PK_dcf156731ecc8b420b6c39d22c8" PRIMARY KEY (id);


--
-- Name: plan_versions PK_dd2f605d45f2679a86a7c1c5b20; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_versions
    ADD CONSTRAINT "PK_dd2f605d45f2679a86a7c1c5b20" PRIMARY KEY (id);


--
-- Name: event_revisions PK_de85c26390b0fe638666227b5fe; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_revisions
    ADD CONSTRAINT "PK_de85c26390b0fe638666227b5fe" PRIMARY KEY (id);


--
-- Name: rca_fault_tree_analyses PK_de910b9b14c0013c625a8a79b77; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_fault_tree_analyses
    ADD CONSTRAINT "PK_de910b9b14c0013c625a8a79b77" PRIMARY KEY (id);


--
-- Name: event_coding PK_deb54018d298a448151a8b3dc64; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_coding
    ADD CONSTRAINT "PK_deb54018d298a448151a8b3dc64" PRIMARY KEY (id);


--
-- Name: auth_refresh_tokens PK_df6893d2063a4ea7bbf1eda31e5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.auth_refresh_tokens
    ADD CONSTRAINT "PK_df6893d2063a4ea7bbf1eda31e5" PRIMARY KEY (id);


--
-- Name: code_versions PK_dfcc317afdad57e1654fa060409; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.code_versions
    ADD CONSTRAINT "PK_dfcc317afdad57e1654fa060409" PRIMARY KEY (id);


--
-- Name: user_scopes PK_e8dc0040d99fcf1b9fc8dcc3d30; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.user_scopes
    ADD CONSTRAINT "PK_e8dc0040d99fcf1b9fc8dcc3d30" PRIMARY KEY (id);


--
-- Name: period_product_slices PK_ec179c384cf037c481d384deb1e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_product_slices
    ADD CONSTRAINT "PK_ec179c384cf037c481d384deb1e" PRIMARY KEY (id);


--
-- Name: loss_line_evidence PK_ec2c2871f87af39a4795f07ea5f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.loss_line_evidence
    ADD CONSTRAINT "PK_ec2c2871f87af39a4795f07ea5f" PRIMARY KEY (id);


--
-- Name: actuals_jobs PK_eec93f324fbb623b426a69a988d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.actuals_jobs
    ADD CONSTRAINT "PK_eec93f324fbb623b426a69a988d" PRIMARY KEY (id);


--
-- Name: event_review_items PK_f546c5052e8e2c6214cb39d83d6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_review_items
    ADD CONSTRAINT "PK_f546c5052e8e2c6214cb39d83d6" PRIMARY KEY (id);


--
-- Name: role_delegations PK_f57c7d51efadcb32b084a06f806; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.role_delegations
    ADD CONSTRAINT "PK_f57c7d51efadcb32b084a06f806" PRIMARY KEY (id);


--
-- Name: unit_product_rates PK_f735f2993e0ef900b2eb9be1b6f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_product_rates
    ADD CONSTRAINT "PK_f735f2993e0ef900b2eb9be1b6f" PRIMARY KEY (id);


--
-- Name: rca_causes PK_f742927e2198a8ab2da2cb2de1a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_causes
    ADD CONSTRAINT "PK_f742927e2198a8ab2da2cb2de1a" PRIMARY KEY (id);


--
-- Name: pi_sync_jobs PK_f851c487ed5d4feda4b0e8935fe; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_sync_jobs
    ADD CONSTRAINT "PK_f851c487ed5d4feda4b0e8935fe" PRIMARY KEY (id);


--
-- Name: source_objects PK_f8dc86db30494bfcb13b63469b1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.source_objects
    ADD CONSTRAINT "PK_f8dc86db30494bfcb13b63469b1" PRIMARY KEY (id);


--
-- Name: rule_versions PK_f94078d9fb0f85dcdf3ceaec3ec; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rule_versions
    ADD CONSTRAINT "PK_f94078d9fb0f85dcdf3ceaec3ec" PRIMARY KEY (id);


--
-- Name: rca_barrier_analyses PK_fc75893e8c95b19094180792083; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_barrier_analyses
    ADD CONSTRAINT "PK_fc75893e8c95b19094180792083" PRIMARY KEY (id);


--
-- Name: production_profiles PK_ffc00934315c8134cf2db648797; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_profiles
    ADD CONSTRAINT "PK_ffc00934315c8134cf2db648797" PRIMARY KEY (id);


--
-- Name: tenants UQ_3021c18db2b363ae9324c826c5a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.tenants
    ADD CONSTRAINT "UQ_3021c18db2b363ae9324c826c5a" UNIQUE (code);


--
-- Name: verification_status_codes UQ_547ed4b92d53d98e137c8e20c91; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.verification_status_codes
    ADD CONSTRAINT "UQ_547ed4b92d53d98e137c8e20c91" UNIQUE (code);


--
-- Name: roles UQ_648e3f5447f725579d7d4ffdfb7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.roles
    ADD CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE (name);


--
-- Name: organizations UQ_7e27c3b62c681fbe3e2322535f2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.organizations
    ADD CONSTRAINT "UQ_7e27c3b62c681fbe3e2322535f2" UNIQUE (code);


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: accounting_policies UQ_accounting_policies_kind_scope_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.accounting_policies
    ADD CONSTRAINT "UQ_accounting_policies_kind_scope_version" UNIQUE (tenant_id, policy_kind, scope_key, version);


--
-- Name: accounting_revisions UQ_accounting_revisions_period_revision; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.accounting_revisions
    ADD CONSTRAINT "UQ_accounting_revisions_period_revision" UNIQUE (period_id, revision);


--
-- Name: approved_loss_line_valuations UQ_approved_loss_line_valuations_cell; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.approved_loss_line_valuations
    ADD CONSTRAINT "UQ_approved_loss_line_valuations_cell" UNIQUE (approved_line_id, view, currency);


--
-- Name: approved_valuation_totals UQ_approved_valuation_totals_cell; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.approved_valuation_totals
    ADD CONSTRAINT "UQ_approved_valuation_totals_cell" UNIQUE (revision_id, slice_id, kind, view, currency);


--
-- Name: attribute_mapping_versions UQ_attribute_mapping_versions_tenant_template_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.attribute_mapping_versions
    ADD CONSTRAINT "UQ_attribute_mapping_versions_tenant_template_version" UNIQUE (tenant_id, template_name, version);


--
-- Name: buffer_levels UQ_buffer_levels_reading; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.buffer_levels
    ADD CONSTRAINT "UQ_buffer_levels_reading" UNIQUE (tenant_id, from_unit_id, to_unit_id, observed_at);


--
-- Name: code_mapping_rules UQ_code_mapping_rules_tenant_kind_source_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.code_mapping_rules
    ADD CONSTRAINT "UQ_code_mapping_rules_tenant_kind_source_version" UNIQUE (tenant_id, rule_kind, source_code_id, version);


--
-- Name: code_versions UQ_code_versions_library_code_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.code_versions
    ADD CONSTRAINT "UQ_code_versions_library_code_version" UNIQUE (library, code_id, version);


--
-- Name: rca_cause_codes UQ_dd288509552d6a52b39bdff81f1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_cause_codes
    ADD CONSTRAINT "UQ_dd288509552d6a52b39bdff81f1" UNIQUE (code);


--
-- Name: event_coding UQ_event_coding_event_revision; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_coding
    ADD CONSTRAINT "UQ_event_coding_event_revision" UNIQUE (event_id, revision);


--
-- Name: event_relations UQ_event_relations_from_to_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_relations
    ADD CONSTRAINT "UQ_event_relations_from_to_type" UNIQUE (from_event_id, to_event_id, relation_type);


--
-- Name: event_revisions UQ_event_revisions_event_revision; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_revisions
    ADD CONSTRAINT "UQ_event_revisions_event_revision" UNIQUE (event_id, revision);


--
-- Name: external_production_reports UQ_external_production_reports_revision; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.external_production_reports
    ADD CONSTRAINT "UQ_external_production_reports_revision" UNIQUE (tenant_id, external_report_id, external_revision);


--
-- Name: failure_code_groups UQ_failure_code_groups_tenant_kind_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.failure_code_groups
    ADD CONSTRAINT "UQ_failure_code_groups_tenant_kind_code" UNIQUE (tenant_id, group_kind, code);


--
-- Name: impact_codes UQ_impact_codes_tenant_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.impact_codes
    ADD CONSTRAINT "UQ_impact_codes_tenant_code" UNIQUE (tenant_id, code);


--
-- Name: loss_category_defs UQ_loss_category_defs_tenant_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.loss_category_defs
    ADD CONSTRAINT "UQ_loss_category_defs_tenant_code" UNIQUE (tenant_id, code);


--
-- Name: loss_line_valuations UQ_loss_line_valuations_line_view_currency; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.loss_line_valuations
    ADD CONSTRAINT "UQ_loss_line_valuations_line_view_currency" UNIQUE (loss_line_id, view, currency);


--
-- Name: measurement_samples UQ_measurement_samples_identity; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.measurement_samples
    ADD CONSTRAINT "UQ_measurement_samples_identity" UNIQUE (signal_id, observed_at, source_revision);


--
-- Name: month_closes UQ_month_closes_tenant_first_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.month_closes
    ADD CONSTRAINT "UQ_month_closes_tenant_first_date" UNIQUE (tenant_id, first_date);


--
-- Name: oee_codes UQ_oee_codes_tenant_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.oee_codes
    ADD CONSTRAINT "UQ_oee_codes_tenant_code" UNIQUE (tenant_id, code);


--
-- Name: period_ledger_totals UQ_period_ledger_totals_run_slice_ledger; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_ledger_totals
    ADD CONSTRAINT "UQ_period_ledger_totals_run_slice_ledger" UNIQUE (run_id, slice_id, ledger);


--
-- Name: period_valuation_totals UQ_period_valuation_totals_cell; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_valuation_totals
    ADD CONSTRAINT "UQ_period_valuation_totals_cell" UNIQUE (run_id, slice_id, ledger, kind, view, currency);


--
-- Name: pi_open_frames UQ_pi_open_frames_connection_web_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_open_frames
    ADD CONSTRAINT "UQ_pi_open_frames_connection_web_id" UNIQUE (connection_id, web_id);


--
-- Name: pi_page_manifests UQ_pi_page_manifests_job_window_page; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_page_manifests
    ADD CONSTRAINT "UQ_pi_page_manifests_job_window_page" UNIQUE (job_id, window_start, window_end, page_index);


--
-- Name: plan_periods UQ_plan_periods_version_slice_start; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_periods
    ADD CONSTRAINT "UQ_plan_periods_version_slice_start" UNIQUE (plan_version_id, slice_id, utc_start);


--
-- Name: plan_product_slices UQ_plan_product_slices_version_position; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_product_slices
    ADD CONSTRAINT "UQ_plan_product_slices_version_position" UNIQUE (plan_version_id, "position");


--
-- Name: plan_scenarios UQ_plan_scenarios_tenant_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_scenarios
    ADD CONSTRAINT "UQ_plan_scenarios_tenant_name" UNIQUE (tenant_id, name);


--
-- Name: plan_versions UQ_plan_versions_plan_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_versions
    ADD CONSTRAINT "UQ_plan_versions_plan_version" UNIQUE (plan_id, version);


--
-- Name: plant_flow_routes UQ_plant_flow_routes_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plant_flow_routes
    ADD CONSTRAINT "UQ_plant_flow_routes_version" UNIQUE (from_unit_id, to_unit_id, version);


--
-- Name: production_periods UQ_production_periods_unit_start; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_periods
    ADD CONSTRAINT "UQ_production_periods_unit_start" UNIQUE (tenant_id, unit_id, utc_start);


--
-- Name: production_profiles UQ_production_profiles_key_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_profiles
    ADD CONSTRAINT "UQ_production_profiles_key_version" UNIQUE (tenant_id, unit_id, product_id, operating_mode, version);


--
-- Name: products UQ_products_tenant_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.products
    ADD CONSTRAINT "UQ_products_tenant_code" UNIQUE (tenant_id, code);


--
-- Name: rate_imports UQ_rate_imports_document_revision; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rate_imports
    ADD CONSTRAINT "UQ_rate_imports_document_revision" UNIQUE (tenant_id, kind, external_id, revision);


--
-- Name: rca_case_links UQ_rca_case_links_target; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_case_links
    ADD CONSTRAINT "UQ_rca_case_links_target" UNIQUE (rca_id, link_type, target_id);


--
-- Name: rca_trigger_evaluations UQ_rca_trigger_evaluations_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_trigger_evaluations
    ADD CONSTRAINT "UQ_rca_trigger_evaluations_key" UNIQUE (tenant_id, idempotency_key);


--
-- Name: reason_codes UQ_reason_codes_tenant_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.reason_codes
    ADD CONSTRAINT "UQ_reason_codes_tenant_code" UNIQUE (tenant_id, code);


--
-- Name: reconciliation_line_sets UQ_reconciliation_line_sets_revision_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.reconciliation_line_sets
    ADD CONSTRAINT "UQ_reconciliation_line_sets_revision_version" UNIQUE (revision_id, version);


--
-- Name: rule_versions UQ_rule_versions_rule_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rule_versions
    ADD CONSTRAINT "UQ_rule_versions_rule_version" UNIQUE (rule_id, version);


--
-- Name: rules UQ_rules_tenant_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rules
    ADD CONSTRAINT "UQ_rules_tenant_name" UNIQUE (tenant_id, name);


--
-- Name: shift_instances UQ_shift_instances_unit_start; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.shift_instances
    ADD CONSTRAINT "UQ_shift_instances_unit_start" UNIQUE (unit_id, utc_start);


--
-- Name: signal_summaries UQ_signal_summaries_identity; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.signal_summaries
    ADD CONSTRAINT "UQ_signal_summaries_identity" UNIQUE (signal_id, period_start, period_end, source_revision);


--
-- Name: source_objects UQ_source_objects_identity; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.source_objects
    ADD CONSTRAINT "UQ_source_objects_identity" UNIQUE (tenant_id, connection_id, source_object_id);


--
-- Name: source_status_mappings UQ_source_status_mappings_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.source_status_mappings
    ADD CONSTRAINT "UQ_source_status_mappings_version" UNIQUE (tenant_id, source_system, version);


--
-- Name: unit_impact_rules UQ_unit_impact_rules_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_impact_rules
    ADD CONSTRAINT "UQ_unit_impact_rules_version" UNIQUE (unit_id, asset_id, version);


--
-- Name: unit_product_rates UQ_unit_product_rates_profile_kind_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_product_rates
    ADD CONSTRAINT "UQ_unit_product_rates_profile_kind_version" UNIQUE (profile_id, rate_kind, version);


--
-- Name: unit_streams UQ_unit_streams_code_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_streams
    ADD CONSTRAINT "UQ_unit_streams_code_version" UNIQUE (unit_id, code, version);


--
-- Name: units UQ_units_tenant_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.units
    ADD CONSTRAINT "UQ_units_tenant_code" UNIQUE (tenant_id, code);


--
-- Name: user_scopes UQ_user_scopes_user_scope_role; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.user_scopes
    ADD CONSTRAINT "UQ_user_scopes_user_scope_role" UNIQUE (user_id, scope_kind, scope_id, role);


--
-- Name: raw_observations_y2026m09 raw_observations_y2026m09_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.raw_observations_y2026m09
    ADD CONSTRAINT raw_observations_y2026m09_pkey PRIMARY KEY (id, received_at);


--
-- Name: raw_observations_y2026m10 raw_observations_y2026m10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.raw_observations_y2026m10
    ADD CONSTRAINT raw_observations_y2026m10_pkey PRIMARY KEY (id, received_at);


--
-- Name: raw_observations_y2026m11 raw_observations_y2026m11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.raw_observations_y2026m11
    ADD CONSTRAINT raw_observations_y2026m11_pkey PRIMARY KEY (id, received_at);


--
-- Name: raw_observations_y2026m12 raw_observations_y2026m12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.raw_observations_y2026m12
    ADD CONSTRAINT raw_observations_y2026m12_pkey PRIMARY KEY (id, received_at);


--
-- Name: IDX_01e38f5ea9f551f60095f137dd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_01e38f5ea9f551f60095f137dd" ON forge.event_coding USING btree (tenant_id);


--
-- Name: IDX_03bc03f60cf3ead27d2290f93c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_03bc03f60cf3ead27d2290f93c" ON forge.pi_sync_jobs USING btree (tenant_id);


--
-- Name: IDX_05f711ad4a10b54074f8ec67ab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_05f711ad4a10b54074f8ec67ab" ON forge.production_periods USING btree (tenant_id);


--
-- Name: IDX_06830eabae1dc4cafe121af8be; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_06830eabae1dc4cafe121af8be" ON forge.rca_fault_tree_analyses USING btree (organization_id);


--
-- Name: IDX_0a60561d49d2defb80153b5a3c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0a60561d49d2defb80153b5a3c" ON forge.pi_connections USING btree (organization_id);


--
-- Name: IDX_0adf29d9a8e4b154d18dfd2d8c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0adf29d9a8e4b154d18dfd2d8c" ON forge.source_hierarchy_mappings USING btree (source_type);


--
-- Name: IDX_0b8772a88f0e68be361d6114dc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0b8772a88f0e68be361d6114dc" ON forge.rca_trigger_evaluations USING btree (tenant_id);


--
-- Name: IDX_0d6fc1a3c3a0e83b3fce15fb9c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0d6fc1a3c3a0e83b3fce15fb9c" ON forge.rca_cause_codes USING btree (parent_id);


--
-- Name: IDX_0e57b4f47c9f913c284d686721; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0e57b4f47c9f913c284d686721" ON forge.valuation_rates USING btree (tenant_id);


--
-- Name: IDX_10c88127427a6b9e64da2bea0b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_10c88127427a6b9e64da2bea0b" ON forge.rca_fishbone_diagrams USING btree (tenant_id);


--
-- Name: IDX_12376c181edbdcc0bfa1f432e2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_12376c181edbdcc0bfa1f432e2" ON forge.export_jobs USING btree (tenant_id);


--
-- Name: IDX_12522f4e4a573535f49f91706b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_12522f4e4a573535f49f91706b" ON forge.code_mapping_rules USING btree (tenant_id);


--
-- Name: IDX_139c530dcddcd1c0f040f8a7e7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_139c530dcddcd1c0f040f8a7e7" ON forge.custom_attribute_definitions USING btree (entity_type);


--
-- Name: IDX_1463179e78a90d088ae8374743; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1463179e78a90d088ae8374743" ON forge.af_bindings USING btree (tenant_id);


--
-- Name: IDX_14c3aac4fa45210bfd61640e67; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_14c3aac4fa45210bfd61640e67" ON forge.user_notifications USING btree (tenant_id);


--
-- Name: IDX_1510a82722301bb123b7211fbf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1510a82722301bb123b7211fbf" ON forge.attribute_mapping_versions USING btree (tenant_id);


--
-- Name: IDX_1614859f262a4b0df6cc307026; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1614859f262a4b0df6cc307026" ON forge.rca_five_why_analyses USING btree (tenant_id);


--
-- Name: IDX_19d7cfd5c6d832f26e9cd6f959; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_19d7cfd5c6d832f26e9cd6f959" ON forge.custom_attribute_definitions USING btree (organization_id);


--
-- Name: IDX_1b7a67348d189f9f49f6f8f99f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1b7a67348d189f9f49f6f8f99f" ON forge.fx_rates USING btree (tenant_id);


--
-- Name: IDX_1badad0d8d18d45cb93eeee6ae; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1badad0d8d18d45cb93eeee6ae" ON forge.rule_versions USING btree (tenant_id);


--
-- Name: IDX_1d6559ddce3efa137676bc9c63; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1d6559ddce3efa137676bc9c63" ON forge.plant_flow_routes USING btree (tenant_id);


--
-- Name: IDX_1d7e8e30b31a645b5ce4b323f0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1d7e8e30b31a645b5ce4b323f0" ON forge.ingestion_exceptions USING btree (tenant_id);


--
-- Name: IDX_1de00b5048d8462a8d84698c22; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1de00b5048d8462a8d84698c22" ON forge.crews USING btree (tenant_id);


--
-- Name: IDX_1e09340b68d8478a6133ebb4d9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1e09340b68d8478a6133ebb4d9" ON forge.production_day_certifications USING btree (tenant_id);


--
-- Name: IDX_268ab8531f11ebd5d619fc33ae; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_268ab8531f11ebd5d619fc33ae" ON forge.af_bindings USING btree (web_id);


--
-- Name: IDX_29fd3a7a95156f68d757b2aa36; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_29fd3a7a95156f68d757b2aa36" ON forge.user_scopes USING btree (tenant_id);


--
-- Name: IDX_2ce0e9b621d1ae4c01c4fb937e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2ce0e9b621d1ae4c01c4fb937e" ON forge.replay_runs USING btree (tenant_id);


--
-- Name: IDX_2fbf7af88f913ca105c2c44708; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2fbf7af88f913ca105c2c44708" ON forge.reconciliation_lines USING btree (tenant_id);


--
-- Name: IDX_31dcd684e1d819c50c9aa5f827; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_31dcd684e1d819c50c9aa5f827" ON forge.secrets USING btree (tenant_id);


--
-- Name: IDX_39ca7dfd04021dc96cd14c0c68; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_39ca7dfd04021dc96cd14c0c68" ON forge.crew_rotations USING btree (tenant_id);


--
-- Name: IDX_3a1adec9dc81f00da6920ceda8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3a1adec9dc81f00da6920ceda8" ON forge.rca_fishbone_diagrams USING btree (rca_id);


--
-- Name: IDX_3b38ccc53896cd40077d5c23be; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3b38ccc53896cd40077d5c23be" ON forge.pi_sync_watermarks USING btree (organization_id);


--
-- Name: IDX_3b6e486e49a2353c4456e72751; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3b6e486e49a2353c4456e72751" ON forge.custom_attribute_definitions USING btree (created_at);


--
-- Name: IDX_3bb69dab6cb26d5d09cdb139fd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3bb69dab6cb26d5d09cdb139fd" ON forge.external_production_reports USING btree (tenant_id);


--
-- Name: IDX_3bf8a35c31c8c280c1a65451d8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3bf8a35c31c8c280c1a65451d8" ON forge.demand_statuses USING btree (tenant_id);


--
-- Name: IDX_40bfa9eb36b30927422f2b51f4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_40bfa9eb36b30927422f2b51f4" ON forge.rca_fault_tree_analyses USING btree (tenant_id);


--
-- Name: IDX_41870904cacc3982b156128bb6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_41870904cacc3982b156128bb6" ON forge.pi_sync_jobs USING btree (organization_id);


--
-- Name: IDX_41de923dd1f5226edfeac125d7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_41de923dd1f5226edfeac125d7" ON forge.state_engine_cursors USING btree (tenant_id);


--
-- Name: IDX_42c70bceb21f44824c5545b48e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_42c70bceb21f44824c5545b48e" ON forge.calendar_versions USING btree (tenant_id);


--
-- Name: IDX_43fb31c1659c08cb74d9ce169a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_43fb31c1659c08cb74d9ce169a" ON forge.rca_case_links USING btree (tenant_id);


--
-- Name: IDX_4a07909a5653e70d2e5e883550; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4a07909a5653e70d2e5e883550" ON forge.failure_code_groups USING btree (tenant_id);


--
-- Name: IDX_4bca7afdf5e1a9164295b81ad4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4bca7afdf5e1a9164295b81ad4" ON forge.rca_five_why_analyses USING btree (organization_id);


--
-- Name: IDX_4def568e3a54288dd8f16bb896; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4def568e3a54288dd8f16bb896" ON forge.reconciliation_line_sets USING btree (tenant_id);


--
-- Name: IDX_4eab5ecd3f4166db8c7db5e17d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4eab5ecd3f4166db8c7db5e17d" ON forge.rca_change_analyses USING btree (tenant_id);


--
-- Name: IDX_50500b02ccd3ed71fe7e19f647; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_50500b02ccd3ed71fe7e19f647" ON forge.actuals_runs USING btree (tenant_id);


--
-- Name: IDX_52477a3c4a6cb7e34a8a27b8cb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_52477a3c4a6cb7e34a8a27b8cb" ON forge.rca_knowledge_base USING btree (tenant_id);


--
-- Name: IDX_560a5a557df886c4a8a15d840e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_560a5a557df886c4a8a15d840e" ON forge.pi_connections USING btree (created_at);


--
-- Name: IDX_5dca9ea5566957e12f31d4d086; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5dca9ea5566957e12f31d4d086" ON forge.approved_loss_line_valuations USING btree (tenant_id);


--
-- Name: IDX_5f6667abd5bde682568dc0e831; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5f6667abd5bde682568dc0e831" ON forge.source_hierarchy_mappings USING btree (pattern);


--
-- Name: IDX_61f562215e491df0d6be3089c8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_61f562215e491df0d6be3089c8" ON forge.event_revisions USING btree (tenant_id);


--
-- Name: IDX_68ad038635e2343241e4c85215; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_68ad038635e2343241e4c85215" ON forge.work_order_operations USING btree (tenant_id);


--
-- Name: IDX_68e47c91039617fea2ff36313b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_68e47c91039617fea2ff36313b" ON forge.rca_fmea_analyses USING btree (organization_id);


--
-- Name: IDX_68e74a0ab6e2aa327b5c0fe677; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_68e74a0ab6e2aa327b5c0fe677" ON forge.pi_sync_watermarks USING btree (tenant_id);


--
-- Name: IDX_69a0ace0ec077a4dd7f55ccda3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_69a0ace0ec077a4dd7f55ccda3" ON forge.integration_connections USING btree (tenant_id);


--
-- Name: IDX_6a2e35fcbd3f5f6b09f0f0eccd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6a2e35fcbd3f5f6b09f0f0eccd" ON forge.rca_fishbone_diagrams USING btree (organization_id);


--
-- Name: IDX_6bf485a95f0c0c8fb72d228a7c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6bf485a95f0c0c8fb72d228a7c" ON forge.stop_incident_breaks USING btree (tenant_id);


--
-- Name: IDX_6c05f068f12c3d0f0e399670d7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6c05f068f12c3d0f0e399670d7" ON forge.custom_attribute_values USING btree (tenant_id);


--
-- Name: IDX_6f2183f735a5b87eaf2f557f60; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6f2183f735a5b87eaf2f557f60" ON forge.af_bindings USING btree (created_at);


--
-- Name: IDX_736faece0ea92fc5e8574115a7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_736faece0ea92fc5e8574115a7" ON forge.custom_attribute_values USING btree (created_at);


--
-- Name: IDX_768c28ade4f54ed5bfb3be28bb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_768c28ade4f54ed5bfb3be28bb" ON forge.event_review_items USING btree (tenant_id);


--
-- Name: IDX_78d0844a70c25eda3dabeed97a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_78d0844a70c25eda3dabeed97a" ON forge.source_hierarchy_mappings USING btree (source_identifier);


--
-- Name: IDX_7aca87f7b0403c779920474181; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7aca87f7b0403c779920474181" ON forge.transition_standards USING btree (tenant_id);


--
-- Name: IDX_7b1b2bc0fa110afda818239468; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7b1b2bc0fa110afda818239468" ON forge.signals USING btree (tenant_id);


--
-- Name: IDX_7b4828e54cf099626221a42c90; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7b4828e54cf099626221a42c90" ON forge.stream_runs USING btree (tenant_id);


--
-- Name: IDX_7c1ca69fdcb693137f615eafab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7c1ca69fdcb693137f615eafab" ON forge.pi_sync_watermarks USING btree (created_at);


--
-- Name: IDX_7d579a1460bd013cca496c3b8b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7d579a1460bd013cca496c3b8b" ON forge.period_data_holds USING btree (tenant_id);


--
-- Name: IDX_7dd5b7d5b3d980501f6e7f106e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7dd5b7d5b3d980501f6e7f106e" ON forge.signal_backfill_runs USING btree (tenant_id);


--
-- Name: IDX_7e1c798ad723662cfd98453fb7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7e1c798ad723662cfd98453fb7" ON forge.approval_actions USING btree (tenant_id);


--
-- Name: IDX_7e5b997af65eb13f932573fc34; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7e5b997af65eb13f932573fc34" ON forge.rca_change_analyses USING btree (organization_id);


--
-- Name: IDX_7fa81bd4264b9df8d18f9d26f0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7fa81bd4264b9df8d18f9d26f0" ON forge.pi_mappings USING btree (tenant_id);


--
-- Name: IDX_7fc5d781e06c4f407969f7d146; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7fc5d781e06c4f407969f7d146" ON forge.event_relations USING btree (tenant_id);


--
-- Name: IDX_80e4e5c2b0f6f69646dca73bde; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_80e4e5c2b0f6f69646dca73bde" ON forge.period_change_proposals USING btree (tenant_id);


--
-- Name: IDX_830758bdb0fa45d45b34d17938; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_830758bdb0fa45d45b34d17938" ON forge.loss_category_defs USING btree (tenant_id);


--
-- Name: IDX_835a76e43cba29898db7a0bd35; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_835a76e43cba29898db7a0bd35" ON forge.month_close_actions USING btree (tenant_id);


--
-- Name: IDX_83749665d60550ebcbc2171fc6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_83749665d60550ebcbc2171fc6" ON forge.rate_imports USING btree (tenant_id);


--
-- Name: IDX_8458d7310a56c10ed38fd8e3ef; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8458d7310a56c10ed38fd8e3ef" ON forge.stop_reconciliations USING btree (tenant_id);


--
-- Name: IDX_86d28b5a6cccf3bd81c0cbb327; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_86d28b5a6cccf3bd81c0cbb327" ON forge.af_bindings USING btree (bound_type);


--
-- Name: IDX_887fc92f512228d4860e341404; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_887fc92f512228d4860e341404" ON forge.source_status_mappings USING btree (tenant_id);


--
-- Name: IDX_8915d9aba8665e9fd0e74ba600; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8915d9aba8665e9fd0e74ba600" ON forge.source_hierarchy_mappings USING btree (is_active);


--
-- Name: IDX_8b6ad2bccf50753849263a521e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8b6ad2bccf50753849263a521e" ON forge.rca_change_analyses USING btree (rca_id);


--
-- Name: IDX_8c8c3702fc08ec58a536e91021; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8c8c3702fc08ec58a536e91021" ON forge.unit_state_mappings USING btree (tenant_id);


--
-- Name: IDX_905e4f0b87f62e0dcc791e042c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_905e4f0b87f62e0dcc791e042c" ON forge.plan_scenarios USING btree (tenant_id);


--
-- Name: IDX_90d257c2c4f58a6b01c7211c7c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_90d257c2c4f58a6b01c7211c7c" ON forge.af_bindings USING btree (local_id);


--
-- Name: IDX_92c1f2c75417c27d0b2559d012; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_92c1f2c75417c27d0b2559d012" ON forge.af_bindings USING btree (organization_id);


--
-- Name: IDX_97ae496f70b45daddfa927e068; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_97ae496f70b45daddfa927e068" ON forge.rca_fmea_analyses USING btree (rca_id);


--
-- Name: IDX_97cc60709443b4eebe4c1c08c9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_97cc60709443b4eebe4c1c08c9" ON forge.period_product_slices USING btree (tenant_id);


--
-- Name: IDX_9df48d1ec44bcd8648c488abe5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9df48d1ec44bcd8648c488abe5" ON forge.bulk_jobs USING btree (tenant_id);


--
-- Name: IDX_9fbf19e5e72ff36f825959e133; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9fbf19e5e72ff36f825959e133" ON forge.restatement_postings USING btree (tenant_id);


--
-- Name: IDX_a10a6ecb685dcadfb8196eb20c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a10a6ecb685dcadfb8196eb20c" ON forge.custom_attribute_values USING btree (entity_id);


--
-- Name: IDX_a15f110084e26bf1a96caef2bd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a15f110084e26bf1a96caef2bd" ON forge.pi_mappings USING btree (organization_id);


--
-- Name: IDX_a66f57e74944f56f8426399892; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a66f57e74944f56f8426399892" ON forge.custom_attribute_definitions USING btree (tenant_id);


--
-- Name: IDX_ab248cb66cf01a2254f835aaf3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ab248cb66cf01a2254f835aaf3" ON forge.unit_streams USING btree (tenant_id);


--
-- Name: IDX_ab7af7a9db037b87a30ad8cbc7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ab7af7a9db037b87a30ad8cbc7" ON forge.buffer_levels USING btree (tenant_id);


--
-- Name: IDX_accounting_policies_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_accounting_policies_lookup" ON forge.accounting_policies USING btree (tenant_id, policy_kind, unit_id, effective_from);


--
-- Name: IDX_accounting_policies_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_accounting_policies_pending" ON forge.accounting_policies USING btree (tenant_id, policy_kind, created_at) WHERE ((approved_at IS NULL) AND (rejected_at IS NULL));


--
-- Name: IDX_accounting_policies_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_accounting_policies_unit" ON forge.accounting_policies USING btree (unit_id);


--
-- Name: IDX_accounting_revisions_current_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_accounting_revisions_current_run" ON forge.accounting_revisions USING btree (current_run_id);


--
-- Name: IDX_accounting_revisions_supersedes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_accounting_revisions_supersedes" ON forge.accounting_revisions USING btree (supersedes_id);


--
-- Name: IDX_accounting_revisions_tenant_approved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_accounting_revisions_tenant_approved" ON forge.accounting_revisions USING btree (tenant_id, approved_at) WHERE (lifecycle = 'approved'::forge.accounting_revision_lifecycle);


--
-- Name: IDX_actuals_adjustments_slice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_actuals_adjustments_slice" ON forge.actuals_adjustments USING btree (slice_id);


--
-- Name: IDX_actuals_adjustments_tenant_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_actuals_adjustments_tenant_period" ON forge.actuals_adjustments USING btree (tenant_id, period_id);


--
-- Name: IDX_actuals_adjustments_tenant_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_actuals_adjustments_tenant_unit" ON forge.actuals_adjustments USING btree (tenant_id, unit_id);


--
-- Name: IDX_actuals_jobs_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_actuals_jobs_period" ON forge.actuals_jobs USING btree (period_id);


--
-- Name: IDX_actuals_jobs_state_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_actuals_jobs_state_created" ON forge.actuals_jobs USING btree (state, created_at);


--
-- Name: IDX_actuals_results_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_actuals_results_run" ON forge.actuals_results USING btree (actuals_run_id);


--
-- Name: IDX_actuals_results_slice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_actuals_results_slice" ON forge.actuals_results USING btree (slice_id);


--
-- Name: IDX_actuals_results_tenant_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_actuals_results_tenant_period" ON forge.actuals_results USING btree (tenant_id, period_id);


--
-- Name: IDX_actuals_runs_period_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_actuals_runs_period_created" ON forge.actuals_runs USING btree (period_id, created_at);


--
-- Name: IDX_ada1a4a28cc8c8a6d4faddb64f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ada1a4a28cc8c8a6d4faddb64f" ON forge.rca_knowledge_base USING btree (organization_id);


--
-- Name: IDX_ae728f988ed7af9c4bfe77b61a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ae728f988ed7af9c4bfe77b61a" ON forge.production_profiles USING btree (tenant_id);


--
-- Name: IDX_ae9a6d92f453c8773b2227e0ee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ae9a6d92f453c8773b2227e0ee" ON forge.source_mappings USING btree (tenant_id);


--
-- Name: IDX_afc84c794ebf8dc2255356d9ac; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_afc84c794ebf8dc2255356d9ac" ON forge.rca_knowledge_votes USING btree (tenant_id);


--
-- Name: IDX_app_settings_tenant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_app_settings_tenant_user" ON forge.app_settings USING btree (tenant_id, user_id);


--
-- Name: IDX_approval_actions_revision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_actions_revision" ON forge.approval_actions USING btree (revision_id);


--
-- Name: IDX_approval_actions_tenant_period_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_actions_tenant_period_created" ON forge.approval_actions USING btree (tenant_id, period_id, created_at);


--
-- Name: IDX_approval_inbox_accounting_policies; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_accounting_policies" ON forge.accounting_policies USING btree (tenant_id, created_at, id) WHERE (approved_at IS NULL);


--
-- Name: IDX_approval_inbox_accounting_revisions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_accounting_revisions" ON forge.accounting_revisions USING btree (tenant_id, created_at, id) WHERE ((lifecycle = 'in_review'::forge.accounting_revision_lifecycle) AND (submitted_at IS NOT NULL));


--
-- Name: IDX_approval_inbox_actuals_adjustments; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_actuals_adjustments" ON forge.actuals_adjustments USING btree (tenant_id, created_at, id) WHERE (state = 'proposed'::forge.actuals_adjustment_state);


--
-- Name: IDX_approval_inbox_demand_statuses; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_demand_statuses" ON forge.demand_statuses USING btree (tenant_id, created_at, id) WHERE (state = 'draft'::forge.demand_status_state);


--
-- Name: IDX_approval_inbox_fx_rates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_fx_rates" ON forge.fx_rates USING btree (tenant_id, created_at, id) WHERE (state = 'draft'::forge.fx_rate_state);


--
-- Name: IDX_approval_inbox_lot_dispositions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_lot_dispositions" ON forge.lot_dispositions USING btree (tenant_id, created_at, id) WHERE ((state)::text = 'proposed'::text);


--
-- Name: IDX_approval_inbox_month_closes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_month_closes" ON forge.month_closes USING btree (tenant_id, created_at, id) WHERE ((state)::text = ANY ((ARRAY['quantities_closed'::character varying, 'finance_signed_off'::character varying])::text[]));


--
-- Name: IDX_approval_inbox_period_change_proposals; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_period_change_proposals" ON forge.period_change_proposals USING btree (tenant_id, created_at, id) WHERE (state = 'open'::forge.period_change_proposal_state);


--
-- Name: IDX_approval_inbox_plan_versions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_plan_versions" ON forge.plan_versions USING btree (tenant_id, created_at, id) WHERE (approval_state = 'submitted'::forge.plan_version_approval_state);


--
-- Name: IDX_approval_inbox_plant_flow_routes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_plant_flow_routes" ON forge.plant_flow_routes USING btree (tenant_id, created_at, id) WHERE (state = 'draft'::forge.plant_flow_route_state);


--
-- Name: IDX_approval_inbox_postings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_postings" ON forge.accounting_revisions USING btree (tenant_id, created_at, id) WHERE ((lifecycle = 'approved'::forge.accounting_revision_lifecycle) AND (supersedes_id IS NOT NULL));


--
-- Name: IDX_approval_inbox_production_profiles; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_production_profiles" ON forge.production_profiles USING btree (tenant_id, created_at, id) WHERE (state = 'draft'::forge.production_profile_state);


--
-- Name: IDX_approval_inbox_rcas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_rcas" ON forge.rcas USING btree (tenant_id, created_at, id) WHERE ((status)::text = 'closure_review'::text);


--
-- Name: IDX_approval_inbox_rules; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_rules" ON forge.rules USING btree (tenant_id, created_at, id) WHERE ((draft_definition IS NOT NULL) AND (retired_at IS NULL));


--
-- Name: IDX_approval_inbox_source_status_mappings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_source_status_mappings" ON forge.source_status_mappings USING btree (tenant_id, created_at, id) WHERE ((state)::text = 'draft'::text);


--
-- Name: IDX_approval_inbox_stop_reconciliations; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_stop_reconciliations" ON forge.stop_reconciliations USING btree (tenant_id, created_at, id) WHERE ((state)::text = 'suggested'::text);


--
-- Name: IDX_approval_inbox_transition_standards; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_transition_standards" ON forge.transition_standards USING btree (tenant_id, created_at, id) WHERE (state = 'draft'::forge.transition_standard_state);


--
-- Name: IDX_approval_inbox_uncertainty_budgets; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_uncertainty_budgets" ON forge.uncertainty_budgets USING btree (tenant_id, created_at, id) WHERE ((state)::text = 'proposed'::text);


--
-- Name: IDX_approval_inbox_unit_impact_rules; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_unit_impact_rules" ON forge.unit_impact_rules USING btree (tenant_id, created_at, id) WHERE (state = 'draft'::forge.unit_impact_rule_state);


--
-- Name: IDX_approval_inbox_unit_product_rates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_unit_product_rates" ON forge.unit_product_rates USING btree (tenant_id, created_at, id) WHERE (state = 'draft'::forge.unit_product_rate_state);


--
-- Name: IDX_approval_inbox_unit_streams; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_unit_streams" ON forge.unit_streams USING btree (tenant_id, created_at, id) WHERE (state = 'draft'::forge.unit_stream_state);


--
-- Name: IDX_approval_inbox_valuation_rates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_inbox_valuation_rates" ON forge.valuation_rates USING btree (tenant_id, created_at, id) WHERE (state = 'draft'::forge.valuation_rate_state);


--
-- Name: IDX_approval_snapshots_tenant_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approval_snapshots_tenant_period" ON forge.approval_snapshots USING btree (tenant_id, period_id);


--
-- Name: IDX_approved_loss_line_valuations_line; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approved_loss_line_valuations_line" ON forge.approved_loss_line_valuations USING btree (approved_line_id);


--
-- Name: IDX_approved_loss_lines_tenant_cause; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approved_loss_lines_tenant_cause" ON forge.approved_loss_lines USING btree (tenant_id, cause_event_id);


--
-- Name: IDX_approved_loss_lines_tenant_revision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approved_loss_lines_tenant_revision" ON forge.approved_loss_lines USING btree (tenant_id, revision_id);


--
-- Name: IDX_approved_loss_lines_tenant_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approved_loss_lines_tenant_source" ON forge.approved_loss_lines USING btree (tenant_id, source_id);


--
-- Name: IDX_approved_valuation_totals_tenant_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_approved_valuation_totals_tenant_period" ON forge.approved_valuation_totals USING btree (tenant_id, period_id);


--
-- Name: IDX_assets_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_assets_tenant_code" ON forge.assets USING btree (tenant_id, code);


--
-- Name: IDX_assets_tenant_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_assets_tenant_unit" ON forge.assets USING btree (tenant_id, unit_id);


--
-- Name: IDX_attribute_mapping_versions_tenant_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_attribute_mapping_versions_tenant_template" ON forge.attribute_mapping_versions USING btree (tenant_id, template_name);


--
-- Name: IDX_audit_log_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_audit_log_at" ON forge.audit_log USING btree (at);


--
-- Name: IDX_audit_log_rca_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_audit_log_rca_case" ON forge.audit_log USING btree (tenant_id, ((detail ->> 'caseId'::text)), at, id) WHERE ((entity_type)::text = ANY ((ARRAY['rca_case'::character varying, 'rca_action'::character varying, 'rca_case_link'::character varying, 'rca_analysis'::character varying, 'rca_cause'::character varying])::text[]));


--
-- Name: IDX_audit_log_tenant_entity_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_audit_log_tenant_entity_at" ON forge.audit_log USING btree (tenant_id, entity_type, entity_id, at);


--
-- Name: IDX_audit_logs_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_audit_logs_tenant_created" ON forge.audit_logs USING btree (tenant_id, created_at);


--
-- Name: IDX_audit_logs_tenant_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_audit_logs_tenant_time" ON forge.audit_logs USING btree (tenant_id, "timestamp", id);


--
-- Name: IDX_audit_logs_tenant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_audit_logs_tenant_user" ON forge.audit_logs USING btree (tenant_id, user_id);


--
-- Name: IDX_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_audit_logs_timestamp" ON forge.audit_logs USING btree ("timestamp");


--
-- Name: IDX_auth_refresh_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_auth_refresh_tokens_expires" ON forge.auth_refresh_tokens USING btree (expires_at);


--
-- Name: IDX_auth_refresh_tokens_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_auth_refresh_tokens_family" ON forge.auth_refresh_tokens USING btree (family_id);


--
-- Name: IDX_auth_refresh_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_auth_refresh_tokens_user" ON forge.auth_refresh_tokens USING btree (user_id);


--
-- Name: IDX_b0564fcd9cfb5b4b9bd00429de; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b0564fcd9cfb5b4b9bd00429de" ON forge.feature_flags USING btree (tenant_id);


--
-- Name: IDX_b15d66428823c8b8113f7c8a41; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b15d66428823c8b8113f7c8a41" ON forge.custom_attribute_values USING btree (attribute_definition_id);


--
-- Name: IDX_b2468a20339717a30e1a29998f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b2468a20339717a30e1a29998f" ON forge.approval_snapshots USING btree (tenant_id);


--
-- Name: IDX_b3ca481cb9edf1c55d002aece9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b3ca481cb9edf1c55d002aece9" ON forge.rca_five_why_analyses USING btree (rca_id);


--
-- Name: IDX_b452cba15c834ab797e539860b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b452cba15c834ab797e539860b" ON forge.rca_barrier_analyses USING btree (rca_id);


--
-- Name: IDX_b612b99ef80a15bb16c6695502; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b612b99ef80a15bb16c6695502" ON forge.plan_versions USING btree (tenant_id);


--
-- Name: IDX_b6a8953d43eaf93d4aa0898ebc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b6a8953d43eaf93d4aa0898ebc" ON forge.rca_barrier_analyses USING btree (tenant_id);


--
-- Name: IDX_bb56578ccb47df6ef52551b1ad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bb56578ccb47df6ef52551b1ad" ON forge.pi_sync_jobs USING btree (created_at);


--
-- Name: IDX_bee73a348dcf70a5e113e865bb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bee73a348dcf70a5e113e865bb" ON forge.sites USING btree (tenant_id);


--
-- Name: IDX_bf3eb0c0607310d1195ed28d33; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bf3eb0c0607310d1195ed28d33" ON forge.source_hierarchy_mappings USING btree (tenant_id);


--
-- Name: IDX_bf6a3fb8000706722a8ac1c3cb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bf6a3fb8000706722a8ac1c3cb" ON forge.plan_product_slices USING btree (tenant_id);


--
-- Name: IDX_buffer_levels_from_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_buffer_levels_from_unit" ON forge.buffer_levels USING btree (from_unit_id);


--
-- Name: IDX_buffer_levels_tenant_to_observed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_buffer_levels_tenant_to_observed" ON forge.buffer_levels USING btree (tenant_id, to_unit_id, observed_at);


--
-- Name: IDX_buffer_levels_to_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_buffer_levels_to_unit" ON forge.buffer_levels USING btree (to_unit_id);


--
-- Name: IDX_bulk_jobs_state_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bulk_jobs_state_created" ON forge.bulk_jobs USING btree (state, created_at);


--
-- Name: IDX_c031a85158e72fbab7deccbd1c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c031a85158e72fbab7deccbd1c" ON forge.unit_impact_rules USING btree (tenant_id);


--
-- Name: IDX_c1110e5c2256f1e42a8927483b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c1110e5c2256f1e42a8927483b" ON forge.rule_runs USING btree (tenant_id);


--
-- Name: IDX_c5074ce654cea7bb387994f253; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c5074ce654cea7bb387994f253" ON forge.rca_knowledge_base USING btree (created_at);


--
-- Name: IDX_c756eb42e3acfec0ff7673fc47; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c756eb42e3acfec0ff7673fc47" ON forge.unit_product_rates USING btree (tenant_id);


--
-- Name: IDX_calculation_runs_actuals_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_calculation_runs_actuals_run" ON forge.calculation_runs USING btree (actuals_run_id);


--
-- Name: IDX_calculation_runs_period_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_calculation_runs_period_created" ON forge.calculation_runs USING btree (period_id, created_at);


--
-- Name: IDX_calculation_runs_revision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_calculation_runs_revision" ON forge.calculation_runs USING btree (revision_id);


--
-- Name: IDX_calendar_versions_tenant_site_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_calendar_versions_tenant_site_unit" ON forge.calendar_versions USING btree (tenant_id, site_id, unit_id);


--
-- Name: IDX_cb5dd318884707fdb160842660; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cb5dd318884707fdb160842660" ON forge.custom_attribute_values USING btree (entity_type);


--
-- Name: IDX_ccd01e20166022423d510a615a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ccd01e20166022423d510a615a" ON forge.code_versions USING btree (tenant_id);


--
-- Name: IDX_cd1145cff62fe67d6f7302d884; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cd1145cff62fe67d6f7302d884" ON forge.failure_dictionary_entries USING btree (tenant_id);


--
-- Name: IDX_cf77cb884567ad22e66a90f061; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cf77cb884567ad22e66a90f061" ON forge.plan_generation_jobs USING btree (tenant_id);


--
-- Name: IDX_code_mapping_rules_tenant_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_code_mapping_rules_tenant_source" ON forge.code_mapping_rules USING btree (tenant_id, source_code_id);


--
-- Name: IDX_code_versions_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_code_versions_tenant_code" ON forge.code_versions USING btree (tenant_id, code_id);


--
-- Name: IDX_crew_rotations_crew_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_crew_rotations_crew_from" ON forge.crew_rotations USING btree (crew_id, effective_from);


--
-- Name: IDX_d58a5489812bd0bb3a3309af3b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d58a5489812bd0bb3a3309af3b" ON forge.month_closes USING btree (tenant_id);


--
-- Name: IDX_d7911d18fe4de2373c4d79ced0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d7911d18fe4de2373c4d79ced0" ON forge.ingestion_jobs USING btree (tenant_id);


--
-- Name: IDX_d98aa8becfb1ce17fc43efd626; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d98aa8becfb1ce17fc43efd626" ON forge.accounting_revisions USING btree (tenant_id);


--
-- Name: IDX_da67fcf410e52cca13513d5fbf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_da67fcf410e52cca13513d5fbf" ON forge.rca_fault_tree_analyses USING btree (rca_id);


--
-- Name: IDX_dc14cf1cea5a5b8eb72f6d95b3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_dc14cf1cea5a5b8eb72f6d95b3" ON forge.pi_connections USING btree (tenant_id);


--
-- Name: IDX_de078f09095a67c33e78af101e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_de078f09095a67c33e78af101e" ON forge.actuals_jobs USING btree (tenant_id);


--
-- Name: IDX_demand_statuses_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_demand_statuses_product" ON forge.demand_statuses USING btree (product_id);


--
-- Name: IDX_demand_statuses_tenant_product_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_demand_statuses_tenant_product_from" ON forge.demand_statuses USING btree (tenant_id, product_id, effective_from);


--
-- Name: IDX_e014b70e91d35a67b595d17fd5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e014b70e91d35a67b595d17fd5" ON forge.standby_equipment USING btree (tenant_id);


--
-- Name: IDX_e32a020c89dbed51d53d26e5fc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e32a020c89dbed51d53d26e5fc" ON forge.standby_records USING btree (tenant_id);


--
-- Name: IDX_e75c7fdfd17fc23147ee6c18e4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e75c7fdfd17fc23147ee6c18e4" ON forge.source_objects USING btree (tenant_id);


--
-- Name: IDX_e9a363021da71ef233e60b1210; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e9a363021da71ef233e60b1210" ON forge.stop_incidents USING btree (tenant_id);


--
-- Name: IDX_ea042a30a025ca09ee724ba571; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ea042a30a025ca09ee724ba571" ON forge.source_hierarchy_mappings USING btree (priority);


--
-- Name: IDX_ea8fb7b5b790b42ec6c161651c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ea8fb7b5b790b42ec6c161651c" ON forge.actuals_adjustments USING btree (tenant_id);


--
-- Name: IDX_ee8876d8d96b2ec9e7356b5933; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ee8876d8d96b2ec9e7356b5933" ON forge.pi_mappings USING btree (created_at);


--
-- Name: IDX_event_coding_tenant_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_event_coding_tenant_event" ON forge.event_coding USING btree (tenant_id, event_id);


--
-- Name: IDX_event_impacts_tenant_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_event_impacts_tenant_rule" ON forge.event_impacts USING btree (tenant_id, rule_id);


--
-- Name: IDX_event_relations_tenant_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_event_relations_tenant_from" ON forge.event_relations USING btree (tenant_id, from_event_id);


--
-- Name: IDX_event_relations_tenant_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_event_relations_tenant_to" ON forge.event_relations USING btree (tenant_id, to_event_id);


--
-- Name: IDX_event_review_items_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_event_review_items_event" ON forge.event_review_items USING btree (event_id);


--
-- Name: IDX_event_review_items_tenant_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_event_review_items_tenant_state" ON forge.event_review_items USING btree (tenant_id, state);


--
-- Name: IDX_event_revisions_tenant_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_event_revisions_tenant_event" ON forge.event_revisions USING btree (tenant_id, event_id);


--
-- Name: IDX_export_job_sources_revision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_export_job_sources_revision" ON forge.export_job_sources USING btree (revision_id);


--
-- Name: IDX_export_job_sources_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_export_job_sources_snapshot" ON forge.export_job_sources USING btree (snapshot_id);


--
-- Name: IDX_export_jobs_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_export_jobs_expires" ON forge.export_jobs USING btree (expires_at) WHERE (object_key IS NOT NULL);


--
-- Name: IDX_export_jobs_state_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_export_jobs_state_created" ON forge.export_jobs USING btree (state, created_at);


--
-- Name: IDX_export_jobs_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_export_jobs_tenant_created" ON forge.export_jobs USING btree (tenant_id, created_at);


--
-- Name: IDX_external_production_reports_connection_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_external_production_reports_connection_date" ON forge.external_production_reports USING btree (tenant_id, connection_id, local_production_date);


--
-- Name: IDX_external_production_reports_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_external_production_reports_site" ON forge.external_production_reports USING btree (site_id);


--
-- Name: IDX_external_production_reports_site_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_external_production_reports_site_date" ON forge.external_production_reports USING btree (tenant_id, site_id, local_production_date);


--
-- Name: IDX_external_production_reports_window; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_external_production_reports_window" ON forge.external_production_reports USING btree (tenant_id, utc_start);


--
-- Name: IDX_f1e5726c50ef2a632e178103c8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f1e5726c50ef2a632e178103c8" ON forge.rules USING btree (tenant_id);


--
-- Name: IDX_f20b36faff75f435f9452aa68e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f20b36faff75f435f9452aa68e" ON forge.rca_barrier_analyses USING btree (organization_id);


--
-- Name: IDX_f669097b81e8a638570ec72b21; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f669097b81e8a638570ec72b21" ON forge.calculation_runs USING btree (tenant_id);


--
-- Name: IDX_f8d326764fd59e8c9a44748081; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f8d326764fd59e8c9a44748081" ON forge.rca_actions USING btree (tenant_id);


--
-- Name: IDX_fa20797ebbcfcbceb893c111c2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fa20797ebbcfcbceb893c111c2" ON forge.accounting_policies USING btree (tenant_id);


--
-- Name: IDX_failure_code_groups_tenant_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_failure_code_groups_tenant_parent" ON forge.failure_code_groups USING btree (tenant_id, parent_id);


--
-- Name: IDX_failure_code_groups_tenant_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_failure_code_groups_tenant_path" ON forge.failure_code_groups USING btree (tenant_id, path);


--
-- Name: IDX_failure_dictionary_entries_tenant_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_failure_dictionary_entries_tenant_kind" ON forge.failure_dictionary_entries USING btree (tenant_id, entry_kind, effective_from);


--
-- Name: IDX_fdb271a23d58c7a948ee730e40; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fdb271a23d58c7a948ee730e40" ON forge.source_hierarchy_mappings USING btree (target_type);


--
-- Name: IDX_feb3331b1d18cafdbf9e96f1f7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_feb3331b1d18cafdbf9e96f1f7" ON forge.custom_attribute_values USING btree (organization_id);


--
-- Name: IDX_ffae41607f1c369f1c87975ce8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ffae41607f1c369f1c87975ce8" ON forge.rca_fmea_analyses USING btree (tenant_id);


--
-- Name: IDX_fx_rates_tenant_type_pair_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fx_rates_tenant_type_pair_from" ON forge.fx_rates USING btree (tenant_id, rate_type, from_currency, to_currency, effective_from);


--
-- Name: IDX_idempotency_keys_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_idempotency_keys_expires_at" ON forge.idempotency_keys USING btree (expires_at);


--
-- Name: IDX_inbox_tenant_scope_received; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_inbox_tenant_scope_received" ON forge.inbox USING btree (tenant_id, scope, received_at);


--
-- Name: IDX_ingestion_exceptions_tenant_state_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ingestion_exceptions_tenant_state_last_seen" ON forge.ingestion_exceptions USING btree (tenant_id, state, last_seen);


--
-- Name: IDX_ingestion_job_transitions_job_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ingestion_job_transitions_job_at" ON forge.ingestion_job_transitions USING btree (job_id, created_at);


--
-- Name: IDX_ingestion_jobs_state_next_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ingestion_jobs_state_next_run" ON forge.ingestion_jobs USING btree (state, next_run_at);


--
-- Name: IDX_ingestion_jobs_tenant_connection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ingestion_jobs_tenant_connection" ON forge.ingestion_jobs USING btree (tenant_id, connection_id);


--
-- Name: IDX_integration_connections_tenant_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_integration_connections_tenant_source" ON forge.integration_connections USING btree (tenant_id, source_type);


--
-- Name: IDX_kpi_results_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_kpi_results_run" ON forge.kpi_results USING btree (run_id);


--
-- Name: IDX_kpi_results_tenant_run_metric; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_kpi_results_tenant_run_metric" ON forge.kpi_results USING btree (tenant_id, run_id, metric);


--
-- Name: IDX_loss_category_defs_tenant_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_loss_category_defs_tenant_parent" ON forge.loss_category_defs USING btree (tenant_id, parent_id);


--
-- Name: IDX_loss_category_defs_tenant_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_loss_category_defs_tenant_path" ON forge.loss_category_defs USING btree (tenant_id, path);


--
-- Name: IDX_loss_line_evidence_event_revision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_loss_line_evidence_event_revision" ON forge.loss_line_evidence USING btree (event_revision_id);


--
-- Name: IDX_loss_line_evidence_line; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_loss_line_evidence_line" ON forge.loss_line_evidence USING btree (loss_line_id);


--
-- Name: IDX_loss_line_evidence_tenant_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_loss_line_evidence_tenant_event" ON forge.loss_line_evidence USING btree (tenant_id, event_id);


--
-- Name: IDX_loss_line_valuations_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_loss_line_valuations_period" ON forge.loss_line_valuations USING btree (period_id);


--
-- Name: IDX_loss_line_valuations_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_loss_line_valuations_run" ON forge.loss_line_valuations USING btree (run_id);


--
-- Name: IDX_loss_line_valuations_tenant_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_loss_line_valuations_tenant_run" ON forge.loss_line_valuations USING btree (tenant_id, run_id);


--
-- Name: IDX_loss_lines_rate_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_loss_lines_rate_version" ON forge.loss_lines USING btree (rate_version_id);


--
-- Name: IDX_loss_lines_revision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_loss_lines_revision" ON forge.loss_lines USING btree (revision_id);


--
-- Name: IDX_loss_lines_run_ledger_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_loss_lines_run_ledger_kind" ON forge.loss_lines USING btree (run_id, ledger, kind);


--
-- Name: IDX_loss_lines_slice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_loss_lines_slice" ON forge.loss_lines USING btree (slice_id);


--
-- Name: IDX_loss_lines_tenant_cause_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_loss_lines_tenant_cause_event" ON forge.loss_lines USING btree (tenant_id, cause_event_id);


--
-- Name: IDX_loss_lines_tenant_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_loss_lines_tenant_period" ON forge.loss_lines USING btree (tenant_id, period_id);


--
-- Name: IDX_lot_dispositions_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_lot_dispositions_event" ON forge.lot_dispositions USING btree (production_event_id) WHERE (production_event_id IS NOT NULL);


--
-- Name: IDX_lot_dispositions_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_lot_dispositions_product" ON forge.lot_dispositions USING btree (product_id);


--
-- Name: IDX_lot_dispositions_recovery_of; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_lot_dispositions_recovery_of" ON forge.lot_dispositions USING btree (recovery_of_id) WHERE (recovery_of_id IS NOT NULL);


--
-- Name: IDX_lot_dispositions_supersedes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_lot_dispositions_supersedes" ON forge.lot_dispositions USING btree (supersedes_id) WHERE (supersedes_id IS NOT NULL);


--
-- Name: IDX_lot_dispositions_tenant_lot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_lot_dispositions_tenant_lot" ON forge.lot_dispositions USING btree (tenant_id, lot_code);


--
-- Name: IDX_lot_dispositions_tenant_unit_production; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_lot_dispositions_tenant_unit_production" ON forge.lot_dispositions USING btree (tenant_id, unit_id, production_start);


--
-- Name: IDX_lot_dispositions_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_lot_dispositions_unit" ON forge.lot_dispositions USING btree (unit_id);


--
-- Name: IDX_measurement_samples_signal_inserted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_measurement_samples_signal_inserted" ON ONLY forge.measurement_samples USING btree (signal_id, inserted_at);


--
-- Name: IDX_month_close_actions_close; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_month_close_actions_close" ON forge.month_close_actions USING btree (month_close_id, created_at);


--
-- Name: IDX_outbox_pending_next_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_outbox_pending_next_attempt" ON forge.outbox USING btree (next_attempt_at, id) WHERE (state = 'pending'::forge.outbox_state);


--
-- Name: IDX_outbox_tenant_aggregate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_outbox_tenant_aggregate" ON forge.outbox USING btree (tenant_id, aggregate_type, aggregate_id);


--
-- Name: IDX_period_change_proposals_approved_revision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_period_change_proposals_approved_revision" ON forge.period_change_proposals USING btree (approved_revision_id);


--
-- Name: IDX_period_change_proposals_created_revision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_period_change_proposals_created_revision" ON forge.period_change_proposals USING btree (created_revision_id);


--
-- Name: IDX_period_change_proposals_tenant_period_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_period_change_proposals_tenant_period_created" ON forge.period_change_proposals USING btree (tenant_id, period_id, created_at);


--
-- Name: IDX_period_data_holds_tenant_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_period_data_holds_tenant_period" ON forge.period_data_holds USING btree (tenant_id, period_id);


--
-- Name: IDX_period_ledger_totals_slice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_period_ledger_totals_slice" ON forge.period_ledger_totals USING btree (slice_id);


--
-- Name: IDX_period_ledger_totals_tenant_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_period_ledger_totals_tenant_period" ON forge.period_ledger_totals USING btree (tenant_id, period_id);


--
-- Name: IDX_period_product_slices_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_period_product_slices_period" ON forge.period_product_slices USING btree (period_id);


--
-- Name: IDX_period_product_slices_plan_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_period_product_slices_plan_period" ON forge.period_product_slices USING btree (plan_period_id);


--
-- Name: IDX_period_product_slices_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_period_product_slices_policy" ON forge.period_product_slices USING btree (actuals_policy_id);


--
-- Name: IDX_period_product_slices_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_period_product_slices_product" ON forge.period_product_slices USING btree (product_id);


--
-- Name: IDX_period_product_slices_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_period_product_slices_profile" ON forge.period_product_slices USING btree (profile_id);


--
-- Name: IDX_period_valuation_totals_tenant_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_period_valuation_totals_tenant_period" ON forge.period_valuation_totals USING btree (tenant_id, period_id);


--
-- Name: IDX_pi_open_frames_connection_polled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_pi_open_frames_connection_polled" ON forge.pi_open_frames USING btree (connection_id, last_polled_at);


--
-- Name: IDX_pi_page_manifests_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_pi_page_manifests_tenant" ON forge.pi_page_manifests USING btree (tenant_id);


--
-- Name: IDX_pi_sync_job_links_ingestion_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_pi_sync_job_links_ingestion_job" ON forge.pi_sync_job_links USING btree (ingestion_job_id);


--
-- Name: IDX_plan_generation_jobs_state_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_generation_jobs_state_created" ON forge.plan_generation_jobs USING btree (state, created_at);


--
-- Name: IDX_plan_generation_jobs_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_generation_jobs_version" ON forge.plan_generation_jobs USING btree (plan_version_id);


--
-- Name: IDX_plan_periods_planning_rate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_periods_planning_rate" ON forge.plan_periods USING btree (planning_rate_version_id);


--
-- Name: IDX_plan_periods_shift_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_periods_shift_instance" ON forge.plan_periods USING btree (shift_instance_id);


--
-- Name: IDX_plan_periods_slice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_periods_slice" ON forge.plan_periods USING btree (slice_id);


--
-- Name: IDX_plan_periods_sustained_rate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_periods_sustained_rate" ON forge.plan_periods USING btree (sustained_rate_version_id);


--
-- Name: IDX_plan_periods_tenant_unit_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_periods_tenant_unit_start" ON forge.plan_periods USING btree (tenant_id, unit_id, utc_start);


--
-- Name: IDX_plan_periods_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_periods_unit" ON forge.plan_periods USING btree (unit_id);


--
-- Name: IDX_plan_product_slices_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_product_slices_product" ON forge.plan_product_slices USING btree (product_id);


--
-- Name: IDX_plan_product_slices_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_product_slices_profile" ON forge.plan_product_slices USING btree (profile_id);


--
-- Name: IDX_plan_product_slices_scenario_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_product_slices_scenario_unit" ON forge.plan_product_slices USING btree (scenario_id, unit_id);


--
-- Name: IDX_plan_versions_calendar_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_versions_calendar_version" ON forge.plan_versions USING btree (calendar_version_id);


--
-- Name: IDX_plan_versions_scenario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_versions_scenario" ON forge.plan_versions USING btree (scenario_id);


--
-- Name: IDX_plan_versions_supersedes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_versions_supersedes" ON forge.plan_versions USING btree (supersedes_version_id);


--
-- Name: IDX_plan_versions_tenant_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_versions_tenant_unit" ON forge.plan_versions USING btree (tenant_id, unit_id);


--
-- Name: IDX_plan_versions_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plan_versions_unit" ON forge.plan_versions USING btree (unit_id);


--
-- Name: IDX_plant_flow_routes_tenant_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plant_flow_routes_tenant_from" ON forge.plant_flow_routes USING btree (tenant_id, from_unit_id);


--
-- Name: IDX_plant_flow_routes_tenant_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_plant_flow_routes_tenant_to" ON forge.plant_flow_routes USING btree (tenant_id, to_unit_id);


--
-- Name: IDX_production_day_certifications_tenant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_day_certifications_tenant_date" ON forge.production_day_certifications USING btree (tenant_id, local_date);


--
-- Name: IDX_production_day_certifications_unit_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_day_certifications_unit_date" ON forge.production_day_certifications USING btree (unit_id, local_date);


--
-- Name: IDX_production_events_declared; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_declared" ON forge.production_events USING btree (tenant_id, unit_id, start_time) WHERE ((declared_figures IS NOT NULL) AND (retracted_at IS NULL));


--
-- Name: IDX_production_events_from_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_from_product" ON forge.production_events USING btree (from_product_id) WHERE (from_product_id IS NOT NULL);


--
-- Name: IDX_production_events_impact_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_impact_code" ON forge.production_events USING btree (impact_code_id) WHERE (impact_code_id IS NOT NULL);


--
-- Name: IDX_production_events_lot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_lot" ON forge.production_events USING btree (tenant_id, lot_code) WHERE (lot_code IS NOT NULL);


--
-- Name: IDX_production_events_oee_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_oee_code" ON forge.production_events USING btree (oee_code_id) WHERE (oee_code_id IS NOT NULL);


--
-- Name: IDX_production_events_open_by_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_open_by_unit" ON forge.production_events USING btree (tenant_id, unit_id) WHERE (end_time IS NULL);


--
-- Name: IDX_production_events_open_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_open_start" ON forge.production_events USING btree (start_time, id) WHERE ((end_time IS NULL) AND (physical_state = 'open'::forge.production_event_physical_state));


--
-- Name: IDX_production_events_origin_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_origin_asset" ON forge.production_events USING btree (origin_asset_id) WHERE (origin_asset_id IS NOT NULL);


--
-- Name: IDX_production_events_origin_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_origin_unit" ON forge.production_events USING btree (origin_unit_id) WHERE (origin_unit_id IS NOT NULL);


--
-- Name: IDX_production_events_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_plan" ON forge.production_events USING btree (plan_id) WHERE (plan_id IS NOT NULL);


--
-- Name: IDX_production_events_rca; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_rca" ON forge.production_events USING btree (rca_id) WHERE (rca_id IS NOT NULL);


--
-- Name: IDX_production_events_recovery_of; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_recovery_of" ON forge.production_events USING btree (recovery_of_event_id) WHERE (recovery_of_event_id IS NOT NULL);


--
-- Name: IDX_production_events_tenant_asset_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_tenant_asset_start" ON forge.production_events USING btree (tenant_id, asset_id, start_time);


--
-- Name: IDX_production_events_tenant_duration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_tenant_duration" ON forge.production_events USING btree (tenant_id, COALESCE(duration_seconds, 'Infinity'::numeric), id);


--
-- Name: IDX_production_events_tenant_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_tenant_event_id" ON forge.production_events USING btree (tenant_id, event_id) WHERE (event_id IS NOT NULL);


--
-- Name: IDX_production_events_tenant_occurrence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_tenant_occurrence" ON forge.production_events USING btree (tenant_id, occurrence_id);


--
-- Name: IDX_production_events_tenant_reason_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_tenant_reason_start" ON forge.production_events USING btree (tenant_id, reason_code_id, start_time);


--
-- Name: IDX_production_events_tenant_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_tenant_start" ON forge.production_events USING btree (tenant_id, start_time, id);


--
-- Name: IDX_production_events_tenant_type_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_tenant_type_start" ON forge.production_events USING btree (tenant_id, physical_type, start_time);


--
-- Name: IDX_production_events_tenant_unit_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_tenant_unit_start" ON forge.production_events USING btree (tenant_id, unit_id, start_time);


--
-- Name: IDX_production_events_tenant_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_tenant_verified" ON forge.production_events USING btree (tenant_id, start_time, id) WHERE (verified_at IS NOT NULL);


--
-- Name: IDX_production_events_to_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_to_product" ON forge.production_events USING btree (to_product_id) WHERE (to_product_id IS NOT NULL);


--
-- Name: IDX_production_events_uncoded_stops; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_uncoded_stops" ON forge.production_events USING btree (tenant_id, end_time) WHERE ((physical_type = 'downtime'::forge.production_event_physical_type) AND (coding_state = 'uncoded'::forge.production_event_coding_state) AND (physical_state = 'closed'::forge.production_event_physical_state));


--
-- Name: IDX_production_events_unit_span; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_unit_span" ON forge.production_events USING gist (unit_id, tstzrange(start_time, end_time, '[)'::text)) WHERE (physical_state = ANY (ARRAY['open'::forge.production_event_physical_state, 'closed'::forge.production_event_physical_state]));


--
-- Name: IDX_production_events_unverified_stops; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_events_unverified_stops" ON forge.production_events USING btree (tenant_id, unit_id, start_time) WHERE ((physical_type = 'downtime'::forge.production_event_physical_type) AND (verified_at IS NULL));


--
-- Name: IDX_production_periods_current_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_periods_current_run" ON forge.production_periods USING btree (current_actuals_run_id);


--
-- Name: IDX_production_periods_plan_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_periods_plan_version" ON forge.production_periods USING btree (selected_plan_version_id);


--
-- Name: IDX_production_periods_shift_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_periods_shift_instance" ON forge.production_periods USING btree (shift_instance_id);


--
-- Name: IDX_production_periods_tenant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_periods_tenant_date" ON forge.production_periods USING btree (tenant_id, local_date);


--
-- Name: IDX_production_periods_tenant_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_periods_tenant_start" ON forge.production_periods USING btree (tenant_id, utc_start);


--
-- Name: IDX_production_periods_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_periods_unit" ON forge.production_periods USING btree (unit_id);


--
-- Name: IDX_production_plans_product_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_plans_product_ref" ON forge.production_plans USING btree (product_ref_id);


--
-- Name: IDX_production_plans_scenario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_plans_scenario" ON forge.production_plans USING btree (scenario_id);


--
-- Name: IDX_production_plans_unit_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_plans_unit_ref" ON forge.production_plans USING btree (unit_ref_id);


--
-- Name: IDX_production_profiles_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_profiles_product" ON forge.production_profiles USING btree (product_id);


--
-- Name: IDX_production_profiles_tenant_unit_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_production_profiles_tenant_unit_product" ON forge.production_profiles USING btree (tenant_id, unit_id, product_id);


--
-- Name: IDX_products_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_products_organization" ON forge.products USING btree (organization_id);


--
-- Name: IDX_rate_imports_state_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rate_imports_state_created" ON forge.rate_imports USING btree (state, created_at);


--
-- Name: IDX_raw_observations_replay_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_raw_observations_replay_run" ON ONLY forge.raw_observations USING btree (replay_run_id);


--
-- Name: IDX_raw_observations_tenant_connection_received; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_raw_observations_tenant_connection_received" ON ONLY forge.raw_observations USING btree (tenant_id, connection_id, received_at);


--
-- Name: IDX_raw_observations_tenant_object_received; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_raw_observations_tenant_object_received" ON ONLY forge.raw_observations USING btree (tenant_id, source_object_id, received_at);


--
-- Name: IDX_rca_actions_tenant_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_actions_tenant_due" ON forge.rca_actions USING btree (tenant_id, due_date, id);


--
-- Name: IDX_rca_actions_tenant_owner_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_actions_tenant_owner_due" ON forge.rca_actions USING btree (tenant_id, owner_id, due_date, id);


--
-- Name: IDX_rca_actions_tenant_rca; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_actions_tenant_rca" ON forge.rca_actions USING btree (tenant_id, rca_id);


--
-- Name: IDX_rca_actions_tenant_rca_recommendation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_actions_tenant_rca_recommendation" ON forge.rca_actions USING btree (tenant_id, rca_id, recommendation_id);


--
-- Name: IDX_rca_actions_verification_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_actions_verification_due" ON forge.rca_actions USING btree (tenant_id, verification_window_end);


--
-- Name: IDX_rca_case_links_tenant_rca; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_case_links_tenant_rca" ON forge.rca_case_links USING btree (tenant_id, rca_id);


--
-- Name: IDX_rca_case_links_tenant_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_case_links_tenant_target" ON forge.rca_case_links USING btree (tenant_id, link_type, target_id);


--
-- Name: IDX_rca_case_links_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_case_links_unit" ON forge.rca_case_links USING btree (unit_id);


--
-- Name: IDX_rca_cause_codes_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_cause_codes_tenant_code" ON forge.rca_cause_codes USING btree (tenant_id, code);


--
-- Name: IDX_rca_causes_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_causes_tenant_code" ON forge.rca_causes USING btree (tenant_id, cause_code_id);


--
-- Name: IDX_rca_causes_tenant_rca; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_causes_tenant_rca" ON forge.rca_causes USING btree (tenant_id, rca_id);


--
-- Name: IDX_rca_knowledge_base_shared; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_knowledge_base_shared" ON forge.rca_knowledge_base USING btree (shared_at DESC, id DESC) WHERE ((share_scope)::text = 'organization'::text);


--
-- Name: IDX_rca_knowledge_base_tenant_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_knowledge_base_tenant_asset" ON forge.rca_knowledge_base USING btree (tenant_id, asset_id);


--
-- Name: IDX_rca_knowledge_base_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_knowledge_base_tenant_created" ON forge.rca_knowledge_base USING btree (tenant_id, created_at, id);


--
-- Name: IDX_rca_knowledge_base_tenant_rca; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_knowledge_base_tenant_rca" ON forge.rca_knowledge_base USING btree (tenant_id, rca_id);


--
-- Name: IDX_rca_knowledge_base_tenant_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_knowledge_base_tenant_unit" ON forge.rca_knowledge_base USING btree (tenant_id, unit_id);


--
-- Name: IDX_rca_templates_tenant_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_templates_tenant_name" ON forge.rca_templates USING btree (tenant_id, template_name);


--
-- Name: IDX_rca_trigger_evaluations_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_trigger_evaluations_event" ON forge.rca_trigger_evaluations USING btree (tenant_id, event_id);


--
-- Name: IDX_rca_trigger_evaluations_rca; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_trigger_evaluations_rca" ON forge.rca_trigger_evaluations USING btree (tenant_id, rca_id, trigger);


--
-- Name: IDX_rca_trigger_evaluations_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_trigger_evaluations_state" ON forge.rca_trigger_evaluations USING btree (tenant_id, state, fired_at);


--
-- Name: IDX_rca_trigger_evaluations_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rca_trigger_evaluations_unit" ON forge.rca_trigger_evaluations USING btree (unit_id);


--
-- Name: IDX_rcas_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rcas_tenant" ON forge.rcas USING btree (tenant_id);


--
-- Name: IDX_rcas_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rcas_tenant_created" ON forge.rcas USING btree (tenant_id, created_at);


--
-- Name: IDX_rcas_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rcas_unit" ON forge.rcas USING btree (unit_id);


--
-- Name: IDX_reason_codes_tenant_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_reason_codes_tenant_parent" ON forge.reason_codes USING btree (tenant_id, parent_id);


--
-- Name: IDX_reason_codes_tenant_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_reason_codes_tenant_path" ON forge.reason_codes USING btree (tenant_id, path);


--
-- Name: IDX_reconciliation_line_sets_base_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_reconciliation_line_sets_base_run" ON forge.reconciliation_line_sets USING btree (base_run_id);


--
-- Name: IDX_reconciliation_line_sets_tenant_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_reconciliation_line_sets_tenant_period" ON forge.reconciliation_line_sets USING btree (tenant_id, period_id);


--
-- Name: IDX_reconciliation_lines_adjustment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_reconciliation_lines_adjustment" ON forge.reconciliation_lines USING btree (adjustment_id);


--
-- Name: IDX_reconciliation_lines_reverses_line; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_reconciliation_lines_reverses_line" ON forge.reconciliation_lines USING btree (reverses_line_id) WHERE (reverses_line_id IS NOT NULL);


--
-- Name: IDX_reconciliation_lines_set; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_reconciliation_lines_set" ON forge.reconciliation_lines USING btree (line_set_id);


--
-- Name: IDX_reconciliation_lines_slice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_reconciliation_lines_slice" ON forge.reconciliation_lines USING btree (slice_id);


--
-- Name: IDX_reconciliation_lines_tenant_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_reconciliation_lines_tenant_period" ON forge.reconciliation_lines USING btree (tenant_id, period_id);


--
-- Name: IDX_replay_runs_state_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_replay_runs_state_created" ON forge.replay_runs USING btree (state, created_at);


--
-- Name: IDX_replay_runs_tenant_connection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_replay_runs_tenant_connection" ON forge.replay_runs USING btree (tenant_id, connection_id);


--
-- Name: IDX_restatement_postings_tenant_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_restatement_postings_tenant_period" ON forge.restatement_postings USING btree (tenant_id, period_id);


--
-- Name: IDX_role_delegations_delegate_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_role_delegations_delegate_until" ON forge.role_delegations USING btree (delegate_id, valid_until);


--
-- Name: IDX_role_delegations_delegator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_role_delegations_delegator" ON forge.role_delegations USING btree (delegator_id);


--
-- Name: IDX_role_delegations_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_role_delegations_tenant_created" ON forge.role_delegations USING btree (tenant_id, created_at, id);


--
-- Name: IDX_rule_runs_tenant_rule_ran; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rule_runs_tenant_rule_ran" ON forge.rule_runs USING btree (tenant_id, rule_id, ran_at);


--
-- Name: IDX_rule_versions_tenant_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rule_versions_tenant_rule" ON forge.rule_versions USING btree (tenant_id, rule_id);


--
-- Name: IDX_rules_tenant_kind_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_rules_tenant_kind_state" ON forge.rules USING btree (tenant_id, kind, state);


--
-- Name: IDX_shift_instances_calendar_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_shift_instances_calendar_version" ON forge.shift_instances USING btree (calendar_version_id);


--
-- Name: IDX_shift_instances_crew; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_shift_instances_crew" ON forge.shift_instances USING btree (crew_id);


--
-- Name: IDX_shift_instances_tenant_unit_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_shift_instances_tenant_unit_date" ON forge.shift_instances USING btree (tenant_id, unit_id, local_date);


--
-- Name: IDX_shift_notes_tenant_unit_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_shift_notes_tenant_unit_shift" ON forge.shift_notes USING btree (tenant_id, unit_id, local_date, shift_name);


--
-- Name: IDX_signal_backfill_runs_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_signal_backfill_runs_job" ON forge.signal_backfill_runs USING btree (ingestion_job_id);


--
-- Name: IDX_signal_backfill_runs_tenant_signal_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_signal_backfill_runs_tenant_signal_created" ON forge.signal_backfill_runs USING btree (tenant_id, signal_id, created_at);


--
-- Name: IDX_signal_summaries_tenant_signal_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_signal_summaries_tenant_signal_period" ON forge.signal_summaries USING btree (tenant_id, signal_id, period_start);


--
-- Name: IDX_signals_tenant_connection_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_signals_tenant_connection_source" ON forge.signals USING btree (tenant_id, connection_id, source_key, effective_from);


--
-- Name: IDX_signals_tenant_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_signals_tenant_unit" ON forge.signals USING btree (tenant_id, unit_id);


--
-- Name: IDX_source_mappings_legacy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_source_mappings_legacy" ON forge.source_mappings USING btree (legacy_mapping_id);


--
-- Name: IDX_source_mappings_tenant_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_source_mappings_tenant_kind" ON forge.source_mappings USING btree (tenant_id, match_kind);


--
-- Name: IDX_source_objects_canonical_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_source_objects_canonical_event" ON forge.source_objects USING btree (canonical_event_id);


--
-- Name: IDX_source_objects_tenant_connection_observed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_source_objects_tenant_connection_observed" ON forge.source_objects USING btree (tenant_id, connection_id, latest_observed_at);


--
-- Name: IDX_source_status_mappings_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_source_status_mappings_lookup" ON forge.source_status_mappings USING btree (tenant_id, source_system, effective_from);


--
-- Name: IDX_standby_equipment_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_standby_equipment_unit" ON forge.standby_equipment USING btree (unit_id);


--
-- Name: IDX_standby_records_tenant_asset_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_standby_records_tenant_asset_start" ON forge.standby_records USING btree (tenant_id, asset_id, started_at);


--
-- Name: IDX_standby_records_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_standby_records_unit" ON forge.standby_records USING btree (unit_id);


--
-- Name: IDX_stop_incident_members_incident; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_stop_incident_members_incident" ON forge.stop_incident_members USING btree (incident_id);


--
-- Name: IDX_stop_incidents_tenant_unit_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_stop_incidents_tenant_unit_start" ON forge.stop_incidents USING btree (tenant_id, unit_id, start_time);


--
-- Name: IDX_stop_reconciliations_tenant_evidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_stop_reconciliations_tenant_evidence" ON forge.stop_reconciliations USING btree (tenant_id, evidence_event_id);


--
-- Name: IDX_stop_reconciliations_tenant_unit_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_stop_reconciliations_tenant_unit_state" ON forge.stop_reconciliations USING btree (tenant_id, unit_id, state);


--
-- Name: IDX_stream_runs_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_stream_runs_product" ON forge.stream_runs USING btree (product_id);


--
-- Name: IDX_stream_runs_tenant_unit_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_stream_runs_tenant_unit_start" ON forge.stream_runs USING btree (tenant_id, unit_id, start_time);


--
-- Name: IDX_tasks_tenant_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_tasks_tenant_assignee" ON forge.tasks USING btree (tenant_id, assigned_to);


--
-- Name: IDX_tasks_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_tasks_tenant_created" ON forge.tasks USING btree (tenant_id, created_at);


--
-- Name: IDX_tasks_tenant_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_tasks_tenant_due" ON forge.tasks USING btree (tenant_id, due_date, id);


--
-- Name: IDX_tasks_tenant_rca_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_tasks_tenant_rca_action" ON forge.tasks USING btree (tenant_id, rca_action_id);


--
-- Name: IDX_transition_standards_from_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_transition_standards_from_product" ON forge.transition_standards USING btree (from_product_id);


--
-- Name: IDX_transition_standards_tenant_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_transition_standards_tenant_unit" ON forge.transition_standards USING btree (tenant_id, unit_id);


--
-- Name: IDX_transition_standards_to_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_transition_standards_to_product" ON forge.transition_standards USING btree (to_product_id);


--
-- Name: IDX_uncertainty_budgets_tenant_unit_boundary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_uncertainty_budgets_tenant_unit_boundary" ON forge.uncertainty_budgets USING btree (tenant_id, unit_id, boundary, effective_from);


--
-- Name: IDX_uncertainty_budgets_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_uncertainty_budgets_unit" ON forge.uncertainty_budgets USING btree (unit_id);


--
-- Name: IDX_unit_impact_rules_standby; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_unit_impact_rules_standby" ON forge.unit_impact_rules USING btree (standby_asset_id) WHERE (standby_asset_id IS NOT NULL);


--
-- Name: IDX_unit_impact_rules_tenant_unit_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_unit_impact_rules_tenant_unit_asset" ON forge.unit_impact_rules USING btree (tenant_id, unit_id, asset_id);


--
-- Name: IDX_unit_product_rates_import; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_unit_product_rates_import" ON forge.unit_product_rates USING btree (rate_import_id);


--
-- Name: IDX_unit_product_rates_tenant_kind_external; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_unit_product_rates_tenant_kind_external" ON forge.unit_product_rates USING btree (tenant_id, rate_kind, external_id);


--
-- Name: IDX_unit_state_mappings_tenant_unit_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_unit_state_mappings_tenant_unit_from" ON forge.unit_state_mappings USING btree (tenant_id, unit_id, effective_from);


--
-- Name: IDX_unit_streams_tenant_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_unit_streams_tenant_unit" ON forge.unit_streams USING btree (tenant_id, unit_id);


--
-- Name: IDX_units_site_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_units_site_id" ON forge.units USING btree (site_id);


--
-- Name: IDX_user_notifications_open_work; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_user_notifications_open_work" ON forge.user_notifications USING btree (tenant_id, kind) WHERE ((resolved_at IS NULL) AND (work_item_key IS NOT NULL));


--
-- Name: IDX_user_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_user_notifications_user" ON forge.user_notifications USING btree (user_id);


--
-- Name: IDX_user_notifications_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_user_notifications_user_active" ON forge.user_notifications USING btree (tenant_id, user_id, created_at, id) WHERE (resolved_at IS NULL);


--
-- Name: IDX_user_notifications_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_user_notifications_user_created" ON forge.user_notifications USING btree (tenant_id, user_id, created_at, id);


--
-- Name: IDX_user_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_user_notifications_user_unread" ON forge.user_notifications USING btree (tenant_id, user_id) WHERE ((read_at IS NULL) AND (resolved_at IS NULL));


--
-- Name: IDX_user_scopes_tenant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_user_scopes_tenant_user" ON forge.user_scopes USING btree (tenant_id, user_id);


--
-- Name: IDX_user_scopes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_user_scopes_user" ON forge.user_scopes USING btree (user_id);


--
-- Name: IDX_users_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_users_email_lower" ON forge.users USING btree (lower((email)::text));


--
-- Name: IDX_users_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_users_organization" ON forge.users USING btree (organization_id);


--
-- Name: IDX_users_tenant_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_users_tenant_name" ON forge.users USING btree (tenant_id, name, id);


--
-- Name: IDX_valuation_rates_impact_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_valuation_rates_impact_code" ON forge.valuation_rates USING btree (impact_code_id);


--
-- Name: IDX_valuation_rates_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_valuation_rates_profile" ON forge.valuation_rates USING btree (profile_id);


--
-- Name: IDX_verification_status_codes_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_verification_status_codes_tenant_code" ON forge.verification_status_codes USING btree (tenant_id, code);


--
-- Name: IDX_work_order_operations_tenant_asset_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_work_order_operations_tenant_asset_start" ON forge.work_order_operations USING btree (tenant_id, asset_id, started_at);


--
-- Name: IDX_work_order_operations_tenant_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_work_order_operations_tenant_event" ON forge.work_order_operations USING btree (tenant_id, event_id);


--
-- Name: UQ_accounting_revisions_period_open; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_accounting_revisions_period_open" ON forge.accounting_revisions USING btree (period_id) WHERE (lifecycle = ANY (ARRAY['draft'::forge.accounting_revision_lifecycle, 'in_review'::forge.accounting_revision_lifecycle]));


--
-- Name: UQ_actuals_jobs_queued_period; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_actuals_jobs_queued_period" ON forge.actuals_jobs USING btree (period_id) WHERE ((state = 'queued'::forge.actuals_job_state) AND (kind = 'recompute'::forge.actuals_job_kind));


--
-- Name: UQ_approval_snapshots_revision; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_approval_snapshots_revision" ON forge.approval_snapshots USING btree (revision_id);


--
-- Name: UQ_calendar_versions_site_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_calendar_versions_site_version" ON forge.calendar_versions USING btree (site_id, version) WHERE (unit_id IS NULL);


--
-- Name: UQ_calendar_versions_unit_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_calendar_versions_unit_version" ON forge.calendar_versions USING btree (unit_id, version) WHERE (unit_id IS NOT NULL);


--
-- Name: UQ_crews_site_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_crews_site_name" ON forge.crews USING btree (site_id, name);


--
-- Name: UQ_event_impacts_event; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_event_impacts_event" ON forge.event_impacts USING btree (event_id);


--
-- Name: UQ_export_job_sources_job_position; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_export_job_sources_job_position" ON forge.export_job_sources USING btree (export_job_id, "position");


--
-- Name: UQ_failure_dictionary_entries_current; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_failure_dictionary_entries_current" ON forge.failure_dictionary_entries USING btree (tenant_id, entry_kind, equipment_class, code) WHERE (effective_to IS NULL);


--
-- Name: UQ_feature_flags_tenant_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_feature_flags_tenant_key" ON forge.feature_flags USING btree (tenant_id, key);


--
-- Name: UQ_ingestion_exceptions_open_object_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_ingestion_exceptions_open_object_code" ON forge.ingestion_exceptions USING btree (tenant_id, connection_id, source_object_id, error_code) WHERE (state = 'open'::forge.ingestion_exception_state);


--
-- Name: UQ_ingestion_jobs_connection_scope_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_ingestion_jobs_connection_scope_active" ON forge.ingestion_jobs USING btree (connection_id, scope_hash) WHERE (state <> 'stopped'::forge.ingestion_job_state);


--
-- Name: UQ_loss_lines_run_auto_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_loss_lines_run_auto_key" ON forge.loss_lines USING btree (run_id, auto_key) WHERE (auto_key IS NOT NULL);


--
-- Name: UQ_period_change_proposals_open; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_period_change_proposals_open" ON forge.period_change_proposals USING btree (approved_revision_id) WHERE (state = 'open'::forge.period_change_proposal_state);


--
-- Name: UQ_period_data_holds_open; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_period_data_holds_open" ON forge.period_data_holds USING btree (period_id) WHERE (ended_at IS NULL);


--
-- Name: UQ_period_product_slices_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_period_product_slices_active" ON forge.period_product_slices USING btree (period_id, product_id, window_from) WHERE (superseded_at IS NULL);


--
-- Name: UQ_plan_scenarios_tenant_baseline; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_plan_scenarios_tenant_baseline" ON forge.plan_scenarios USING btree (tenant_id) WHERE is_accounting_baseline;


--
-- Name: UQ_plan_versions_plan_approved; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_plan_versions_plan_approved" ON forge.plan_versions USING btree (plan_id) WHERE (approval_state = 'approved'::forge.plan_version_approval_state);


--
-- Name: UQ_plan_versions_plan_open; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_plan_versions_plan_open" ON forge.plan_versions USING btree (plan_id) WHERE (approval_state = ANY (ARRAY['draft'::forge.plan_version_approval_state, 'submitted'::forge.plan_version_approval_state]));


--
-- Name: UQ_production_day_certifications_certified; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_production_day_certifications_certified" ON forge.production_day_certifications USING btree (unit_id, local_date) WHERE ((state)::text = 'certified'::text);


--
-- Name: UQ_rca_knowledge_votes_entry_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_rca_knowledge_votes_entry_user" ON forge.rca_knowledge_votes USING btree (entry_id, user_id);


--
-- Name: UQ_restatement_postings_revision; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_restatement_postings_revision" ON forge.restatement_postings USING btree (revision_id);


--
-- Name: UQ_signals_current_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_signals_current_source" ON forge.signals USING btree (tenant_id, connection_id, source_key) WHERE (effective_to IS NULL);


--
-- Name: UQ_sites_default_per_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_sites_default_per_tenant" ON forge.sites USING btree (tenant_id) WHERE is_default;


--
-- Name: UQ_sites_tenant_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_sites_tenant_name" ON forge.sites USING btree (tenant_id, name);


--
-- Name: UQ_source_mappings_active_any_connection; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_source_mappings_active_any_connection" ON forge.source_mappings USING btree (tenant_id, source_system, match_kind, normalized_value) WHERE (is_active AND (connection_id IS NULL));


--
-- Name: UQ_source_mappings_active_connection; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_source_mappings_active_connection" ON forge.source_mappings USING btree (tenant_id, source_system, connection_id, match_kind, normalized_value) WHERE (is_active AND (connection_id IS NOT NULL));


--
-- Name: UQ_standby_equipment_current; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_standby_equipment_current" ON forge.standby_equipment USING btree (tenant_id, asset_id) WHERE (effective_to IS NULL);


--
-- Name: UQ_standby_records_external_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_standby_records_external_ref" ON forge.standby_records USING btree (tenant_id, external_ref) WHERE (external_ref IS NOT NULL);


--
-- Name: UQ_state_engine_cursors_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_state_engine_cursors_unit" ON forge.state_engine_cursors USING btree (tenant_id, unit_id);


--
-- Name: UQ_stop_incident_breaks_occurrence; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_stop_incident_breaks_occurrence" ON forge.stop_incident_breaks USING btree (tenant_id, occurrence_id);


--
-- Name: UQ_stop_incident_members_occurrence; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_stop_incident_members_occurrence" ON forge.stop_incident_members USING btree (tenant_id, occurrence_id);


--
-- Name: UQ_stop_incidents_first_occurrence; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_stop_incidents_first_occurrence" ON forge.stop_incidents USING btree (tenant_id, first_occurrence_id);


--
-- Name: UQ_stop_reconciliations_pair; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_stop_reconciliations_pair" ON forge.stop_reconciliations USING btree (tenant_id, kept_event_id, evidence_event_id);


--
-- Name: UQ_stream_runs_lot; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_stream_runs_lot" ON forge.stream_runs USING btree (tenant_id, lot_code) WHERE (lot_code IS NOT NULL);


--
-- Name: UQ_tasks_open_rca_action; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_tasks_open_rca_action" ON forge.tasks USING btree (rca_action_id) WHERE ((rca_action_id IS NOT NULL) AND ((status)::text = ANY ((ARRAY['Open'::character varying, 'In Progress'::character varying])::text[])));


--
-- Name: UQ_transition_standards_key_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_transition_standards_key_version" ON forge.transition_standards USING btree (unit_id, from_product_id, to_product_id, COALESCE(catalyst_family, ''::character varying), COALESCE(operating_mode, ''::character varying), version);


--
-- Name: UQ_uncertainty_budgets_open; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_uncertainty_budgets_open" ON forge.uncertainty_budgets USING btree (tenant_id, unit_id, boundary) WHERE (((state)::text = 'approved'::text) AND (effective_to IS NULL));


--
-- Name: UQ_unit_state_mappings_current; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_unit_state_mappings_current" ON forge.unit_state_mappings USING btree (tenant_id, unit_id) WHERE (effective_to IS NULL);


--
-- Name: UQ_user_notifications_user_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_user_notifications_user_key" ON forge.user_notifications USING btree (tenant_id, user_id, dedupe_key);


--
-- Name: UQ_work_order_operations_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_work_order_operations_operation" ON forge.work_order_operations USING btree (tenant_id, work_order_id, operation_id);


--
-- Name: raw_observations_y2026m09_replay_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_observations_y2026m09_replay_run_id_idx ON forge.raw_observations_y2026m09 USING btree (replay_run_id);


--
-- Name: raw_observations_y2026m09_tenant_id_connection_id_received__idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_observations_y2026m09_tenant_id_connection_id_received__idx ON forge.raw_observations_y2026m09 USING btree (tenant_id, connection_id, received_at);


--
-- Name: raw_observations_y2026m09_tenant_id_source_object_id_receiv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_observations_y2026m09_tenant_id_source_object_id_receiv_idx ON forge.raw_observations_y2026m09 USING btree (tenant_id, source_object_id, received_at);


--
-- Name: raw_observations_y2026m10_replay_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_observations_y2026m10_replay_run_id_idx ON forge.raw_observations_y2026m10 USING btree (replay_run_id);


--
-- Name: raw_observations_y2026m10_tenant_id_connection_id_received__idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_observations_y2026m10_tenant_id_connection_id_received__idx ON forge.raw_observations_y2026m10 USING btree (tenant_id, connection_id, received_at);


--
-- Name: raw_observations_y2026m10_tenant_id_source_object_id_receiv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_observations_y2026m10_tenant_id_source_object_id_receiv_idx ON forge.raw_observations_y2026m10 USING btree (tenant_id, source_object_id, received_at);


--
-- Name: raw_observations_y2026m11_replay_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_observations_y2026m11_replay_run_id_idx ON forge.raw_observations_y2026m11 USING btree (replay_run_id);


--
-- Name: raw_observations_y2026m11_tenant_id_connection_id_received__idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_observations_y2026m11_tenant_id_connection_id_received__idx ON forge.raw_observations_y2026m11 USING btree (tenant_id, connection_id, received_at);


--
-- Name: raw_observations_y2026m11_tenant_id_source_object_id_receiv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_observations_y2026m11_tenant_id_source_object_id_receiv_idx ON forge.raw_observations_y2026m11 USING btree (tenant_id, source_object_id, received_at);


--
-- Name: raw_observations_y2026m12_replay_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_observations_y2026m12_replay_run_id_idx ON forge.raw_observations_y2026m12 USING btree (replay_run_id);


--
-- Name: raw_observations_y2026m12_tenant_id_connection_id_received__idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_observations_y2026m12_tenant_id_connection_id_received__idx ON forge.raw_observations_y2026m12 USING btree (tenant_id, connection_id, received_at);


--
-- Name: raw_observations_y2026m12_tenant_id_source_object_id_receiv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raw_observations_y2026m12_tenant_id_source_object_id_receiv_idx ON forge.raw_observations_y2026m12 USING btree (tenant_id, source_object_id, received_at);


--
-- Name: raw_observations_y2026m09_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."PK_a75cc6d8710913a02fefb609f97" ATTACH PARTITION forge.raw_observations_y2026m09_pkey;


--
-- Name: raw_observations_y2026m09_replay_run_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."IDX_raw_observations_replay_run" ATTACH PARTITION forge.raw_observations_y2026m09_replay_run_id_idx;


--
-- Name: raw_observations_y2026m09_tenant_id_connection_id_received__idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."IDX_raw_observations_tenant_connection_received" ATTACH PARTITION forge.raw_observations_y2026m09_tenant_id_connection_id_received__idx;


--
-- Name: raw_observations_y2026m09_tenant_id_source_object_id_receiv_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."IDX_raw_observations_tenant_object_received" ATTACH PARTITION forge.raw_observations_y2026m09_tenant_id_source_object_id_receiv_idx;


--
-- Name: raw_observations_y2026m10_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."PK_a75cc6d8710913a02fefb609f97" ATTACH PARTITION forge.raw_observations_y2026m10_pkey;


--
-- Name: raw_observations_y2026m10_replay_run_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."IDX_raw_observations_replay_run" ATTACH PARTITION forge.raw_observations_y2026m10_replay_run_id_idx;


--
-- Name: raw_observations_y2026m10_tenant_id_connection_id_received__idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."IDX_raw_observations_tenant_connection_received" ATTACH PARTITION forge.raw_observations_y2026m10_tenant_id_connection_id_received__idx;


--
-- Name: raw_observations_y2026m10_tenant_id_source_object_id_receiv_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."IDX_raw_observations_tenant_object_received" ATTACH PARTITION forge.raw_observations_y2026m10_tenant_id_source_object_id_receiv_idx;


--
-- Name: raw_observations_y2026m11_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."PK_a75cc6d8710913a02fefb609f97" ATTACH PARTITION forge.raw_observations_y2026m11_pkey;


--
-- Name: raw_observations_y2026m11_replay_run_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."IDX_raw_observations_replay_run" ATTACH PARTITION forge.raw_observations_y2026m11_replay_run_id_idx;


--
-- Name: raw_observations_y2026m11_tenant_id_connection_id_received__idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."IDX_raw_observations_tenant_connection_received" ATTACH PARTITION forge.raw_observations_y2026m11_tenant_id_connection_id_received__idx;


--
-- Name: raw_observations_y2026m11_tenant_id_source_object_id_receiv_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."IDX_raw_observations_tenant_object_received" ATTACH PARTITION forge.raw_observations_y2026m11_tenant_id_source_object_id_receiv_idx;


--
-- Name: raw_observations_y2026m12_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."PK_a75cc6d8710913a02fefb609f97" ATTACH PARTITION forge.raw_observations_y2026m12_pkey;


--
-- Name: raw_observations_y2026m12_replay_run_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."IDX_raw_observations_replay_run" ATTACH PARTITION forge.raw_observations_y2026m12_replay_run_id_idx;


--
-- Name: raw_observations_y2026m12_tenant_id_connection_id_received__idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."IDX_raw_observations_tenant_connection_received" ATTACH PARTITION forge.raw_observations_y2026m12_tenant_id_connection_id_received__idx;


--
-- Name: raw_observations_y2026m12_tenant_id_source_object_id_receiv_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX forge."IDX_raw_observations_tenant_object_received" ATTACH PARTITION forge.raw_observations_y2026m12_tenant_id_source_object_id_receiv_idx;


--
-- Name: accounting_revisions trg_accounting_revisions_approved_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_accounting_revisions_approved_immutable BEFORE DELETE OR UPDATE ON forge.accounting_revisions FOR EACH ROW EXECUTE FUNCTION forge.accounting_revision_approved_immutable();


--
-- Name: actuals_results trg_actuals_results_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_actuals_results_immutable BEFORE DELETE OR UPDATE ON forge.actuals_results FOR EACH ROW EXECUTE FUNCTION forge.actuals_immutable();


--
-- Name: actuals_runs trg_actuals_runs_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_actuals_runs_immutable BEFORE DELETE OR UPDATE ON forge.actuals_runs FOR EACH ROW EXECUTE FUNCTION forge.actuals_immutable();


--
-- Name: approval_actions trg_approval_actions_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_approval_actions_append_only BEFORE DELETE OR UPDATE ON forge.approval_actions FOR EACH ROW EXECUTE FUNCTION forge.workflow_rows_append_only();


--
-- Name: approval_snapshots trg_approval_snapshots_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_approval_snapshots_append_only BEFORE DELETE OR UPDATE ON forge.approval_snapshots FOR EACH ROW EXECUTE FUNCTION forge.workflow_rows_append_only();


--
-- Name: approved_loss_line_valuations trg_approved_loss_line_valuations_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_approved_loss_line_valuations_immutable BEFORE DELETE OR UPDATE ON forge.approved_loss_line_valuations FOR EACH ROW EXECUTE FUNCTION forge.accounting_lines_immutable();


--
-- Name: approved_loss_lines trg_approved_loss_lines_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_approved_loss_lines_immutable BEFORE DELETE OR UPDATE ON forge.approved_loss_lines FOR EACH ROW EXECUTE FUNCTION forge.accounting_lines_immutable();


--
-- Name: approved_valuation_totals trg_approved_valuation_totals_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_approved_valuation_totals_immutable BEFORE DELETE OR UPDATE ON forge.approved_valuation_totals FOR EACH ROW EXECUTE FUNCTION forge.accounting_lines_immutable();


--
-- Name: audit_log trg_audit_log_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log_append_only BEFORE DELETE OR UPDATE ON forge.audit_log FOR EACH ROW EXECUTE FUNCTION forge.audit_log_append_only();


--
-- Name: calendar_versions trg_calendar_versions_published_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_calendar_versions_published_immutable BEFORE DELETE OR UPDATE ON forge.calendar_versions FOR EACH ROW EXECUTE FUNCTION forge.calendar_versions_published_immutable();


--
-- Name: export_job_sources trg_export_job_sources_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_export_job_sources_append_only BEFORE DELETE OR UPDATE ON forge.export_job_sources FOR EACH ROW EXECUTE FUNCTION forge.workflow_rows_append_only();


--
-- Name: export_jobs trg_export_jobs_completed_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_export_jobs_completed_immutable BEFORE DELETE OR UPDATE ON forge.export_jobs FOR EACH ROW EXECUTE FUNCTION forge.export_job_completed_immutable();


--
-- Name: kpi_results trg_kpi_results_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_kpi_results_immutable BEFORE DELETE OR UPDATE ON forge.kpi_results FOR EACH ROW EXECUTE FUNCTION forge.accounting_lines_immutable();


--
-- Name: loss_line_evidence trg_loss_line_evidence_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_loss_line_evidence_immutable BEFORE DELETE OR UPDATE ON forge.loss_line_evidence FOR EACH ROW EXECUTE FUNCTION forge.accounting_lines_immutable();


--
-- Name: loss_line_valuations trg_loss_line_valuations_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_loss_line_valuations_immutable BEFORE DELETE OR UPDATE ON forge.loss_line_valuations FOR EACH ROW EXECUTE FUNCTION forge.accounting_lines_immutable();


--
-- Name: loss_lines trg_loss_lines_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_loss_lines_immutable BEFORE DELETE OR UPDATE ON forge.loss_lines FOR EACH ROW EXECUTE FUNCTION forge.accounting_lines_immutable();


--
-- Name: measurement_samples trg_measurement_samples_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_measurement_samples_immutable BEFORE DELETE OR UPDATE ON forge.measurement_samples FOR EACH ROW EXECUTE FUNCTION forge.measurement_samples_immutable();


--
-- Name: month_close_actions trg_month_close_actions_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_month_close_actions_append_only BEFORE DELETE OR UPDATE ON forge.month_close_actions FOR EACH ROW EXECUTE FUNCTION forge.workflow_rows_append_only();


--
-- Name: period_ledger_totals trg_period_ledger_totals_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_period_ledger_totals_immutable BEFORE DELETE OR UPDATE ON forge.period_ledger_totals FOR EACH ROW EXECUTE FUNCTION forge.accounting_lines_immutable();


--
-- Name: period_valuation_totals trg_period_valuation_totals_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_period_valuation_totals_immutable BEFORE DELETE OR UPDATE ON forge.period_valuation_totals FOR EACH ROW EXECUTE FUNCTION forge.accounting_lines_immutable();


--
-- Name: plan_periods trg_plan_periods_frozen; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plan_periods_frozen BEFORE DELETE OR UPDATE ON forge.plan_periods FOR EACH ROW EXECUTE FUNCTION forge.plan_periods_frozen();


--
-- Name: plan_versions trg_plan_versions_approved_kept; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_plan_versions_approved_kept BEFORE DELETE ON forge.plan_versions FOR EACH ROW EXECUTE FUNCTION forge.plan_versions_approved_kept();


--
-- Name: production_events trg_production_events_occurrence; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_production_events_occurrence BEFORE INSERT ON forge.production_events FOR EACH ROW EXECUTE FUNCTION forge.production_events_default_occurrence();


--
-- Name: raw_observations trg_raw_observations_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_raw_observations_immutable BEFORE DELETE OR UPDATE ON forge.raw_observations FOR EACH ROW EXECUTE FUNCTION forge.raw_observations_immutable();


--
-- Name: rca_barrier_analyses trg_rca_child_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rca_child_tenant BEFORE INSERT OR UPDATE OF rca_id, tenant_id ON forge.rca_barrier_analyses FOR EACH ROW EXECUTE FUNCTION forge.rca_child_tenant_follows_rca();


--
-- Name: rca_change_analyses trg_rca_child_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rca_child_tenant BEFORE INSERT OR UPDATE OF rca_id, tenant_id ON forge.rca_change_analyses FOR EACH ROW EXECUTE FUNCTION forge.rca_child_tenant_follows_rca();


--
-- Name: rca_fault_tree_analyses trg_rca_child_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rca_child_tenant BEFORE INSERT OR UPDATE OF rca_id, tenant_id ON forge.rca_fault_tree_analyses FOR EACH ROW EXECUTE FUNCTION forge.rca_child_tenant_follows_rca();


--
-- Name: rca_fishbone_diagrams trg_rca_child_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rca_child_tenant BEFORE INSERT OR UPDATE OF rca_id, tenant_id ON forge.rca_fishbone_diagrams FOR EACH ROW EXECUTE FUNCTION forge.rca_child_tenant_follows_rca();


--
-- Name: rca_five_why_analyses trg_rca_child_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rca_child_tenant BEFORE INSERT OR UPDATE OF rca_id, tenant_id ON forge.rca_five_why_analyses FOR EACH ROW EXECUTE FUNCTION forge.rca_child_tenant_follows_rca();


--
-- Name: rca_fmea_analyses trg_rca_child_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rca_child_tenant BEFORE INSERT OR UPDATE OF rca_id, tenant_id ON forge.rca_fmea_analyses FOR EACH ROW EXECUTE FUNCTION forge.rca_child_tenant_follows_rca();


--
-- Name: rca_knowledge_base trg_rca_child_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rca_child_tenant BEFORE INSERT OR UPDATE OF rca_id, tenant_id ON forge.rca_knowledge_base FOR EACH ROW EXECUTE FUNCTION forge.rca_child_tenant_follows_rca();


--
-- Name: rcas trg_rca_tenant_propagates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rca_tenant_propagates AFTER UPDATE OF tenant_id ON forge.rcas FOR EACH ROW WHEN (((old.tenant_id)::text IS DISTINCT FROM (new.tenant_id)::text)) EXECUTE FUNCTION forge.rca_tenant_propagates();


--
-- Name: reconciliation_line_sets trg_reconciliation_line_sets_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reconciliation_line_sets_append_only BEFORE DELETE OR UPDATE ON forge.reconciliation_line_sets FOR EACH ROW EXECUTE FUNCTION forge.workflow_rows_append_only();


--
-- Name: reconciliation_lines trg_reconciliation_lines_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reconciliation_lines_append_only BEFORE DELETE OR UPDATE ON forge.reconciliation_lines FOR EACH ROW EXECUTE FUNCTION forge.workflow_rows_append_only();


--
-- Name: shift_instances FK_0093bbcc37b152bfd44f797f5c1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.shift_instances
    ADD CONSTRAINT "FK_0093bbcc37b152bfd44f797f5c1" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE CASCADE;


--
-- Name: pi_sync_jobs FK_03bc03f60cf3ead27d2290f93ce; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_sync_jobs
    ADD CONSTRAINT "FK_03bc03f60cf3ead27d2290f93ce" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: production_events FK_09af81053b4af55cdc775bc3bd5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_events
    ADD CONSTRAINT "FK_09af81053b4af55cdc775bc3bd5" FOREIGN KEY (reason_code_id) REFERENCES forge.reason_codes(id);


--
-- Name: production_plans FK_0a60dfceafde9f802bdf5443304; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_plans
    ADD CONSTRAINT "FK_0a60dfceafde9f802bdf5443304" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: rca_cause_codes FK_0d6fc1a3c3a0e83b3fce15fb9c5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_cause_codes
    ADD CONSTRAINT "FK_0d6fc1a3c3a0e83b3fce15fb9c5" FOREIGN KEY (parent_id) REFERENCES forge.rca_cause_codes(id) ON DELETE CASCADE;


--
-- Name: rule_runs FK_0f381bd68d24644837a0d7861fb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rule_runs
    ADD CONSTRAINT "FK_0f381bd68d24644837a0d7861fb" FOREIGN KEY (rule_id) REFERENCES forge.rules(id) ON DELETE RESTRICT;


--
-- Name: rca_fishbone_diagrams FK_10c88127427a6b9e64da2bea0be; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_fishbone_diagrams
    ADD CONSTRAINT "FK_10c88127427a6b9e64da2bea0be" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: production_profiles FK_1153e094a665f9c223993823fa9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_profiles
    ADD CONSTRAINT "FK_1153e094a665f9c223993823fa9" FOREIGN KEY (product_id) REFERENCES forge.products(id) ON DELETE RESTRICT;


--
-- Name: event_relations FK_1161551aeffa4ecaef63adc7d8c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_relations
    ADD CONSTRAINT "FK_1161551aeffa4ecaef63adc7d8c" FOREIGN KEY (from_event_id) REFERENCES forge.production_events(id) ON DELETE RESTRICT;


--
-- Name: crews FK_137fe7d87345eeaa9eee3ee2067; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.crews
    ADD CONSTRAINT "FK_137fe7d87345eeaa9eee3ee2067" FOREIGN KEY (site_id) REFERENCES forge.sites(id) ON DELETE RESTRICT;


--
-- Name: af_bindings FK_1463179e78a90d088ae8374743e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.af_bindings
    ADD CONSTRAINT "FK_1463179e78a90d088ae8374743e" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: rca_five_why_analyses FK_1614859f262a4b0df6cc307026b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_five_why_analyses
    ADD CONSTRAINT "FK_1614859f262a4b0df6cc307026b" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: production_events FK_165571c3016f2aae50852324396; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_events
    ADD CONSTRAINT "FK_165571c3016f2aae50852324396" FOREIGN KEY (oee_code_id) REFERENCES forge.oee_codes(id);


--
-- Name: signal_backfill_runs FK_186de18d2f68699b94f11d202e8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.signal_backfill_runs
    ADD CONSTRAINT "FK_186de18d2f68699b94f11d202e8" FOREIGN KEY (signal_id) REFERENCES forge.signals(id) ON DELETE CASCADE;


--
-- Name: reason_codes FK_1a590363bbe4694d21c2e252e7b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.reason_codes
    ADD CONSTRAINT "FK_1a590363bbe4694d21c2e252e7b" FOREIGN KEY (parent_id) REFERENCES forge.reason_codes(id) ON DELETE RESTRICT;


--
-- Name: reason_codes FK_20fc0f6c74c7e4eb0df205f40e5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.reason_codes
    ADD CONSTRAINT "FK_20fc0f6c74c7e4eb0df205f40e5" FOREIGN KEY (default_impact_code_id) REFERENCES forge.impact_codes(id) ON DELETE RESTRICT;


--
-- Name: measurement_samples FK_2192b407182f3eb16cf7c1be47f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE forge.measurement_samples
    ADD CONSTRAINT "FK_2192b407182f3eb16cf7c1be47f" FOREIGN KEY (signal_id) REFERENCES forge.signals(id) ON DELETE RESTRICT;


--
-- Name: rca_knowledge_base FK_2454183612fe71f7fae2c463054; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_knowledge_base
    ADD CONSTRAINT "FK_2454183612fe71f7fae2c463054" FOREIGN KEY (rca_id) REFERENCES forge.rcas(id) ON DELETE SET NULL;


--
-- Name: event_review_items FK_25ab6786605a498c12d34c3c1a9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_review_items
    ADD CONSTRAINT "FK_25ab6786605a498c12d34c3c1a9" FOREIGN KEY (event_id) REFERENCES forge.production_events(id) ON DELETE RESTRICT;


--
-- Name: failure_code_groups FK_2a89de98b2b8da866bdeb4ae537; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.failure_code_groups
    ADD CONSTRAINT "FK_2a89de98b2b8da866bdeb4ae537" FOREIGN KEY (parent_id) REFERENCES forge.failure_code_groups(id) ON DELETE RESTRICT;


--
-- Name: units FK_2e1f4c47dcaa5ff0cb28211963b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.units
    ADD CONSTRAINT "FK_2e1f4c47dcaa5ff0cb28211963b" FOREIGN KEY (site_id) REFERENCES forge.sites(id) ON DELETE RESTRICT;


--
-- Name: assets FK_35832939b4bc039606a21fc27ee; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.assets
    ADD CONSTRAINT "FK_35832939b4bc039606a21fc27ee" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: pi_sync_job_links FK_39f1f21950ed2ad2d7e5f8ab845; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_sync_job_links
    ADD CONSTRAINT "FK_39f1f21950ed2ad2d7e5f8ab845" FOREIGN KEY (pi_sync_job_id) REFERENCES forge.pi_sync_jobs(id) ON DELETE CASCADE;


--
-- Name: rca_fishbone_diagrams FK_3a1adec9dc81f00da6920ceda82; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_fishbone_diagrams
    ADD CONSTRAINT "FK_3a1adec9dc81f00da6920ceda82" FOREIGN KEY (rca_id) REFERENCES forge.rcas(id) ON DELETE CASCADE;


--
-- Name: shift_instances FK_3d31f4fa45f3f6f3bfc4dd01667; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.shift_instances
    ADD CONSTRAINT "FK_3d31f4fa45f3f6f3bfc4dd01667" FOREIGN KEY (crew_id) REFERENCES forge.crews(id) ON DELETE SET NULL;


--
-- Name: rca_fault_tree_analyses FK_40bfa9eb36b30927422f2b51f42; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_fault_tree_analyses
    ADD CONSTRAINT "FK_40bfa9eb36b30927422f2b51f42" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: calendar_versions FK_49bc94bef03897db386268dac22; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.calendar_versions
    ADD CONSTRAINT "FK_49bc94bef03897db386268dac22" FOREIGN KEY (site_id) REFERENCES forge.sites(id) ON DELETE RESTRICT;


--
-- Name: event_coding FK_4e8136c698ead2d487411c64e4c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_coding
    ADD CONSTRAINT "FK_4e8136c698ead2d487411c64e4c" FOREIGN KEY (oee_code_version_id) REFERENCES forge.code_versions(id) ON DELETE RESTRICT;


--
-- Name: loss_category_defs FK_4e8e4ce35034eb1201676740eeb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.loss_category_defs
    ADD CONSTRAINT "FK_4e8e4ce35034eb1201676740eeb" FOREIGN KEY (parent_id) REFERENCES forge.loss_category_defs(id) ON DELETE RESTRICT;


--
-- Name: ingestion_job_transitions FK_4e9c180aa00c390fcad5e197a02; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.ingestion_job_transitions
    ADD CONSTRAINT "FK_4e9c180aa00c390fcad5e197a02" FOREIGN KEY (job_id) REFERENCES forge.ingestion_jobs(id) ON DELETE CASCADE;


--
-- Name: rca_change_analyses FK_4eab5ecd3f4166db8c7db5e17d2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_change_analyses
    ADD CONSTRAINT "FK_4eab5ecd3f4166db8c7db5e17d2" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: rca_knowledge_base FK_52477a3c4a6cb7e34a8a27b8cb5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_knowledge_base
    ADD CONSTRAINT "FK_52477a3c4a6cb7e34a8a27b8cb5" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: event_coding FK_5392982fe3abc3700ac382a592e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_coding
    ADD CONSTRAINT "FK_5392982fe3abc3700ac382a592e" FOREIGN KEY (reason_code_version_id) REFERENCES forge.code_versions(id) ON DELETE RESTRICT;


--
-- Name: event_relations FK_6243ca3de560c4a3f4af22de725; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_relations
    ADD CONSTRAINT "FK_6243ca3de560c4a3f4af22de725" FOREIGN KEY (to_event_id) REFERENCES forge.production_events(id) ON DELETE RESTRICT;


--
-- Name: shift_instances FK_68654c5b55f02f36cd88a30ea51; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.shift_instances
    ADD CONSTRAINT "FK_68654c5b55f02f36cd88a30ea51" FOREIGN KEY (calendar_version_id) REFERENCES forge.calendar_versions(id) ON DELETE RESTRICT;


--
-- Name: pi_sync_watermarks FK_68e74a0ab6e2aa327b5c0fe677b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_sync_watermarks
    ADD CONSTRAINT "FK_68e74a0ab6e2aa327b5c0fe677b" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: pi_sync_job_links FK_6a426a3477b8386a211fd100bf7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_sync_job_links
    ADD CONSTRAINT "FK_6a426a3477b8386a211fd100bf7" FOREIGN KEY (ingestion_job_id) REFERENCES forge.ingestion_jobs(id) ON DELETE CASCADE;


--
-- Name: custom_attribute_values FK_6c05f068f12c3d0f0e399670d70; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.custom_attribute_values
    ADD CONSTRAINT "FK_6c05f068f12c3d0f0e399670d70" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: audit_logs FK_6f18d459490bb48923b1f40bdb7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.audit_logs
    ADD CONSTRAINT "FK_6f18d459490bb48923b1f40bdb7" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: pi_page_manifests FK_6f4de7ac39c3d3cda159aad6073; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_page_manifests
    ADD CONSTRAINT "FK_6f4de7ac39c3d3cda159aad6073" FOREIGN KEY (job_id) REFERENCES forge.ingestion_jobs(id) ON DELETE CASCADE;


--
-- Name: rca_knowledge_votes FK_7463017744d7e1410587fa8cf74; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_knowledge_votes
    ADD CONSTRAINT "FK_7463017744d7e1410587fa8cf74" FOREIGN KEY (entry_id) REFERENCES forge.rca_knowledge_base(id) ON DELETE CASCADE;


--
-- Name: rcas FK_790ced6e47d966eb4fc70d5d56a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rcas
    ADD CONSTRAINT "FK_790ced6e47d966eb4fc70d5d56a" FOREIGN KEY (template_id) REFERENCES forge.rca_templates(id);


--
-- Name: production_profiles FK_7f150424efcfbe1e1e0d7dc23bd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_profiles
    ADD CONSTRAINT "FK_7f150424efcfbe1e1e0d7dc23bd" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: pi_mappings FK_7fa81bd4264b9df8d18f9d26f03; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_mappings
    ADD CONSTRAINT "FK_7fa81bd4264b9df8d18f9d26f03" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: crew_rotations FK_84685edba4dc886bc63f03765c7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.crew_rotations
    ADD CONSTRAINT "FK_84685edba4dc886bc63f03765c7" FOREIGN KEY (crew_id) REFERENCES forge.crews(id) ON DELETE CASCADE;


--
-- Name: unit_product_rates FK_84787a5fbf49c2d14e38e8b05bb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_product_rates
    ADD CONSTRAINT "FK_84787a5fbf49c2d14e38e8b05bb" FOREIGN KEY (rate_import_id) REFERENCES forge.rate_imports(id) ON DELETE RESTRICT;


--
-- Name: valuation_rates FK_84f5cfca9fd8b463f90218f4bba; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.valuation_rates
    ADD CONSTRAINT "FK_84f5cfca9fd8b463f90218f4bba" FOREIGN KEY (impact_code_id) REFERENCES forge.impact_codes(id) ON DELETE RESTRICT;


--
-- Name: rca_change_analyses FK_8b6ad2bccf50753849263a521ef; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_change_analyses
    ADD CONSTRAINT "FK_8b6ad2bccf50753849263a521ef" FOREIGN KEY (rca_id) REFERENCES forge.rcas(id) ON DELETE CASCADE;


--
-- Name: production_events FK_8e36b4c91cff4344b1ed8da72d8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_events
    ADD CONSTRAINT "FK_8e36b4c91cff4344b1ed8da72d8" FOREIGN KEY (plan_id) REFERENCES forge.production_plans(id);


--
-- Name: replay_runs FK_8f4650b77f7041e2dbe388f351d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.replay_runs
    ADD CONSTRAINT "FK_8f4650b77f7041e2dbe388f351d" FOREIGN KEY (connection_id) REFERENCES forge.integration_connections(id) ON DELETE RESTRICT;


--
-- Name: rcas FK_90f1f10ffd6d8366913f112d6ab; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rcas
    ADD CONSTRAINT "FK_90f1f10ffd6d8366913f112d6ab" FOREIGN KEY (team_lead_id) REFERENCES forge.users(id);


--
-- Name: production_events FK_91c1cd9e89d1db1d05f14d395e0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_events
    ADD CONSTRAINT "FK_91c1cd9e89d1db1d05f14d395e0" FOREIGN KEY (asset_id) REFERENCES forge.assets(id);


--
-- Name: tasks FK_93edccfc42408754c4b5957105e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.tasks
    ADD CONSTRAINT "FK_93edccfc42408754c4b5957105e" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: signals FK_948d720721b85d24a5809ed9fd1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.signals
    ADD CONSTRAINT "FK_948d720721b85d24a5809ed9fd1" FOREIGN KEY (connection_id) REFERENCES forge.integration_connections(id) ON DELETE RESTRICT;


--
-- Name: rca_fmea_analyses FK_97ae496f70b45daddfa927e0688; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_fmea_analyses
    ADD CONSTRAINT "FK_97ae496f70b45daddfa927e0688" FOREIGN KEY (rca_id) REFERENCES forge.rcas(id) ON DELETE CASCADE;


--
-- Name: products FK_9c365ebf78f0e8a6d9e4827ea70; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.products
    ADD CONSTRAINT "FK_9c365ebf78f0e8a6d9e4827ea70" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: production_events FK_9c89eb92722994c19f0be0ba0a1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_events
    ADD CONSTRAINT "FK_9c89eb92722994c19f0be0ba0a1" FOREIGN KEY (impact_code_id) REFERENCES forge.impact_codes(id);


--
-- Name: rcas FK_a0e2a9c25b398c12e232d861b3b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rcas
    ADD CONSTRAINT "FK_a0e2a9c25b398c12e232d861b3b" FOREIGN KEY (event_id) REFERENCES forge.production_events(id) ON DELETE SET NULL;


--
-- Name: signals FK_a409efa7123360cad893c419fe4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.signals
    ADD CONSTRAINT "FK_a409efa7123360cad893c419fe4" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: custom_attribute_definitions FK_a66f57e74944f56f84263998924; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.custom_attribute_definitions
    ADD CONSTRAINT "FK_a66f57e74944f56f84263998924" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: accounting_revisions FK_accounting_revisions_period; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.accounting_revisions
    ADD CONSTRAINT "FK_accounting_revisions_period" FOREIGN KEY (period_id) REFERENCES forge.production_periods(id) ON DELETE RESTRICT;


--
-- Name: actuals_adjustments FK_actuals_adjustments_slice; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.actuals_adjustments
    ADD CONSTRAINT "FK_actuals_adjustments_slice" FOREIGN KEY (slice_id) REFERENCES forge.period_product_slices(id) ON DELETE RESTRICT;


--
-- Name: actuals_jobs FK_actuals_jobs_period; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.actuals_jobs
    ADD CONSTRAINT "FK_actuals_jobs_period" FOREIGN KEY (period_id) REFERENCES forge.production_periods(id) ON DELETE CASCADE;


--
-- Name: actuals_results FK_actuals_results_run; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.actuals_results
    ADD CONSTRAINT "FK_actuals_results_run" FOREIGN KEY (actuals_run_id) REFERENCES forge.actuals_runs(id) ON DELETE RESTRICT;


--
-- Name: actuals_results FK_actuals_results_slice; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.actuals_results
    ADD CONSTRAINT "FK_actuals_results_slice" FOREIGN KEY (slice_id) REFERENCES forge.period_product_slices(id) ON DELETE RESTRICT;


--
-- Name: actuals_runs FK_actuals_runs_period; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.actuals_runs
    ADD CONSTRAINT "FK_actuals_runs_period" FOREIGN KEY (period_id) REFERENCES forge.production_periods(id) ON DELETE RESTRICT;


--
-- Name: approval_actions FK_approval_actions_revision; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.approval_actions
    ADD CONSTRAINT "FK_approval_actions_revision" FOREIGN KEY (revision_id) REFERENCES forge.accounting_revisions(id) ON DELETE RESTRICT;


--
-- Name: approval_snapshots FK_approval_snapshots_revision; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.approval_snapshots
    ADD CONSTRAINT "FK_approval_snapshots_revision" FOREIGN KEY (revision_id) REFERENCES forge.accounting_revisions(id) ON DELETE RESTRICT;


--
-- Name: approved_loss_line_valuations FK_approved_loss_line_valuations_line; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.approved_loss_line_valuations
    ADD CONSTRAINT "FK_approved_loss_line_valuations_line" FOREIGN KEY (approved_line_id) REFERENCES forge.approved_loss_lines(id) ON DELETE RESTRICT;


--
-- Name: approved_loss_lines FK_approved_loss_lines_revision; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.approved_loss_lines
    ADD CONSTRAINT "FK_approved_loss_lines_revision" FOREIGN KEY (revision_id) REFERENCES forge.accounting_revisions(id) ON DELETE RESTRICT;


--
-- Name: approved_valuation_totals FK_approved_valuation_totals_revision; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.approved_valuation_totals
    ADD CONSTRAINT "FK_approved_valuation_totals_revision" FOREIGN KEY (revision_id) REFERENCES forge.accounting_revisions(id) ON DELETE RESTRICT;


--
-- Name: rca_five_why_analyses FK_b3ca481cb9edf1c55d002aece95; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_five_why_analyses
    ADD CONSTRAINT "FK_b3ca481cb9edf1c55d002aece95" FOREIGN KEY (rca_id) REFERENCES forge.rcas(id) ON DELETE CASCADE;


--
-- Name: rca_barrier_analyses FK_b452cba15c834ab797e539860b7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_barrier_analyses
    ADD CONSTRAINT "FK_b452cba15c834ab797e539860b7" FOREIGN KEY (rca_id) REFERENCES forge.rcas(id) ON DELETE CASCADE;


--
-- Name: pi_open_frames FK_b65aa7f6d6c1f6338c39ca15fca; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_open_frames
    ADD CONSTRAINT "FK_b65aa7f6d6c1f6338c39ca15fca" FOREIGN KEY (connection_id) REFERENCES forge.integration_connections(id) ON DELETE CASCADE;


--
-- Name: rca_barrier_analyses FK_b6a8953d43eaf93d4aa0898ebce; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_barrier_analyses
    ADD CONSTRAINT "FK_b6a8953d43eaf93d4aa0898ebce" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: ingestion_jobs FK_b9486287fd1fec7742fb17f4398; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.ingestion_jobs
    ADD CONSTRAINT "FK_b9486287fd1fec7742fb17f4398" FOREIGN KEY (connection_id) REFERENCES forge.integration_connections(id) ON DELETE RESTRICT;


--
-- Name: source_hierarchy_mappings FK_bf3eb0c0607310d1195ed28d338; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.source_hierarchy_mappings
    ADD CONSTRAINT "FK_bf3eb0c0607310d1195ed28d338" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: buffer_levels FK_buffer_levels_from_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.buffer_levels
    ADD CONSTRAINT "FK_buffer_levels_from_unit" FOREIGN KEY (from_unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: buffer_levels FK_buffer_levels_to_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.buffer_levels
    ADD CONSTRAINT "FK_buffer_levels_to_unit" FOREIGN KEY (to_unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: valuation_rates FK_c43b65b42543a0f992b0de2727e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.valuation_rates
    ADD CONSTRAINT "FK_c43b65b42543a0f992b0de2727e" FOREIGN KEY (profile_id) REFERENCES forge.production_profiles(id) ON DELETE RESTRICT;


--
-- Name: production_events FK_c5154628c51cdf276e6132dc3b9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_events
    ADD CONSTRAINT "FK_c5154628c51cdf276e6132dc3b9" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: signal_summaries FK_ca02434414b6d317b7554719e0a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.signal_summaries
    ADD CONSTRAINT "FK_ca02434414b6d317b7554719e0a" FOREIGN KEY (signal_id) REFERENCES forge.signals(id) ON DELETE RESTRICT;


--
-- Name: calculation_runs FK_calculation_runs_actuals_run; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.calculation_runs
    ADD CONSTRAINT "FK_calculation_runs_actuals_run" FOREIGN KEY (actuals_run_id) REFERENCES forge.actuals_runs(id) ON DELETE RESTRICT;


--
-- Name: calculation_runs FK_calculation_runs_period; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.calculation_runs
    ADD CONSTRAINT "FK_calculation_runs_period" FOREIGN KEY (period_id) REFERENCES forge.production_periods(id) ON DELETE RESTRICT;


--
-- Name: calculation_runs FK_calculation_runs_revision; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.calculation_runs
    ADD CONSTRAINT "FK_calculation_runs_revision" FOREIGN KEY (revision_id) REFERENCES forge.accounting_revisions(id) ON DELETE RESTRICT;


--
-- Name: event_revisions FK_cff28cc6154ae420bce7414eb21; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_revisions
    ADD CONSTRAINT "FK_cff28cc6154ae420bce7414eb21" FOREIGN KEY (event_id) REFERENCES forge.production_events(id) ON DELETE RESTRICT;


--
-- Name: rule_versions FK_d13d4a69ecdb5acf7b1df3bbf6c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rule_versions
    ADD CONSTRAINT "FK_d13d4a69ecdb5acf7b1df3bbf6c" FOREIGN KEY (rule_id) REFERENCES forge.rules(id) ON DELETE RESTRICT;


--
-- Name: event_coding FK_d20ef97b79daf51e1afb8336776; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_coding
    ADD CONSTRAINT "FK_d20ef97b79daf51e1afb8336776" FOREIGN KEY (impact_code_version_id) REFERENCES forge.code_versions(id) ON DELETE RESTRICT;


--
-- Name: rca_fault_tree_analyses FK_da67fcf410e52cca13513d5fbf2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_fault_tree_analyses
    ADD CONSTRAINT "FK_da67fcf410e52cca13513d5fbf2" FOREIGN KEY (rca_id) REFERENCES forge.rcas(id) ON DELETE CASCADE;


--
-- Name: unit_product_rates FK_db9f823eb23a8eb9b27f28df301; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_product_rates
    ADD CONSTRAINT "FK_db9f823eb23a8eb9b27f28df301" FOREIGN KEY (profile_id) REFERENCES forge.production_profiles(id) ON DELETE RESTRICT;


--
-- Name: pi_connections FK_dc14cf1cea5a5b8eb72f6d95b3f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.pi_connections
    ADD CONSTRAINT "FK_dc14cf1cea5a5b8eb72f6d95b3f" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: calendar_versions FK_dc755cdbb7ce2b332b452961d37; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.calendar_versions
    ADD CONSTRAINT "FK_dc755cdbb7ce2b332b452961d37" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: demand_statuses FK_demand_statuses_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.demand_statuses
    ADD CONSTRAINT "FK_demand_statuses_product" FOREIGN KEY (product_id) REFERENCES forge.products(id) ON DELETE RESTRICT;


--
-- Name: user_scopes FK_e23369bd4a15d31af02810a2690; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.user_scopes
    ADD CONSTRAINT "FK_e23369bd4a15d31af02810a2690" FOREIGN KEY (user_id) REFERENCES forge.users(id) ON DELETE CASCADE;


--
-- Name: event_coding FK_ef1cf2a6fc0eacbb8ed0fe58495; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_coding
    ADD CONSTRAINT "FK_ef1cf2a6fc0eacbb8ed0fe58495" FOREIGN KEY (event_id) REFERENCES forge.production_events(id) ON DELETE RESTRICT;


--
-- Name: event_impacts FK_event_impacts_event; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_impacts
    ADD CONSTRAINT "FK_event_impacts_event" FOREIGN KEY (event_id) REFERENCES forge.production_events(id) ON DELETE RESTRICT;


--
-- Name: event_impacts FK_event_impacts_rule; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.event_impacts
    ADD CONSTRAINT "FK_event_impacts_rule" FOREIGN KEY (rule_id) REFERENCES forge.unit_impact_rules(id) ON DELETE RESTRICT;


--
-- Name: export_job_sources FK_export_job_sources_job; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.export_job_sources
    ADD CONSTRAINT "FK_export_job_sources_job" FOREIGN KEY (export_job_id) REFERENCES forge.export_jobs(id) ON DELETE RESTRICT;


--
-- Name: export_job_sources FK_export_job_sources_revision; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.export_job_sources
    ADD CONSTRAINT "FK_export_job_sources_revision" FOREIGN KEY (revision_id) REFERENCES forge.accounting_revisions(id) ON DELETE RESTRICT;


--
-- Name: export_job_sources FK_export_job_sources_snapshot; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.export_job_sources
    ADD CONSTRAINT "FK_export_job_sources_snapshot" FOREIGN KEY (snapshot_id) REFERENCES forge.approval_snapshots(id) ON DELETE RESTRICT;


--
-- Name: external_production_reports FK_external_production_reports_site; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.external_production_reports
    ADD CONSTRAINT "FK_external_production_reports_site" FOREIGN KEY (site_id) REFERENCES forge.sites(id) ON DELETE RESTRICT;


--
-- Name: rcas FK_f5f23f4d4c0af808efc3384f50b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rcas
    ADD CONSTRAINT "FK_f5f23f4d4c0af808efc3384f50b" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: production_events FK_f6b86cfe4d0085cf0ab70695b6a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_events
    ADD CONSTRAINT "FK_f6b86cfe4d0085cf0ab70695b6a" FOREIGN KEY (rca_id) REFERENCES forge.rcas(id) ON DELETE SET NULL;


--
-- Name: auth_refresh_tokens FK_f795ad14f31838e3ddc663ee150; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.auth_refresh_tokens
    ADD CONSTRAINT "FK_f795ad14f31838e3ddc663ee150" FOREIGN KEY (user_id) REFERENCES forge.users(id) ON DELETE CASCADE;


--
-- Name: production_events FK_fda378c707c43df7d9730fdac8c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_events
    ADD CONSTRAINT "FK_fda378c707c43df7d9730fdac8c" FOREIGN KEY (unit_id) REFERENCES forge.units(id);


--
-- Name: rca_fmea_analyses FK_ffae41607f1c369f1c87975ce83; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_fmea_analyses
    ADD CONSTRAINT "FK_ffae41607f1c369f1c87975ce83" FOREIGN KEY (tenant_id) REFERENCES forge.tenants(id);


--
-- Name: kpi_results FK_kpi_results_run; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.kpi_results
    ADD CONSTRAINT "FK_kpi_results_run" FOREIGN KEY (run_id) REFERENCES forge.calculation_runs(id) ON DELETE RESTRICT;


--
-- Name: loss_line_evidence FK_loss_line_evidence_line; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.loss_line_evidence
    ADD CONSTRAINT "FK_loss_line_evidence_line" FOREIGN KEY (loss_line_id) REFERENCES forge.loss_lines(id) ON DELETE RESTRICT;


--
-- Name: loss_line_valuations FK_loss_line_valuations_line; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.loss_line_valuations
    ADD CONSTRAINT "FK_loss_line_valuations_line" FOREIGN KEY (loss_line_id) REFERENCES forge.loss_lines(id) ON DELETE RESTRICT;


--
-- Name: loss_line_valuations FK_loss_line_valuations_run; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.loss_line_valuations
    ADD CONSTRAINT "FK_loss_line_valuations_run" FOREIGN KEY (run_id) REFERENCES forge.calculation_runs(id) ON DELETE RESTRICT;


--
-- Name: loss_lines FK_loss_lines_rate_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.loss_lines
    ADD CONSTRAINT "FK_loss_lines_rate_version" FOREIGN KEY (rate_version_id) REFERENCES forge.unit_product_rates(id) ON DELETE RESTRICT;


--
-- Name: loss_lines FK_loss_lines_revision; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.loss_lines
    ADD CONSTRAINT "FK_loss_lines_revision" FOREIGN KEY (revision_id) REFERENCES forge.accounting_revisions(id) ON DELETE RESTRICT;


--
-- Name: loss_lines FK_loss_lines_run; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.loss_lines
    ADD CONSTRAINT "FK_loss_lines_run" FOREIGN KEY (run_id) REFERENCES forge.calculation_runs(id) ON DELETE RESTRICT;


--
-- Name: loss_lines FK_loss_lines_slice; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.loss_lines
    ADD CONSTRAINT "FK_loss_lines_slice" FOREIGN KEY (slice_id) REFERENCES forge.period_product_slices(id) ON DELETE RESTRICT;


--
-- Name: lot_dispositions FK_lot_dispositions_event; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.lot_dispositions
    ADD CONSTRAINT "FK_lot_dispositions_event" FOREIGN KEY (production_event_id) REFERENCES forge.production_events(id) ON DELETE RESTRICT;


--
-- Name: lot_dispositions FK_lot_dispositions_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.lot_dispositions
    ADD CONSTRAINT "FK_lot_dispositions_product" FOREIGN KEY (product_id) REFERENCES forge.products(id) ON DELETE RESTRICT;


--
-- Name: lot_dispositions FK_lot_dispositions_recovery_of; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.lot_dispositions
    ADD CONSTRAINT "FK_lot_dispositions_recovery_of" FOREIGN KEY (recovery_of_id) REFERENCES forge.lot_dispositions(id) ON DELETE RESTRICT;


--
-- Name: lot_dispositions FK_lot_dispositions_supersedes; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.lot_dispositions
    ADD CONSTRAINT "FK_lot_dispositions_supersedes" FOREIGN KEY (supersedes_id) REFERENCES forge.lot_dispositions(id) ON DELETE RESTRICT;


--
-- Name: lot_dispositions FK_lot_dispositions_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.lot_dispositions
    ADD CONSTRAINT "FK_lot_dispositions_unit" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: month_close_actions FK_month_close_actions_close; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.month_close_actions
    ADD CONSTRAINT "FK_month_close_actions_close" FOREIGN KEY (month_close_id) REFERENCES forge.month_closes(id) ON DELETE RESTRICT;


--
-- Name: period_change_proposals FK_period_change_proposals_approved_revision; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_change_proposals
    ADD CONSTRAINT "FK_period_change_proposals_approved_revision" FOREIGN KEY (approved_revision_id) REFERENCES forge.accounting_revisions(id) ON DELETE RESTRICT;


--
-- Name: period_change_proposals FK_period_change_proposals_created_revision; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_change_proposals
    ADD CONSTRAINT "FK_period_change_proposals_created_revision" FOREIGN KEY (created_revision_id) REFERENCES forge.accounting_revisions(id) ON DELETE RESTRICT;


--
-- Name: period_change_proposals FK_period_change_proposals_period; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_change_proposals
    ADD CONSTRAINT "FK_period_change_proposals_period" FOREIGN KEY (period_id) REFERENCES forge.production_periods(id) ON DELETE RESTRICT;


--
-- Name: period_data_holds FK_period_data_holds_period; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_data_holds
    ADD CONSTRAINT "FK_period_data_holds_period" FOREIGN KEY (period_id) REFERENCES forge.production_periods(id) ON DELETE RESTRICT;


--
-- Name: period_ledger_totals FK_period_ledger_totals_run; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_ledger_totals
    ADD CONSTRAINT "FK_period_ledger_totals_run" FOREIGN KEY (run_id) REFERENCES forge.calculation_runs(id) ON DELETE RESTRICT;


--
-- Name: period_ledger_totals FK_period_ledger_totals_slice; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_ledger_totals
    ADD CONSTRAINT "FK_period_ledger_totals_slice" FOREIGN KEY (slice_id) REFERENCES forge.period_product_slices(id) ON DELETE RESTRICT;


--
-- Name: period_product_slices FK_period_product_slices_period; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_product_slices
    ADD CONSTRAINT "FK_period_product_slices_period" FOREIGN KEY (period_id) REFERENCES forge.production_periods(id) ON DELETE RESTRICT;


--
-- Name: period_product_slices FK_period_product_slices_plan_period; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_product_slices
    ADD CONSTRAINT "FK_period_product_slices_plan_period" FOREIGN KEY (plan_period_id) REFERENCES forge.plan_periods(id) ON DELETE SET NULL;


--
-- Name: period_product_slices FK_period_product_slices_policy; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_product_slices
    ADD CONSTRAINT "FK_period_product_slices_policy" FOREIGN KEY (actuals_policy_id) REFERENCES forge.accounting_policies(id) ON DELETE RESTRICT;


--
-- Name: period_product_slices FK_period_product_slices_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_product_slices
    ADD CONSTRAINT "FK_period_product_slices_product" FOREIGN KEY (product_id) REFERENCES forge.products(id) ON DELETE RESTRICT;


--
-- Name: period_product_slices FK_period_product_slices_profile; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_product_slices
    ADD CONSTRAINT "FK_period_product_slices_profile" FOREIGN KEY (profile_id) REFERENCES forge.production_profiles(id) ON DELETE RESTRICT;


--
-- Name: period_valuation_totals FK_period_valuation_totals_run; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.period_valuation_totals
    ADD CONSTRAINT "FK_period_valuation_totals_run" FOREIGN KEY (run_id) REFERENCES forge.calculation_runs(id) ON DELETE RESTRICT;


--
-- Name: plan_generation_jobs FK_plan_generation_jobs_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_generation_jobs
    ADD CONSTRAINT "FK_plan_generation_jobs_version" FOREIGN KEY (plan_version_id) REFERENCES forge.plan_versions(id) ON DELETE CASCADE;


--
-- Name: plan_periods FK_plan_periods_planning_rate; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_periods
    ADD CONSTRAINT "FK_plan_periods_planning_rate" FOREIGN KEY (planning_rate_version_id) REFERENCES forge.unit_product_rates(id) ON DELETE RESTRICT;


--
-- Name: plan_periods FK_plan_periods_shift_instance; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_periods
    ADD CONSTRAINT "FK_plan_periods_shift_instance" FOREIGN KEY (shift_instance_id) REFERENCES forge.shift_instances(id) ON DELETE SET NULL;


--
-- Name: plan_periods FK_plan_periods_slice; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_periods
    ADD CONSTRAINT "FK_plan_periods_slice" FOREIGN KEY (slice_id) REFERENCES forge.plan_product_slices(id) ON DELETE CASCADE;


--
-- Name: plan_periods FK_plan_periods_sustained_rate; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_periods
    ADD CONSTRAINT "FK_plan_periods_sustained_rate" FOREIGN KEY (sustained_rate_version_id) REFERENCES forge.unit_product_rates(id) ON DELETE RESTRICT;


--
-- Name: plan_periods FK_plan_periods_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_periods
    ADD CONSTRAINT "FK_plan_periods_unit" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: plan_periods FK_plan_periods_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_periods
    ADD CONSTRAINT "FK_plan_periods_version" FOREIGN KEY (plan_version_id) REFERENCES forge.plan_versions(id) ON DELETE CASCADE;


--
-- Name: plan_product_slices FK_plan_product_slices_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_product_slices
    ADD CONSTRAINT "FK_plan_product_slices_product" FOREIGN KEY (product_id) REFERENCES forge.products(id) ON DELETE RESTRICT;


--
-- Name: plan_product_slices FK_plan_product_slices_profile; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_product_slices
    ADD CONSTRAINT "FK_plan_product_slices_profile" FOREIGN KEY (profile_id) REFERENCES forge.production_profiles(id) ON DELETE RESTRICT;


--
-- Name: plan_product_slices FK_plan_product_slices_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_product_slices
    ADD CONSTRAINT "FK_plan_product_slices_version" FOREIGN KEY (plan_version_id) REFERENCES forge.plan_versions(id) ON DELETE CASCADE;


--
-- Name: plan_versions FK_plan_versions_calendar_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_versions
    ADD CONSTRAINT "FK_plan_versions_calendar_version" FOREIGN KEY (calendar_version_id) REFERENCES forge.calendar_versions(id) ON DELETE RESTRICT;


--
-- Name: plan_versions FK_plan_versions_plan; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_versions
    ADD CONSTRAINT "FK_plan_versions_plan" FOREIGN KEY (plan_id) REFERENCES forge.production_plans(id) ON DELETE CASCADE;


--
-- Name: plan_versions FK_plan_versions_scenario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_versions
    ADD CONSTRAINT "FK_plan_versions_scenario" FOREIGN KEY (scenario_id) REFERENCES forge.plan_scenarios(id) ON DELETE RESTRICT;


--
-- Name: plan_versions FK_plan_versions_supersedes; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_versions
    ADD CONSTRAINT "FK_plan_versions_supersedes" FOREIGN KEY (supersedes_version_id) REFERENCES forge.plan_versions(id) ON DELETE RESTRICT;


--
-- Name: plan_versions FK_plan_versions_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plan_versions
    ADD CONSTRAINT "FK_plan_versions_unit" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: plant_flow_routes FK_plant_flow_routes_from_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plant_flow_routes
    ADD CONSTRAINT "FK_plant_flow_routes_from_unit" FOREIGN KEY (from_unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: plant_flow_routes FK_plant_flow_routes_to_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.plant_flow_routes
    ADD CONSTRAINT "FK_plant_flow_routes_to_unit" FOREIGN KEY (to_unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: production_day_certifications FK_production_day_certifications_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_day_certifications
    ADD CONSTRAINT "FK_production_day_certifications_unit" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: production_events FK_production_events_from_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_events
    ADD CONSTRAINT "FK_production_events_from_product" FOREIGN KEY (from_product_id) REFERENCES forge.products(id) ON DELETE RESTRICT;


--
-- Name: production_events FK_production_events_origin_asset; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_events
    ADD CONSTRAINT "FK_production_events_origin_asset" FOREIGN KEY (origin_asset_id) REFERENCES forge.assets(id) ON DELETE RESTRICT;


--
-- Name: production_events FK_production_events_origin_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_events
    ADD CONSTRAINT "FK_production_events_origin_unit" FOREIGN KEY (origin_unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: production_events FK_production_events_recovery_of; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_events
    ADD CONSTRAINT "FK_production_events_recovery_of" FOREIGN KEY (recovery_of_event_id) REFERENCES forge.production_events(id) ON DELETE RESTRICT;


--
-- Name: production_events FK_production_events_to_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_events
    ADD CONSTRAINT "FK_production_events_to_product" FOREIGN KEY (to_product_id) REFERENCES forge.products(id) ON DELETE RESTRICT;


--
-- Name: production_periods FK_production_periods_plan_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_periods
    ADD CONSTRAINT "FK_production_periods_plan_version" FOREIGN KEY (selected_plan_version_id) REFERENCES forge.plan_versions(id) ON DELETE RESTRICT;


--
-- Name: production_periods FK_production_periods_shift_instance; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_periods
    ADD CONSTRAINT "FK_production_periods_shift_instance" FOREIGN KEY (shift_instance_id) REFERENCES forge.shift_instances(id) ON DELETE SET NULL;


--
-- Name: production_periods FK_production_periods_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_periods
    ADD CONSTRAINT "FK_production_periods_unit" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: production_plans FK_production_plans_product_ref; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_plans
    ADD CONSTRAINT "FK_production_plans_product_ref" FOREIGN KEY (product_ref_id) REFERENCES forge.products(id) ON DELETE RESTRICT;


--
-- Name: production_plans FK_production_plans_scenario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_plans
    ADD CONSTRAINT "FK_production_plans_scenario" FOREIGN KEY (scenario_id) REFERENCES forge.plan_scenarios(id) ON DELETE RESTRICT;


--
-- Name: production_plans FK_production_plans_unit_ref; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.production_plans
    ADD CONSTRAINT "FK_production_plans_unit_ref" FOREIGN KEY (unit_ref_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: rca_actions FK_rca_actions_rca; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_actions
    ADD CONSTRAINT "FK_rca_actions_rca" FOREIGN KEY (rca_id) REFERENCES forge.rcas(id) ON DELETE CASCADE;


--
-- Name: rca_case_links FK_rca_case_links_rca; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_case_links
    ADD CONSTRAINT "FK_rca_case_links_rca" FOREIGN KEY (rca_id) REFERENCES forge.rcas(id) ON DELETE CASCADE;


--
-- Name: rca_causes FK_rca_causes_cause_code; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_causes
    ADD CONSTRAINT "FK_rca_causes_cause_code" FOREIGN KEY (cause_code_id) REFERENCES forge.rca_cause_codes(id) ON DELETE RESTRICT;


--
-- Name: rca_causes FK_rca_causes_rca; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_causes
    ADD CONSTRAINT "FK_rca_causes_rca" FOREIGN KEY (rca_id) REFERENCES forge.rcas(id) ON DELETE CASCADE;


--
-- Name: rca_trigger_evaluations FK_rca_trigger_evaluations_rca; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.rca_trigger_evaluations
    ADD CONSTRAINT "FK_rca_trigger_evaluations_rca" FOREIGN KEY (rca_id) REFERENCES forge.rcas(id) ON DELETE SET NULL;


--
-- Name: reconciliation_line_sets FK_reconciliation_line_sets_base_run; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.reconciliation_line_sets
    ADD CONSTRAINT "FK_reconciliation_line_sets_base_run" FOREIGN KEY (base_run_id) REFERENCES forge.calculation_runs(id) ON DELETE RESTRICT;


--
-- Name: reconciliation_line_sets FK_reconciliation_line_sets_period; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.reconciliation_line_sets
    ADD CONSTRAINT "FK_reconciliation_line_sets_period" FOREIGN KEY (period_id) REFERENCES forge.production_periods(id) ON DELETE RESTRICT;


--
-- Name: reconciliation_line_sets FK_reconciliation_line_sets_revision; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.reconciliation_line_sets
    ADD CONSTRAINT "FK_reconciliation_line_sets_revision" FOREIGN KEY (revision_id) REFERENCES forge.accounting_revisions(id) ON DELETE RESTRICT;


--
-- Name: reconciliation_lines FK_reconciliation_lines_adjustment; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.reconciliation_lines
    ADD CONSTRAINT "FK_reconciliation_lines_adjustment" FOREIGN KEY (adjustment_id) REFERENCES forge.actuals_adjustments(id) ON DELETE RESTRICT;


--
-- Name: reconciliation_lines FK_reconciliation_lines_reverses_line; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.reconciliation_lines
    ADD CONSTRAINT "FK_reconciliation_lines_reverses_line" FOREIGN KEY (reverses_line_id) REFERENCES forge.approved_loss_lines(id) ON DELETE RESTRICT;


--
-- Name: reconciliation_lines FK_reconciliation_lines_set; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.reconciliation_lines
    ADD CONSTRAINT "FK_reconciliation_lines_set" FOREIGN KEY (line_set_id) REFERENCES forge.reconciliation_line_sets(id) ON DELETE RESTRICT;


--
-- Name: reconciliation_lines FK_reconciliation_lines_slice; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.reconciliation_lines
    ADD CONSTRAINT "FK_reconciliation_lines_slice" FOREIGN KEY (slice_id) REFERENCES forge.period_product_slices(id) ON DELETE RESTRICT;


--
-- Name: restatement_postings FK_restatement_postings_period; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.restatement_postings
    ADD CONSTRAINT "FK_restatement_postings_period" FOREIGN KEY (period_id) REFERENCES forge.production_periods(id) ON DELETE RESTRICT;


--
-- Name: restatement_postings FK_restatement_postings_revision; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.restatement_postings
    ADD CONSTRAINT "FK_restatement_postings_revision" FOREIGN KEY (revision_id) REFERENCES forge.accounting_revisions(id) ON DELETE RESTRICT;


--
-- Name: role_delegations FK_role_delegations_delegate; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.role_delegations
    ADD CONSTRAINT "FK_role_delegations_delegate" FOREIGN KEY (delegate_id) REFERENCES forge.users(id) ON DELETE RESTRICT;


--
-- Name: role_delegations FK_role_delegations_delegator; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.role_delegations
    ADD CONSTRAINT "FK_role_delegations_delegator" FOREIGN KEY (delegator_id) REFERENCES forge.users(id) ON DELETE RESTRICT;


--
-- Name: shift_notes FK_shift_notes_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.shift_notes
    ADD CONSTRAINT "FK_shift_notes_unit" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: stop_incident_members FK_stop_incident_members_incident; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.stop_incident_members
    ADD CONSTRAINT "FK_stop_incident_members_incident" FOREIGN KEY (incident_id) REFERENCES forge.stop_incidents(id) ON DELETE CASCADE;


--
-- Name: stop_reconciliations FK_stop_reconciliations_evidence_event; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.stop_reconciliations
    ADD CONSTRAINT "FK_stop_reconciliations_evidence_event" FOREIGN KEY (evidence_event_id) REFERENCES forge.production_events(id) ON DELETE RESTRICT;


--
-- Name: stop_reconciliations FK_stop_reconciliations_kept_event; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.stop_reconciliations
    ADD CONSTRAINT "FK_stop_reconciliations_kept_event" FOREIGN KEY (kept_event_id) REFERENCES forge.production_events(id) ON DELETE RESTRICT;


--
-- Name: stream_runs FK_stream_runs_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.stream_runs
    ADD CONSTRAINT "FK_stream_runs_product" FOREIGN KEY (product_id) REFERENCES forge.products(id) ON DELETE RESTRICT;


--
-- Name: stream_runs FK_stream_runs_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.stream_runs
    ADD CONSTRAINT "FK_stream_runs_unit" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: tasks FK_tasks_rca_action; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.tasks
    ADD CONSTRAINT "FK_tasks_rca_action" FOREIGN KEY (rca_action_id) REFERENCES forge.rca_actions(id) ON DELETE SET NULL;


--
-- Name: transition_standards FK_transition_standards_from_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.transition_standards
    ADD CONSTRAINT "FK_transition_standards_from_product" FOREIGN KEY (from_product_id) REFERENCES forge.products(id) ON DELETE RESTRICT;


--
-- Name: transition_standards FK_transition_standards_to_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.transition_standards
    ADD CONSTRAINT "FK_transition_standards_to_product" FOREIGN KEY (to_product_id) REFERENCES forge.products(id) ON DELETE RESTRICT;


--
-- Name: transition_standards FK_transition_standards_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.transition_standards
    ADD CONSTRAINT "FK_transition_standards_unit" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: uncertainty_budgets FK_uncertainty_budgets_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.uncertainty_budgets
    ADD CONSTRAINT "FK_uncertainty_budgets_unit" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: unit_impact_rules FK_unit_impact_rules_asset; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_impact_rules
    ADD CONSTRAINT "FK_unit_impact_rules_asset" FOREIGN KEY (asset_id) REFERENCES forge.assets(id) ON DELETE RESTRICT;


--
-- Name: unit_impact_rules FK_unit_impact_rules_standby_asset; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_impact_rules
    ADD CONSTRAINT "FK_unit_impact_rules_standby_asset" FOREIGN KEY (standby_asset_id) REFERENCES forge.assets(id) ON DELETE RESTRICT;


--
-- Name: unit_impact_rules FK_unit_impact_rules_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_impact_rules
    ADD CONSTRAINT "FK_unit_impact_rules_unit" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: unit_streams FK_unit_streams_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.unit_streams
    ADD CONSTRAINT "FK_unit_streams_unit" FOREIGN KEY (unit_id) REFERENCES forge.units(id) ON DELETE RESTRICT;


--
-- Name: user_notifications FK_user_notifications_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY forge.user_notifications
    ADD CONSTRAINT "FK_user_notifications_user" FOREIGN KEY (user_id) REFERENCES forge.users(id) ON DELETE CASCADE;


--
-- Name: accounting_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.accounting_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: accounting_revisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.accounting_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: actuals_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.actuals_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: actuals_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.actuals_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: actuals_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.actuals_results ENABLE ROW LEVEL SECURITY;

--
-- Name: actuals_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.actuals_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: af_bindings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.af_bindings ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.approval_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.approval_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: approved_loss_line_valuations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.approved_loss_line_valuations ENABLE ROW LEVEL SECURITY;

--
-- Name: approved_loss_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.approved_loss_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: approved_valuation_totals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.approved_valuation_totals ENABLE ROW LEVEL SECURITY;

--
-- Name: assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.assets ENABLE ROW LEVEL SECURITY;

--
-- Name: attribute_mapping_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.attribute_mapping_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: buffer_levels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.buffer_levels ENABLE ROW LEVEL SECURITY;

--
-- Name: bulk_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.bulk_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: calculation_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.calculation_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.calendar_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: code_mapping_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.code_mapping_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: code_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.code_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: crew_rotations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.crew_rotations ENABLE ROW LEVEL SECURITY;

--
-- Name: crews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.crews ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_attribute_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.custom_attribute_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_attribute_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.custom_attribute_values ENABLE ROW LEVEL SECURITY;

--
-- Name: demand_statuses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.demand_statuses ENABLE ROW LEVEL SECURITY;

--
-- Name: event_coding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.event_coding ENABLE ROW LEVEL SECURITY;

--
-- Name: event_impacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.event_impacts ENABLE ROW LEVEL SECURITY;

--
-- Name: event_relations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.event_relations ENABLE ROW LEVEL SECURITY;

--
-- Name: event_review_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.event_review_items ENABLE ROW LEVEL SECURITY;

--
-- Name: event_revisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.event_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: evidence_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.evidence_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: evidence_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.evidence_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: export_job_sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.export_job_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: export_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.export_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: external_production_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.external_production_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: failure_code_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.failure_code_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: failure_dictionary_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.failure_dictionary_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.feature_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: fx_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.fx_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: idempotency_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.idempotency_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: impact_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.impact_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: inbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.inbox ENABLE ROW LEVEL SECURITY;

--
-- Name: ingestion_exceptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.ingestion_exceptions ENABLE ROW LEVEL SECURITY;

--
-- Name: ingestion_job_transitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.ingestion_job_transitions ENABLE ROW LEVEL SECURITY;

--
-- Name: ingestion_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.ingestion_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.integration_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: kpi_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.kpi_results ENABLE ROW LEVEL SECURITY;

--
-- Name: loss_category_defs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.loss_category_defs ENABLE ROW LEVEL SECURITY;

--
-- Name: loss_line_evidence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.loss_line_evidence ENABLE ROW LEVEL SECURITY;

--
-- Name: loss_line_valuations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.loss_line_valuations ENABLE ROW LEVEL SECURITY;

--
-- Name: loss_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.loss_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: lot_dispositions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.lot_dispositions ENABLE ROW LEVEL SECURITY;

--
-- Name: measurement_samples; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.measurement_samples ENABLE ROW LEVEL SECURITY;

--
-- Name: month_close_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.month_close_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: month_closes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.month_closes ENABLE ROW LEVEL SECURITY;

--
-- Name: oee_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.oee_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: period_change_proposals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.period_change_proposals ENABLE ROW LEVEL SECURITY;

--
-- Name: period_data_holds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.period_data_holds ENABLE ROW LEVEL SECURITY;

--
-- Name: period_ledger_totals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.period_ledger_totals ENABLE ROW LEVEL SECURITY;

--
-- Name: period_product_slices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.period_product_slices ENABLE ROW LEVEL SECURITY;

--
-- Name: period_valuation_totals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.period_valuation_totals ENABLE ROW LEVEL SECURITY;

--
-- Name: pi_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.pi_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: pi_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.pi_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: pi_open_frames; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.pi_open_frames ENABLE ROW LEVEL SECURITY;

--
-- Name: pi_page_manifests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.pi_page_manifests ENABLE ROW LEVEL SECURITY;

--
-- Name: pi_sync_job_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.pi_sync_job_links ENABLE ROW LEVEL SECURITY;

--
-- Name: pi_sync_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.pi_sync_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: pi_sync_watermarks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.pi_sync_watermarks ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_generation_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.plan_generation_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.plan_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_product_slices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.plan_product_slices ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_scenarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.plan_scenarios ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.plan_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: plant_flow_routes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.plant_flow_routes ENABLE ROW LEVEL SECURITY;

--
-- Name: production_day_certifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.production_day_certifications ENABLE ROW LEVEL SECURITY;

--
-- Name: production_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.production_events ENABLE ROW LEVEL SECURITY;

--
-- Name: production_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.production_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: production_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.production_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: production_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.production_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.products ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_imports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rate_imports ENABLE ROW LEVEL SECURITY;

--
-- Name: raw_identities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.raw_identities ENABLE ROW LEVEL SECURITY;

--
-- Name: raw_observations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.raw_observations ENABLE ROW LEVEL SECURITY;

--
-- Name: rca_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rca_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: rca_barrier_analyses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rca_barrier_analyses ENABLE ROW LEVEL SECURITY;

--
-- Name: rca_case_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rca_case_links ENABLE ROW LEVEL SECURITY;

--
-- Name: rca_cause_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rca_cause_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: rca_causes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rca_causes ENABLE ROW LEVEL SECURITY;

--
-- Name: rca_change_analyses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rca_change_analyses ENABLE ROW LEVEL SECURITY;

--
-- Name: rca_fault_tree_analyses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rca_fault_tree_analyses ENABLE ROW LEVEL SECURITY;

--
-- Name: rca_fishbone_diagrams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rca_fishbone_diagrams ENABLE ROW LEVEL SECURITY;

--
-- Name: rca_five_why_analyses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rca_five_why_analyses ENABLE ROW LEVEL SECURITY;

--
-- Name: rca_fmea_analyses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rca_fmea_analyses ENABLE ROW LEVEL SECURITY;

--
-- Name: rca_knowledge_base; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rca_knowledge_base ENABLE ROW LEVEL SECURITY;

--
-- Name: rca_knowledge_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rca_knowledge_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: rca_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rca_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: rca_trigger_evaluations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rca_trigger_evaluations ENABLE ROW LEVEL SECURITY;

--
-- Name: rcas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rcas ENABLE ROW LEVEL SECURITY;

--
-- Name: reason_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.reason_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: reconciliation_line_sets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.reconciliation_line_sets ENABLE ROW LEVEL SECURITY;

--
-- Name: reconciliation_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.reconciliation_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: replay_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.replay_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: restatement_postings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.restatement_postings ENABLE ROW LEVEL SECURITY;

--
-- Name: role_delegations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.role_delegations ENABLE ROW LEVEL SECURITY;

--
-- Name: rule_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rule_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: rule_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rule_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.rules ENABLE ROW LEVEL SECURITY;

--
-- Name: secrets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.secrets ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_instances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.shift_instances ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.shift_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: signal_backfill_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.signal_backfill_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: signal_summaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.signal_summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: signals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.signals ENABLE ROW LEVEL SECURITY;

--
-- Name: sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.sites ENABLE ROW LEVEL SECURITY;

--
-- Name: source_hierarchy_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.source_hierarchy_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: source_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.source_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: source_objects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.source_objects ENABLE ROW LEVEL SECURITY;

--
-- Name: source_status_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.source_status_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: standby_equipment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.standby_equipment ENABLE ROW LEVEL SECURITY;

--
-- Name: standby_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.standby_records ENABLE ROW LEVEL SECURITY;

--
-- Name: state_engine_cursors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.state_engine_cursors ENABLE ROW LEVEL SECURITY;

--
-- Name: stop_incident_breaks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.stop_incident_breaks ENABLE ROW LEVEL SECURITY;

--
-- Name: stop_incident_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.stop_incident_members ENABLE ROW LEVEL SECURITY;

--
-- Name: stop_incidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.stop_incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: stop_reconciliations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.stop_reconciliations ENABLE ROW LEVEL SECURITY;

--
-- Name: stream_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.stream_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: accounting_policies tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.accounting_policies USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: accounting_revisions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.accounting_revisions USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: actuals_adjustments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.actuals_adjustments USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: actuals_jobs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.actuals_jobs USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: actuals_results tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.actuals_results USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: actuals_runs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.actuals_runs USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: af_bindings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.af_bindings USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: app_settings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.app_settings USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: approval_actions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.approval_actions USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: approval_snapshots tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.approval_snapshots USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: approved_loss_line_valuations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.approved_loss_line_valuations USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: approved_loss_lines tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.approved_loss_lines USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: approved_valuation_totals tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.approved_valuation_totals USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: assets tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.assets USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: attribute_mapping_versions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.attribute_mapping_versions USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: audit_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.audit_log USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: audit_logs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.audit_logs USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: buffer_levels tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.buffer_levels USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: bulk_jobs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.bulk_jobs USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: calculation_runs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.calculation_runs USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: calendar_versions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.calendar_versions USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: code_mapping_rules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.code_mapping_rules USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: code_versions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.code_versions USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: crew_rotations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.crew_rotations USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: crews tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.crews USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: custom_attribute_definitions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.custom_attribute_definitions USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: custom_attribute_values tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.custom_attribute_values USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: demand_statuses tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.demand_statuses USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: event_coding tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.event_coding USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: event_impacts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.event_impacts USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: event_relations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.event_relations USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: event_review_items tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.event_review_items USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: event_revisions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.event_revisions USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: evidence_categories tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.evidence_categories USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: evidence_locations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.evidence_locations USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: export_job_sources tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.export_job_sources USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: export_jobs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.export_jobs USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: external_production_reports tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.external_production_reports USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: failure_code_groups tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.failure_code_groups USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: failure_dictionary_entries tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.failure_dictionary_entries USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: feature_flags tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.feature_flags USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: fx_rates tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.fx_rates USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: idempotency_keys tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.idempotency_keys USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: impact_codes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.impact_codes USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: inbox tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.inbox USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: ingestion_exceptions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.ingestion_exceptions USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: ingestion_job_transitions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.ingestion_job_transitions USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: ingestion_jobs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.ingestion_jobs USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: integration_connections tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.integration_connections USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: kpi_results tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.kpi_results USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: loss_category_defs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.loss_category_defs USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: loss_line_evidence tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.loss_line_evidence USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: loss_line_valuations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.loss_line_valuations USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: loss_lines tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.loss_lines USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: lot_dispositions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.lot_dispositions USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: measurement_samples tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.measurement_samples USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: month_close_actions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.month_close_actions USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: month_closes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.month_closes USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: oee_codes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.oee_codes USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: outbox tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.outbox USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: period_change_proposals tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.period_change_proposals USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: period_data_holds tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.period_data_holds USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: period_ledger_totals tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.period_ledger_totals USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: period_product_slices tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.period_product_slices USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: period_valuation_totals tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.period_valuation_totals USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: pi_connections tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.pi_connections USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: pi_mappings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.pi_mappings USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: pi_open_frames tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.pi_open_frames USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: pi_page_manifests tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.pi_page_manifests USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: pi_sync_job_links tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.pi_sync_job_links USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: pi_sync_jobs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.pi_sync_jobs USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: pi_sync_watermarks tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.pi_sync_watermarks USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: plan_generation_jobs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.plan_generation_jobs USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: plan_periods tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.plan_periods USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: plan_product_slices tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.plan_product_slices USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: plan_scenarios tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.plan_scenarios USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: plan_versions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.plan_versions USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: plant_flow_routes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.plant_flow_routes USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: production_day_certifications tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.production_day_certifications USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: production_events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.production_events USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: production_periods tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.production_periods USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: production_plans tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.production_plans USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: production_profiles tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.production_profiles USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: products tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.products USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rate_imports tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rate_imports USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: raw_identities tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.raw_identities USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: raw_observations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.raw_observations USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rca_actions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rca_actions USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rca_barrier_analyses tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rca_barrier_analyses USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rca_case_links tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rca_case_links USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rca_cause_codes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rca_cause_codes USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rca_causes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rca_causes USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rca_change_analyses tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rca_change_analyses USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rca_fault_tree_analyses tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rca_fault_tree_analyses USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rca_fishbone_diagrams tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rca_fishbone_diagrams USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rca_five_why_analyses tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rca_five_why_analyses USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rca_fmea_analyses tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rca_fmea_analyses USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rca_knowledge_base tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rca_knowledge_base USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rca_knowledge_votes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rca_knowledge_votes USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rca_templates tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rca_templates USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rca_trigger_evaluations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rca_trigger_evaluations USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rcas tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rcas USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: reason_codes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.reason_codes USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: reconciliation_line_sets tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.reconciliation_line_sets USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: reconciliation_lines tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.reconciliation_lines USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: replay_runs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.replay_runs USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: restatement_postings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.restatement_postings USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: role_delegations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.role_delegations USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rule_runs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rule_runs USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rule_versions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rule_versions USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: rules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.rules USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: secrets tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.secrets USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: shift_instances tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.shift_instances USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: shift_notes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.shift_notes USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: signal_backfill_runs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.signal_backfill_runs USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: signal_summaries tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.signal_summaries USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: signals tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.signals USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: sites tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.sites USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: source_hierarchy_mappings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.source_hierarchy_mappings USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: source_mappings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.source_mappings USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: source_objects tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.source_objects USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: source_status_mappings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.source_status_mappings USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: standby_equipment tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.standby_equipment USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: standby_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.standby_records USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: state_engine_cursors tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.state_engine_cursors USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: stop_incident_breaks tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.stop_incident_breaks USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: stop_incident_members tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.stop_incident_members USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: stop_incidents tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.stop_incidents USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: stop_reconciliations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.stop_reconciliations USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: stream_runs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.stream_runs USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: tasks tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.tasks USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: transition_standards tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.transition_standards USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: uncertainty_budgets tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.uncertainty_budgets USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: unit_impact_rules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.unit_impact_rules USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: unit_product_rates tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.unit_product_rates USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: unit_state_mappings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.unit_state_mappings USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: unit_streams tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.unit_streams USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: units tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.units USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: user_notifications tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.user_notifications USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: user_scopes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.user_scopes USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: users tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.users USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: valuation_rates tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.valuation_rates USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: verification_status_codes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.verification_status_codes USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: work_order_operations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON forge.work_order_operations USING (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[])))) WITH CHECK (((( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids) IS NULL) OR (tenant_id IS NULL) OR ((tenant_id)::text = ANY (( SELECT forge.app_rls_tenant_ids() AS app_rls_tenant_ids)::text[]))));


--
-- Name: transition_standards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.transition_standards ENABLE ROW LEVEL SECURITY;

--
-- Name: uncertainty_budgets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.uncertainty_budgets ENABLE ROW LEVEL SECURITY;

--
-- Name: unit_impact_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.unit_impact_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: unit_product_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.unit_product_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: unit_state_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.unit_state_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: unit_streams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.unit_streams ENABLE ROW LEVEL SECURITY;

--
-- Name: units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.units ENABLE ROW LEVEL SECURITY;

--
-- Name: user_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.user_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: user_scopes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.user_scopes ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.users ENABLE ROW LEVEL SECURITY;

--
-- Name: valuation_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.valuation_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: verification_status_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.verification_status_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: work_order_operations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE forge.work_order_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA forge TO proact_rls_user;


--
-- Name: FUNCTION app_organization_user_by_email(p_tenant_id uuid, p_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION forge.app_organization_user_by_email(p_tenant_id uuid, p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION forge.app_organization_user_by_email(p_tenant_id uuid, p_email text) TO proact_rls_user;


--
-- Name: FUNCTION app_organization_user_rows(p_tenant_id uuid, p_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION forge.app_organization_user_rows(p_tenant_id uuid, p_email text) FROM PUBLIC;


--
-- Name: FUNCTION app_plant_user_directory(p_tenant_id uuid, p_user_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION forge.app_plant_user_directory(p_tenant_id uuid, p_user_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION forge.app_plant_user_directory(p_tenant_id uuid, p_user_ids uuid[]) TO proact_rls_user;


--
-- Name: FUNCTION app_plant_user_rows(p_tenant_id uuid, p_user_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION forge.app_plant_user_rows(p_tenant_id uuid, p_user_ids uuid[]) FROM PUBLIC;


--
-- Name: TABLE accounting_policies; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.accounting_policies TO proact_rls_user;


--
-- Name: TABLE accounting_revisions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.accounting_revisions TO proact_rls_user;


--
-- Name: TABLE actuals_adjustments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.actuals_adjustments TO proact_rls_user;


--
-- Name: TABLE actuals_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.actuals_jobs TO proact_rls_user;


--
-- Name: TABLE actuals_results; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.actuals_results TO proact_rls_user;


--
-- Name: TABLE actuals_runs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.actuals_runs TO proact_rls_user;


--
-- Name: TABLE af_bindings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.af_bindings TO proact_rls_user;


--
-- Name: TABLE app_settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.app_settings TO proact_rls_user;


--
-- Name: TABLE approval_actions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.approval_actions TO proact_rls_user;


--
-- Name: TABLE approval_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.approval_snapshots TO proact_rls_user;


--
-- Name: TABLE approved_loss_line_valuations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.approved_loss_line_valuations TO proact_rls_user;


--
-- Name: TABLE approved_loss_lines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.approved_loss_lines TO proact_rls_user;


--
-- Name: TABLE approved_valuation_totals; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.approved_valuation_totals TO proact_rls_user;


--
-- Name: TABLE assets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.assets TO proact_rls_user;


--
-- Name: TABLE attribute_mapping_versions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.attribute_mapping_versions TO proact_rls_user;


--
-- Name: TABLE audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.audit_log TO proact_rls_user;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.audit_logs TO proact_rls_user;


--
-- Name: TABLE auth_refresh_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.auth_refresh_tokens TO proact_rls_user;


--
-- Name: TABLE buffer_levels; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.buffer_levels TO proact_rls_user;


--
-- Name: TABLE bulk_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.bulk_jobs TO proact_rls_user;


--
-- Name: TABLE calculation_runs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.calculation_runs TO proact_rls_user;


--
-- Name: TABLE calendar_versions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.calendar_versions TO proact_rls_user;


--
-- Name: TABLE code_mapping_rules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.code_mapping_rules TO proact_rls_user;


--
-- Name: TABLE code_versions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.code_versions TO proact_rls_user;


--
-- Name: TABLE crew_rotations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.crew_rotations TO proact_rls_user;


--
-- Name: TABLE crews; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.crews TO proact_rls_user;


--
-- Name: TABLE custom_attribute_definitions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.custom_attribute_definitions TO proact_rls_user;


--
-- Name: TABLE custom_attribute_values; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.custom_attribute_values TO proact_rls_user;


--
-- Name: TABLE demand_statuses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.demand_statuses TO proact_rls_user;


--
-- Name: TABLE event_coding; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.event_coding TO proact_rls_user;


--
-- Name: TABLE event_impacts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.event_impacts TO proact_rls_user;


--
-- Name: TABLE event_relations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.event_relations TO proact_rls_user;


--
-- Name: TABLE event_review_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.event_review_items TO proact_rls_user;


--
-- Name: TABLE event_revisions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.event_revisions TO proact_rls_user;


--
-- Name: TABLE evidence_categories; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.evidence_categories TO proact_rls_user;


--
-- Name: TABLE evidence_locations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.evidence_locations TO proact_rls_user;


--
-- Name: TABLE export_job_sources; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.export_job_sources TO proact_rls_user;


--
-- Name: TABLE export_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.export_jobs TO proact_rls_user;


--
-- Name: TABLE external_production_reports; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.external_production_reports TO proact_rls_user;


--
-- Name: TABLE failure_code_groups; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.failure_code_groups TO proact_rls_user;


--
-- Name: TABLE failure_dictionary_entries; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.failure_dictionary_entries TO proact_rls_user;


--
-- Name: TABLE production_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.production_events TO proact_rls_user;


--
-- Name: TABLE failure_events_v; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.failure_events_v TO proact_rls_user;


--
-- Name: TABLE feature_flags; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.feature_flags TO proact_rls_user;


--
-- Name: TABLE fx_rates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.fx_rates TO proact_rls_user;


--
-- Name: TABLE idempotency_keys; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.idempotency_keys TO proact_rls_user;


--
-- Name: TABLE impact_codes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.impact_codes TO proact_rls_user;


--
-- Name: TABLE inbox; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.inbox TO proact_rls_user;


--
-- Name: TABLE ingestion_exceptions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.ingestion_exceptions TO proact_rls_user;


--
-- Name: TABLE ingestion_job_transitions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.ingestion_job_transitions TO proact_rls_user;


--
-- Name: TABLE ingestion_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.ingestion_jobs TO proact_rls_user;


--
-- Name: TABLE integration_connections; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.integration_connections TO proact_rls_user;


--
-- Name: TABLE kpi_results; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.kpi_results TO proact_rls_user;


--
-- Name: TABLE loss_lines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.loss_lines TO proact_rls_user;


--
-- Name: TABLE period_product_slices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.period_product_slices TO proact_rls_user;


--
-- Name: TABLE production_periods; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.production_periods TO proact_rls_user;


--
-- Name: TABLE loss_categories_v; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.loss_categories_v TO proact_rls_user;


--
-- Name: TABLE loss_category_defs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.loss_category_defs TO proact_rls_user;


--
-- Name: TABLE loss_line_evidence; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.loss_line_evidence TO proact_rls_user;


--
-- Name: TABLE loss_line_valuations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.loss_line_valuations TO proact_rls_user;


--
-- Name: TABLE lot_dispositions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.lot_dispositions TO proact_rls_user;


--
-- Name: TABLE measurement_samples; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.measurement_samples TO proact_rls_user;


--
-- Name: TABLE migrations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.migrations TO proact_rls_user;


--
-- Name: SEQUENCE migrations_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE forge.migrations_id_seq TO proact_rls_user;


--
-- Name: TABLE month_close_actions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.month_close_actions TO proact_rls_user;


--
-- Name: TABLE month_closes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.month_closes TO proact_rls_user;


--
-- Name: TABLE oee_codes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.oee_codes TO proact_rls_user;


--
-- Name: TABLE plan_versions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.plan_versions TO proact_rls_user;


--
-- Name: TABLE oee_summaries_v; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.oee_summaries_v TO proact_rls_user;


--
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.organizations TO proact_rls_user;


--
-- Name: TABLE outbox; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.outbox TO proact_rls_user;


--
-- Name: SEQUENCE outbox_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE forge.outbox_id_seq TO proact_rls_user;


--
-- Name: TABLE period_change_proposals; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.period_change_proposals TO proact_rls_user;


--
-- Name: TABLE period_data_holds; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.period_data_holds TO proact_rls_user;


--
-- Name: TABLE period_ledger_totals; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.period_ledger_totals TO proact_rls_user;


--
-- Name: TABLE period_valuation_totals; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.period_valuation_totals TO proact_rls_user;


--
-- Name: TABLE pi_connections; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.pi_connections TO proact_rls_user;


--
-- Name: TABLE pi_mappings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.pi_mappings TO proact_rls_user;


--
-- Name: TABLE pi_open_frames; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.pi_open_frames TO proact_rls_user;


--
-- Name: TABLE pi_page_manifests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.pi_page_manifests TO proact_rls_user;


--
-- Name: TABLE pi_sync_job_links; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.pi_sync_job_links TO proact_rls_user;


--
-- Name: TABLE pi_sync_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.pi_sync_jobs TO proact_rls_user;


--
-- Name: TABLE pi_sync_watermarks; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.pi_sync_watermarks TO proact_rls_user;


--
-- Name: TABLE plan_generation_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.plan_generation_jobs TO proact_rls_user;


--
-- Name: TABLE plan_periods; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.plan_periods TO proact_rls_user;


--
-- Name: TABLE plan_product_slices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.plan_product_slices TO proact_rls_user;


--
-- Name: TABLE plan_scenarios; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.plan_scenarios TO proact_rls_user;


--
-- Name: TABLE plant_flow_routes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.plant_flow_routes TO proact_rls_user;


--
-- Name: TABLE production_day_certifications; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.production_day_certifications TO proact_rls_user;


--
-- Name: TABLE production_losses_v; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.production_losses_v TO proact_rls_user;


--
-- Name: TABLE production_plans; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.production_plans TO proact_rls_user;


--
-- Name: TABLE production_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.production_profiles TO proact_rls_user;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.products TO proact_rls_user;


--
-- Name: TABLE rate_imports; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rate_imports TO proact_rls_user;


--
-- Name: TABLE raw_identities; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.raw_identities TO proact_rls_user;


--
-- Name: TABLE raw_observations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.raw_observations TO proact_rls_user;


--
-- Name: TABLE raw_observations_y2026m09; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.raw_observations_y2026m09 TO proact_rls_user;


--
-- Name: TABLE raw_observations_y2026m10; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.raw_observations_y2026m10 TO proact_rls_user;


--
-- Name: TABLE raw_observations_y2026m11; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.raw_observations_y2026m11 TO proact_rls_user;


--
-- Name: TABLE raw_observations_y2026m12; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.raw_observations_y2026m12 TO proact_rls_user;


--
-- Name: TABLE rca_actions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rca_actions TO proact_rls_user;


--
-- Name: TABLE rca_barrier_analyses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rca_barrier_analyses TO proact_rls_user;


--
-- Name: TABLE rca_case_links; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rca_case_links TO proact_rls_user;


--
-- Name: TABLE rca_cause_codes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rca_cause_codes TO proact_rls_user;


--
-- Name: TABLE rca_causes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rca_causes TO proact_rls_user;


--
-- Name: TABLE rca_change_analyses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rca_change_analyses TO proact_rls_user;


--
-- Name: TABLE rca_fault_tree_analyses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rca_fault_tree_analyses TO proact_rls_user;


--
-- Name: TABLE rca_fishbone_diagrams; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rca_fishbone_diagrams TO proact_rls_user;


--
-- Name: TABLE rca_five_why_analyses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rca_five_why_analyses TO proact_rls_user;


--
-- Name: TABLE rca_fmea_analyses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rca_fmea_analyses TO proact_rls_user;


--
-- Name: TABLE rca_knowledge_base; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rca_knowledge_base TO proact_rls_user;


--
-- Name: TABLE rca_knowledge_votes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rca_knowledge_votes TO proact_rls_user;


--
-- Name: TABLE rca_templates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rca_templates TO proact_rls_user;


--
-- Name: TABLE rca_trigger_evaluations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rca_trigger_evaluations TO proact_rls_user;


--
-- Name: TABLE rcas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rcas TO proact_rls_user;


--
-- Name: TABLE reason_codes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.reason_codes TO proact_rls_user;


--
-- Name: TABLE reconciliation_line_sets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.reconciliation_line_sets TO proact_rls_user;


--
-- Name: TABLE reconciliation_lines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.reconciliation_lines TO proact_rls_user;


--
-- Name: TABLE replay_runs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.replay_runs TO proact_rls_user;


--
-- Name: TABLE restatement_postings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.restatement_postings TO proact_rls_user;


--
-- Name: TABLE role_delegations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.role_delegations TO proact_rls_user;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.roles TO proact_rls_user;


--
-- Name: TABLE rule_runs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rule_runs TO proact_rls_user;


--
-- Name: TABLE rule_versions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rule_versions TO proact_rls_user;


--
-- Name: TABLE rules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.rules TO proact_rls_user;


--
-- Name: TABLE secrets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.secrets TO proact_rls_user;


--
-- Name: TABLE shift_instances; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.shift_instances TO proact_rls_user;


--
-- Name: TABLE shift_notes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.shift_notes TO proact_rls_user;


--
-- Name: TABLE signal_backfill_runs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.signal_backfill_runs TO proact_rls_user;


--
-- Name: TABLE signal_summaries; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.signal_summaries TO proact_rls_user;


--
-- Name: TABLE signals; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.signals TO proact_rls_user;


--
-- Name: TABLE sites; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.sites TO proact_rls_user;


--
-- Name: TABLE source_hierarchy_mappings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.source_hierarchy_mappings TO proact_rls_user;


--
-- Name: TABLE source_mappings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.source_mappings TO proact_rls_user;


--
-- Name: TABLE source_objects; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.source_objects TO proact_rls_user;


--
-- Name: TABLE source_status_mappings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.source_status_mappings TO proact_rls_user;


--
-- Name: TABLE standby_equipment; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.standby_equipment TO proact_rls_user;


--
-- Name: TABLE standby_records; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.standby_records TO proact_rls_user;


--
-- Name: TABLE state_engine_cursors; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.state_engine_cursors TO proact_rls_user;


--
-- Name: TABLE stop_incident_breaks; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.stop_incident_breaks TO proact_rls_user;


--
-- Name: TABLE stop_incident_members; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.stop_incident_members TO proact_rls_user;


--
-- Name: TABLE stop_incidents; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.stop_incidents TO proact_rls_user;


--
-- Name: TABLE stop_reconciliations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.stop_reconciliations TO proact_rls_user;


--
-- Name: TABLE stream_runs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.stream_runs TO proact_rls_user;


--
-- Name: TABLE tasks; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.tasks TO proact_rls_user;


--
-- Name: TABLE tenants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.tenants TO proact_rls_user;


--
-- Name: TABLE transition_standards; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.transition_standards TO proact_rls_user;


--
-- Name: TABLE typeorm_metadata; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.typeorm_metadata TO proact_rls_user;


--
-- Name: TABLE uncertainty_budgets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.uncertainty_budgets TO proact_rls_user;


--
-- Name: TABLE unit_impact_rules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.unit_impact_rules TO proact_rls_user;


--
-- Name: TABLE unit_product_rates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.unit_product_rates TO proact_rls_user;


--
-- Name: TABLE unit_state_mappings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.unit_state_mappings TO proact_rls_user;


--
-- Name: TABLE unit_streams; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.unit_streams TO proact_rls_user;


--
-- Name: TABLE units; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.units TO proact_rls_user;


--
-- Name: TABLE user_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.user_notifications TO proact_rls_user;


--
-- Name: TABLE user_scopes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.user_scopes TO proact_rls_user;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.users TO proact_rls_user;


--
-- Name: TABLE valuation_rates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.valuation_rates TO proact_rls_user;


--
-- Name: TABLE verification_status_codes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.verification_status_codes TO proact_rls_user;


--
-- Name: TABLE work_order_operations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE forge.work_order_operations TO proact_rls_user;


--
-- PostgreSQL database dump complete
--


--
-- PostgreSQL database dump
--


-- Dumped from database version 15.18
-- Dumped by pg_dump version 15.18

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
CREATE SCHEMA IF NOT EXISTS forge;
SET search_path = forge, public;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO forge.migrations VALUES (1, 1791411016572, 'Baseline1791411016572');
INSERT INTO forge.migrations VALUES (2, 1791497600000, 'UserScopesAndIdempotency1791497600000');
INSERT INTO forge.migrations VALUES (3, 1791584000000, 'EventIntervalModel1791584000000');
INSERT INTO forge.migrations VALUES (4, 1791670400000, 'EventRevisions1791670400000');
INSERT INTO forge.migrations VALUES (5, 1791756800000, 'HierarchyMappingAndCodeLibraries1791756800000');
INSERT INTO forge.migrations VALUES (6, 1791843200000, 'EventOperations1791843200000');
INSERT INTO forge.migrations VALUES (7, 1791929600000, 'IntakeCore1791929600000');
INSERT INTO forge.migrations VALUES (8, 1791929600001, 'PiConnectionsToIntegrationConnections1791929600001');
INSERT INTO forge.migrations VALUES (9, 1792016000000, 'PiCertifiedIntake1792016000000');
INSERT INTO forge.migrations VALUES (10, 1792102400000, 'SignalsAndSamples1792102400000');
INSERT INTO forge.migrations VALUES (11, 1792188800000, 'Calendars1792188800000');
INSERT INTO forge.migrations VALUES (12, 1792275200000, 'ProfilesAndRates1792275200000');
INSERT INTO forge.migrations VALUES (13, 1792361600000, 'PlanVersions1792361600000');
INSERT INTO forge.migrations VALUES (14, 1792448000000, 'PeriodsActuals1792448000000');
INSERT INTO forge.migrations VALUES (15, 1792534400000, 'AccountingEngine1792534400000');
INSERT INTO forge.migrations VALUES (16, 1792620800000, 'ReconciliationWorkflow1792620800000');
INSERT INTO forge.migrations VALUES (17, 1792707200000, 'ExportsAndDomainEvents1792707200000');
INSERT INTO forge.migrations VALUES (18, 1792793600000, 'KpiResults1792793600000');
INSERT INTO forge.migrations VALUES (19, 1792880000000, 'Valuation1792880000000');
INSERT INTO forge.migrations VALUES (20, 1792966400000, 'FeatureFlags1792966400000');
INSERT INTO forge.migrations VALUES (21, 1793052800000, 'DeclarativeRules1793052800000');
INSERT INTO forge.migrations VALUES (22, 1793139200000, 'RcaLinks1793139200000');
INSERT INTO forge.migrations VALUES (23, 1793225600000, 'MigrationCutover1793225600000');
INSERT INTO forge.migrations VALUES (24, 1793312000000, 'AppSettingsScopeAndRefreshTokens1793312000000');
INSERT INTO forge.migrations VALUES (25, 1793398400000, 'RcaChildIntegrity1793398400000');
INSERT INTO forge.migrations VALUES (26, 1793484800000, 'TenantRowLevelSecurity1793484800000');
INSERT INTO forge.migrations VALUES (27, 1793571200000, 'ProductionEventsTenantStartIndex1793571200000');
INSERT INTO forge.migrations VALUES (28, 1793657600000, 'MqttSubscribeJobsAndDecodeErrorCodes1793657600000');
INSERT INTO forge.migrations VALUES (29, 1793746800000, 'RcaKnowledgeV21793746800000');
INSERT INTO forge.migrations VALUES (30, 1793833200000, 'TenantDisplaySettings1793833200000');
INSERT INTO forge.migrations VALUES (31, 1793900000000, 'VerificationChecklistColumns1793900000000');
INSERT INTO forge.migrations VALUES (32, 1793900060000, 'RcaCauseCodeParent1793900060000');
INSERT INTO forge.migrations VALUES (33, 1793900500000, 'MasterDataV21793900500000');
INSERT INTO forge.migrations VALUES (34, 1793902000000, 'PlaReportIndexes1793902000000');
INSERT INTO forge.migrations VALUES (35, 1793903100000, 'RcaAnalysisRowVersion1793903100000');
INSERT INTO forge.migrations VALUES (36, 1793904000000, 'AdministrationIndexes1793904000000');
INSERT INTO forge.migrations VALUES (37, 1793905000000, 'PlantUserDirectory1793905000000');
INSERT INTO forge.migrations VALUES (38, 1793906000000, 'ApprovedValuationTotals1793906000000');
INSERT INTO forge.migrations VALUES (39, 1793907000000, 'EventHistoryRestrict1793907000000');
INSERT INTO forge.migrations VALUES (40, 1793908000000, 'ProductionEventsSpanIndex1793908000000');
INSERT INTO forge.migrations VALUES (41, 1793909000000, 'ProductionEventsForeignKeyIndexes1793909000000');
INSERT INTO forge.migrations VALUES (42, 1793910000000, 'RlsPolicyInitPlan1793910000000');
INSERT INTO forge.migrations VALUES (43, 1793911000000, 'OutboxPendingIndex1793911000000');
INSERT INTO forge.migrations VALUES (44, 1793912000000, 'KpiEquivalentDowntime1793912000000');
INSERT INTO forge.migrations VALUES (45, 1793913000000, 'DowntimeImpactBackfill1793913000000');
INSERT INTO forge.migrations VALUES (46, 1793914000000, 'ApprovedLedgerLines1793914000000');
INSERT INTO forge.migrations VALUES (47, 1793915000000, 'KpiScheduleDowntime1793915000000');
INSERT INTO forge.migrations VALUES (48, 1793916000000, 'TenantWeekStart1793916000000');
INSERT INTO forge.migrations VALUES (49, 1793917000000, 'OeePolicyFirstOut1793917000000');
INSERT INTO forge.migrations VALUES (50, 1793918000000, 'KpiCodedDowntime1793918000000');
INSERT INTO forge.migrations VALUES (51, 1793919000000, 'EventOrigin1793919000000');
INSERT INTO forge.migrations VALUES (52, 1793920000000, 'PlannedStopWindow1793920000000');
INSERT INTO forge.migrations VALUES (53, 1793921000000, 'FailureDetail1793921000000');
INSERT INTO forge.migrations VALUES (54, 1793922000000, 'ReconciliationLineEvidence1793922000000');
INSERT INTO forge.migrations VALUES (55, 1793923000000, 'ToleranceUnexplainedTarget1793923000000');
INSERT INTO forge.migrations VALUES (56, 1793930000000, 'GradeTransitionKinds1793930000000');
INSERT INTO forge.migrations VALUES (57, 1793930100000, 'GradeTransitionStandards1793930100000');
INSERT INTO forge.migrations VALUES (58, 1793940000000, 'FailureDictionary1793940000000');
INSERT INTO forge.migrations VALUES (59, 1793941000000, 'StandbyRecords1793941000000');
INSERT INTO forge.migrations VALUES (60, 1793942000000, 'WorkOrderOperations1793942000000');
INSERT INTO forge.migrations VALUES (61, 1793943000000, 'UnitStateMappings1793943000000');
INSERT INTO forge.migrations VALUES (62, 1793950000000, 'ValuationFinanceV31793950000000');
INSERT INTO forge.migrations VALUES (63, 1793950100000, 'ValuationPolicyV31793950100000');
INSERT INTO forge.migrations VALUES (64, 1793960000000, 'RcaClosureEffectiveness1793960000000');
INSERT INTO forge.migrations VALUES (65, 1793970000000, 'DropRedundantTenantIndexes1793970000000');
INSERT INTO forge.migrations VALUES (66, 1793970100000, 'IntervalChecksValidated1793970100000');
INSERT INTO forge.migrations VALUES (67, 1793970200000, 'LegacyMoneyNumeric1793970200000');
INSERT INTO forge.migrations VALUES (68, 1793970300000, 'HotTableFillfactor1793970300000');
INSERT INTO forge.migrations VALUES (69, 1793970400000, 'AuditRetentionSupport1793970400000');
INSERT INTO forge.migrations VALUES (70, 1793970500000, 'LegacyTenantUuid1793970500000');
INSERT INTO forge.migrations VALUES (71, 1793980070000, 'DropDashboardConfigurations1793980070000');
INSERT INTO forge.migrations VALUES (72, 1793980200000, 'PlannedTransitionTotals1793980200000');
INSERT INTO forge.migrations VALUES (73, 1793980210000, 'OeePolicyTransitionAllowancePlanned1793980210000');
INSERT INTO forge.migrations VALUES (74, 1793990000000, 'DropLegacyConnectivity1793990000000');
INSERT INTO forge.migrations VALUES (75, 1794010000000, 'MonthClose1794010000000');
INSERT INTO forge.migrations VALUES (76, 1794010100000, 'ReconciliationSla1794010100000');
INSERT INTO forge.migrations VALUES (77, 1794010200000, 'RestatementPostingSourceStatus1794010200000');
INSERT INTO forge.migrations VALUES (78, 1794010300000, 'DayCertification1794010300000');
INSERT INTO forge.migrations VALUES (79, 1794030000000, 'ProvisionalFxRates1794030000000');
INSERT INTO forge.migrations VALUES (80, 1794040000000, 'LotDispositions1794040000000');
INSERT INTO forge.migrations VALUES (81, 1794060000000, 'ManualChangeProposal1794060000000');
INSERT INTO forge.migrations VALUES (82, 1794060100000, 'UserNotifications1794060100000');
INSERT INTO forge.migrations VALUES (83, 1794070000000, 'CoreTenantUuid1794070000000');
INSERT INTO forge.migrations VALUES (84, 1794110000000, 'ReworkYieldRate1794110000000');
INSERT INTO forge.migrations VALUES (85, 1794110100000, 'ValuationComponentBreakdown1794110100000');
INSERT INTO forge.migrations VALUES (86, 1794120000000, 'MeasurementSourcesUncertainty1794120000000');
INSERT INTO forge.migrations VALUES (87, 1794130000000, 'SlaReminders1794130000000');
INSERT INTO forge.migrations VALUES (88, 1794130001000, 'StopCodingVerification1794130001000');
INSERT INTO forge.migrations VALUES (89, 1794130002000, 'ReversalLineKind1794130002000');
INSERT INTO forge.migrations VALUES (90, 1794130003000, 'ReversalLines1794130003000');
INSERT INTO forge.migrations VALUES (91, 1794130004000, 'BridgeReviewAction1794130004000');
INSERT INTO forge.migrations VALUES (92, 1794130005000, 'RoleDelegations1794130005000');
INSERT INTO forge.migrations VALUES (93, 1794150000000, 'ExportPdfFormat1794150000000');
INSERT INTO forge.migrations VALUES (94, 1794150100000, 'ControllableAvailabilityMetric1794150100000');
INSERT INTO forge.migrations VALUES (95, 1794160000000, 'TransitionStandardContext1794160000000');
INSERT INTO forge.migrations VALUES (96, 1794160100000, 'UnitStreams1794160100000');
INSERT INTO forge.migrations VALUES (97, 1794160200000, 'PlantFlow1794160200000');
INSERT INTO forge.migrations VALUES (98, 1794170000000, 'StopEventsStateEngine1794170000000');
INSERT INTO forge.migrations VALUES (99, 1794180030000, 'SourceAuthorityMakerChecker1794180030000');
INSERT INTO forge.migrations VALUES (100, 1794190000000, 'DelegableMetrologyApprover1794190000000');
INSERT INTO forge.migrations VALUES (101, 1794190100000, 'UnitImpactRules1794190100000');
INSERT INTO forge.migrations VALUES (102, 1794190200000, 'AnalogStateThresholds1794190200000');
INSERT INTO forge.migrations VALUES (103, 1794190300000, 'SourceFallbackNotifications1794190300000');
INSERT INTO forge.migrations VALUES (104, 1794190400000, 'SuperAdminApprovalOverride1794190400000');
INSERT INTO forge.migrations VALUES (105, 1794190800000, 'ApprovalInboxIndexes1794190800000');
INSERT INTO forge.migrations VALUES (106, 1794210500000, 'RcaUxRemediation1794210500000');
INSERT INTO forge.migrations VALUES (107, 1794210600000, 'ProductionEventListIndexes1794210600000');
INSERT INTO forge.migrations VALUES (108, 1794220300000, 'WorkReminderNotifications1794220300000');
INSERT INTO forge.migrations VALUES (109, 1794220400000, 'RcaRecommendationActionTasks1794220400000');
INSERT INTO forge.migrations VALUES (110, 1794220500000, 'RcaTypedCauses1794220500000');
INSERT INTO forge.migrations VALUES (111, 1794220600000, 'RcaFieldHistory1794220600000');
INSERT INTO forge.migrations VALUES (112, 1794220700000, 'LossLineAppliedRate1794220700000');
INSERT INTO forge.migrations VALUES (113, 1794220800000, 'PolicyCommissioningBackdate1794220800000');
INSERT INTO forge.migrations VALUES (114, 1794220900000, 'RestoreDerivedStopSourceKind1794220900000');
INSERT INTO forge.migrations VALUES (115, 1794221300000, 'ValuationBackdateRestatement1794221300000');
INSERT INTO forge.migrations VALUES (116, 1794221460000, 'RcaActionVerificationPlan1794221460000');
INSERT INTO forge.migrations VALUES (117, 1794221550000, 'ValuationChangeTrigger1794221550000');
INSERT INTO forge.migrations VALUES (118, 1794221600000, 'UncodeReasonlessCodedStops1794221600000');
INSERT INTO forge.migrations VALUES (119, 1794221700000, 'CloseRecommendationsOfClosedCases1794221700000');
INSERT INTO forge.migrations VALUES (120, 1794222350000, 'NotificationWorkItemResolution1794222350000');
INSERT INTO forge.migrations VALUES (121, 1794222400000, 'RecordUncodedStopRepairRevision1794222400000');
INSERT INTO forge.migrations VALUES (122, 1794222580000, 'HierarchyRowVersion1794222580000');
INSERT INTO forge.migrations VALUES (123, 1794222791000, 'ExportJobLabels1794222791000');
INSERT INTO forge.migrations VALUES (124, 1794222800000, 'LegacyRoleMirrorBackfill1794222800000');
INSERT INTO forge.migrations VALUES (125, 1794222810000, 'RecordClosedRecommendationRepairHistory1794222810000');
INSERT INTO forge.migrations VALUES (126, 1794222900000, 'ProductionEventSourceIdIndex1794222900000');
INSERT INTO forge.migrations VALUES (127, 1794240100000, 'ExportRcaCase1794240100000');
INSERT INTO forge.migrations VALUES (128, 1794240200000, 'RcaRecurrenceWatch1794240200000');
INSERT INTO forge.migrations VALUES (129, 1794240210000, 'RcaCriticalConsequenceClass1794240210000');
INSERT INTO forge.migrations VALUES (130, 1794240400000, 'WeightedReasonStops1794240400000');
INSERT INTO forge.migrations VALUES (131, 1794240500000, 'DropV1RcaTables1794240500000');
INSERT INTO forge.migrations VALUES (132, 1794240600000, 'MeasurementSamplesInsertedIndex1794240600000');
INSERT INTO forge.migrations VALUES (133, 1794240600000, 'DropV1LegacyTables1794240600000');
INSERT INTO forge.migrations VALUES (134, 1794240610000, 'DropPiAfElementDuplicateIndex1794240610000');
INSERT INTO forge.migrations VALUES (135, 1794240700000, 'PgStatStatements1794240700000');
INSERT INTO forge.migrations VALUES (136, 1794240800000, 'ShiftNotes1794240800000');
INSERT INTO forge.migrations VALUES (137, 1794240900000, 'OpsReportExports1794240900000');
INSERT INTO forge.migrations VALUES (138, 1794241000000, 'TenantWeekStartAnyDay1794241000000');
INSERT INTO forge.migrations VALUES (139, 1794241100000, 'PlantMonthKeyFunction1794241100000');
INSERT INTO forge.migrations VALUES (140, 1794241101000, 'ExternalReportSourceFigures1794241101000');
INSERT INTO forge.migrations VALUES (141, 1794241200000, 'LossAccountingPolicyKind1794241200000');
INSERT INTO forge.migrations VALUES (142, 1794241300000, 'ProductionLossEventKind1794241300000');
INSERT INTO forge.migrations VALUES (143, 1794241301000, 'ProductionEventDeclaredFigures1794241301000');
INSERT INTO forge.migrations VALUES (144, 1794241400000, 'ApprovalInboxLossAccounting1794241400000');


--
-- Data for Name: typeorm_metadata; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO forge.typeorm_metadata VALUES ('GENERATED_COLUMN', 'traverse_forge', 'forge', 'production_events', 'duration_seconds', 'CASE WHEN "end_time" IS NULL THEN NULL ELSE EXTRACT(EPOCH FROM ("end_time" - "start_time")) END');


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('forge.migrations_id_seq', 144, true);


--
-- PostgreSQL database dump complete
--


