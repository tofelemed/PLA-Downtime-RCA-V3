--
-- PostgreSQL database dump
--

\restrict FmNYYQF6w2Y4DXwifYI19iptOLhWgK0tN6vKVK2oFoJaRuKnIJCq3SWmnS4t5lo

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: af_bindings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.af_bindings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    web_id character varying(255),
    local_id character varying(36),
    bound_type character varying(100),
    mapping_config text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    key character varying(255) NOT NULL,
    value text NOT NULL
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
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
    tenant_id character varying(36),
    organization_id character varying(36),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id character varying(36) NOT NULL,
    details text,
    organization_id character varying(36),
    tenant_id character varying(36),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    "timestamp" timestamp with time zone NOT NULL
);


--
-- Name: bacnet_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bacnet_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500),
    "ipAddress" character varying(45) NOT NULL,
    port integer DEFAULT 47808 NOT NULL,
    "deviceId" integer DEFAULT 123 NOT NULL,
    "timeoutMs" integer DEFAULT 10000 NOT NULL,
    "retryCount" integer DEFAULT 3 NOT NULL,
    "pollingIntervalMs" integer DEFAULT 1000 NOT NULL,
    "operationType" character varying(50) DEFAULT 'readProperty'::character varying NOT NULL,
    "objectType" character varying(100),
    "objectInstance" integer,
    "propertyId" character varying(100),
    enabled boolean DEFAULT true NOT NULL,
    "tenantId" uuid NOT NULL,
    status character varying(50) DEFAULT 'disconnected'::character varying NOT NULL,
    "lastConnected" timestamp with time zone,
    "errorCount" integer DEFAULT 0 NOT NULL,
    "lastError" text,
    metadata text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: barrier_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barrier_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    rca_id character varying(36) NOT NULL,
    hazard text,
    barriers text
);


--
-- Name: change_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    rca_id character varying(36) NOT NULL,
    change_description text,
    changes text
);


--
-- Name: connection_health; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connection_health (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "connectionType" character varying(50) NOT NULL,
    "opcuaConnectionId" uuid,
    "modbusConnectionId" uuid,
    "ethernetipConnectionId" uuid,
    "mqttConnectionId" uuid,
    "systemIntegrationId" uuid,
    status character varying(20) NOT NULL,
    "responseTimeMs" integer,
    "dataPointCount" integer,
    "errorRate" numeric(10,4),
    "lastDataReceivedMs" integer,
    "errorMessage" text,
    metrics text,
    configuration text,
    "checkedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: custom_attribute_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_attribute_definitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
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


--
-- Name: custom_attribute_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_attribute_values (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    entity_id character varying(36) NOT NULL,
    entity_type character varying(100) NOT NULL,
    attribute_definition_id character varying(36) NOT NULL,
    value text
);


--
-- Name: dashboard_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_configurations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    dashboard_name character varying(255) NOT NULL,
    dashboard_type character varying(100),
    layout_config text,
    widget_config text,
    tenant_id character varying(36),
    organization_id character varying(36),
    is_default boolean DEFAULT false NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    created_by character varying(36),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: data_bindings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_bindings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500),
    "sourceOPCUAConnectionId" uuid,
    "sourceModbusConnectionId" uuid,
    "sourceEtherNetIPConnectionId" uuid,
    "sourceMQTTConnectionId" uuid,
    "sourceSystemIntegrationId" uuid,
    "targetOPCUAConnectionId" uuid,
    "targetModbusConnectionId" uuid,
    "targetEtherNetIPConnectionId" uuid,
    "targetMQTTConnectionId" uuid,
    "targetSystemIntegrationId" uuid,
    "sourcePath" character varying(500),
    "targetPath" character varying(500),
    "transformationRules" text,
    "pollingIntervalMs" integer DEFAULT 1000 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    active boolean DEFAULT false NOT NULL,
    "triggerMode" character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    schedule text,
    filters text,
    "tenantId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: data_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_sources (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    source_name character varying(255) NOT NULL,
    type character varying(100),
    connection_string text,
    credentials_encrypted text,
    status character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    last_sync_time timestamp with time zone,
    config text
);


--
-- Name: data_transformations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_transformations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "bindingId" uuid NOT NULL,
    "transformationType" character varying(50) NOT NULL,
    parameters text,
    "orderIndex" integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    description character varying(500),
    "inputMapping" text,
    "outputMapping" text,
    formula character varying(1000),
    conditions text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: database_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.database_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500),
    "databaseType" character varying(50) NOT NULL,
    host character varying(45) NOT NULL,
    port integer DEFAULT 5432 NOT NULL,
    database character varying(100) NOT NULL,
    username character varying(100),
    "passwordHash" character varying(255),
    schema character varying(100),
    "table" character varying(100),
    "timeoutMs" integer DEFAULT 30000 NOT NULL,
    "retryCount" integer DEFAULT 3 NOT NULL,
    "pollingIntervalMs" integer DEFAULT 1000 NOT NULL,
    "operationType" character varying(50) DEFAULT 'query'::character varying NOT NULL,
    query text,
    "connectionString" text,
    enabled boolean DEFAULT true NOT NULL,
    "tenantId" uuid NOT NULL,
    status character varying(50) DEFAULT 'disconnected'::character varying NOT NULL,
    "lastConnected" timestamp with time zone,
    "errorCount" integer DEFAULT 0 NOT NULL,
    "lastError" text,
    metadata text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: dnp3_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dnp3_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500),
    "ipAddress" character varying(45) NOT NULL,
    port integer DEFAULT 20000 NOT NULL,
    "connectionType" character varying(20) DEFAULT 'tcp'::character varying NOT NULL,
    "sourceAddress" integer DEFAULT 1 NOT NULL,
    "destinationAddress" integer DEFAULT 1 NOT NULL,
    "timeoutMs" integer DEFAULT 10000 NOT NULL,
    "retryCount" integer DEFAULT 3 NOT NULL,
    "pollingIntervalMs" integer DEFAULT 1000 NOT NULL,
    "operationType" character varying(50) DEFAULT 'read'::character varying NOT NULL,
    "objectGroup" character varying(100),
    "objectVariation" integer,
    "startIndex" integer,
    "stopIndex" integer,
    enabled boolean DEFAULT true NOT NULL,
    "tenantId" uuid NOT NULL,
    status character varying(50) DEFAULT 'disconnected'::character varying NOT NULL,
    "lastConnected" timestamp with time zone,
    "errorCount" integer DEFAULT 0 NOT NULL,
    "lastError" text,
    metadata text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ethernetip_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ethernetip_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500),
    "ipAddress" character varying(45) NOT NULL,
    port integer DEFAULT 44818 NOT NULL,
    "timeoutMs" integer DEFAULT 10000 NOT NULL,
    "retryCount" integer DEFAULT 3 NOT NULL,
    "backplaneSlot" integer DEFAULT 0 NOT NULL,
    "cipSecurity" boolean DEFAULT false NOT NULL,
    "vendorId" integer DEFAULT 1 NOT NULL,
    "productCode" integer DEFAULT 0 NOT NULL,
    "pollingIntervalMs" integer DEFAULT 100 NOT NULL,
    "tagPaths" text,
    "dataTypes" text,
    "arraySizes" text,
    enabled boolean DEFAULT true NOT NULL,
    "tenantId" uuid NOT NULL,
    "organizationId" character varying(36),
    status character varying(50) DEFAULT 'disconnected'::character varying NOT NULL,
    "lastConnected" timestamp with time zone,
    "errorCount" integer DEFAULT 0 NOT NULL,
    "lastError" text,
    metadata text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: evidence_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evidence_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category_name character varying(255) NOT NULL,
    description text,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: evidence_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evidence_locations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    location_name character varying(255) NOT NULL,
    description text,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fault_tree_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fault_tree_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    rca_id character varying(36) NOT NULL,
    top_event text,
    tree_data text
);


--
-- Name: fishbone_diagrams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fishbone_diagrams (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    rca_id character varying(36) NOT NULL,
    problem_statement text,
    categories text,
    causes text
);


--
-- Name: five_why_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.five_why_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    rca_id character varying(36) NOT NULL,
    problem_statement text,
    why_levels text,
    root_cause text
);


--
-- Name: fmea_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fmea_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    rca_id character varying(36) NOT NULL,
    analysis_name character varying(255),
    failure_modes text
);


--
-- Name: historian_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historian_tags (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    web_id character varying(255),
    tag_name character varying(255) NOT NULL,
    tag_path character varying(1000),
    description text,
    category character varying(100),
    unit_of_measure character varying(50),
    data_type character varying(50),
    update_interval integer,
    warning_threshold double precision,
    alarm_threshold double precision,
    enabled boolean DEFAULT true NOT NULL,
    config text
);


--
-- Name: impact_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.impact_codes (
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: logic_tree_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logic_tree_nodes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "rcaId" uuid NOT NULL,
    "parentId" uuid,
    question text NOT NULL,
    answer text,
    type character varying(50) NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    "evidenceIds" text NOT NULL,
    "position" text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: loss_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loss_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "reconcileFormId" uuid NOT NULL,
    "categoryName" character varying(255) NOT NULL,
    "lossAmount" double precision NOT NULL,
    "impactCodeId" uuid NOT NULL,
    "oeeCodeId" uuid NOT NULL,
    description text NOT NULL,
    "tenantId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: modbus_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modbus_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500),
    connection_type character varying(20) NOT NULL,
    ip_address character varying(45),
    port integer,
    serial_port character varying(50),
    baud_rate integer,
    timeout_ms integer DEFAULT 5000 NOT NULL,
    retry_count integer DEFAULT 3 NOT NULL,
    unit_id integer DEFAULT 1 NOT NULL,
    polling_interval_ms integer DEFAULT 1000 NOT NULL,
    start_address integer DEFAULT 0 NOT NULL,
    register_count integer DEFAULT 10 NOT NULL,
    data_type character varying(20) DEFAULT 'uint16'::character varying NOT NULL,
    byte_ordering character varying(20) DEFAULT 'big-endian'::character varying NOT NULL,
    scaling_factor numeric(10,4) DEFAULT '1'::numeric NOT NULL,
    unit character varying(50),
    enabled boolean DEFAULT true NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id character varying(36),
    status character varying(50) DEFAULT 'disconnected'::character varying NOT NULL,
    last_connected timestamp with time zone,
    error_count integer DEFAULT 0 NOT NULL,
    last_error text,
    metadata text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    "tenantId" uuid
);


--
-- Name: mqtt_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mqtt_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500),
    broker_url character varying(500) NOT NULL,
    port integer DEFAULT 1883 NOT NULL,
    client_id character varying(255),
    username character varying(255),
    password_hash character varying(255),
    keep_alive_seconds integer DEFAULT 60 NOT NULL,
    reconnect_period_ms integer DEFAULT 1000 NOT NULL,
    connect_timeout_ms integer DEFAULT 30000 NOT NULL,
    clean_session boolean DEFAULT true NOT NULL,
    subscribe_topics text,
    publish_topic character varying(500),
    qos_level integer DEFAULT 1 NOT NULL,
    use_tls boolean DEFAULT false NOT NULL,
    ca_cert character varying(500),
    client_cert character varying(500),
    client_key character varying(500),
    last_will_topic character varying(500),
    last_will_message text,
    last_will_qos integer DEFAULT 1 NOT NULL,
    last_will_retain boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id character varying(36),
    status character varying(50) DEFAULT 'disconnected'::character varying NOT NULL,
    last_connected timestamp with time zone,
    error_count integer DEFAULT 0 NOT NULL,
    last_error text,
    metadata text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    "tenantId" uuid
);


--
-- Name: oee_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oee_codes (
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: oee_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oee_summaries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    plan_id uuid NOT NULL,
    availability numeric(5,2),
    performance numeric(5,2),
    quality numeric(5,2),
    oee numeric(5,2),
    period character varying(50),
    planned_production_time numeric(10,2),
    actual_production_time numeric(10,2),
    downtime numeric(10,2),
    tenant_id uuid,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: opcua_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opcua_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500),
    endpoint character varying(500) NOT NULL,
    security_mode character varying(50) DEFAULT 'SignAndEncrypt'::character varying NOT NULL,
    security_policy character varying(100) DEFAULT 'Basic256Sha256'::character varying NOT NULL,
    authentication character varying(50) DEFAULT 'Anonymous'::character varying NOT NULL,
    certificate_path character varying(500),
    private_key_path character varying(500),
    reconnect_interval_ms integer DEFAULT 5000 NOT NULL,
    max_reconnect_attempts integer DEFAULT 5 NOT NULL,
    username character varying(255),
    password_hash character varying(255),
    timeout_ms integer DEFAULT 30000 NOT NULL,
    session_timeout_ms integer DEFAULT 60000 NOT NULL,
    keep_alive_ms integer DEFAULT 10000 NOT NULL,
    max_message_size integer DEFAULT 65536 NOT NULL,
    polling_interval_ms integer DEFAULT 1000 NOT NULL,
    subscription_size integer DEFAULT 1000 NOT NULL,
    default_nodes text,
    application_name character varying(500),
    enabled boolean DEFAULT true NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id character varying(36),
    status character varying(50) DEFAULT 'disconnected'::character varying NOT NULL,
    last_connected timestamp with time zone,
    error_count integer DEFAULT 0 NOT NULL,
    last_error text,
    metadata text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    "tenantId" uuid
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pi_af_elements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pi_af_elements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    web_id character varying(255),
    name character varying(255),
    description text,
    path character varying(1000),
    template character varying(255),
    categories text,
    parent_id character varying(36),
    hierarchy_level integer,
    last_seen_at timestamp with time zone,
    has_children boolean DEFAULT false NOT NULL,
    metadata text
);


--
-- Name: pi_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pi_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
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


--
-- Name: pi_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pi_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    web_id character varying(255),
    name character varying(255),
    template character varying(255),
    primary_af_id character varying(255),
    start_utc timestamp with time zone,
    end_utc timestamp with time zone,
    acknowledged boolean DEFAULT false NOT NULL,
    event_data text
);


--
-- Name: pi_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pi_mappings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    source_type character varying(100),
    source_id character varying(255),
    target_type character varying(100),
    target_id character varying(36),
    mapping_rules text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: pi_sync_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pi_sync_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
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


--
-- Name: pi_sync_watermarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pi_sync_watermarks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    sync_type character varying(100),
    last_sync_timestamp timestamp with time zone,
    last_sync_marker character varying(255),
    sync_status character varying(50)
);


--
-- Name: production_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_events (
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
    quantity numeric(10,2),
    cost numeric(10,2),
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
    tenant_id character varying(36),
    organization_id character varying(36),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: production_losses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_losses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    plan_id uuid NOT NULL,
    period character varying(50),
    actual numeric(15,4),
    short_range_plan numeric(15,4),
    losses numeric(15,4),
    unaccounted_loss numeric(15,4),
    action character varying(50),
    loss_type character varying(100),
    loss_category character varying(100),
    quantity numeric(15,4),
    cost numeric(15,2),
    description text,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: production_plan_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_plan_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    template_data text,
    is_active boolean DEFAULT true NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: production_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_plans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    plan_name character varying(255) NOT NULL,
    unit_id character varying(36) NOT NULL,
    product_id character varying(36),
    tenant_id character varying(36),
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    uom character varying(50),
    description text,
    standard_rate numeric(15,4),
    tenant_id character varying(36),
    organization_id character varying(36),
    unit_id character varying(36),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profinet_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profinet_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500),
    "ipAddress" character varying(45) NOT NULL,
    port integer DEFAULT 34964 NOT NULL,
    "connectionType" character varying(20) DEFAULT 'tcp'::character varying NOT NULL,
    "deviceId" integer DEFAULT 1 NOT NULL,
    "timeoutMs" integer DEFAULT 10000 NOT NULL,
    "retryCount" integer DEFAULT 3 NOT NULL,
    "pollingIntervalMs" integer DEFAULT 100 NOT NULL,
    "operationType" character varying(50) DEFAULT 'read'::character varying NOT NULL,
    "slotNumber" character varying(100),
    "subslotNumber" character varying(100),
    index character varying(100),
    subindex character varying(100),
    enabled boolean DEFAULT true NOT NULL,
    "tenantId" uuid NOT NULL,
    status character varying(50) DEFAULT 'disconnected'::character varying NOT NULL,
    "lastConnected" timestamp with time zone,
    "errorCount" integer DEFAULT 0 NOT NULL,
    "lastError" text,
    metadata text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: query_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.query_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    attributes text NOT NULL,
    query_params text NOT NULL,
    result_count integer NOT NULL,
    tenant_id character varying(36) NOT NULL
);


--
-- Name: rca_analysis_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rca_analysis_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    analysis_type character varying(100),
    config_name character varying(255),
    is_default boolean DEFAULT true NOT NULL,
    config_data text
);


--
-- Name: rca_barrier_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rca_barrier_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    rca_id character varying(36) NOT NULL,
    hazard character varying(255) NOT NULL,
    barriers text NOT NULL
);


--
-- Name: rca_cause_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rca_cause_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    tenant_id uuid,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rca_change_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rca_change_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    rca_id character varying(36) NOT NULL,
    question character varying(255) NOT NULL,
    changes text NOT NULL
);


--
-- Name: rca_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rca_evidence (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "rcaId" uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    type character varying(50) NOT NULL,
    "fileName" character varying(255),
    "filePath" character varying(255),
    "collectedBy" character varying(255) NOT NULL,
    "collectedAt" timestamp with time zone NOT NULL,
    "nodeIds" text,
    "fileBlob" bytea,
    category character varying(100),
    location character varying(100),
    "timestamp" timestamp with time zone,
    "relatedAssetId" uuid,
    severity character varying(50),
    tags text,
    verified boolean,
    "fiveP" character varying(50),
    task character varying(255),
    "dueDate" timestamp with time zone,
    status character varying(50),
    attachments text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: rca_fault_tree_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rca_fault_tree_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    rca_id character varying(36) NOT NULL,
    top_event character varying(255) NOT NULL,
    nodes text NOT NULL,
    minimum_cut_sets text
);


--
-- Name: rca_fishbone_diagrams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rca_fishbone_diagrams (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    rca_id character varying(36) NOT NULL,
    effect text NOT NULL,
    categories text NOT NULL
);


--
-- Name: rca_five_why_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rca_five_why_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    rca_id character varying(36) NOT NULL,
    problem text NOT NULL,
    why_levels text NOT NULL,
    root_cause text NOT NULL,
    verified_by character varying(255),
    verified_date timestamp with time zone
);


--
-- Name: rca_fmea_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rca_fmea_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    rca_id character varying(36) NOT NULL,
    failure_mode character varying(255) NOT NULL,
    effects text NOT NULL,
    causes text NOT NULL
);


--
-- Name: rca_knowledge_base; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rca_knowledge_base (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    rca_id character varying(36) NOT NULL,
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
    cost_saved double precision,
    downtime_reduced double precision,
    keywords text,
    tags text,
    content text,
    related_rcas text,
    author character varying(36),
    is_published boolean DEFAULT false NOT NULL,
    times_referenced integer DEFAULT 0 NOT NULL,
    helpful_votes integer DEFAULT 0 NOT NULL,
    closed_date character varying(50)
);


--
-- Name: rca_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rca_recommendations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "rcaId" uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    priority character varying(50) NOT NULL,
    "assigneeId" uuid NOT NULL,
    "dueDate" timestamp with time zone,
    status character varying(50) NOT NULL,
    "cmmsWorkOrderId" character varying(255),
    "estimatedCost" double precision,
    "actualCost" double precision,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: rca_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rca_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    template_name character varying(255) NOT NULL,
    description text,
    template_type character varying(100),
    template_data text,
    is_active boolean DEFAULT true NOT NULL,
    organization_id uuid NOT NULL,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rca_trigger_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rca_trigger_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    name character varying(255) NOT NULL,
    description text,
    rules text,
    global_settings text,
    is_active boolean DEFAULT true NOT NULL,
    auto_create_rca boolean DEFAULT false NOT NULL,
    trigger_type character varying(100),
    legacy_conditions text
);


--
-- Name: rcas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rcas (
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
    tenant_id character varying(36),
    organization_id character varying(36),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reason_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reason_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    tenant_id uuid,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reconcile_forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reconcile_forms (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "lossId" uuid NOT NULL,
    "totalLossAmount" double precision NOT NULL,
    "categorizedLossAmount" double precision NOT NULL,
    "unaccountedLossAmount" double precision NOT NULL,
    "productionEvent" character varying(255) NOT NULL,
    comment text NOT NULL,
    status character varying(50) NOT NULL,
    categories text NOT NULL,
    "tenantId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: restapi_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restapi_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500),
    "baseUrl" character varying(500) NOT NULL,
    protocol character varying(20) DEFAULT 'https'::character varying NOT NULL,
    "defaultMethod" character varying(50) DEFAULT 'GET'::character varying NOT NULL,
    username character varying(100),
    "passwordHash" character varying(255),
    "apiKey" character varying(255),
    "authType" character varying(100),
    "timeoutMs" integer DEFAULT 30000 NOT NULL,
    "retryCount" integer DEFAULT 3 NOT NULL,
    "pollingIntervalMs" integer DEFAULT 1000 NOT NULL,
    "operationType" character varying(50) DEFAULT 'request'::character varying NOT NULL,
    headers text,
    "queryParams" text,
    enabled boolean DEFAULT true NOT NULL,
    "tenantId" uuid NOT NULL,
    status character varying(50) DEFAULT 'disconnected'::character varying NOT NULL,
    "lastConnected" timestamp with time zone,
    "errorCount" integer DEFAULT 0 NOT NULL,
    "lastError" text,
    metadata text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    permissions text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: scada_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scada_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500),
    "ipAddress" character varying(45) NOT NULL,
    port integer DEFAULT 502 NOT NULL,
    protocol character varying(20) DEFAULT 'modbus'::character varying NOT NULL,
    "connectionType" character varying(20) DEFAULT 'tcp'::character varying NOT NULL,
    "unitId" integer DEFAULT 1 NOT NULL,
    "timeoutMs" integer DEFAULT 10000 NOT NULL,
    "retryCount" integer DEFAULT 3 NOT NULL,
    "pollingIntervalMs" integer DEFAULT 1000 NOT NULL,
    "operationType" character varying(50) DEFAULT 'read'::character varying NOT NULL,
    "registerType" character varying(100),
    "startAddress" integer,
    "registerCount" integer,
    "dataType" character varying(20) DEFAULT 'uint16'::character varying NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "tenantId" uuid NOT NULL,
    status character varying(50) DEFAULT 'disconnected'::character varying NOT NULL,
    "lastConnected" timestamp with time zone,
    "errorCount" integer DEFAULT 0 NOT NULL,
    "lastError" text,
    metadata text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: source_hierarchy_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source_hierarchy_mappings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    source_type character varying(50) NOT NULL,
    source_connection_id uuid,
    source_identifier character varying(1000) NOT NULL,
    source_path character varying(1000),
    target_type character varying(50) NOT NULL,
    target_id uuid NOT NULL,
    tenant_id character varying(36) NOT NULL,
    organization_id character varying(36),
    is_pattern boolean DEFAULT false NOT NULL,
    pattern character varying(500),
    priority integer DEFAULT 50 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stream_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stream_alerts (
    id character varying(120) NOT NULL,
    type character varying(50) NOT NULL,
    message text NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    source character varying(255) NOT NULL,
    severity integer DEFAULT 0 NOT NULL,
    acknowledged boolean DEFAULT false NOT NULL,
    metadata text,
    "tenantId" character varying(36),
    "organizationId" character varying(36),
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stream_connection_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stream_connection_configs (
    id character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(100) NOT NULL,
    config text,
    enabled boolean DEFAULT true NOT NULL,
    "lastConnection" timestamp with time zone,
    "connectionStatus" character varying(50) DEFAULT 'disconnected'::character varying NOT NULL,
    "errorCount" integer DEFAULT 0 NOT NULL,
    metadata text,
    "tenantId" character varying(36),
    "organizationId" character varying(36),
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stream_data_sinks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stream_data_sinks (
    id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(100) NOT NULL,
    config text,
    enabled boolean DEFAULT true NOT NULL,
    "lastWrite" timestamp with time zone,
    "writeCount" integer DEFAULT 0 NOT NULL,
    "errorCount" integer DEFAULT 0 NOT NULL,
    metadata text,
    "tenantId" character varying(36),
    "organizationId" character varying(36),
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stream_data_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stream_data_sources (
    id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    "connectorType" character varying(100) NOT NULL,
    config text,
    enabled boolean DEFAULT true NOT NULL,
    "lastData" text,
    "lastUpdate" timestamp with time zone,
    "errorCount" integer DEFAULT 0 NOT NULL,
    status character varying(50) DEFAULT 'inactive'::character varying NOT NULL,
    metadata text,
    "tenantId" character varying(36),
    "organizationId" character varying(36),
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stream_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stream_metrics (
    id character varying(120) NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    "totalEvents" integer DEFAULT 0 NOT NULL,
    "processedEvents" integer DEFAULT 0 NOT NULL,
    "droppedEvents" integer DEFAULT 0 NOT NULL,
    "averageLatency" double precision DEFAULT '0'::double precision NOT NULL,
    throughput double precision DEFAULT '0'::double precision NOT NULL,
    "activeSources" integer DEFAULT 0 NOT NULL,
    "activeSinks" integer DEFAULT 0 NOT NULL,
    "activeProcessors" integer DEFAULT 0 NOT NULL,
    "errorRate" double precision DEFAULT '0'::double precision NOT NULL,
    "dataQuality" text,
    "tenantId" character varying(36),
    "organizationId" character varying(36),
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stream_processors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stream_processors (
    id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(100) NOT NULL,
    config text,
    enabled boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "inputSchema" text,
    "outputSchema" text,
    metadata text,
    "tenantId" character varying(36),
    "organizationId" character varying(36),
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_integrations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    "integrationType" character varying(50) NOT NULL,
    endpoint character varying(500),
    "apiKey" character varying(255),
    username character varying(255),
    "passwordHash" character varying(255),
    "systemType" character varying(50),
    database character varying(500),
    "syncIntervalSeconds" integer DEFAULT 300 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    configuration text,
    authentication text,
    description character varying(500),
    "tenantId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
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
    tenant_id character varying(36) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: unmapped_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unmapped_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id character varying(36),
    organization_id character varying(36),
    unit_id character varying(36),
    event_name character varying(255),
    event_type character varying(100),
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    source_system character varying(100),
    source_id character varying(255),
    event_data text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
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


--
-- Name: verification_status_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_status_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    tenant_id uuid,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: websocket_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.websocket_connections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500),
    url character varying(500) NOT NULL,
    protocol character varying(20) DEFAULT 'ws'::character varying NOT NULL,
    subprotocol character varying(100),
    "timeoutMs" integer DEFAULT 30000 NOT NULL,
    "retryCount" integer DEFAULT 3 NOT NULL,
    "reconnectIntervalMs" integer DEFAULT 5000 NOT NULL,
    "operationType" character varying(50) DEFAULT 'connect'::character varying NOT NULL,
    "messageHandlers" text,
    "eventHandlers" text,
    "autoReconnect" boolean DEFAULT true NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "tenantId" uuid NOT NULL,
    status character varying(50) DEFAULT 'disconnected'::character varying NOT NULL,
    "lastConnected" timestamp with time zone,
    "errorCount" integer DEFAULT 0 NOT NULL,
    "lastError" text,
    metadata text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: rca_analysis_configs PK_00f0a11efecffc9cdb6dbec7416; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_analysis_configs
    ADD CONSTRAINT "PK_00f0a11efecffc9cdb6dbec7416" PRIMARY KEY (id);


--
-- Name: restapi_connections PK_01a9efe285161ab550157c43453; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restapi_connections
    ADD CONSTRAINT "PK_01a9efe285161ab550157c43453" PRIMARY KEY (id);


--
-- Name: pi_events PK_02cefa18eaf1664541667e3e0da; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pi_events
    ADD CONSTRAINT "PK_02cefa18eaf1664541667e3e0da" PRIMARY KEY (id);


--
-- Name: custom_attribute_values PK_03ad98b91a6e738144a780bde41; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_attribute_values
    ADD CONSTRAINT "PK_03ad98b91a6e738144a780bde41" PRIMARY KEY (id);


--
-- Name: fmea_analyses PK_0761fc32d03b229c64ddafbf52c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fmea_analyses
    ADD CONSTRAINT "PK_0761fc32d03b229c64ddafbf52c" PRIMARY KEY (id);


--
-- Name: products PK_0806c755e0aca124e67c0cf6d7d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY (id);


--
-- Name: profinet_connections PK_098af12178c29e7a51896a86b2b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profinet_connections
    ADD CONSTRAINT "PK_098af12178c29e7a51896a86b2b" PRIMARY KEY (id);


--
-- Name: database_connections PK_0e22db8b41302c3c47fffb530c7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.database_connections
    ADD CONSTRAINT "PK_0e22db8b41302c3c47fffb530c7" PRIMARY KEY (id);


--
-- Name: five_why_analyses PK_12693e215a2bafc07aa6d9793fe; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.five_why_analyses
    ADD CONSTRAINT "PK_12693e215a2bafc07aa6d9793fe" PRIMARY KEY (id);


--
-- Name: production_plans PK_171d3990efc1882102b85f3b71e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_plans
    ADD CONSTRAINT "PK_171d3990efc1882102b85f3b71e" PRIMARY KEY (id);


--
-- Name: audit_logs PK_1bb179d048bbc581caa3b013439; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY (id);


--
-- Name: bacnet_connections PK_2310e757b1cf7c0ee1901fe35e4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bacnet_connections
    ADD CONSTRAINT "PK_2310e757b1cf7c0ee1901fe35e4" PRIMARY KEY (id);


--
-- Name: rca_fmea_analyses PK_251fce5d03bc898689efda27262; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_fmea_analyses
    ADD CONSTRAINT "PK_251fce5d03bc898689efda27262" PRIMARY KEY (id);


--
-- Name: source_hierarchy_mappings PK_2c866d3bc72058309481c3d36cf; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_hierarchy_mappings
    ADD CONSTRAINT "PK_2c866d3bc72058309481c3d36cf" PRIMARY KEY (id);


--
-- Name: loss_categories PK_2fa7cdd00a5efbd0c41d7806599; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loss_categories
    ADD CONSTRAINT "PK_2fa7cdd00a5efbd0c41d7806599" PRIMARY KEY (id);


--
-- Name: af_bindings PK_3253600520c1b5087dd810f612b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.af_bindings
    ADD CONSTRAINT "PK_3253600520c1b5087dd810f612b" PRIMARY KEY (id);


--
-- Name: logic_tree_nodes PK_336064ed7879d9fa710c9c6c696; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logic_tree_nodes
    ADD CONSTRAINT "PK_336064ed7879d9fa710c9c6c696" PRIMARY KEY (id);


--
-- Name: mqtt_connections PK_3cc7fa986d0abea35d7d25ecb69; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mqtt_connections
    ADD CONSTRAINT "PK_3cc7fa986d0abea35d7d25ecb69" PRIMARY KEY (id);


--
-- Name: pi_connections PK_40888c881beaf673504c899a8d5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pi_connections
    ADD CONSTRAINT "PK_40888c881beaf673504c899a8d5" PRIMARY KEY (id);


--
-- Name: evidence_locations PK_45d3400a5784cab15ad44761689; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence_locations
    ADD CONSTRAINT "PK_45d3400a5784cab15ad44761689" PRIMARY KEY (id);


--
-- Name: opcua_connections PK_460e0457ef0adabaff2dfd51349; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opcua_connections
    ADD CONSTRAINT "PK_460e0457ef0adabaff2dfd51349" PRIMARY KEY (id);


--
-- Name: pi_mappings PK_47985c609cdcbe0c5c483b036e0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pi_mappings
    ADD CONSTRAINT "PK_47985c609cdcbe0c5c483b036e0" PRIMARY KEY (id);


--
-- Name: pi_af_elements PK_4949d4548f2e7e4cfed8ba7a03b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pi_af_elements
    ADD CONSTRAINT "PK_4949d4548f2e7e4cfed8ba7a03b" PRIMARY KEY (id);


--
-- Name: oee_codes PK_536c1d9ccef5ff5c263b4846e25; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oee_codes
    ADD CONSTRAINT "PK_536c1d9ccef5ff5c263b4846e25" PRIMARY KEY (id);


--
-- Name: tenants PK_53be67a04681c66b87ee27c9321; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY (id);


--
-- Name: rca_fishbone_diagrams PK_551c262c49bbf0d50d594452354; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_fishbone_diagrams
    ADD CONSTRAINT "PK_551c262c49bbf0d50d594452354" PRIMARY KEY (id);


--
-- Name: units PK_5a8f2f064919b587d93936cb223; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT "PK_5a8f2f064919b587d93936cb223" PRIMARY KEY (id);


--
-- Name: verification_status_codes PK_5cae70cab49bac4d6f1e8f46e2e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_status_codes
    ADD CONSTRAINT "PK_5cae70cab49bac4d6f1e8f46e2e" PRIMARY KEY (id);


--
-- Name: rca_templates PK_61a07aeb26e387f734cd18e5967; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_templates
    ADD CONSTRAINT "PK_61a07aeb26e387f734cd18e5967" PRIMARY KEY (id);


--
-- Name: reason_codes PK_64e9bc3e20d2e61416a5134650f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reason_codes
    ADD CONSTRAINT "PK_64e9bc3e20d2e61416a5134650f" PRIMARY KEY (id);


--
-- Name: organizations PK_6b031fcd0863e3f6b44230163f9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY (id);


--
-- Name: stream_alerts PK_6d39fdeba26e1d4ae6339b6aa45; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_alerts
    ADD CONSTRAINT "PK_6d39fdeba26e1d4ae6339b6aa45" PRIMARY KEY (id);


--
-- Name: rca_cause_codes PK_7469109ba189e280ad139ebed8c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_cause_codes
    ADD CONSTRAINT "PK_7469109ba189e280ad139ebed8c" PRIMARY KEY (id);


--
-- Name: historian_tags PK_75ec1f39b7eeb6052daa8f6a6d6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historian_tags
    ADD CONSTRAINT "PK_75ec1f39b7eeb6052daa8f6a6d6" PRIMARY KEY (id);


--
-- Name: fault_tree_analyses PK_7a4d3fb71d122fe590d0073b05a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fault_tree_analyses
    ADD CONSTRAINT "PK_7a4d3fb71d122fe590d0073b05a" PRIMARY KEY (id);


--
-- Name: dashboard_configurations PK_82164825b0d6cca17ca2f8bf932; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_configurations
    ADD CONSTRAINT "PK_82164825b0d6cca17ca2f8bf932" PRIMARY KEY (id);


--
-- Name: pi_sync_watermarks PK_8265039f1043d909c7e2b99875f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pi_sync_watermarks
    ADD CONSTRAINT "PK_8265039f1043d909c7e2b99875f" PRIMARY KEY (id);


--
-- Name: rca_recommendations PK_8c1d396d67af15542f450e31374; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_recommendations
    ADD CONSTRAINT "PK_8c1d396d67af15542f450e31374" PRIMARY KEY (id);


--
-- Name: tasks PK_8d12ff38fcc62aaba2cab748772; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY (id);


--
-- Name: data_transformations PK_8e6b5bffeb7d5bd1c785b992ba3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_transformations
    ADD CONSTRAINT "PK_8e6b5bffeb7d5bd1c785b992ba3" PRIMARY KEY (id);


--
-- Name: scada_connections PK_8f05c55ca77f78e90516c5a2e49; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scada_connections
    ADD CONSTRAINT "PK_8f05c55ca77f78e90516c5a2e49" PRIMARY KEY (id);


--
-- Name: system_integrations PK_906ed1d97f84b3cad4e6b09a3a2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_integrations
    ADD CONSTRAINT "PK_906ed1d97f84b3cad4e6b09a3a2" PRIMARY KEY (id);


--
-- Name: app_settings PK_975c2db59c65c05fd9c6b63a2ab; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT "PK_975c2db59c65c05fd9c6b63a2ab" PRIMARY KEY (key);


--
-- Name: ethernetip_connections PK_97a529cc8ffe2a5425b4b626742; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ethernetip_connections
    ADD CONSTRAINT "PK_97a529cc8ffe2a5425b4b626742" PRIMARY KEY (id);


--
-- Name: evidence_categories PK_9b65089011c8ec5f49e5ce6f1dd; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence_categories
    ADD CONSTRAINT "PK_9b65089011c8ec5f49e5ce6f1dd" PRIMARY KEY (id);


--
-- Name: rcas PK_9bdfb12ad025954407386c84352; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rcas
    ADD CONSTRAINT "PK_9bdfb12ad025954407386c84352" PRIMARY KEY (id);


--
-- Name: modbus_connections PK_9ea1d72ff4a6c26bb4f28eee9cf; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modbus_connections
    ADD CONSTRAINT "PK_9ea1d72ff4a6c26bb4f28eee9cf" PRIMARY KEY (id);


--
-- Name: stream_metrics PK_9f692873e7aa367896f5a820b22; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_metrics
    ADD CONSTRAINT "PK_9f692873e7aa367896f5a820b22" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: dnp3_connections PK_ab80284ceba00c0f61857a224fd; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dnp3_connections
    ADD CONSTRAINT "PK_ab80284ceba00c0f61857a224fd" PRIMARY KEY (id);


--
-- Name: stream_data_sinks PK_ae62cc9c7ea75ba272b57e73578; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_data_sinks
    ADD CONSTRAINT "PK_ae62cc9c7ea75ba272b57e73578" PRIMARY KEY (id);


--
-- Name: production_plan_templates PK_affeac036100de4e94f08646cf0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_plan_templates
    ADD CONSTRAINT "PK_affeac036100de4e94f08646cf0" PRIMARY KEY (id);


--
-- Name: barrier_analyses PK_b0108ccb065c3b4212d2cbfd5e8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barrier_analyses
    ADD CONSTRAINT "PK_b0108ccb065c3b4212d2cbfd5e8" PRIMARY KEY (id);


--
-- Name: production_events PK_b60ec956f8e608ebfbffe05d093; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_events
    ADD CONSTRAINT "PK_b60ec956f8e608ebfbffe05d093" PRIMARY KEY (id);


--
-- Name: production_losses PK_bab3174baa416b40eaa88acf8cf; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_losses
    ADD CONSTRAINT "PK_bab3174baa416b40eaa88acf8cf" PRIMARY KEY (id);


--
-- Name: custom_attribute_definitions PK_bc25a5e0aaca1b8bd0a8cf33e3c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_attribute_definitions
    ADD CONSTRAINT "PK_bc25a5e0aaca1b8bd0a8cf33e3c" PRIMARY KEY (id);


--
-- Name: stream_connection_configs PK_bc409782898d5b34b84eef1c048; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_connection_configs
    ADD CONSTRAINT "PK_bc409782898d5b34b84eef1c048" PRIMARY KEY (id);


--
-- Name: rca_evidence PK_bc9a78f7c9fa546369e2ebef50c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_evidence
    ADD CONSTRAINT "PK_bc9a78f7c9fa546369e2ebef50c" PRIMARY KEY (id);


--
-- Name: reconcile_forms PK_c089521661142a1cd1b1b54a7b6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconcile_forms
    ADD CONSTRAINT "PK_c089521661142a1cd1b1b54a7b6" PRIMARY KEY (id);


--
-- Name: stream_processors PK_c1231e36e2c5b9d4cce3b910a26; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_processors
    ADD CONSTRAINT "PK_c1231e36e2c5b9d4cce3b910a26" PRIMARY KEY (id);


--
-- Name: roles PK_c1433d71a4838793a49dcad46ab; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY (id);


--
-- Name: unmapped_events PK_c2cb177b4d33a513e5171fa5749; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unmapped_events
    ADD CONSTRAINT "PK_c2cb177b4d33a513e5171fa5749" PRIMARY KEY (id);


--
-- Name: rca_change_analyses PK_c7ade9f85999597b5addf8889f9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_change_analyses
    ADD CONSTRAINT "PK_c7ade9f85999597b5addf8889f9" PRIMARY KEY (id);


--
-- Name: rca_knowledge_base PK_c971545b619ef871835d0f6e352; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_knowledge_base
    ADD CONSTRAINT "PK_c971545b619ef871835d0f6e352" PRIMARY KEY (id);


--
-- Name: rca_trigger_configs PK_cb345a4a138fe548514c518809b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_trigger_configs
    ADD CONSTRAINT "PK_cb345a4a138fe548514c518809b" PRIMARY KEY (id);


--
-- Name: query_history PK_d14e08569f855cccc762004f7d1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_history
    ADD CONSTRAINT "PK_d14e08569f855cccc762004f7d1" PRIMARY KEY (id);


--
-- Name: rca_five_why_analyses PK_d3bef094d46b53fac64e6bec875; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_five_why_analyses
    ADD CONSTRAINT "PK_d3bef094d46b53fac64e6bec875" PRIMARY KEY (id);


--
-- Name: data_bindings PK_d934c725d13f71962cc18d529e9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_bindings
    ADD CONSTRAINT "PK_d934c725d13f71962cc18d529e9" PRIMARY KEY (id);


--
-- Name: stream_data_sources PK_da681a5e70a568aaf21242f9472; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_data_sources
    ADD CONSTRAINT "PK_da681a5e70a568aaf21242f9472" PRIMARY KEY (id);


--
-- Name: oee_summaries PK_da8ccd227a8d771ae634d198e31; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oee_summaries
    ADD CONSTRAINT "PK_da8ccd227a8d771ae634d198e31" PRIMARY KEY (id);


--
-- Name: assets PK_da96729a8b113377cfb6a62439c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT "PK_da96729a8b113377cfb6a62439c" PRIMARY KEY (id);


--
-- Name: impact_codes PK_dac4bfca776b3ccf9c5698a5c25; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_codes
    ADD CONSTRAINT "PK_dac4bfca776b3ccf9c5698a5c25" PRIMARY KEY (id);


--
-- Name: data_sources PK_dc70b1c6b641726739857fd938d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sources
    ADD CONSTRAINT "PK_dc70b1c6b641726739857fd938d" PRIMARY KEY (id);


--
-- Name: connection_health PK_de3bf73e723eb657f27e664ee12; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_health
    ADD CONSTRAINT "PK_de3bf73e723eb657f27e664ee12" PRIMARY KEY (id);


--
-- Name: rca_fault_tree_analyses PK_de910b9b14c0013c625a8a79b77; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_fault_tree_analyses
    ADD CONSTRAINT "PK_de910b9b14c0013c625a8a79b77" PRIMARY KEY (id);


--
-- Name: change_analyses PK_e0eb89281f2308c934b0a6a0cd3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_analyses
    ADD CONSTRAINT "PK_e0eb89281f2308c934b0a6a0cd3" PRIMARY KEY (id);


--
-- Name: websocket_connections PK_ead282edc24a39682982185fb21; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.websocket_connections
    ADD CONSTRAINT "PK_ead282edc24a39682982185fb21" PRIMARY KEY (id);


--
-- Name: pi_sync_jobs PK_f851c487ed5d4feda4b0e8935fe; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pi_sync_jobs
    ADD CONSTRAINT "PK_f851c487ed5d4feda4b0e8935fe" PRIMARY KEY (id);


--
-- Name: rca_barrier_analyses PK_fc75893e8c95b19094180792083; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_barrier_analyses
    ADD CONSTRAINT "PK_fc75893e8c95b19094180792083" PRIMARY KEY (id);


--
-- Name: fishbone_diagrams PK_fe8614706c6d50d3130e1e86566; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fishbone_diagrams
    ADD CONSTRAINT "PK_fe8614706c6d50d3130e1e86566" PRIMARY KEY (id);


--
-- Name: reason_codes UQ_10a9f60ddba7bc9f6396a38eaae; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reason_codes
    ADD CONSTRAINT "UQ_10a9f60ddba7bc9f6396a38eaae" UNIQUE (code);


--
-- Name: tenants UQ_3021c18db2b363ae9324c826c5a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT "UQ_3021c18db2b363ae9324c826c5a" UNIQUE (code);


--
-- Name: units UQ_47635c1ab22d02fc3ebae3608b8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT "UQ_47635c1ab22d02fc3ebae3608b8" UNIQUE (code);


--
-- Name: verification_status_codes UQ_547ed4b92d53d98e137c8e20c91; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_status_codes
    ADD CONSTRAINT "UQ_547ed4b92d53d98e137c8e20c91" UNIQUE (code);


--
-- Name: pi_af_elements UQ_583df9e4a4a26098718f37c8e6f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pi_af_elements
    ADD CONSTRAINT "UQ_583df9e4a4a26098718f37c8e6f" UNIQUE (web_id);


--
-- Name: roles UQ_648e3f5447f725579d7d4ffdfb7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE (name);


--
-- Name: products UQ_7cfc24d6c24f0ec91294003d6b8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "UQ_7cfc24d6c24f0ec91294003d6b8" UNIQUE (code);


--
-- Name: organizations UQ_7e27c3b62c681fbe3e2322535f2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "UQ_7e27c3b62c681fbe3e2322535f2" UNIQUE (code);


--
-- Name: impact_codes UQ_83aeac110d18f6080f118f6b597; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact_codes
    ADD CONSTRAINT "UQ_83aeac110d18f6080f118f6b597" UNIQUE (code);


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: oee_codes UQ_d8ba3be5670be09142d190594a1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oee_codes
    ADD CONSTRAINT "UQ_d8ba3be5670be09142d190594a1" UNIQUE (code);


--
-- Name: rca_cause_codes UQ_dd288509552d6a52b39bdff81f1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_cause_codes
    ADD CONSTRAINT "UQ_dd288509552d6a52b39bdff81f1" UNIQUE (code);


--
-- Name: IDX_03bc03f60cf3ead27d2290f93c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_03bc03f60cf3ead27d2290f93c" ON public.pi_sync_jobs USING btree (tenant_id);


--
-- Name: IDX_06830eabae1dc4cafe121af8be; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_06830eabae1dc4cafe121af8be" ON public.rca_fault_tree_analyses USING btree (organization_id);


--
-- Name: IDX_086a5ec69875c0c87463002f29; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_086a5ec69875c0c87463002f29" ON public.stream_alerts USING btree ("tenantId");


--
-- Name: IDX_09df7426df1326499f89b39491; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_09df7426df1326499f89b39491" ON public.historian_tags USING btree (organization_id);


--
-- Name: IDX_0a60561d49d2defb80153b5a3c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0a60561d49d2defb80153b5a3c" ON public.pi_connections USING btree (organization_id);


--
-- Name: IDX_0adf29d9a8e4b154d18dfd2d8c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0adf29d9a8e4b154d18dfd2d8c" ON public.source_hierarchy_mappings USING btree (source_type);


--
-- Name: IDX_10c88127427a6b9e64da2bea0b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_10c88127427a6b9e64da2bea0b" ON public.rca_fishbone_diagrams USING btree (tenant_id);


--
-- Name: IDX_119be1602e564fc35b68bc7539; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_119be1602e564fc35b68bc7539" ON public.stream_data_sinks USING btree (type);


--
-- Name: IDX_139c530dcddcd1c0f040f8a7e7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_139c530dcddcd1c0f040f8a7e7" ON public.custom_attribute_definitions USING btree (entity_type);


--
-- Name: IDX_1463179e78a90d088ae8374743; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1463179e78a90d088ae8374743" ON public.af_bindings USING btree (tenant_id);


--
-- Name: IDX_14bbf3e0251a28add502cc5fc3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_14bbf3e0251a28add502cc5fc3" ON public.scada_connections USING btree ("tenantId", enabled);


--
-- Name: IDX_1614859f262a4b0df6cc307026; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1614859f262a4b0df6cc307026" ON public.rca_five_why_analyses USING btree (tenant_id);


--
-- Name: IDX_19d7cfd5c6d832f26e9cd6f959; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_19d7cfd5c6d832f26e9cd6f959" ON public.custom_attribute_definitions USING btree (organization_id);


--
-- Name: IDX_1a68e66eb10626fe366c03494b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1a68e66eb10626fe366c03494b" ON public.rca_trigger_configs USING btree (organization_id);


--
-- Name: IDX_1a96c779ad73d283135a62d6f9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1a96c779ad73d283135a62d6f9" ON public.barrier_analyses USING btree (organization_id);


--
-- Name: IDX_1ca559a671f86ff006f1aba6f9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1ca559a671f86ff006f1aba6f9" ON public.pi_events USING btree (start_utc);


--
-- Name: IDX_1eec9b8ac8a36e3150f35d401b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1eec9b8ac8a36e3150f35d401b" ON public.data_sources USING btree (organization_id);


--
-- Name: IDX_20ce2e2e0b18596ad41f8a9459; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_20ce2e2e0b18596ad41f8a9459" ON public.fishbone_diagrams USING btree (rca_id);


--
-- Name: IDX_22776255c9e7c95b90d543eb70; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_22776255c9e7c95b90d543eb70" ON public.stream_alerts USING btree ("timestamp");


--
-- Name: IDX_2353d831240b19fcc34d6803a9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2353d831240b19fcc34d6803a9" ON public.stream_data_sources USING btree (status);


--
-- Name: IDX_243a82722abeb72cbadcddd7ff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_243a82722abeb72cbadcddd7ff" ON public.pi_events USING btree (tenant_id);


--
-- Name: IDX_268ab8531f11ebd5d619fc33ae; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_268ab8531f11ebd5d619fc33ae" ON public.af_bindings USING btree (web_id);


--
-- Name: IDX_278ac79c0bba2b29cca67c4352; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_278ac79c0bba2b29cca67c4352" ON public.pi_af_elements USING btree (organization_id);


--
-- Name: IDX_297cd1f53bb77990c39dc04c4a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_297cd1f53bb77990c39dc04c4a" ON public.pi_af_elements USING btree (created_at);


--
-- Name: IDX_2a256a9847af5aae8afc3f6d54; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2a256a9847af5aae8afc3f6d54" ON public.stream_processors USING btree ("order");


--
-- Name: IDX_366bf98ce45a78fc04c5d2be12; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_366bf98ce45a78fc04c5d2be12" ON public.pi_events USING btree (organization_id);


--
-- Name: IDX_386fe3a14ca7ab15da185351e2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_386fe3a14ca7ab15da185351e2" ON public.data_sources USING btree (created_at);


--
-- Name: IDX_39dceb76a83f68b33494034bca; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_39dceb76a83f68b33494034bca" ON public.data_sources USING btree (tenant_id);


--
-- Name: IDX_3a1adec9dc81f00da6920ceda8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3a1adec9dc81f00da6920ceda8" ON public.rca_fishbone_diagrams USING btree (rca_id);


--
-- Name: IDX_3b14a168ddf22e64110d530f3d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3b14a168ddf22e64110d530f3d" ON public.stream_connection_configs USING btree ("connectionStatus");


--
-- Name: IDX_3b38ccc53896cd40077d5c23be; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3b38ccc53896cd40077d5c23be" ON public.pi_sync_watermarks USING btree (organization_id);


--
-- Name: IDX_3b6e486e49a2353c4456e72751; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3b6e486e49a2353c4456e72751" ON public.custom_attribute_definitions USING btree (created_at);


--
-- Name: IDX_40bfa9eb36b30927422f2b51f4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_40bfa9eb36b30927422f2b51f4" ON public.rca_fault_tree_analyses USING btree (tenant_id);


--
-- Name: IDX_41870904cacc3982b156128bb6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_41870904cacc3982b156128bb6" ON public.pi_sync_jobs USING btree (organization_id);


--
-- Name: IDX_459e5caad164d68ba08510f128; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_459e5caad164d68ba08510f128" ON public.query_history USING btree ("timestamp");


--
-- Name: IDX_45ecd1369d8e7754ddaf36fc1a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_45ecd1369d8e7754ddaf36fc1a" ON public.fmea_analyses USING btree (organization_id);


--
-- Name: IDX_47db4c22f1a45dd6d8503df8dc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_47db4c22f1a45dd6d8503df8dc" ON public.rca_analysis_configs USING btree (tenant_id);


--
-- Name: IDX_491a32514a4c2611323a3bc986; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_491a32514a4c2611323a3bc986" ON public.fmea_analyses USING btree (rca_id);


--
-- Name: IDX_4a14c733b1d1421f1ce0eedbe1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4a14c733b1d1421f1ce0eedbe1" ON public.stream_data_sources USING btree ("connectorType");


--
-- Name: IDX_4aaa9ba241ad8f86ec4584159a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4aaa9ba241ad8f86ec4584159a" ON public.stream_processors USING btree ("organizationId");


--
-- Name: IDX_4bca7afdf5e1a9164295b81ad4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4bca7afdf5e1a9164295b81ad4" ON public.rca_five_why_analyses USING btree (organization_id);


--
-- Name: IDX_4c418bf452d0e118261bd0995f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4c418bf452d0e118261bd0995f" ON public.stream_alerts USING btree (acknowledged);


--
-- Name: IDX_4eab5ecd3f4166db8c7db5e17d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4eab5ecd3f4166db8c7db5e17d" ON public.rca_change_analyses USING btree (tenant_id);


--
-- Name: IDX_52477a3c4a6cb7e34a8a27b8cb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_52477a3c4a6cb7e34a8a27b8cb" ON public.rca_knowledge_base USING btree (tenant_id);


--
-- Name: IDX_537bc41b31a70177f34238e934; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_537bc41b31a70177f34238e934" ON public.fault_tree_analyses USING btree (rca_id);


--
-- Name: IDX_560a5a557df886c4a8a15d840e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_560a5a557df886c4a8a15d840e" ON public.pi_connections USING btree (created_at);


--
-- Name: IDX_583df9e4a4a26098718f37c8e6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_583df9e4a4a26098718f37c8e6" ON public.pi_af_elements USING btree (web_id);


--
-- Name: IDX_5f19ca962634e4010e60c3e572; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5f19ca962634e4010e60c3e572" ON public.stream_data_sources USING btree ("tenantId");


--
-- Name: IDX_5f6667abd5bde682568dc0e831; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5f6667abd5bde682568dc0e831" ON public.source_hierarchy_mappings USING btree (pattern);


--
-- Name: IDX_6026665bcdb9cce25a1306d560; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6026665bcdb9cce25a1306d560" ON public.stream_processors USING btree (enabled);


--
-- Name: IDX_632e962cb6b605ccb5a7d42ebf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_632e962cb6b605ccb5a7d42ebf" ON public.rca_trigger_configs USING btree (tenant_id);


--
-- Name: IDX_68e47c91039617fea2ff36313b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_68e47c91039617fea2ff36313b" ON public.rca_fmea_analyses USING btree (organization_id);


--
-- Name: IDX_68e74a0ab6e2aa327b5c0fe677; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_68e74a0ab6e2aa327b5c0fe677" ON public.pi_sync_watermarks USING btree (tenant_id);


--
-- Name: IDX_6a2e35fcbd3f5f6b09f0f0eccd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6a2e35fcbd3f5f6b09f0f0eccd" ON public.rca_fishbone_diagrams USING btree (organization_id);


--
-- Name: IDX_6c05f068f12c3d0f0e399670d7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6c05f068f12c3d0f0e399670d7" ON public.custom_attribute_values USING btree (tenant_id);


--
-- Name: IDX_6cb936610cd3733aa89611e597; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6cb936610cd3733aa89611e597" ON public.stream_data_sources USING btree (enabled);


--
-- Name: IDX_6d3a73b904484a86a6f7fa706d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6d3a73b904484a86a6f7fa706d" ON public.rca_trigger_configs USING btree (created_at);


--
-- Name: IDX_6ed7925463b87855c10381624f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6ed7925463b87855c10381624f" ON public.historian_tags USING btree (enabled);


--
-- Name: IDX_6edca99b81ac062b893c1f35ed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6edca99b81ac062b893c1f35ed" ON public.stream_metrics USING btree ("tenantId");


--
-- Name: IDX_6f2183f735a5b87eaf2f557f60; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6f2183f735a5b87eaf2f557f60" ON public.af_bindings USING btree (created_at);


--
-- Name: IDX_707919a300bbb088ba707dbe92; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_707919a300bbb088ba707dbe92" ON public.five_why_analyses USING btree (tenant_id);


--
-- Name: IDX_736faece0ea92fc5e8574115a7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_736faece0ea92fc5e8574115a7" ON public.custom_attribute_values USING btree (created_at);


--
-- Name: IDX_773a16f0da066ebd71b1accc1d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_773a16f0da066ebd71b1accc1d" ON public.fault_tree_analyses USING btree (organization_id);


--
-- Name: IDX_78d0844a70c25eda3dabeed97a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_78d0844a70c25eda3dabeed97a" ON public.source_hierarchy_mappings USING btree (source_identifier);


--
-- Name: IDX_7a24bfafd08197338686845431; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7a24bfafd08197338686845431" ON public.stream_data_sources USING btree ("organizationId");


--
-- Name: IDX_7c1ca69fdcb693137f615eafab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7c1ca69fdcb693137f615eafab" ON public.pi_sync_watermarks USING btree (created_at);


--
-- Name: IDX_7e5b997af65eb13f932573fc34; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7e5b997af65eb13f932573fc34" ON public.rca_change_analyses USING btree (organization_id);


--
-- Name: IDX_7fa81bd4264b9df8d18f9d26f0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7fa81bd4264b9df8d18f9d26f0" ON public.pi_mappings USING btree (tenant_id);


--
-- Name: IDX_80e0ce436793d531e24612d267; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_80e0ce436793d531e24612d267" ON public.barrier_analyses USING btree (tenant_id);


--
-- Name: IDX_831fa8d64f8cf5c57a85208906; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_831fa8d64f8cf5c57a85208906" ON public.stream_processors USING btree ("tenantId");


--
-- Name: IDX_832d253b7c15500aaf919d1ce0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_832d253b7c15500aaf919d1ce0" ON public.websocket_connections USING btree ("tenantId", enabled);


--
-- Name: IDX_8375dd95ca704bf99eed7f4af3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8375dd95ca704bf99eed7f4af3" ON public.restapi_connections USING btree ("tenantId", enabled);


--
-- Name: IDX_8468622057cdfce2c423fb73be; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8468622057cdfce2c423fb73be" ON public.stream_metrics USING btree ("timestamp");


--
-- Name: IDX_8550095330d18590e7cead3500; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8550095330d18590e7cead3500" ON public.stream_connection_configs USING btree (type);


--
-- Name: IDX_8662ec50511259be3076f9c81a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8662ec50511259be3076f9c81a" ON public.query_history USING btree (tenant_id);


--
-- Name: IDX_86d28b5a6cccf3bd81c0cbb327; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_86d28b5a6cccf3bd81c0cbb327" ON public.af_bindings USING btree (bound_type);


--
-- Name: IDX_8915d9aba8665e9fd0e74ba600; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8915d9aba8665e9fd0e74ba600" ON public.source_hierarchy_mappings USING btree (is_active);


--
-- Name: IDX_8b6ad2bccf50753849263a521e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8b6ad2bccf50753849263a521e" ON public.rca_change_analyses USING btree (rca_id);


--
-- Name: IDX_8d42a346e61169120ae97510fa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8d42a346e61169120ae97510fa" ON public.barrier_analyses USING btree (rca_id);


--
-- Name: IDX_8d77df8595e77a6d7f866b406c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8d77df8595e77a6d7f866b406c" ON public.historian_tags USING btree (tenant_id);


--
-- Name: IDX_90d257c2c4f58a6b01c7211c7c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_90d257c2c4f58a6b01c7211c7c" ON public.af_bindings USING btree (local_id);


--
-- Name: IDX_928802dbf538f07a75f2c3ba48; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_928802dbf538f07a75f2c3ba48" ON public.pi_events USING btree (template);


--
-- Name: IDX_92c1f2c75417c27d0b2559d012; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_92c1f2c75417c27d0b2559d012" ON public.af_bindings USING btree (organization_id);


--
-- Name: IDX_97ae496f70b45daddfa927e068; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_97ae496f70b45daddfa927e068" ON public.rca_fmea_analyses USING btree (rca_id);


--
-- Name: IDX_9caeb54c670d4b0d80c7d470c1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9caeb54c670d4b0d80c7d470c1" ON public.fault_tree_analyses USING btree (tenant_id);


--
-- Name: IDX_a067299e14d010580eebfb86cb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a067299e14d010580eebfb86cb" ON public.pi_af_elements USING btree (tenant_id);


--
-- Name: IDX_a10a6ecb685dcadfb8196eb20c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a10a6ecb685dcadfb8196eb20c" ON public.custom_attribute_values USING btree (entity_id);


--
-- Name: IDX_a15f110084e26bf1a96caef2bd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a15f110084e26bf1a96caef2bd" ON public.pi_mappings USING btree (organization_id);


--
-- Name: IDX_a3ba97b71e803f5a330c66d1f9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a3ba97b71e803f5a330c66d1f9" ON public.bacnet_connections USING btree ("tenantId", enabled);


--
-- Name: IDX_a646bf5f4a0b20b911bfe624b0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a646bf5f4a0b20b911bfe624b0" ON public.database_connections USING btree ("tenantId", enabled);


--
-- Name: IDX_a66f57e74944f56f8426399892; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a66f57e74944f56f8426399892" ON public.custom_attribute_definitions USING btree (tenant_id);


--
-- Name: IDX_aa258f6d6c837000eb837c8141; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_aa258f6d6c837000eb837c8141" ON public.data_sources USING btree (type);


--
-- Name: IDX_ab4b1540c768e5c421adffe34e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ab4b1540c768e5c421adffe34e" ON public.stream_processors USING btree (type);


--
-- Name: IDX_aba1b638438bb1267e4b5f0381; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_aba1b638438bb1267e4b5f0381" ON public.stream_metrics USING btree ("organizationId");


--
-- Name: IDX_ada1a4a28cc8c8a6d4faddb64f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ada1a4a28cc8c8a6d4faddb64f" ON public.rca_knowledge_base USING btree (organization_id);


--
-- Name: IDX_aedbc5f7844f468f578dd9f4d8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_aedbc5f7844f468f578dd9f4d8" ON public.stream_data_sinks USING btree (enabled);


--
-- Name: IDX_af7b065900a91fd28781526e76; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_af7b065900a91fd28781526e76" ON public.fmea_analyses USING btree (created_at);


--
-- Name: IDX_b096d83c9704cbbc387fe6c803; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b096d83c9704cbbc387fe6c803" ON public.rca_analysis_configs USING btree (organization_id);


--
-- Name: IDX_b15d66428823c8b8113f7c8a41; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b15d66428823c8b8113f7c8a41" ON public.custom_attribute_values USING btree (attribute_definition_id);


--
-- Name: IDX_b3c45d6e6a61c86943298a702e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b3c45d6e6a61c86943298a702e" ON public.five_why_analyses USING btree (rca_id);


--
-- Name: IDX_b3ca481cb9edf1c55d002aece9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b3ca481cb9edf1c55d002aece9" ON public.rca_five_why_analyses USING btree (rca_id);


--
-- Name: IDX_b452cba15c834ab797e539860b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b452cba15c834ab797e539860b" ON public.rca_barrier_analyses USING btree (rca_id);


--
-- Name: IDX_b52ed93e1ad0bcc5ac4f15385a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b52ed93e1ad0bcc5ac4f15385a" ON public.dnp3_connections USING btree ("tenantId", enabled);


--
-- Name: IDX_b53402d3b212b5a166572c5ca7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b53402d3b212b5a166572c5ca7" ON public.stream_connection_configs USING btree (enabled);


--
-- Name: IDX_b5af1a62e3f1afa08dd2d359f1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b5af1a62e3f1afa08dd2d359f1" ON public.historian_tags USING btree (web_id);


--
-- Name: IDX_b6a8953d43eaf93d4aa0898ebc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b6a8953d43eaf93d4aa0898ebc" ON public.rca_barrier_analyses USING btree (tenant_id);


--
-- Name: IDX_bae5b07021480819ce31e933f3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bae5b07021480819ce31e933f3" ON public.stream_connection_configs USING btree ("tenantId");


--
-- Name: IDX_baf96330ad2e93bf54f0617689; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_baf96330ad2e93bf54f0617689" ON public.change_analyses USING btree (rca_id);


--
-- Name: IDX_bb56578ccb47df6ef52551b1ad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bb56578ccb47df6ef52551b1ad" ON public.pi_sync_jobs USING btree (created_at);


--
-- Name: IDX_bbbc016f1489fd92ff413957b8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bbbc016f1489fd92ff413957b8" ON public.five_why_analyses USING btree (created_at);


--
-- Name: IDX_bf3eb0c0607310d1195ed28d33; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bf3eb0c0607310d1195ed28d33" ON public.source_hierarchy_mappings USING btree (tenant_id);


--
-- Name: IDX_c087539c265e0d2b1886cbbd38; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c087539c265e0d2b1886cbbd38" ON public.five_why_analyses USING btree (organization_id);


--
-- Name: IDX_c46a7ad67c0b78d6f92d381e6a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c46a7ad67c0b78d6f92d381e6a" ON public.barrier_analyses USING btree (created_at);


--
-- Name: IDX_c5074ce654cea7bb387994f253; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c5074ce654cea7bb387994f253" ON public.rca_knowledge_base USING btree (created_at);


--
-- Name: IDX_c76edc1e50d935210c73ba27bb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c76edc1e50d935210c73ba27bb" ON public.data_sources USING btree (status);


--
-- Name: IDX_cb5dd318884707fdb160842660; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cb5dd318884707fdb160842660" ON public.custom_attribute_values USING btree (entity_type);


--
-- Name: IDX_ce8e4d371840bbeff8beda50c8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ce8e4d371840bbeff8beda50c8" ON public.change_analyses USING btree (tenant_id);


--
-- Name: IDX_cf8b40fcf36b0fee6a2e81e833; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cf8b40fcf36b0fee6a2e81e833" ON public.stream_alerts USING btree ("organizationId");


--
-- Name: IDX_d099cf8e70daabd3851892d9b8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d099cf8e70daabd3851892d9b8" ON public.fishbone_diagrams USING btree (tenant_id);


--
-- Name: IDX_d253e2f3d22fb390a12fc40b33; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d253e2f3d22fb390a12fc40b33" ON public.fishbone_diagrams USING btree (organization_id);


--
-- Name: IDX_d2d97aadc174ec0d0c62488dc2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d2d97aadc174ec0d0c62488dc2" ON public.rca_analysis_configs USING btree (created_at);


--
-- Name: IDX_d366d7817cb50f1c76e4196862; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d366d7817cb50f1c76e4196862" ON public.profinet_connections USING btree ("tenantId", enabled);


--
-- Name: IDX_d3d4d5b235928fe4605a45b48e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d3d4d5b235928fe4605a45b48e" ON public.stream_alerts USING btree (type);


--
-- Name: IDX_d66335073f378c5e772e48d3f6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d66335073f378c5e772e48d3f6" ON public.change_analyses USING btree (organization_id);


--
-- Name: IDX_d77f0ad25d88557fa83bf55c9d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d77f0ad25d88557fa83bf55c9d" ON public.stream_data_sinks USING btree ("tenantId");


--
-- Name: IDX_d7d4b83e2c43370585421d6d65; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d7d4b83e2c43370585421d6d65" ON public.fault_tree_analyses USING btree (created_at);


--
-- Name: IDX_d8eac7c75d2762a9c33f2b8617; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d8eac7c75d2762a9c33f2b8617" ON public.pi_events USING btree (created_at);


--
-- Name: IDX_da67fcf410e52cca13513d5fbf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_da67fcf410e52cca13513d5fbf" ON public.rca_fault_tree_analyses USING btree (rca_id);


--
-- Name: IDX_dc14cf1cea5a5b8eb72f6d95b3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_dc14cf1cea5a5b8eb72f6d95b3" ON public.pi_connections USING btree (tenant_id);


--
-- Name: IDX_dcac91bdb09d8fd2aa4ef1ca10; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_dcac91bdb09d8fd2aa4ef1ca10" ON public.pi_af_elements USING btree (parent_id);


--
-- Name: IDX_dd618b11743f397901dd416a40; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_dd618b11743f397901dd416a40" ON public.stream_data_sinks USING btree ("organizationId");


--
-- Name: IDX_de6783dc8220ac36576a84c086; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_de6783dc8220ac36576a84c086" ON public.change_analyses USING btree (created_at);


--
-- Name: IDX_e09ac90c0669bb7e638c0bfa2a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e09ac90c0669bb7e638c0bfa2a" ON public.historian_tags USING btree (created_at);


--
-- Name: IDX_e6313f2722a8d39dd852218507; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e6313f2722a8d39dd852218507" ON public.pi_af_elements USING btree (template);


--
-- Name: IDX_e820a37dde387b103af49eebc5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e820a37dde387b103af49eebc5" ON public.stream_connection_configs USING btree ("organizationId");


--
-- Name: IDX_ea042a30a025ca09ee724ba571; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ea042a30a025ca09ee724ba571" ON public.source_hierarchy_mappings USING btree (priority);


--
-- Name: IDX_ee8876d8d96b2ec9e7356b5933; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ee8876d8d96b2ec9e7356b5933" ON public.pi_mappings USING btree (created_at);


--
-- Name: IDX_f20600e078a6ba3b8efb928775; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f20600e078a6ba3b8efb928775" ON public.fishbone_diagrams USING btree (created_at);


--
-- Name: IDX_f20b36faff75f435f9452aa68e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f20b36faff75f435f9452aa68e" ON public.rca_barrier_analyses USING btree (organization_id);


--
-- Name: IDX_f6dbc499812b60d690c5c3f359; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f6dbc499812b60d690c5c3f359" ON public.data_sources USING btree (enabled);


--
-- Name: IDX_faf6bc79e85331733cd0d567b4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_faf6bc79e85331733cd0d567b4" ON public.pi_events USING btree (primary_af_id);


--
-- Name: IDX_fba9d32f43f51fc0b45c5a26a1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fba9d32f43f51fc0b45c5a26a1" ON public.fmea_analyses USING btree (tenant_id);


--
-- Name: IDX_fbba362107909d51dd06f54617; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fbba362107909d51dd06f54617" ON public.historian_tags USING btree (category);


--
-- Name: IDX_fdb271a23d58c7a948ee730e40; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fdb271a23d58c7a948ee730e40" ON public.source_hierarchy_mappings USING btree (target_type);


--
-- Name: IDX_feb3331b1d18cafdbf9e96f1f7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_feb3331b1d18cafdbf9e96f1f7" ON public.custom_attribute_values USING btree (organization_id);


--
-- Name: IDX_ffae41607f1c369f1c87975ce8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ffae41607f1c369f1c87975ce8" ON public.rca_fmea_analyses USING btree (tenant_id);


--
-- Name: production_losses FK_043210fc4ee9601d5be253ed7fa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_losses
    ADD CONSTRAINT "FK_043210fc4ee9601d5be253ed7fa" FOREIGN KEY (plan_id) REFERENCES public.production_plans(id);


--
-- Name: production_events FK_09af81053b4af55cdc775bc3bd5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_events
    ADD CONSTRAINT "FK_09af81053b4af55cdc775bc3bd5" FOREIGN KEY (reason_code_id) REFERENCES public.reason_codes(id);


--
-- Name: production_events FK_165571c3016f2aae50852324396; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_events
    ADD CONSTRAINT "FK_165571c3016f2aae50852324396" FOREIGN KEY (oee_code_id) REFERENCES public.oee_codes(id);


--
-- Name: loss_categories FK_193c29b91ad1a8c51a93795ad2e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loss_categories
    ADD CONSTRAINT "FK_193c29b91ad1a8c51a93795ad2e" FOREIGN KEY ("oeeCodeId") REFERENCES public.oee_codes(id);


--
-- Name: connection_health FK_47556682b92aae9d92c8d1eb9d6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_health
    ADD CONSTRAINT "FK_47556682b92aae9d92c8d1eb9d6" FOREIGN KEY ("ethernetipConnectionId") REFERENCES public.ethernetip_connections(id);


--
-- Name: connection_health FK_4dc9c9f58017162ed446f07e1ae; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_health
    ADD CONSTRAINT "FK_4dc9c9f58017162ed446f07e1ae" FOREIGN KEY ("modbusConnectionId") REFERENCES public.modbus_connections(id);


--
-- Name: oee_summaries FK_5266210a97774dca8df05d96d09; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oee_summaries
    ADD CONSTRAINT "FK_5266210a97774dca8df05d96d09" FOREIGN KEY (plan_id) REFERENCES public.production_plans(id);


--
-- Name: logic_tree_nodes FK_5c7c4a7010b9d0897735b611256; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logic_tree_nodes
    ADD CONSTRAINT "FK_5c7c4a7010b9d0897735b611256" FOREIGN KEY ("parentId") REFERENCES public.logic_tree_nodes(id);


--
-- Name: data_bindings FK_5d009f74b2274f0d3b620f0195e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_bindings
    ADD CONSTRAINT "FK_5d009f74b2274f0d3b620f0195e" FOREIGN KEY ("sourceEtherNetIPConnectionId") REFERENCES public.ethernetip_connections(id);


--
-- Name: connection_health FK_671f511028ef4da6d1f33c50761; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_health
    ADD CONSTRAINT "FK_671f511028ef4da6d1f33c50761" FOREIGN KEY ("opcuaConnectionId") REFERENCES public.opcua_connections(id);


--
-- Name: data_transformations FK_691e17d14a722afe00d51a8fef6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_transformations
    ADD CONSTRAINT "FK_691e17d14a722afe00d51a8fef6" FOREIGN KEY ("bindingId") REFERENCES public.data_bindings(id) ON DELETE CASCADE;


--
-- Name: data_bindings FK_6975ed005c96539055da31b7d86; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_bindings
    ADD CONSTRAINT "FK_6975ed005c96539055da31b7d86" FOREIGN KEY ("sourceMQTTConnectionId") REFERENCES public.mqtt_connections(id);


--
-- Name: data_bindings FK_78d7de931e8445efc767aa378e0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_bindings
    ADD CONSTRAINT "FK_78d7de931e8445efc767aa378e0" FOREIGN KEY ("targetOPCUAConnectionId") REFERENCES public.opcua_connections(id);


--
-- Name: rcas FK_790ced6e47d966eb4fc70d5d56a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rcas
    ADD CONSTRAINT "FK_790ced6e47d966eb4fc70d5d56a" FOREIGN KEY (template_id) REFERENCES public.rca_templates(id);


--
-- Name: logic_tree_nodes FK_791df580d6b173be0d1fb294f06; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logic_tree_nodes
    ADD CONSTRAINT "FK_791df580d6b173be0d1fb294f06" FOREIGN KEY ("rcaId") REFERENCES public.rcas(id);


--
-- Name: reconcile_forms FK_829750e1b655f62473fbf34b36c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconcile_forms
    ADD CONSTRAINT "FK_829750e1b655f62473fbf34b36c" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id);


--
-- Name: rca_evidence FK_82d0f82dec4406f3cbd2df14bf4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_evidence
    ADD CONSTRAINT "FK_82d0f82dec4406f3cbd2df14bf4" FOREIGN KEY ("rcaId") REFERENCES public.rcas(id);


--
-- Name: oee_summaries FK_834d98877996ec31892e24edb8d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oee_summaries
    ADD CONSTRAINT "FK_834d98877996ec31892e24edb8d" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: mqtt_connections FK_83f500201cd0f88f9d2fffd2986; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mqtt_connections
    ADD CONSTRAINT "FK_83f500201cd0f88f9d2fffd2986" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id);


--
-- Name: rca_recommendations FK_882aeb3d1b3de219e0396922f12; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_recommendations
    ADD CONSTRAINT "FK_882aeb3d1b3de219e0396922f12" FOREIGN KEY ("assigneeId") REFERENCES public.users(id);


--
-- Name: data_bindings FK_8ae43b12236e907c68055ee0b5c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_bindings
    ADD CONSTRAINT "FK_8ae43b12236e907c68055ee0b5c" FOREIGN KEY ("sourceOPCUAConnectionId") REFERENCES public.opcua_connections(id);


--
-- Name: data_bindings FK_8b79d96b53cb58bb05694cc624f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_bindings
    ADD CONSTRAINT "FK_8b79d96b53cb58bb05694cc624f" FOREIGN KEY ("sourceSystemIntegrationId") REFERENCES public.system_integrations(id);


--
-- Name: production_events FK_8e36b4c91cff4344b1ed8da72d8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_events
    ADD CONSTRAINT "FK_8e36b4c91cff4344b1ed8da72d8" FOREIGN KEY (plan_id) REFERENCES public.production_plans(id);


--
-- Name: loss_categories FK_90bd0d20e1a2d29260118eb88a7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loss_categories
    ADD CONSTRAINT "FK_90bd0d20e1a2d29260118eb88a7" FOREIGN KEY ("impactCodeId") REFERENCES public.impact_codes(id);


--
-- Name: rcas FK_90f1f10ffd6d8366913f112d6ab; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rcas
    ADD CONSTRAINT "FK_90f1f10ffd6d8366913f112d6ab" FOREIGN KEY (team_lead_id) REFERENCES public.users(id);


--
-- Name: production_events FK_91c1cd9e89d1db1d05f14d395e0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_events
    ADD CONSTRAINT "FK_91c1cd9e89d1db1d05f14d395e0" FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
-- Name: modbus_connections FK_941fc289173aadb1999f35f38cc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modbus_connections
    ADD CONSTRAINT "FK_941fc289173aadb1999f35f38cc" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id);


--
-- Name: production_events FK_9c89eb92722994c19f0be0ba0a1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_events
    ADD CONSTRAINT "FK_9c89eb92722994c19f0be0ba0a1" FOREIGN KEY (impact_code_id) REFERENCES public.impact_codes(id);


--
-- Name: rcas FK_a0e2a9c25b398c12e232d861b3b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rcas
    ADD CONSTRAINT "FK_a0e2a9c25b398c12e232d861b3b" FOREIGN KEY (event_id) REFERENCES public.production_events(id);


--
-- Name: loss_categories FK_a4e0812d81eaa05f0ca64b8b2c2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loss_categories
    ADD CONSTRAINT "FK_a4e0812d81eaa05f0ca64b8b2c2" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id);


--
-- Name: data_bindings FK_a6b1a1234541040a7053c4a5f70; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_bindings
    ADD CONSTRAINT "FK_a6b1a1234541040a7053c4a5f70" FOREIGN KEY ("targetEtherNetIPConnectionId") REFERENCES public.ethernetip_connections(id);


--
-- Name: connection_health FK_b247d26494f07e284c642b41e16; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_health
    ADD CONSTRAINT "FK_b247d26494f07e284c642b41e16" FOREIGN KEY ("systemIntegrationId") REFERENCES public.system_integrations(id);


--
-- Name: reconcile_forms FK_b6a13399b1a6b1cb64c745c314d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconcile_forms
    ADD CONSTRAINT "FK_b6a13399b1a6b1cb64c745c314d" FOREIGN KEY ("lossId") REFERENCES public.production_losses(id);


--
-- Name: data_bindings FK_bb225d12d357e55db9510d6b6ef; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_bindings
    ADD CONSTRAINT "FK_bb225d12d357e55db9510d6b6ef" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id);


--
-- Name: production_losses FK_c01238245c8d3209352cd791379; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_losses
    ADD CONSTRAINT "FK_c01238245c8d3209352cd791379" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: opcua_connections FK_c8e81a6ca6c4e4decedae3f2e59; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opcua_connections
    ADD CONSTRAINT "FK_c8e81a6ca6c4e4decedae3f2e59" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id);


--
-- Name: system_integrations FK_c8ebae12649b35319e78dcf84ca; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_integrations
    ADD CONSTRAINT "FK_c8ebae12649b35319e78dcf84ca" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id);


--
-- Name: connection_health FK_cf62fd05e752296936a42ad0eb6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_health
    ADD CONSTRAINT "FK_cf62fd05e752296936a42ad0eb6" FOREIGN KEY ("mqttConnectionId") REFERENCES public.mqtt_connections(id);


--
-- Name: rca_recommendations FK_da1882bdc7e97c6f2169e95753f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_recommendations
    ADD CONSTRAINT "FK_da1882bdc7e97c6f2169e95753f" FOREIGN KEY ("rcaId") REFERENCES public.rcas(id);


--
-- Name: data_bindings FK_e71d86958c7184c058ca8eac56d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_bindings
    ADD CONSTRAINT "FK_e71d86958c7184c058ca8eac56d" FOREIGN KEY ("targetSystemIntegrationId") REFERENCES public.system_integrations(id);


--
-- Name: data_bindings FK_ee8022d1372c9a5670bd611196d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_bindings
    ADD CONSTRAINT "FK_ee8022d1372c9a5670bd611196d" FOREIGN KEY ("targetModbusConnectionId") REFERENCES public.modbus_connections(id);


--
-- Name: ethernetip_connections FK_f0b06fb847659c8c11ac72e3860; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ethernetip_connections
    ADD CONSTRAINT "FK_f0b06fb847659c8c11ac72e3860" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id);


--
-- Name: data_bindings FK_f3cff418b88f34697ea8dc660a4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_bindings
    ADD CONSTRAINT "FK_f3cff418b88f34697ea8dc660a4" FOREIGN KEY ("targetMQTTConnectionId") REFERENCES public.mqtt_connections(id);


--
-- Name: production_events FK_f6b86cfe4d0085cf0ab70695b6a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_events
    ADD CONSTRAINT "FK_f6b86cfe4d0085cf0ab70695b6a" FOREIGN KEY (rca_id) REFERENCES public.rcas(id);


--
-- Name: loss_categories FK_f8ba443e0240f5c682948a1d434; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loss_categories
    ADD CONSTRAINT "FK_f8ba443e0240f5c682948a1d434" FOREIGN KEY ("reconcileFormId") REFERENCES public.reconcile_forms(id);


--
-- Name: data_bindings FK_fc1593a9ec86506eb3f7a2eef8c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_bindings
    ADD CONSTRAINT "FK_fc1593a9ec86506eb3f7a2eef8c" FOREIGN KEY ("sourceModbusConnectionId") REFERENCES public.modbus_connections(id);


--
-- Name: production_events FK_fda378c707c43df7d9730fdac8c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_events
    ADD CONSTRAINT "FK_fda378c707c43df7d9730fdac8c" FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- PostgreSQL database dump complete
--

\unrestrict FmNYYQF6w2Y4DXwifYI19iptOLhWgK0tN6vKVK2oFoJaRuKnIJCq3SWmnS4t5lo

