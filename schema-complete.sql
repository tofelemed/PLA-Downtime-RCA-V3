-- ============================================================================
-- COMPLETE DATABASE SCHEMA FOR PRO-ACT APPLICATION
-- Database: PostgreSQL 14+ (adaptable to other databases)
-- Version: 1.0
-- Date: October 16, 2025
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PART 1: CORE MASTER DATA TABLES
-- ============================================================================

-- Organizations (Top-level entity)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT org_code_not_empty CHECK (TRIM(code) != '')
);

-- Tenants (Customer/Site level)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    address TEXT,
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_tenant_organization FOREIGN KEY (organization_id) 
        REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT tenant_code_org_unique UNIQUE (organization_id, code)
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    tenant_id UUID,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Manager', 'Analyst', 'Engineer', 'Operator')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_user_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
    CONSTRAINT fk_user_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);

-- Units (Production lines/facilities)
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    capacity DECIMAL(15,2),
    unit_of_measure VARCHAR(50),
    ideal_cycle_time INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_unit_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT unit_code_tenant_unique UNIQUE (tenant_id, code)
);

-- Assets (Equipment/machines)
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    unit_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    asset_type VARCHAR(50) CHECK (asset_type IN ('Equipment', 'Instrument', 'System')),
    criticality VARCHAR(20) CHECK (criticality IN ('High', 'Medium', 'Low')),
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    serial_number VARCHAR(255),
    installation_date DATE,
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Maintenance', 'Retired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_asset_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_asset_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
    CONSTRAINT asset_code_unit_unique UNIQUE (unit_id, code)
);

-- ============================================================================
-- PART 2: CODE TABLES (MASTER REFERENCE DATA)
-- ============================================================================

-- Impact Codes
CREATE TABLE impact_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) CHECK (category IN ('Quality', 'Availability', 'Performance')),
    cost_per_unit DECIMAL(15,2),
    cost_per_hour DECIMAL(15,2),
    cost_basis VARCHAR(20) CHECK (cost_basis IN ('perUnit', 'perHour')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_impact_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT impact_code_tenant_unique UNIQUE (tenant_id, code)
);

-- OEE Codes
CREATE TABLE oee_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) CHECK (category IN ('Planned', 'Unplanned')),
    impact_type VARCHAR(50) CHECK (impact_type IN ('Availability', 'Performance', 'Quality')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_oee_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT oee_code_tenant_unique UNIQUE (tenant_id, code)
);

-- RCA Cause Codes
CREATE TABLE rca_cause_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) CHECK (category IN ('Equipment', 'Process', 'Material', 'Personnel', 'Environment', 'Method')),
    parent_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_rca_cause_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_rca_cause_parent FOREIGN KEY (parent_id) REFERENCES rca_cause_codes(id) ON DELETE SET NULL,
    CONSTRAINT rca_cause_code_tenant_unique UNIQUE (tenant_id, code)
);

-- Verification Status Codes
CREATE TABLE verification_status_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(50),
    items TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_verification_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT verification_code_tenant_unique UNIQUE (tenant_id, code)
);

-- Reason Codes (ISA-95 compliant)
CREATE TABLE reason_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_reason_code_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_reason_code_parent FOREIGN KEY (parent_id) REFERENCES reason_codes(id) ON DELETE SET NULL,
    CONSTRAINT reason_code_tenant_unique UNIQUE (tenant_id, code)
);

-- ============================================================================
-- PART 3: PRODUCTION MANAGEMENT TABLES
-- ============================================================================

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    tenant_id UUID,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit_of_measure VARCHAR(50),
    standard_cost DECIMAL(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT product_code_unique UNIQUE (code)
);

-- Production Plan Templates
CREATE TABLE production_plan_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit_id UUID NOT NULL,
    product_ids UUID[],
    plan_basis VARCHAR(50),
    start_date DATE,
    end_date DATE,
    recurrence VARCHAR(50),
    useful_production_time JSONB,
    data_entry_frequency VARCHAR(50),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_plan_template_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_plan_template_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
);

-- Production Plans
CREATE TABLE production_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    name VARCHAR(255) NOT NULL,
    unit_id UUID NOT NULL,
    product_id UUID NOT NULL,
    planned_quantity DECIMAL(15,2) NOT NULL,
    actual_quantity DECIMAL(15,2),
    tolerance_limit DECIMAL(15,2),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    plan_basis VARCHAR(50),
    useful_production_time JSONB,
    recurrence VARCHAR(50),
    data_entry_frequency VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Planned' CHECK (status IN ('Planned', 'Active', 'Completed', 'Cancelled')),
    shift VARCHAR(50),
    crew VARCHAR(50),
    planner_notes TEXT,
    comments JSONB,
    approval_status VARCHAR(50) DEFAULT 'Draft' CHECK (approval_status IN ('Draft', 'Pending Review', 'Pending Approval', 'Approved', 'Rejected')),
    submitted_by UUID,
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    custom_attributes JSONB,
    audit_trail JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_plan_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_plan_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
    CONSTRAINT fk_plan_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT fk_plan_submitted_by FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_plan_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_plan_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Production Events (All 7 event types)
CREATE TABLE production_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    organization_id UUID,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    plan_id UUID,
    unit_id UUID NOT NULL,
    asset_id UUID,
    impact_code_id UUID,
    oee_code_id UUID,
    reason_code_id UUID,
    description TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
    source VARCHAR(50) CHECK (source IN ('Manual', 'Simulated PI', 'CMMS', 'PI')),
    quantity DECIMAL(15,2),
    defective_quantity DECIMAL(15,2),
    cost DECIMAL(15,2),
    status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'Coded', 'RCA Required', 'Closed', 'Investigating', 'In Progress', 'Completed', 'Cancelled')),
    rca_id UUID,
    event_type VARCHAR(50) CHECK (event_type IN ('ProductionLoss', 'IOW', 'SOL', 'APM', 'FailureWO', 'ProductionOutput')),
    -- IOW/SOL fields
    parameter VARCHAR(255),
    value DECIMAL(15,4),
    limit_value DECIMAL(15,4),
    limit_type VARCHAR(20) CHECK (limit_type IN ('High', 'Low')),
    breach_duration INTEGER,
    -- SOL specific
    sol_type VARCHAR(50) CHECK (sol_type IN ('Safety', 'Operational')),
    -- APM specific
    apm_type VARCHAR(50),
    severity VARCHAR(50) CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    recommended_action TEXT,
    -- FailureWO specific
    work_order_id VARCHAR(255),
    failure_mode VARCHAR(255),
    -- Additional fields
    shift VARCHAR(50),
    crew VARCHAR(50),
    operator_name VARCHAR(255),
    loss_category VARCHAR(100),
    audit_trail JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_event_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_plan FOREIGN KEY (plan_id) REFERENCES production_plans(id) ON DELETE SET NULL,
    CONSTRAINT fk_event_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL,
    CONSTRAINT fk_event_impact_code FOREIGN KEY (impact_code_id) REFERENCES impact_codes(id) ON DELETE SET NULL,
    CONSTRAINT fk_event_oee_code FOREIGN KEY (oee_code_id) REFERENCES oee_codes(id) ON DELETE SET NULL,
    CONSTRAINT fk_event_reason_code FOREIGN KEY (reason_code_id) REFERENCES reason_codes(id) ON DELETE SET NULL
);

-- Production Losses
CREATE TABLE production_losses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    plan_id UUID NOT NULL,
    period VARCHAR(50) NOT NULL,
    actual DECIMAL(15,2),
    short_range_plan DECIMAL(15,2),
    losses DECIMAL(15,2),
    unaccounted_loss DECIMAL(15,2),
    action VARCHAR(50) CHECK (action IN ('Reconcile', 'RCA Required', 'Closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_loss_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_loss_plan FOREIGN KEY (plan_id) REFERENCES production_plans(id) ON DELETE CASCADE,
    CONSTRAINT loss_plan_period_unique UNIQUE (plan_id, period)
);

-- OEE Summaries
CREATE TABLE oee_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    plan_id UUID NOT NULL,
    period VARCHAR(50) NOT NULL,
    availability DECIMAL(5,2),
    performance DECIMAL(5,2),
    quality DECIMAL(5,2),
    overall_oee DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_oee_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_oee_plan FOREIGN KEY (plan_id) REFERENCES production_plans(id) ON DELETE CASCADE,
    CONSTRAINT oee_plan_period_unique UNIQUE (plan_id, period)
);

-- Reconcile Forms
CREATE TABLE reconcile_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    loss_id UUID NOT NULL,
    total_loss_amount DECIMAL(15,2),
    categorized_loss_amount DECIMAL(15,2),
    unaccounted_loss_amount DECIMAL(15,2),
    production_event TEXT,
    comment TEXT,
    status VARCHAR(50) CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_reconcile_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_reconcile_loss FOREIGN KEY (loss_id) REFERENCES production_losses(id) ON DELETE CASCADE
);

-- Loss Categories
CREATE TABLE loss_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    reconcile_form_id UUID NOT NULL,
    category_name VARCHAR(255),
    loss_amount DECIMAL(15,2),
    impact_code_id UUID,
    oee_code_id UUID,
    description TEXT,
    production_event_id UUID,
    production_event_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_loss_cat_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_loss_cat_reconcile FOREIGN KEY (reconcile_form_id) REFERENCES reconcile_forms(id) ON DELETE CASCADE,
    CONSTRAINT fk_loss_cat_impact FOREIGN KEY (impact_code_id) REFERENCES impact_codes(id) ON DELETE SET NULL,
    CONSTRAINT fk_loss_cat_oee FOREIGN KEY (oee_code_id) REFERENCES oee_codes(id) ON DELETE SET NULL,
    CONSTRAINT fk_loss_cat_event FOREIGN KEY (production_event_id) REFERENCES production_events(id) ON DELETE SET NULL
);

-- ============================================================================
-- PART 4: RCA CORE TABLES
-- ============================================================================

-- RCA Templates
CREATE TABLE rca_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    logic_tree_structure JSONB,
    verification_checklist TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_rca_template_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- RCAs (Root Cause Analysis)
CREATE TABLE rcas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    organization_id UUID,
    event_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'In Progress', 'Analysis', 'Published', 'Closed', 'Definition', 'Data Collection', 'Recommendations', 'Approval', 'Closure')),
    team_lead_id UUID,
    team_member_ids UUID[],
    priority VARCHAR(50) CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    target_close_date DATE,
    actual_close_date DATE,
    root_cause TEXT,
    template_id UUID,
    team_charter TEXT,
    event_diagram JSONB,
    -- Approval & Closure
    approval_status VARCHAR(50) CHECK (approval_status IN ('Pending', 'Approved', 'Rejected')),
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_comments TEXT,
    closure_status VARCHAR(50) CHECK (closure_status IN ('Pending', 'Closed')),
    closed_by UUID,
    closed_at TIMESTAMP WITH TIME ZONE,
    closure_notes TEXT,
    -- Tracking & Performance Metrics
    pre_failure_rate DECIMAL(10,2),
    post_failure_rate DECIMAL(10,2),
    failure_cost_per_incident DECIMAL(15,2),
    implementation_cost DECIMAL(15,2),
    time_to_resolution INTEGER,
    time_to_implementation INTEGER,
    effectiveness_score DECIMAL(5,2),
    last_metrics_update TIMESTAMP WITH TIME ZONE,
    tracking_notes TEXT,
    -- Timeline Tracking
    investigation_start TIMESTAMP WITH TIME ZONE,
    analysis_complete TIMESTAMP WITH TIME ZONE,
    recommendations_published TIMESTAMP WITH TIME ZONE,
    implementation_start TIMESTAMP WITH TIME ZONE,
    implementation_complete TIMESTAMP WITH TIME ZONE,
    effectiveness_review TIMESTAMP WITH TIME ZONE,
    -- ROI & Business Impact
    calculated_roi DECIMAL(10,2),
    cost_savings DECIMAL(15,2),
    downtime_reduction DECIMAL(5,2),
    productivity_improvement DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_rca_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_rca_event FOREIGN KEY (event_id) REFERENCES production_events(id) ON DELETE CASCADE,
    CONSTRAINT fk_rca_team_lead FOREIGN KEY (team_lead_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_rca_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_rca_closed_by FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_rca_template FOREIGN KEY (template_id) REFERENCES rca_templates(id) ON DELETE SET NULL
);

-- RCA Recommendations
CREATE TABLE rca_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    organization_id UUID,
    rca_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority VARCHAR(50) CHECK (priority IN ('Low', 'Medium', 'High')),
    assignee_id UUID,
    due_date DATE,
    status VARCHAR(50) CHECK (status IN ('Open', 'In Progress', 'Completed', 'Cancelled')),
    cmms_work_order_id VARCHAR(255),
    estimated_cost DECIMAL(15,2),
    actual_cost DECIMAL(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_recommendation_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_recommendation_rca FOREIGN KEY (rca_id) REFERENCES rcas(id) ON DELETE CASCADE,
    CONSTRAINT fk_recommendation_assignee FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Evidence Categories
CREATE TABLE evidence_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evidence_cat_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Evidence Locations
CREATE TABLE evidence_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evidence_loc_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- RCA Evidence
CREATE TABLE rca_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    organization_id UUID,
    rca_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    type VARCHAR(50) CHECK (type IN ('Photo', 'Document', 'Time Series', 'Note', 'Video')),
    file_name VARCHAR(500),
    file_path VARCHAR(1000),
    collected_by UUID,
    collected_at TIMESTAMP WITH TIME ZONE,
    node_ids UUID[],
    category VARCHAR(255),
    location VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE,
    related_asset_id UUID,
    severity VARCHAR(50) CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    tags TEXT[],
    verified BOOLEAN DEFAULT false,
    five_p VARCHAR(50) CHECK (five_p IN ('Parts', 'Paper', 'People', 'Place', 'Process')),
    task TEXT,
    due_date DATE,
    evidence_status VARCHAR(50) CHECK (evidence_status IN ('pending', 'completed')),
    -- Time Series (Historian) fields
    ts_provider VARCHAR(50),
    ts_streams JSONB,
    ts_mode VARCHAR(50),
    ts_start TIMESTAMP WITH TIME ZONE,
    ts_end TIMESTAMP WITH TIME ZONE,
    ts_interval VARCHAR(50),
    ts_intervals INTEGER,
    ts_summary_types VARCHAR(255),
    ts_streams_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_evidence_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_evidence_rca FOREIGN KEY (rca_id) REFERENCES rcas(id) ON DELETE CASCADE,
    CONSTRAINT fk_evidence_collector FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_evidence_asset FOREIGN KEY (related_asset_id) REFERENCES assets(id) ON DELETE SET NULL
);

-- Logic Tree Nodes
CREATE TABLE logic_tree_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    organization_id UUID,
    rca_id UUID NOT NULL,
    parent_id UUID,
    question TEXT NOT NULL,
    answer TEXT,
    type VARCHAR(50) CHECK (type IN ('Root', 'Why', 'How', 'Cause')),
    verified BOOLEAN DEFAULT false,
    evidence_ids UUID[],
    position_x DECIMAL(10,2),
    position_y DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_logic_node_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_logic_node_rca FOREIGN KEY (rca_id) REFERENCES rcas(id) ON DELETE CASCADE,
    CONSTRAINT fk_logic_node_parent FOREIGN KEY (parent_id) REFERENCES logic_tree_nodes(id) ON DELETE CASCADE
);

-- ============================================================================
-- PART 5: RCA ANALYSIS TOOLS TABLES
-- ============================================================================

-- RCA Analysis Configurations
CREATE TABLE rca_analysis_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled_tools JSONB,
    five_why_config JSONB,
    fishbone_config JSONB,
    fmea_config JSONB,
    fault_tree_config JSONB,
    knowledge_base_config JSONB,
    required_fields JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_analysis_config_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- RCA Trigger Configurations
CREATE TABLE rca_trigger_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rules JSONB,
    global_settings JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_trigger_config_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Five Why Analyses
CREATE TABLE five_why_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rca_id UUID NOT NULL,
    problem TEXT NOT NULL,
    why_levels JSONB,
    root_cause TEXT,
    verified_by UUID,
    verified_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_five_why_rca FOREIGN KEY (rca_id) REFERENCES rcas(id) ON DELETE CASCADE,
    CONSTRAINT fk_five_why_verified FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Fishbone Diagrams
CREATE TABLE fishbone_diagrams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rca_id UUID NOT NULL,
    effect TEXT NOT NULL,
    categories JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_fishbone_rca FOREIGN KEY (rca_id) REFERENCES rcas(id) ON DELETE CASCADE
);

-- FMEA Analyses
CREATE TABLE fmea_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rca_id UUID NOT NULL,
    failure_mode TEXT NOT NULL,
    effects JSONB,
    causes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_fmea_rca FOREIGN KEY (rca_id) REFERENCES rcas(id) ON DELETE CASCADE
);

-- Fault Tree Analyses
CREATE TABLE fault_tree_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rca_id UUID NOT NULL,
    top_event TEXT NOT NULL,
    nodes JSONB,
    minimum_cut_sets JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_fault_tree_rca FOREIGN KEY (rca_id) REFERENCES rcas(id) ON DELETE CASCADE
);

-- Barrier Analyses
CREATE TABLE barrier_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rca_id UUID NOT NULL,
    hazard TEXT NOT NULL,
    barriers JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_barrier_rca FOREIGN KEY (rca_id) REFERENCES rcas(id) ON DELETE CASCADE
);

-- Change Analyses
CREATE TABLE change_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rca_id UUID NOT NULL,
    question TEXT NOT NULL,
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_change_rca FOREIGN KEY (rca_id) REFERENCES rcas(id) ON DELETE CASCADE
);

-- RCA Knowledge Base
CREATE TABLE rca_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    rca_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    event_type VARCHAR(50),
    unit_id UUID,
    unit_name VARCHAR(255),
    asset_id UUID,
    asset_name VARCHAR(255),
    equipment_category VARCHAR(255),
    problem_statement TEXT,
    symptoms TEXT[],
    impact_codes TEXT[],
    oee_codes TEXT[],
    root_cause TEXT,
    root_cause_category VARCHAR(100),
    contributing_factors TEXT[],
    recommendations JSONB,
    recurrence_count INTEGER DEFAULT 0,
    effectiveness DECIMAL(5,2),
    cost_saved DECIMAL(15,2),
    downtime_reduced INTEGER,
    keywords TEXT[],
    tags TEXT[],
    closed_date DATE,
    times_referenced INTEGER DEFAULT 0,
    helpful_votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_knowledge_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_knowledge_rca FOREIGN KEY (rca_id) REFERENCES rcas(id) ON DELETE CASCADE,
    CONSTRAINT fk_knowledge_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL,
    CONSTRAINT fk_knowledge_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
);

-- ============================================================================
-- PART 6: PI INTEGRATION TABLES
-- ============================================================================

-- PI Connections
CREATE TABLE pi_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    username VARCHAR(255),
    password_encrypted TEXT,
    secret_ref VARCHAR(255),
    asset_server JSONB,
    af_database JSONB,
    tz_policy VARCHAR(20) DEFAULT 'utc',
    auto_delta_sync_enabled BOOLEAN DEFAULT false,
    sync_interval_sec INTEGER DEFAULT 300,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_pi_conn_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- PI AF Elements
CREATE TABLE pi_af_elements (
    id UUID PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    af_path VARCHAR(1000),
    template VARCHAR(255),
    categories TEXT[],
    parent_id UUID,
    level INTEGER,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_pi_element_parent FOREIGN KEY (parent_id) REFERENCES pi_af_elements(id) ON DELETE SET NULL
);

-- AF Bindings (PI to Local Entity Bindings)
CREATE TABLE af_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    web_id VARCHAR(500) NOT NULL,
    bound_type VARCHAR(50) CHECK (bound_type IN ('tenant', 'unit', 'asset')),
    local_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_binding_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT binding_unique UNIQUE (tenant_id, web_id, bound_type)
);

-- PI Events
CREATE TABLE pi_events (
    id UUID PRIMARY KEY,
    ef_id VARCHAR(500) NOT NULL,
    template VARCHAR(255),
    name VARCHAR(500) NOT NULL,
    start_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    end_utc TIMESTAMP WITH TIME ZONE,
    primary_af_id UUID,
    attributes JSONB,
    last_modified_utc TIMESTAMP WITH TIME ZONE,
    tenant_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_pi_event_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_pi_event_element FOREIGN KEY (primary_af_id) REFERENCES pi_af_elements(id) ON DELETE SET NULL
);

-- PI Mappings
CREATE TABLE pi_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    template_to_event_type JSONB,
    attributes_by_template JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_pi_mapping_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- PI Sync Watermarks
CREATE TABLE pi_sync_watermarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    scope_type VARCHAR(50) CHECK (scope_type IN ('element', 'database')),
    scope_id VARCHAR(500) NOT NULL,
    last_end_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_watermark_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT watermark_unique UNIQUE (tenant_id, scope_type, scope_id)
);

-- PI Sync Jobs
CREATE TABLE pi_sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    job_name VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    schedule VARCHAR(100),
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_sync_job_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Historian Tags
CREATE TABLE historian_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(1000),
    web_id VARCHAR(500),
    units VARCHAR(100),
    category VARCHAR(50) CHECK (category IN ('temperature', 'pressure', 'flow', 'level', 'power', 'quality', 'other')),
    update_interval INTEGER,
    thresholds JSONB,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_historian_tag_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ============================================================================
-- PART 7: INTEGRATION & CONFIGURATION TABLES
-- ============================================================================

-- Data Sources (Universal Connector)
CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    connector_type VARCHAR(100) NOT NULL,
    config JSONB,
    enabled BOOLEAN DEFAULT true,
    last_data JSONB,
    last_update TIMESTAMP WITH TIME ZONE,
    error_count INTEGER DEFAULT 0,
    status VARCHAR(50) CHECK (status IN ('active', 'inactive', 'error', 'connecting')),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Connection Configs
CREATE TABLE connection_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    config JSONB,
    enabled BOOLEAN DEFAULT true,
    last_connection TIMESTAMP WITH TIME ZONE,
    connection_status VARCHAR(50) CHECK (connection_status IN ('connected', 'disconnected', 'connecting', 'error')),
    error_count INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Custom Attribute Definitions
CREATE TABLE custom_attribute_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    organization_id UUID,
    entity_type VARCHAR(50) CHECK (entity_type IN ('Organization', 'Tenant', 'Unit', 'Asset')),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    data_type VARCHAR(50) CHECK (data_type IN ('string', 'number', 'boolean', 'date', 'select')),
    is_required BOOLEAN DEFAULT false,
    default_value TEXT,
    validation_rules JSONB,
    select_options TEXT[],
    order_index INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_custom_attr_def_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_custom_attr_def_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Custom Attribute Values
CREATE TABLE custom_attribute_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    entity_type VARCHAR(50) CHECK (entity_type IN ('Organization', 'Tenant', 'Unit', 'Asset')),
    attribute_definition_id UUID NOT NULL,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_custom_attr_val_def FOREIGN KEY (attribute_definition_id) REFERENCES custom_attribute_definitions(id) ON DELETE CASCADE,
    CONSTRAINT custom_attr_entity_unique UNIQUE (entity_id, entity_type, attribute_definition_id)
);

-- Dashboard Configurations
CREATE TABLE dashboard_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    oee_config JSONB,
    losses_config JSONB,
    costs_config JSONB,
    bottleneck_risk_config JSONB,
    display_config JSONB,
    performance_config JSONB,
    quality_config JSONB,
    availability_config JSONB,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    last_modified_by UUID,
    last_modified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_dashboard_config_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_dashboard_config_modifier FOREIGN KEY (last_modified_by) REFERENCES users(id) ON DELETE SET NULL
);

-- App Settings (Key-Value Store)
CREATE TABLE app_settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Unmapped Events
CREATE TABLE unmapped_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    unit_id UUID,
    event_data JSONB,
    reason TEXT,
    suggestions TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_unmapped_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_unmapped_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
);

-- ============================================================================
-- PART 8: AUDIT TABLES
-- ============================================================================

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    organization_id UUID,
    user_id UUID,
    user_name VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    details TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- PART 9: INDEXES
-- ============================================================================

-- Organizations
CREATE INDEX idx_organizations_code ON organizations(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE deleted_at IS NULL;

-- Tenants
CREATE INDEX idx_tenants_org ON tenants(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_active ON tenants(is_active) WHERE deleted_at IS NULL;

-- Users
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_tenant ON users(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;

-- Units
CREATE INDEX idx_units_tenant ON units(tenant_id) WHERE deleted_at IS NULL;

-- Assets
CREATE INDEX idx_assets_unit ON assets(unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assets_tenant ON assets(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assets_status ON assets(status) WHERE deleted_at IS NULL;

-- Code Tables
CREATE INDEX idx_impact_codes_tenant ON impact_codes(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_impact_codes_category ON impact_codes(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_oee_codes_tenant ON oee_codes(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_oee_codes_category ON oee_codes(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_rca_cause_codes_tenant ON rca_cause_codes(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_rca_cause_codes_parent ON rca_cause_codes(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_verification_codes_tenant ON verification_status_codes(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reason_codes_tenant ON reason_codes(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reason_codes_parent ON reason_codes(parent_id) WHERE deleted_at IS NULL;

-- Production
CREATE INDEX idx_products_org ON products(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_plan_templates_tenant ON production_plan_templates(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_plan_templates_unit ON production_plan_templates(unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_plans_tenant ON production_plans(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_plans_unit ON production_plans(unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_plans_status ON production_plans(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_plans_date_range ON production_plans(start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_plans_approval ON production_plans(approval_status) WHERE deleted_at IS NULL;

-- Production Events (Critical for performance)
CREATE INDEX idx_events_tenant ON production_events(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_unit ON production_events(unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_plan ON production_events(plan_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_status ON production_events(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_type ON production_events(event_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_time_range ON production_events(start_time, end_time) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_rca ON production_events(rca_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_time_search ON production_events(unit_id, start_time DESC) WHERE deleted_at IS NULL;

-- Losses and OEE
CREATE INDEX idx_losses_tenant ON production_losses(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_losses_plan ON production_losses(plan_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_losses_period ON production_losses(period) WHERE deleted_at IS NULL;
CREATE INDEX idx_oee_tenant ON oee_summaries(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_oee_plan ON oee_summaries(plan_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_oee_period ON oee_summaries(period) WHERE deleted_at IS NULL;

-- RCA
CREATE INDEX idx_rcas_tenant ON rcas(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_rcas_event ON rcas(event_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_rcas_status ON rcas(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_rcas_priority ON rcas(priority) WHERE deleted_at IS NULL;
CREATE INDEX idx_rcas_team_lead ON rcas(team_lead_id) WHERE deleted_at IS NULL;

-- RCA Components
CREATE INDEX idx_recommendations_rca ON rca_recommendations(rca_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_recommendations_assignee ON rca_recommendations(assignee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_evidence_rca ON rca_evidence(rca_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_evidence_type ON rca_evidence(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_logic_nodes_rca ON logic_tree_nodes(rca_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_logic_nodes_parent ON logic_tree_nodes(parent_id) WHERE deleted_at IS NULL;

-- Knowledge Base
CREATE INDEX idx_knowledge_tenant ON rca_knowledge_base(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_knowledge_rca ON rca_knowledge_base(rca_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_knowledge_unit ON rca_knowledge_base(unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_knowledge_tags ON rca_knowledge_base USING GIN(tags);
CREATE INDEX idx_knowledge_keywords ON rca_knowledge_base USING GIN(keywords);

-- PI Integration
CREATE INDEX idx_pi_connections_tenant ON pi_connections(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pi_elements_parent ON pi_af_elements(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pi_elements_template ON pi_af_elements(template) WHERE deleted_at IS NULL;
CREATE INDEX idx_af_bindings_tenant ON af_bindings(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_af_bindings_local ON af_bindings(bound_type, local_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pi_events_tenant ON pi_events(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pi_events_template ON pi_events(template) WHERE deleted_at IS NULL;
CREATE INDEX idx_pi_events_time ON pi_events(start_utc) WHERE deleted_at IS NULL;
CREATE INDEX idx_historian_tags_tenant ON historian_tags(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_historian_tags_category ON historian_tags(category) WHERE deleted_at IS NULL;

-- Custom Attributes
CREATE INDEX idx_custom_attr_defs_tenant ON custom_attribute_definitions(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_custom_attr_defs_entity ON custom_attribute_definitions(entity_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_custom_attr_vals_entity ON custom_attribute_values(entity_id, entity_type) WHERE deleted_at IS NULL;

-- Audit
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- JSONB Indexes (for complex queries)
CREATE INDEX idx_plans_custom_attrs ON production_plans USING GIN (custom_attributes);
CREATE INDEX idx_events_audit_trail ON production_events USING GIN (audit_trail);

-- Full-text search
CREATE INDEX idx_events_description_fts ON production_events USING GIN (to_tsvector('english', description));
CREATE INDEX idx_rcas_title_fts ON rcas USING GIN (to_tsvector('english', title));

-- ============================================================================
-- PART 10: TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at column
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_impact_codes_updated_at BEFORE UPDATE ON impact_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_oee_codes_updated_at BEFORE UPDATE ON oee_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rca_cause_codes_updated_at BEFORE UPDATE ON rca_cause_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_verification_status_codes_updated_at BEFORE UPDATE ON verification_status_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reason_codes_updated_at BEFORE UPDATE ON reason_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_production_plan_templates_updated_at BEFORE UPDATE ON production_plan_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_production_plans_updated_at BEFORE UPDATE ON production_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_production_events_updated_at BEFORE UPDATE ON production_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_production_losses_updated_at BEFORE UPDATE ON production_losses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_oee_summaries_updated_at BEFORE UPDATE ON oee_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reconcile_forms_updated_at BEFORE UPDATE ON reconcile_forms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loss_categories_updated_at BEFORE UPDATE ON loss_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rca_templates_updated_at BEFORE UPDATE ON rca_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rcas_updated_at BEFORE UPDATE ON rcas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rca_recommendations_updated_at BEFORE UPDATE ON rca_recommendations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rca_evidence_updated_at BEFORE UPDATE ON rca_evidence FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_logic_tree_nodes_updated_at BEFORE UPDATE ON logic_tree_nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rca_analysis_configs_updated_at BEFORE UPDATE ON rca_analysis_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rca_trigger_configs_updated_at BEFORE UPDATE ON rca_trigger_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_five_why_analyses_updated_at BEFORE UPDATE ON five_why_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fishbone_diagrams_updated_at BEFORE UPDATE ON fishbone_diagrams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fmea_analyses_updated_at BEFORE UPDATE ON fmea_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fault_tree_analyses_updated_at BEFORE UPDATE ON fault_tree_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_barrier_analyses_updated_at BEFORE UPDATE ON barrier_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_change_analyses_updated_at BEFORE UPDATE ON change_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rca_knowledge_base_updated_at BEFORE UPDATE ON rca_knowledge_base FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pi_connections_updated_at BEFORE UPDATE ON pi_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pi_af_elements_updated_at BEFORE UPDATE ON pi_af_elements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_af_bindings_updated_at BEFORE UPDATE ON af_bindings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pi_events_updated_at BEFORE UPDATE ON pi_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pi_mappings_updated_at BEFORE UPDATE ON pi_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pi_sync_watermarks_updated_at BEFORE UPDATE ON pi_sync_watermarks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pi_sync_jobs_updated_at BEFORE UPDATE ON pi_sync_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_historian_tags_updated_at BEFORE UPDATE ON historian_tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON data_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_connection_configs_updated_at BEFORE UPDATE ON connection_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_attribute_definitions_updated_at BEFORE UPDATE ON custom_attribute_definitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_attribute_values_updated_at BEFORE UPDATE ON custom_attribute_values FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dashboard_configurations_updated_at BEFORE UPDATE ON dashboard_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_unmapped_events_updated_at BEFORE UPDATE ON unmapped_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 11: USEFUL VIEWS
-- ============================================================================

-- Active Events Summary View
CREATE OR REPLACE VIEW v_active_events AS
SELECT 
    e.*,
    u.name as unit_name,
    a.name as asset_name,
    ic.name as impact_code_name,
    oc.name as oee_code_name,
    rc.name as reason_code_name,
    r.title as rca_title,
    r.status as rca_status
FROM production_events e
LEFT JOIN units u ON e.unit_id = u.id
LEFT JOIN assets a ON e.asset_id = a.id
LEFT JOIN impact_codes ic ON e.impact_code_id = ic.id
LEFT JOIN oee_codes oc ON e.oee_code_id = oc.id
LEFT JOIN reason_codes rc ON e.reason_code_id = rc.id
LEFT JOIN rcas r ON e.rca_id = r.id
WHERE e.deleted_at IS NULL
    AND e.status NOT IN ('Cancelled', 'Closed');

-- RCA Dashboard View
CREATE OR REPLACE VIEW v_rca_dashboard AS
SELECT 
    r.*,
    e.description as event_description,
    e.event_type,
    u_lead.name as team_lead_name,
    COUNT(DISTINCT rec.id) as recommendation_count,
    COUNT(DISTINCT ev.id) as evidence_count
FROM rcas r
LEFT JOIN production_events e ON r.event_id = e.id
LEFT JOIN users u_lead ON r.team_lead_id = u_lead.id
LEFT JOIN rca_recommendations rec ON r.id = rec.rca_id AND rec.deleted_at IS NULL
LEFT JOIN rca_evidence ev ON r.id = ev.rca_id AND ev.deleted_at IS NULL
WHERE r.deleted_at IS NULL
GROUP BY r.id, e.description, e.event_type, u_lead.name;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================


