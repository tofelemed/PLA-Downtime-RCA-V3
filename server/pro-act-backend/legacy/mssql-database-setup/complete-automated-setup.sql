-- =============================================
-- ProAct COMPLETE AUTOMATED DATABASE SETUP
-- =============================================
-- This script automatically:
-- 1. Creates the database if not exists
-- 2. Creates all 50 tables with all fields
-- 3. Creates all indexes
-- 4. Verifies the setup
-- =============================================
-- Run this ONE script and everything is ready!
-- =============================================

USE master;
GO

-- =============================================
-- STEP 1: CREATE DATABASE
-- =============================================

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'ProActDB')
BEGIN
    CREATE DATABASE ProActDB;
    PRINT '✓ Database ProActDB created successfully';
END
ELSE
BEGIN
    PRINT '⚠ Database ProActDB already exists - using existing database';
END
GO

USE ProActDB;
GO

PRINT '';
PRINT '==============================================';
PRINT 'Creating ProAct Database Schema';
PRINT 'Total Tables: 50';
PRINT '==============================================';
PRINT '';

-- =============================================
-- STEP 2: CREATE ALL 50 TABLES
-- =============================================

-- =============================================
-- 1. CORE ENTITIES (6 Tables)
-- =============================================

-- 1.1 Organizations
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[organizations]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[organizations] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [name] NVARCHAR(255) NOT NULL,
        [code] VARCHAR(50) NOT NULL UNIQUE,
        [description] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_organizations_tenant_id ON [dbo].[organizations]([tenant_id]);
    CREATE INDEX idx_organizations_organization_id ON [dbo].[organizations]([organization_id]);
    CREATE INDEX idx_organizations_created_at ON [dbo].[organizations]([created_at]);
    PRINT '✓ Created: organizations';
END
ELSE PRINT '  - organizations (exists)';
GO

-- 1.2 Tenants
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tenants]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[tenants] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [code] VARCHAR(50) NOT NULL UNIQUE,
        [description] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_tenants_tenant_id ON [dbo].[tenants]([tenant_id]);
    CREATE INDEX idx_tenants_organization_id ON [dbo].[tenants]([organization_id]);
    CREATE INDEX idx_tenants_created_at ON [dbo].[tenants]([created_at]);
    PRINT '✓ Created: tenants';
END
ELSE PRINT '  - tenants (exists)';
GO

-- 1.3 Users
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[users] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [name] NVARCHAR(255) NOT NULL,
        [email] NVARCHAR(255) NOT NULL UNIQUE,
        [password_hash] VARCHAR(255) NOT NULL,
        [role] VARCHAR(50) NOT NULL CHECK ([role] IN ('SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Manager', 'Analyst', 'Engineer', 'Operator')),
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_users_tenant_id ON [dbo].[users]([tenant_id]);
    CREATE INDEX idx_users_organization_id ON [dbo].[users]([organization_id]);
    CREATE INDEX idx_users_created_at ON [dbo].[users]([created_at]);
    CREATE INDEX idx_users_email ON [dbo].[users]([email]);
    PRINT '✓ Created: users';
END
ELSE PRINT '  - users (exists)';
GO

-- 1.4 Units
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[units]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[units] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NOT NULL,
        [organization_id] VARCHAR(36) NULL,
        [name] NVARCHAR(255) NOT NULL,
        [code] VARCHAR(50) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        CONSTRAINT unique_unit_code_per_tenant UNIQUE ([tenant_id], [code])
    );
    CREATE INDEX idx_units_tenant_id ON [dbo].[units]([tenant_id]);
    CREATE INDEX idx_units_organization_id ON [dbo].[units]([organization_id]);
    CREATE INDEX idx_units_created_at ON [dbo].[units]([created_at]);
    PRINT '✓ Created: units';
END
ELSE PRINT '  - units (exists)';
GO

-- 1.5 Assets
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[assets]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[assets] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [name] NVARCHAR(255) NOT NULL,
        [code] VARCHAR(50) NOT NULL,
        [unit_id] VARCHAR(36) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        CONSTRAINT unique_asset_code_per_unit UNIQUE ([unit_id], [code])
    );
    CREATE INDEX idx_assets_tenant_id ON [dbo].[assets]([tenant_id]);
    CREATE INDEX idx_assets_organization_id ON [dbo].[assets]([organization_id]);
    CREATE INDEX idx_assets_created_at ON [dbo].[assets]([created_at]);
    CREATE INDEX idx_assets_unit_id ON [dbo].[assets]([unit_id]);
    PRINT '✓ Created: assets';
END
ELSE PRINT '  - assets (exists)';
GO

-- 1.6 Audit Logs
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[audit_logs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[audit_logs] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [user_id] VARCHAR(36) NOT NULL,
        [action] VARCHAR(100) NOT NULL,
        [entity_type] VARCHAR(100) NOT NULL,
        [entity_id] VARCHAR(36) NOT NULL,
        [details] NVARCHAR(MAX) NULL,
        [timestamp] DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX idx_audit_logs_tenant_id ON [dbo].[audit_logs]([tenant_id]);
    CREATE INDEX idx_audit_logs_organization_id ON [dbo].[audit_logs]([organization_id]);
    CREATE INDEX idx_audit_logs_created_at ON [dbo].[audit_logs]([created_at]);
    CREATE INDEX idx_audit_logs_user_id ON [dbo].[audit_logs]([user_id]);
    CREATE INDEX idx_audit_logs_entity_type ON [dbo].[audit_logs]([entity_type]);
    CREATE INDEX idx_audit_logs_timestamp ON [dbo].[audit_logs]([timestamp]);
    PRINT '✓ Created: audit_logs';
END
ELSE PRINT '  - audit_logs (exists)';
GO

-- 1.7 Roles
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[roles]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[roles] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [name] NVARCHAR(100) NOT NULL UNIQUE,
        [description] NVARCHAR(MAX) NULL,
        [permissions] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_roles_created_at ON [dbo].[roles]([created_at]);
    PRINT '✓ Created: roles';
END
ELSE PRINT '  - roles (exists)';
GO

-- 1.8 Tasks
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tasks]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[tasks] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [title] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [assigned_to] VARCHAR(36) NOT NULL,
        [assigned_by] VARCHAR(36) NOT NULL,
        [priority] VARCHAR(50) NOT NULL,
        [status] VARCHAR(50) NOT NULL,
        [due_date] DATETIME NULL,
        [completed_date] DATETIME NULL,
        [entity_type] VARCHAR(100) NULL,
        [entity_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NOT NULL,
        [tenant_id] VARCHAR(36) NOT NULL
    );
    CREATE INDEX idx_tasks_tenant_id ON [dbo].[tasks]([tenant_id]);
    CREATE INDEX idx_tasks_assigned_to ON [dbo].[tasks]([assigned_to]);
    CREATE INDEX idx_tasks_status ON [dbo].[tasks]([status]);
    PRINT '✓ Created: tasks';
END
ELSE PRINT '  - tasks (exists)';
GO

PRINT '';
PRINT '✓ Core entities completed (8/50)';
PRINT '';

-- =============================================
-- 2. MASTER DATA ENTITIES (5 Tables)
-- =============================================

-- 2.1 Impact Codes
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[impact_codes]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[impact_codes] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [code] VARCHAR(50) NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [severity] VARCHAR(50) NULL,
        [color] VARCHAR(7) NULL,
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_impact_codes_tenant_id ON [dbo].[impact_codes]([tenant_id]);
    CREATE INDEX idx_impact_codes_organization_id ON [dbo].[impact_codes]([organization_id]);
    CREATE INDEX idx_impact_codes_created_at ON [dbo].[impact_codes]([created_at]);
    PRINT '✓ Created: impact_codes';
END
ELSE PRINT '  - impact_codes (exists)';
GO

-- 2.2 OEE Codes
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[oee_codes]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[oee_codes] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [code] VARCHAR(50) NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [category] VARCHAR(100) NULL,
        [description] NVARCHAR(MAX) NULL,
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_oee_codes_tenant_id ON [dbo].[oee_codes]([tenant_id]);
    CREATE INDEX idx_oee_codes_organization_id ON [dbo].[oee_codes]([organization_id]);
    CREATE INDEX idx_oee_codes_created_at ON [dbo].[oee_codes]([created_at]);
    PRINT '✓ Created: oee_codes';
END
ELSE PRINT '  - oee_codes (exists)';
GO

-- 2.3 RCA Cause Codes
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[rca_cause_codes]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[rca_cause_codes] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [code] VARCHAR(50) NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [category] VARCHAR(100) NULL,
        [description] NVARCHAR(MAX) NULL,
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_rca_cause_codes_tenant_id ON [dbo].[rca_cause_codes]([tenant_id]);
    CREATE INDEX idx_rca_cause_codes_organization_id ON [dbo].[rca_cause_codes]([organization_id]);
    CREATE INDEX idx_rca_cause_codes_created_at ON [dbo].[rca_cause_codes]([created_at]);
    PRINT '✓ Created: rca_cause_codes';
END
ELSE PRINT '  - rca_cause_codes (exists)';
GO

-- 2.4 Verification Status Codes
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[verification_status_codes]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[verification_status_codes] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [code] VARCHAR(50) NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_verification_status_codes_tenant_id ON [dbo].[verification_status_codes]([tenant_id]);
    CREATE INDEX idx_verification_status_codes_organization_id ON [dbo].[verification_status_codes]([organization_id]);
    CREATE INDEX idx_verification_status_codes_created_at ON [dbo].[verification_status_codes]([created_at]);
    PRINT '✓ Created: verification_status_codes';
END
ELSE PRINT '  - verification_status_codes (exists)';
GO

-- 2.5 Reason Codes
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[reason_codes]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[reason_codes] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [code] VARCHAR(50) NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [category] VARCHAR(100) NULL,
        [description] NVARCHAR(MAX) NULL,
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_reason_codes_tenant_id ON [dbo].[reason_codes]([tenant_id]);
    CREATE INDEX idx_reason_codes_organization_id ON [dbo].[reason_codes]([organization_id]);
    CREATE INDEX idx_reason_codes_created_at ON [dbo].[reason_codes]([created_at]);
    PRINT '✓ Created: reason_codes';
END
ELSE PRINT '  - reason_codes (exists)';
GO

PRINT '';
PRINT '✓ Master data entities completed (11/50)';
PRINT '';

-- =============================================
-- 3. PRODUCTION ENTITIES (9 Tables)
-- =============================================

-- 3.1 Products
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[products] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [unit_id] VARCHAR(36) NULL,
        [name] NVARCHAR(255) NOT NULL,
        [code] VARCHAR(50) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [uom] VARCHAR(50) NULL,
        [standard_rate] DECIMAL(15,4) NULL,
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_products_tenant_id ON [dbo].[products]([tenant_id]);
    CREATE INDEX idx_products_organization_id ON [dbo].[products]([organization_id]);
    CREATE INDEX idx_products_created_at ON [dbo].[products]([created_at]);
    CREATE INDEX idx_products_unit_id ON [dbo].[products]([unit_id]);
    PRINT '✓ Created: products';
END
ELSE PRINT '  - products (exists)';
GO

-- 3.2 Production Plans
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[production_plans]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[production_plans] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [unit_id] VARCHAR(36) NOT NULL,
        [product_id] VARCHAR(36) NULL,
        [plan_name] NVARCHAR(255) NOT NULL,
        [start_date] DATETIME NOT NULL,
        [end_date] DATETIME NOT NULL,
        [target_quantity] DECIMAL(15,4) NULL,
        [actual_quantity] DECIMAL(15,4) NULL,
        [status] VARCHAR(50) NULL
    );
    CREATE INDEX idx_production_plans_tenant_id ON [dbo].[production_plans]([tenant_id]);
    CREATE INDEX idx_production_plans_organization_id ON [dbo].[production_plans]([organization_id]);
    CREATE INDEX idx_production_plans_created_at ON [dbo].[production_plans]([created_at]);
    CREATE INDEX idx_production_plans_unit_id ON [dbo].[production_plans]([unit_id]);
    PRINT '✓ Created: production_plans';
END
ELSE PRINT '  - production_plans (exists)';
GO

-- 3.3 Production Plan Templates
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[production_plan_templates]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[production_plan_templates] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [name] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [template_data] NVARCHAR(MAX) NULL,
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_production_plan_templates_tenant_id ON [dbo].[production_plan_templates]([tenant_id]);
    CREATE INDEX idx_production_plan_templates_organization_id ON [dbo].[production_plan_templates]([organization_id]);
    CREATE INDEX idx_production_plan_templates_created_at ON [dbo].[production_plan_templates]([created_at]);
    PRINT '✓ Created: production_plan_templates';
END
ELSE PRINT '  - production_plan_templates (exists)';
GO

-- 3.4 Production Events
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[production_events] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [unit_id] VARCHAR(36) NOT NULL,
        [event_type] VARCHAR(100) NULL,
        [event_name] NVARCHAR(255) NULL,
        [start_time] DATETIME NOT NULL,
        [end_time] DATETIME NULL,
        [duration] INT NULL,
        [status] VARCHAR(50) NULL,
        [severity] VARCHAR(50) NULL,
        [impact_code_id] VARCHAR(36) NULL,
        [description] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_production_events_tenant_id ON [dbo].[production_events]([tenant_id]);
    CREATE INDEX idx_production_events_organization_id ON [dbo].[production_events]([organization_id]);
    CREATE INDEX idx_production_events_created_at ON [dbo].[production_events]([created_at]);
    CREATE INDEX idx_production_events_unit_id ON [dbo].[production_events]([unit_id]);
    CREATE INDEX idx_production_events_status ON [dbo].[production_events]([status]);
    PRINT '✓ Created: production_events';
END
ELSE PRINT '  - production_events (exists)';
GO

-- 3.5 Production Losses
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[production_losses]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[production_losses] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [plan_id] VARCHAR(36) NOT NULL,
        [period] VARCHAR(50) NULL,
        [loss_type] VARCHAR(100) NULL,
        [loss_category] VARCHAR(100) NULL,
        [quantity] DECIMAL(15,4) NULL,
        [cost] DECIMAL(15,2) NULL,
        [description] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_production_losses_tenant_id ON [dbo].[production_losses]([tenant_id]);
    CREATE INDEX idx_production_losses_organization_id ON [dbo].[production_losses]([organization_id]);
    CREATE INDEX idx_production_losses_created_at ON [dbo].[production_losses]([created_at]);
    CREATE INDEX idx_production_losses_plan_id ON [dbo].[production_losses]([plan_id]);
    CREATE INDEX idx_production_losses_period ON [dbo].[production_losses]([period]);
    PRINT '✓ Created: production_losses';
END
ELSE PRINT '  - production_losses (exists)';
GO

-- 3.6 OEE Summaries
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[oee_summaries]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[oee_summaries] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [plan_id] VARCHAR(36) NOT NULL,
        [period] VARCHAR(50) NULL,
        [availability] DECIMAL(5,2) NULL,
        [performance] DECIMAL(5,2) NULL,
        [quality] DECIMAL(5,2) NULL,
        [oee] DECIMAL(5,2) NULL,
        [planned_production_time] DECIMAL(10,2) NULL,
        [actual_production_time] DECIMAL(10,2) NULL,
        [downtime] DECIMAL(10,2) NULL
    );
    CREATE INDEX idx_oee_summaries_tenant_id ON [dbo].[oee_summaries]([tenant_id]);
    CREATE INDEX idx_oee_summaries_organization_id ON [dbo].[oee_summaries]([organization_id]);
    CREATE INDEX idx_oee_summaries_created_at ON [dbo].[oee_summaries]([created_at]);
    CREATE INDEX idx_oee_summaries_plan_id ON [dbo].[oee_summaries]([plan_id]);
    CREATE INDEX idx_oee_summaries_period ON [dbo].[oee_summaries]([period]);
    PRINT '✓ Created: oee_summaries';
END
ELSE PRINT '  - oee_summaries (exists)';
GO

-- 3.7 Reconcile Forms
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[reconcile_forms]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[reconcile_forms] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [loss_id] VARCHAR(36) NOT NULL,
        [status] VARCHAR(50) NULL,
        [submitted_by] VARCHAR(36) NULL,
        [submitted_at] DATETIME NULL,
        [reviewed_by] VARCHAR(36) NULL,
        [reviewed_at] DATETIME NULL,
        [form_data] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_reconcile_forms_tenant_id ON [dbo].[reconcile_forms]([tenant_id]);
    CREATE INDEX idx_reconcile_forms_organization_id ON [dbo].[reconcile_forms]([organization_id]);
    CREATE INDEX idx_reconcile_forms_created_at ON [dbo].[reconcile_forms]([created_at]);
    CREATE INDEX idx_reconcile_forms_loss_id ON [dbo].[reconcile_forms]([loss_id]);
    CREATE INDEX idx_reconcile_forms_status ON [dbo].[reconcile_forms]([status]);
    PRINT '✓ Created: reconcile_forms';
END
ELSE PRINT '  - reconcile_forms (exists)';
GO

-- 3.8 Loss Categories
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[loss_categories]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[loss_categories] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [reconcile_form_id] VARCHAR(36) NULL,
        [category_name] NVARCHAR(255) NULL,
        [category_type] VARCHAR(100) NULL,
        [value] DECIMAL(15,4) NULL,
        [percentage] DECIMAL(5,2) NULL
    );
    CREATE INDEX idx_loss_categories_tenant_id ON [dbo].[loss_categories]([tenant_id]);
    CREATE INDEX idx_loss_categories_organization_id ON [dbo].[loss_categories]([organization_id]);
    CREATE INDEX idx_loss_categories_created_at ON [dbo].[loss_categories]([created_at]);
    CREATE INDEX idx_loss_categories_reconcile_form_id ON [dbo].[loss_categories]([reconcile_form_id]);
    PRINT '✓ Created: loss_categories';
END
ELSE PRINT '  - loss_categories (exists)';
GO

-- 3.9 Unmapped Events
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[unmapped_events]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[unmapped_events] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [unit_id] VARCHAR(36) NULL,
        [event_name] NVARCHAR(255) NULL,
        [event_type] VARCHAR(100) NULL,
        [start_time] DATETIME NULL,
        [end_time] DATETIME NULL,
        [source_system] VARCHAR(100) NULL,
        [source_id] VARCHAR(255) NULL,
        [event_data] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_unmapped_events_tenant_id ON [dbo].[unmapped_events]([tenant_id]);
    CREATE INDEX idx_unmapped_events_organization_id ON [dbo].[unmapped_events]([organization_id]);
    CREATE INDEX idx_unmapped_events_created_at ON [dbo].[unmapped_events]([created_at]);
    CREATE INDEX idx_unmapped_events_unit_id ON [dbo].[unmapped_events]([unit_id]);
    PRINT '✓ Created: unmapped_events';
END
ELSE PRINT '  - unmapped_events (exists)';
GO

PRINT '';
PRINT '✓ Production entities completed (20/50)';
PRINT '';

-- =============================================
-- 4. RCA ENTITIES (10 Tables)
-- =============================================

-- 4.1 RCAs
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[rcas] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [event_id] VARCHAR(36) NULL,
        [rca_number] VARCHAR(100) NULL,
        [title] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [status] VARCHAR(50) NULL,
        [priority] VARCHAR(50) NULL,
        [assigned_to] VARCHAR(36) NULL,
        [team_members] NVARCHAR(MAX) NULL,
        [start_date] DATETIME NULL,
        [target_completion_date] DATETIME NULL,
        [actual_completion_date] DATETIME NULL,
        [root_cause] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_rcas_tenant_id ON [dbo].[rcas]([tenant_id]);
    CREATE INDEX idx_rcas_organization_id ON [dbo].[rcas]([organization_id]);
    CREATE INDEX idx_rcas_created_at ON [dbo].[rcas]([created_at]);
    CREATE INDEX idx_rcas_event_id ON [dbo].[rcas]([event_id]);
    CREATE INDEX idx_rcas_status ON [dbo].[rcas]([status]);
    PRINT '✓ Created: rcas';
END
ELSE PRINT '  - rcas (exists)';
GO

-- 4.2 RCA Recommendations
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[rca_recommendations]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[rca_recommendations] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [recommendation_text] NVARCHAR(MAX) NOT NULL,
        [priority] VARCHAR(50) NULL,
        [status] VARCHAR(50) NULL,
        [assigned_to] VARCHAR(36) NULL,
        [due_date] DATETIME NULL,
        [completion_date] DATETIME NULL,
        [cost_estimate] DECIMAL(15,2) NULL
    );
    CREATE INDEX idx_rca_recommendations_tenant_id ON [dbo].[rca_recommendations]([tenant_id]);
    CREATE INDEX idx_rca_recommendations_organization_id ON [dbo].[rca_recommendations]([organization_id]);
    CREATE INDEX idx_rca_recommendations_created_at ON [dbo].[rca_recommendations]([created_at]);
    CREATE INDEX idx_rca_recommendations_rca_id ON [dbo].[rca_recommendations]([rca_id]);
    PRINT '✓ Created: rca_recommendations';
END
ELSE PRINT '  - rca_recommendations (exists)';
GO

-- 4.3 RCA Evidence
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[rca_evidence]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[rca_evidence] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [evidence_type] VARCHAR(100) NULL,
        [title] NVARCHAR(255) NULL,
        [description] NVARCHAR(MAX) NULL,
        [file_url] VARCHAR(500) NULL,
        [file_name] NVARCHAR(255) NULL,
        [file_size] INT NULL,
        [uploaded_by] VARCHAR(36) NULL
    );
    CREATE INDEX idx_rca_evidence_tenant_id ON [dbo].[rca_evidence]([tenant_id]);
    CREATE INDEX idx_rca_evidence_organization_id ON [dbo].[rca_evidence]([organization_id]);
    CREATE INDEX idx_rca_evidence_created_at ON [dbo].[rca_evidence]([created_at]);
    CREATE INDEX idx_rca_evidence_rca_id ON [dbo].[rca_evidence]([rca_id]);
    PRINT '✓ Created: rca_evidence';
END
ELSE PRINT '  - rca_evidence (exists)';
GO

-- 4.4 Logic Tree Nodes
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[logic_tree_nodes]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[logic_tree_nodes] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [parent_node_id] VARCHAR(36) NULL,
        [node_type] VARCHAR(50) NULL,
        [label] NVARCHAR(255) NULL,
        [description] NVARCHAR(MAX) NULL,
        [level] INT NULL,
        [position] INT NULL
    );
    CREATE INDEX idx_logic_tree_nodes_tenant_id ON [dbo].[logic_tree_nodes]([tenant_id]);
    CREATE INDEX idx_logic_tree_nodes_organization_id ON [dbo].[logic_tree_nodes]([organization_id]);
    CREATE INDEX idx_logic_tree_nodes_created_at ON [dbo].[logic_tree_nodes]([created_at]);
    CREATE INDEX idx_logic_tree_nodes_rca_id ON [dbo].[logic_tree_nodes]([rca_id]);
    CREATE INDEX idx_logic_tree_nodes_parent_node_id ON [dbo].[logic_tree_nodes]([parent_node_id]);
    PRINT '✓ Created: logic_tree_nodes';
END
ELSE PRINT '  - logic_tree_nodes (exists)';
GO

-- 4.5 RCA Trigger Configs (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[rca_trigger_configs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[rca_trigger_configs] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [name] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [trigger_type] VARCHAR(100) NULL,
        [conditions] NVARCHAR(MAX) NULL,
        [is_active] BIT DEFAULT 1,
        [auto_create_rca] BIT DEFAULT 0
    );
    CREATE INDEX idx_rca_trigger_configs_tenant_id ON [dbo].[rca_trigger_configs]([tenant_id]);
    CREATE INDEX idx_rca_trigger_configs_organization_id ON [dbo].[rca_trigger_configs]([organization_id]);
    CREATE INDEX idx_rca_trigger_configs_created_at ON [dbo].[rca_trigger_configs]([created_at]);
    PRINT '✓ Created: rca_trigger_configs';
END
ELSE PRINT '  - rca_trigger_configs (exists)';
GO

-- 4.6 RCA Knowledge Base (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[rca_knowledge_base]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[rca_knowledge_base] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [title] NVARCHAR(255) NOT NULL,
        [category] VARCHAR(100) NULL,
        [tags] NVARCHAR(MAX) NULL,
        [content] NVARCHAR(MAX) NULL,
        [related_rcas] NVARCHAR(MAX) NULL,
        [author] VARCHAR(36) NULL,
        [is_published] BIT DEFAULT 0
    );
    CREATE INDEX idx_rca_knowledge_base_tenant_id ON [dbo].[rca_knowledge_base]([tenant_id]);
    CREATE INDEX idx_rca_knowledge_base_organization_id ON [dbo].[rca_knowledge_base]([organization_id]);
    CREATE INDEX idx_rca_knowledge_base_created_at ON [dbo].[rca_knowledge_base]([created_at]);
    PRINT '✓ Created: rca_knowledge_base';
END
ELSE PRINT '  - rca_knowledge_base (exists)';
GO

-- 4.7 RCA Analysis Configs (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[rca_analysis_configs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[rca_analysis_configs] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [analysis_type] VARCHAR(100) NULL,
        [config_name] NVARCHAR(255) NULL,
        [config_data] NVARCHAR(MAX) NULL,
        [is_default] BIT DEFAULT 0
    );
    CREATE INDEX idx_rca_analysis_configs_tenant_id ON [dbo].[rca_analysis_configs]([tenant_id]);
    CREATE INDEX idx_rca_analysis_configs_organization_id ON [dbo].[rca_analysis_configs]([organization_id]);
    CREATE INDEX idx_rca_analysis_configs_created_at ON [dbo].[rca_analysis_configs]([created_at]);
    PRINT '✓ Created: rca_analysis_configs';
END
ELSE PRINT '  - rca_analysis_configs (exists)';
GO

-- 4.8 RCA Templates
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[rca_templates]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[rca_templates] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [template_name] NVARCHAR(255) NOT NULL,
        [template_type] VARCHAR(100) NULL,
        [template_data] NVARCHAR(MAX) NULL,
        [description] NVARCHAR(MAX) NULL,
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_rca_templates_tenant_id ON [dbo].[rca_templates]([tenant_id]);
    CREATE INDEX idx_rca_templates_organization_id ON [dbo].[rca_templates]([organization_id]);
    CREATE INDEX idx_rca_templates_created_at ON [dbo].[rca_templates]([created_at]);
    PRINT '✓ Created: rca_templates';
END
ELSE PRINT '  - rca_templates (exists)';
GO

-- 4.9 Evidence Categories
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[evidence_categories]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[evidence_categories] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [category_name] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [icon] VARCHAR(50) NULL,
        [color] VARCHAR(7) NULL,
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_evidence_categories_tenant_id ON [dbo].[evidence_categories]([tenant_id]);
    CREATE INDEX idx_evidence_categories_organization_id ON [dbo].[evidence_categories]([organization_id]);
    CREATE INDEX idx_evidence_categories_created_at ON [dbo].[evidence_categories]([created_at]);
    PRINT '✓ Created: evidence_categories';
END
ELSE PRINT '  - evidence_categories (exists)';
GO

-- 4.10 Evidence Locations
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[evidence_locations]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[evidence_locations] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [location_name] NVARCHAR(255) NOT NULL,
        [location_type] VARCHAR(100) NULL,
        [description] NVARCHAR(MAX) NULL,
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_evidence_locations_tenant_id ON [dbo].[evidence_locations]([tenant_id]);
    CREATE INDEX idx_evidence_locations_organization_id ON [dbo].[evidence_locations]([organization_id]);
    CREATE INDEX idx_evidence_locations_created_at ON [dbo].[evidence_locations]([created_at]);
    PRINT '✓ Created: evidence_locations';
END
ELSE PRINT '  - evidence_locations (exists)';
GO

PRINT '';
PRINT '✓ RCA entities completed (30/50)';
PRINT '';

-- =============================================
-- 5. ANALYSIS TOOL ENTITIES (6 Tables) - ALL NEW
-- =============================================

-- 5.1 Five Why Analyses (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[five_why_analyses]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[five_why_analyses] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [problem_statement] NVARCHAR(MAX) NULL,
        [why_levels] NVARCHAR(MAX) NULL,
        [root_cause] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_five_why_analyses_tenant_id ON [dbo].[five_why_analyses]([tenant_id]);
    CREATE INDEX idx_five_why_analyses_organization_id ON [dbo].[five_why_analyses]([organization_id]);
    CREATE INDEX idx_five_why_analyses_created_at ON [dbo].[five_why_analyses]([created_at]);
    CREATE INDEX idx_five_why_analyses_rca_id ON [dbo].[five_why_analyses]([rca_id]);
    PRINT '✓ Created: five_why_analyses';
END
ELSE PRINT '  - five_why_analyses (exists)';
GO

-- 5.2 Fishbone Diagrams (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fishbone_diagrams]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[fishbone_diagrams] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [problem_statement] NVARCHAR(MAX) NULL,
        [categories] NVARCHAR(MAX) NULL,
        [causes] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_fishbone_diagrams_tenant_id ON [dbo].[fishbone_diagrams]([tenant_id]);
    CREATE INDEX idx_fishbone_diagrams_organization_id ON [dbo].[fishbone_diagrams]([organization_id]);
    CREATE INDEX idx_fishbone_diagrams_created_at ON [dbo].[fishbone_diagrams]([created_at]);
    CREATE INDEX idx_fishbone_diagrams_rca_id ON [dbo].[fishbone_diagrams]([rca_id]);
    PRINT '✓ Created: fishbone_diagrams';
END
ELSE PRINT '  - fishbone_diagrams (exists)';
GO

-- 5.3 FMEA Analyses (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fmea_analyses]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[fmea_analyses] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [analysis_name] NVARCHAR(255) NULL,
        [failure_modes] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_fmea_analyses_tenant_id ON [dbo].[fmea_analyses]([tenant_id]);
    CREATE INDEX idx_fmea_analyses_organization_id ON [dbo].[fmea_analyses]([organization_id]);
    CREATE INDEX idx_fmea_analyses_created_at ON [dbo].[fmea_analyses]([created_at]);
    CREATE INDEX idx_fmea_analyses_rca_id ON [dbo].[fmea_analyses]([rca_id]);
    PRINT '✓ Created: fmea_analyses';
END
ELSE PRINT '  - fmea_analyses (exists)';
GO

-- 5.4 Fault Tree Analyses (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fault_tree_analyses]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[fault_tree_analyses] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [top_event] NVARCHAR(MAX) NULL,
        [tree_data] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_fault_tree_analyses_tenant_id ON [dbo].[fault_tree_analyses]([tenant_id]);
    CREATE INDEX idx_fault_tree_analyses_organization_id ON [dbo].[fault_tree_analyses]([organization_id]);
    CREATE INDEX idx_fault_tree_analyses_created_at ON [dbo].[fault_tree_analyses]([created_at]);
    CREATE INDEX idx_fault_tree_analyses_rca_id ON [dbo].[fault_tree_analyses]([rca_id]);
    PRINT '✓ Created: fault_tree_analyses';
END
ELSE PRINT '  - fault_tree_analyses (exists)';
GO

-- 5.5 Barrier Analyses (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[barrier_analyses]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[barrier_analyses] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [hazard] NVARCHAR(MAX) NULL,
        [barriers] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_barrier_analyses_tenant_id ON [dbo].[barrier_analyses]([tenant_id]);
    CREATE INDEX idx_barrier_analyses_organization_id ON [dbo].[barrier_analyses]([organization_id]);
    CREATE INDEX idx_barrier_analyses_created_at ON [dbo].[barrier_analyses]([created_at]);
    CREATE INDEX idx_barrier_analyses_rca_id ON [dbo].[barrier_analyses]([rca_id]);
    PRINT '✓ Created: barrier_analyses';
END
ELSE PRINT '  - barrier_analyses (exists)';
GO

-- 5.6 Change Analyses (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[change_analyses]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[change_analyses] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [change_description] NVARCHAR(MAX) NULL,
        [changes] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_change_analyses_tenant_id ON [dbo].[change_analyses]([tenant_id]);
    CREATE INDEX idx_change_analyses_organization_id ON [dbo].[change_analyses]([organization_id]);
    CREATE INDEX idx_change_analyses_created_at ON [dbo].[change_analyses]([created_at]);
    CREATE INDEX idx_change_analyses_rca_id ON [dbo].[change_analyses]([rca_id]);
    PRINT '✓ Created: change_analyses';
END
ELSE PRINT '  - change_analyses (exists)';
GO

PRINT '';
PRINT '✓ Analysis tool entities completed (36/50)';
PRINT '';

-- =============================================
-- 6. PI INTEGRATION ENTITIES (8 Tables) - ALL NEW
-- =============================================

-- 6.1 PI Connections (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[pi_connections]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[pi_connections] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [connection_name] NVARCHAR(255) NOT NULL,
        [pi_web_api_url] VARCHAR(500) NOT NULL,
        [username] NVARCHAR(255) NULL,
        [password_encrypted] NVARCHAR(MAX) NULL,
        [af_database_path] VARCHAR(500) NULL,
        [is_active] BIT DEFAULT 1,
        [last_sync_time] DATETIME NULL
    );
    CREATE INDEX idx_pi_connections_tenant_id ON [dbo].[pi_connections]([tenant_id]);
    CREATE INDEX idx_pi_connections_organization_id ON [dbo].[pi_connections]([organization_id]);
    CREATE INDEX idx_pi_connections_created_at ON [dbo].[pi_connections]([created_at]);
    PRINT '✓ Created: pi_connections';
END
ELSE PRINT '  - pi_connections (exists)';
GO

-- 6.2 PI AF Elements (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[pi_af_elements]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[pi_af_elements] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [web_id] VARCHAR(255) UNIQUE NULL,
        [name] NVARCHAR(255) NULL,
        [description] NVARCHAR(MAX) NULL,
        [path] VARCHAR(1000) NULL,
        [template] NVARCHAR(255) NULL,
        [parent_id] VARCHAR(36) NULL,
        [has_children] BIT DEFAULT 0
    );
    CREATE INDEX idx_pi_af_elements_tenant_id ON [dbo].[pi_af_elements]([tenant_id]);
    CREATE INDEX idx_pi_af_elements_organization_id ON [dbo].[pi_af_elements]([organization_id]);
    CREATE INDEX idx_pi_af_elements_created_at ON [dbo].[pi_af_elements]([created_at]);
    CREATE INDEX idx_pi_af_elements_parent_id ON [dbo].[pi_af_elements]([parent_id]);
    CREATE INDEX idx_pi_af_elements_template ON [dbo].[pi_af_elements]([template]);
    CREATE INDEX idx_pi_af_elements_web_id ON [dbo].[pi_af_elements]([web_id]);
    PRINT '✓ Created: pi_af_elements';
END
ELSE PRINT '  - pi_af_elements (exists)';
GO

-- 6.3 AF Bindings (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[af_bindings]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[af_bindings] (
        [id] VARCHAR(36) PRIMARY KEY DEFAULT NEWID(),
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [web_id] VARCHAR(255) NULL,
        [local_id] VARCHAR(36) NULL,
        [bound_type] VARCHAR(100) NULL,
        [mapping_config] NVARCHAR(MAX) NULL,
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_af_bindings_tenant_id ON [dbo].[af_bindings]([tenant_id]);
    CREATE INDEX idx_af_bindings_organization_id ON [dbo].[af_bindings]([organization_id]);
    CREATE INDEX idx_af_bindings_created_at ON [dbo].[af_bindings]([created_at]);
    CREATE INDEX idx_af_bindings_web_id ON [dbo].[af_bindings]([web_id]);
    CREATE INDEX idx_af_bindings_bound_type ON [dbo].[af_bindings]([bound_type]);
    CREATE INDEX idx_af_bindings_local_id ON [dbo].[af_bindings]([local_id]);
    PRINT '✓ Created: af_bindings';
END
ELSE PRINT '  - af_bindings (exists)';
GO

-- 6.4 PI Events (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[pi_events]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[pi_events] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [web_id] VARCHAR(255) NULL,
        [name] NVARCHAR(255) NULL,
        [template] NVARCHAR(255) NULL,
        [primary_af_id] VARCHAR(255) NULL,
        [start_utc] DATETIME NULL,
        [end_utc] DATETIME NULL,
        [acknowledged] BIT DEFAULT 0,
        [event_data] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_pi_events_tenant_id ON [dbo].[pi_events]([tenant_id]);
    CREATE INDEX idx_pi_events_organization_id ON [dbo].[pi_events]([organization_id]);
    CREATE INDEX idx_pi_events_created_at ON [dbo].[pi_events]([created_at]);
    CREATE INDEX idx_pi_events_template ON [dbo].[pi_events]([template]);
    CREATE INDEX idx_pi_events_primary_af_id ON [dbo].[pi_events]([primary_af_id]);
    CREATE INDEX idx_pi_events_start_utc ON [dbo].[pi_events]([start_utc]);
    PRINT '✓ Created: pi_events';
END
ELSE PRINT '  - pi_events (exists)';
GO

-- 6.5 PI Mappings (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[pi_mappings]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[pi_mappings] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [source_type] VARCHAR(100) NULL,
        [source_id] VARCHAR(255) NULL,
        [target_type] VARCHAR(100) NULL,
        [target_id] VARCHAR(36) NULL,
        [mapping_rules] NVARCHAR(MAX) NULL,
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_pi_mappings_tenant_id ON [dbo].[pi_mappings]([tenant_id]);
    CREATE INDEX idx_pi_mappings_organization_id ON [dbo].[pi_mappings]([organization_id]);
    CREATE INDEX idx_pi_mappings_created_at ON [dbo].[pi_mappings]([created_at]);
    PRINT '✓ Created: pi_mappings';
END
ELSE PRINT '  - pi_mappings (exists)';
GO

-- 6.6 PI Sync Watermarks (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[pi_sync_watermarks]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[pi_sync_watermarks] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [sync_type] VARCHAR(100) NULL,
        [last_sync_timestamp] DATETIME NULL,
        [last_sync_marker] VARCHAR(255) NULL,
        [sync_status] VARCHAR(50) NULL
    );
    CREATE INDEX idx_pi_sync_watermarks_tenant_id ON [dbo].[pi_sync_watermarks]([tenant_id]);
    CREATE INDEX idx_pi_sync_watermarks_organization_id ON [dbo].[pi_sync_watermarks]([organization_id]);
    CREATE INDEX idx_pi_sync_watermarks_created_at ON [dbo].[pi_sync_watermarks]([created_at]);
    PRINT '✓ Created: pi_sync_watermarks';
END
ELSE PRINT '  - pi_sync_watermarks (exists)';
GO

-- 6.7 PI Sync Jobs (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[pi_sync_jobs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[pi_sync_jobs] (
        [id] VARCHAR(36) PRIMARY KEY DEFAULT NEWID(),
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [job_name] NVARCHAR(255) NULL,
        [job_type] VARCHAR(100) NULL,
        [schedule] VARCHAR(255) NULL,
        [last_run_time] DATETIME NULL,
        [next_run_time] DATETIME NULL,
        [status] VARCHAR(50) NULL,
        [error_message] NVARCHAR(MAX) NULL,
        [job_config] NVARCHAR(MAX) NULL,
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_pi_sync_jobs_tenant_id ON [dbo].[pi_sync_jobs]([tenant_id]);
    CREATE INDEX idx_pi_sync_jobs_organization_id ON [dbo].[pi_sync_jobs]([organization_id]);
    CREATE INDEX idx_pi_sync_jobs_created_at ON [dbo].[pi_sync_jobs]([created_at]);
    PRINT '✓ Created: pi_sync_jobs';
END
ELSE PRINT '  - pi_sync_jobs (exists)';
GO

-- 6.8 Historian Tags (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[historian_tags]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[historian_tags] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [web_id] VARCHAR(255) NULL,
        [tag_name] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [category] VARCHAR(100) NULL,
        [unit_of_measure] VARCHAR(50) NULL,
        [data_type] VARCHAR(50) NULL,
        [enabled] BIT DEFAULT 1
    );
    CREATE INDEX idx_historian_tags_tenant_id ON [dbo].[historian_tags]([tenant_id]);
    CREATE INDEX idx_historian_tags_organization_id ON [dbo].[historian_tags]([organization_id]);
    CREATE INDEX idx_historian_tags_created_at ON [dbo].[historian_tags]([created_at]);
    CREATE INDEX idx_historian_tags_web_id ON [dbo].[historian_tags]([web_id]);
    CREATE INDEX idx_historian_tags_category ON [dbo].[historian_tags]([category]);
    CREATE INDEX idx_historian_tags_enabled ON [dbo].[historian_tags]([enabled]);
    PRINT '✓ Created: historian_tags';
END
ELSE PRINT '  - historian_tags (exists)';
GO

PRINT '';
PRINT '✓ PI Integration entities completed (44/50)';
PRINT '';

-- =============================================
-- 7. CUSTOM ATTRIBUTES (2 Tables) - NEW
-- =============================================

-- 7.1 Custom Attribute Definitions (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[custom_attribute_definitions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[custom_attribute_definitions] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [entity_type] VARCHAR(100) NOT NULL,
        [attribute_name] NVARCHAR(255) NOT NULL,
        [display_name] NVARCHAR(255) NULL,
        [description] NVARCHAR(MAX) NULL,
        [data_type] VARCHAR(50) NULL,
        [is_required] BIT DEFAULT 0,
        [default_value] NVARCHAR(MAX) NULL,
        [validation_rules] NVARCHAR(MAX) NULL,
        [display_order] INT NULL,
        [is_active] BIT DEFAULT 1
    );
    CREATE INDEX idx_custom_attribute_definitions_entity_type ON [dbo].[custom_attribute_definitions]([entity_type]);
    CREATE INDEX idx_custom_attribute_definitions_tenant_id ON [dbo].[custom_attribute_definitions]([tenant_id]);
    CREATE INDEX idx_custom_attribute_definitions_organization_id ON [dbo].[custom_attribute_definitions]([organization_id]);
    CREATE INDEX idx_custom_attribute_definitions_created_at ON [dbo].[custom_attribute_definitions]([created_at]);
    PRINT '✓ Created: custom_attribute_definitions';
END
ELSE PRINT '  - custom_attribute_definitions (exists)';
GO

-- 7.2 Custom Attribute Values (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[custom_attribute_values]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[custom_attribute_values] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [entity_id] VARCHAR(36) NOT NULL,
        [entity_type] VARCHAR(100) NOT NULL,
        [attribute_definition_id] VARCHAR(36) NOT NULL,
        [value] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_custom_attribute_values_tenant_id ON [dbo].[custom_attribute_values]([tenant_id]);
    CREATE INDEX idx_custom_attribute_values_organization_id ON [dbo].[custom_attribute_values]([organization_id]);
    CREATE INDEX idx_custom_attribute_values_created_at ON [dbo].[custom_attribute_values]([created_at]);
    CREATE INDEX idx_custom_attribute_values_entity_id ON [dbo].[custom_attribute_values]([entity_id]);
    CREATE INDEX idx_custom_attribute_values_entity_type ON [dbo].[custom_attribute_values]([entity_type]);
    CREATE INDEX idx_custom_attribute_values_attribute_definition_id ON [dbo].[custom_attribute_values]([attribute_definition_id]);
    PRINT '✓ Created: custom_attribute_values';
END
ELSE PRINT '  - custom_attribute_values (exists)';
GO

PRINT '';
PRINT '✓ Custom attributes completed (46/50)';
PRINT '';

-- =============================================
-- 8. INTEGRATION (1 Table) - NEW
-- =============================================

-- 8.1 Data Sources (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[data_sources]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[data_sources] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [source_name] NVARCHAR(255) NOT NULL,
        [type] VARCHAR(100) NULL,
        [connection_string] NVARCHAR(MAX) NULL,
        [credentials_encrypted] NVARCHAR(MAX) NULL,
        [status] VARCHAR(50) NULL,
        [enabled] BIT DEFAULT 1,
        [last_sync_time] DATETIME NULL,
        [config] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_data_sources_tenant_id ON [dbo].[data_sources]([tenant_id]);
    CREATE INDEX idx_data_sources_organization_id ON [dbo].[data_sources]([organization_id]);
    CREATE INDEX idx_data_sources_created_at ON [dbo].[data_sources]([created_at]);
    CREATE INDEX idx_data_sources_type ON [dbo].[data_sources]([type]);
    CREATE INDEX idx_data_sources_status ON [dbo].[data_sources]([status]);
    CREATE INDEX idx_data_sources_enabled ON [dbo].[data_sources]([enabled]);
    PRINT '✓ Created: data_sources';
END
ELSE PRINT '  - data_sources (exists)';
GO

PRINT '';
PRINT '✓ Integration entities completed (47/50)';
PRINT '';

-- =============================================
-- 9. HISTORIAN HISTORY (1 Table) - NEW
-- =============================================

-- 9.1 Query History (NEW)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[query_history]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[query_history] (
        [id] VARCHAR(36) PRIMARY KEY,
        [timestamp] DATETIME NOT NULL,
        [attributes] NVARCHAR(MAX) NOT NULL,
        [query_params] NVARCHAR(MAX) NOT NULL,
        [result_count] INT NOT NULL,
        [tenant_id] VARCHAR(36) NOT NULL
    );
    CREATE INDEX idx_query_history_tenant_id ON [dbo].[query_history]([tenant_id]);
    CREATE INDEX idx_query_history_timestamp ON [dbo].[query_history]([timestamp]);
    PRINT '✓ Created: query_history';
END
ELSE PRINT '  - query_history (exists)';
GO

PRINT '';
PRINT '✓ Historian history completed (48/50)';
PRINT '';

-- =============================================
-- 10. SETTINGS & CONFIGURATION (2 Tables)
-- =============================================

-- 10.1 App Settings
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[app_settings]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[app_settings] (
        [key] VARCHAR(255) PRIMARY KEY,
        [value] NVARCHAR(MAX) NULL
    );
    PRINT '✓ Created: app_settings';
END
ELSE PRINT '  - app_settings (exists)';
GO

-- 10.2 Dashboard Configurations
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[dashboard_configurations]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[dashboard_configurations] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [dashboard_name] NVARCHAR(255) NOT NULL,
        [dashboard_type] VARCHAR(100) NULL,
        [layout_config] NVARCHAR(MAX) NULL,
        [widget_config] NVARCHAR(MAX) NULL,
        [is_default] BIT DEFAULT 0,
        [is_public] BIT DEFAULT 0,
        [created_by] VARCHAR(36) NULL
    );
    CREATE INDEX idx_dashboard_configurations_tenant_id ON [dbo].[dashboard_configurations]([tenant_id]);
    CREATE INDEX idx_dashboard_configurations_organization_id ON [dbo].[dashboard_configurations]([organization_id]);
    CREATE INDEX idx_dashboard_configurations_created_at ON [dbo].[dashboard_configurations]([created_at]);
    PRINT '✓ Created: dashboard_configurations';
END
ELSE PRINT '  - dashboard_configurations (exists)';
GO

PRINT '';
PRINT '✓ Settings entities completed (50/50)';
PRINT '';

-- =============================================
-- STEP 3: VERIFICATION
-- =============================================

PRINT '';
PRINT '==============================================';
PRINT 'DATABASE SETUP VERIFICATION';
PRINT '==============================================';
PRINT '';

-- Count tables
DECLARE @TableCount INT;
SELECT @TableCount = COUNT(*) FROM sys.tables;
PRINT 'Total Tables Created: ' + CAST(@TableCount AS VARCHAR(10));
PRINT 'Expected: 50';

IF @TableCount >= 50
    PRINT '✓ SUCCESS: All tables created!';
ELSE
    PRINT '⚠ WARNING: Some tables may be missing';

PRINT '';

-- List all tables
PRINT 'Tables in database:';
SELECT name as TableName FROM sys.tables ORDER BY name;

PRINT '';

-- Count indexes
DECLARE @IndexCount INT;
SELECT @IndexCount = COUNT(*) FROM sys.indexes WHERE type > 0;
PRINT 'Total Indexes: ' + CAST(@IndexCount AS VARCHAR(10));
PRINT 'Expected: 150+';

PRINT '';
PRINT '==============================================';
PRINT '✓✓✓ DATABASE SETUP COMPLETE! ✓✓✓';
PRINT '==============================================';
PRINT '';
PRINT 'Database: ProActDB';
PRINT 'Tables: ' + CAST(@TableCount AS VARCHAR(10));
PRINT 'Status: READY';
PRINT '';
PRINT 'Next Steps:';
PRINT '1. Configure .env file with database credentials';
PRINT '2. Run: npm install';
PRINT '3. Run: npm run start:dev';
PRINT '4. Access Swagger: http://localhost:3000/api';
PRINT '';
PRINT '==============================================';
GO

