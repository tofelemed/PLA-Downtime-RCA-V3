-- =============================================
-- Migration: Add Missing Columns to Match Frontend Requirements
-- =============================================
-- This script adds columns required by the frontend that are missing from the database
-- Run this script to ensure database schema matches frontend expectations

USE ProActDB;
GO

PRINT '';
PRINT '==============================================';
PRINT 'Adding Missing Columns to Match Frontend Requirements';
PRINT '==============================================';
PRINT '';

-- =============================================
-- 1. Production Losses - Add Frontend Required Fields
-- =============================================
PRINT '1. Adding missing columns to production_losses...';

-- Check if columns exist before adding
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_losses]') AND name = 'actual')
BEGIN
    ALTER TABLE [dbo].[production_losses]
    ADD [actual] DECIMAL(15,4) NULL;
    PRINT '   ✓ Added: actual';
END
ELSE PRINT '   - actual (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_losses]') AND name = 'short_range_plan')
BEGIN
    ALTER TABLE [dbo].[production_losses]
    ADD [short_range_plan] DECIMAL(15,4) NULL;
    PRINT '   ✓ Added: short_range_plan';
END
ELSE PRINT '   - short_range_plan (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_losses]') AND name = 'losses')
BEGIN
    ALTER TABLE [dbo].[production_losses]
    ADD [losses] DECIMAL(15,4) NULL;
    PRINT '   ✓ Added: losses';
END
ELSE PRINT '   - losses (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_losses]') AND name = 'unaccounted_loss')
BEGIN
    ALTER TABLE [dbo].[production_losses]
    ADD [unaccounted_loss] DECIMAL(15,4) NULL;
    PRINT '   ✓ Added: unaccounted_loss';
END
ELSE PRINT '   - unaccounted_loss (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_losses]') AND name = 'action')
BEGIN
    ALTER TABLE [dbo].[production_losses]
    ADD [action] VARCHAR(50) NULL;
    PRINT '   ✓ Added: action';
END
ELSE PRINT '   - action (already exists)';

GO

-- =============================================
-- 2. Production Events - Add Frontend Required Fields
-- =============================================
PRINT '';
PRINT '2. Adding missing columns to production_events...';

-- Event ID (different from event_name)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'event_id')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [event_id] VARCHAR(255) NULL;
    PRINT '   ✓ Added: event_id';
END
ELSE PRINT '   - event_id (already exists)';

-- Foreign Key Columns
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'plan_id')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [plan_id] VARCHAR(36) NULL;
    PRINT '   ✓ Added: plan_id';
END
ELSE PRINT '   - plan_id (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'asset_id')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [asset_id] VARCHAR(36) NULL;
    PRINT '   ✓ Added: asset_id';
END
ELSE PRINT '   - asset_id (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'oee_code_id')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [oee_code_id] VARCHAR(36) NULL;
    PRINT '   ✓ Added: oee_code_id';
END
ELSE PRINT '   - oee_code_id (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'rca_id')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [rca_id] VARCHAR(36) NULL;
    PRINT '   ✓ Added: rca_id';
END
ELSE PRINT '   - rca_id (already exists)';

-- Event Source and Metrics
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'source')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [source] VARCHAR(50) NULL;
    PRINT '   ✓ Added: source';
END
ELSE PRINT '   - source (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'quantity')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [quantity] DECIMAL(15,2) NULL;
    PRINT '   ✓ Added: quantity';
END
ELSE PRINT '   - quantity (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'cost')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [cost] DECIMAL(15,2) NULL;
    PRINT '   ✓ Added: cost';
END
ELSE PRINT '   - cost (already exists)';

-- IOW Fields
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'parameter')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [parameter] VARCHAR(255) NULL;
    PRINT '   ✓ Added: parameter';
END
ELSE PRINT '   - parameter (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'value')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [value] DECIMAL(15,4) NULL;
    PRINT '   ✓ Added: value';
END
ELSE PRINT '   - value (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'limit_value')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [limit_value] DECIMAL(15,4) NULL;
    PRINT '   ✓ Added: limit_value';
END
ELSE PRINT '   - limit_value (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'limit_type')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [limit_type] VARCHAR(20) NULL;
    PRINT '   ✓ Added: limit_type';
END
ELSE PRINT '   - limit_type (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'breach_duration')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [breach_duration] INT NULL;
    PRINT '   ✓ Added: breach_duration';
END
ELSE PRINT '   - breach_duration (already exists)';

-- SOL Fields
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'sol_type')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [sol_type] VARCHAR(50) NULL;
    PRINT '   ✓ Added: sol_type';
END
ELSE PRINT '   - sol_type (already exists)';

-- APM Fields
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'apm_type')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [apm_type] VARCHAR(100) NULL;
    PRINT '   ✓ Added: apm_type';
END
ELSE PRINT '   - apm_type (already exists)';

-- Additional Fields
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'recommended_action')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [recommended_action] NVARCHAR(MAX) NULL;
    PRINT '   ✓ Added: recommended_action';
END
ELSE PRINT '   - recommended_action (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'work_order_id')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [work_order_id] VARCHAR(255) NULL;
    PRINT '   ✓ Added: work_order_id';
END
ELSE PRINT '   - work_order_id (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'failure_mode')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [failure_mode] VARCHAR(255) NULL;
    PRINT '   ✓ Added: failure_mode';
END
ELSE PRINT '   - failure_mode (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'defective_quantity')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [defective_quantity] DECIMAL(15,2) NULL;
    PRINT '   ✓ Added: defective_quantity';
END
ELSE PRINT '   - defective_quantity (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'shift')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [shift] VARCHAR(50) NULL;
    PRINT '   ✓ Added: shift';
END
ELSE PRINT '   - shift (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'crew')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [crew] VARCHAR(100) NULL;
    PRINT '   ✓ Added: crew';
END
ELSE PRINT '   - crew (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'audit_trail')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [audit_trail] NVARCHAR(MAX) NULL;
    PRINT '   ✓ Added: audit_trail';
END
ELSE PRINT '   - audit_trail (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'loss_category')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [loss_category] VARCHAR(100) NULL;
    PRINT '   ✓ Added: loss_category';
END
ELSE PRINT '   - loss_category (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'operator_name')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [operator_name] VARCHAR(255) NULL;
    PRINT '   ✓ Added: operator_name';
END
ELSE PRINT '   - operator_name (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[production_events]') AND name = 'reason_code_id')
BEGIN
    ALTER TABLE [dbo].[production_events]
    ADD [reason_code_id] VARCHAR(36) NULL;
    PRINT '   ✓ Added: reason_code_id';
END
ELSE PRINT '   - reason_code_id (already exists)';

GO

-- =============================================
-- 3. RCAs - Add Frontend Required Fields
-- =============================================
PRINT '';
PRINT '3. Adding missing columns to rcas...';

-- Team Lead (map assigned_to if needed)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'team_lead_id')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [team_lead_id] VARCHAR(36) NULL;
    PRINT '   ✓ Added: team_lead_id';
END
ELSE PRINT '   - team_lead_id (already exists)';

-- Tracking & Performance Metrics
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'pre_failure_rate')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [pre_failure_rate] DECIMAL(5,2) NULL;
    PRINT '   ✓ Added: pre_failure_rate';
END
ELSE PRINT '   - pre_failure_rate (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'post_failure_rate')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [post_failure_rate] DECIMAL(5,2) NULL;
    PRINT '   ✓ Added: post_failure_rate';
END
ELSE PRINT '   - post_failure_rate (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'failure_cost_per_incident')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [failure_cost_per_incident] DECIMAL(10,2) NULL;
    PRINT '   ✓ Added: failure_cost_per_incident';
END
ELSE PRINT '   - failure_cost_per_incident (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'implementation_cost')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [implementation_cost] DECIMAL(10,2) NULL;
    PRINT '   ✓ Added: implementation_cost';
END
ELSE PRINT '   - implementation_cost (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'time_to_resolution')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [time_to_resolution] DECIMAL(10,2) NULL;
    PRINT '   ✓ Added: time_to_resolution';
END
ELSE PRINT '   - time_to_resolution (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'time_to_implementation')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [time_to_implementation] DECIMAL(10,2) NULL;
    PRINT '   ✓ Added: time_to_implementation';
END
ELSE PRINT '   - time_to_implementation (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'effectiveness_score')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [effectiveness_score] DECIMAL(5,2) NULL;
    PRINT '   ✓ Added: effectiveness_score';
END
ELSE PRINT '   - effectiveness_score (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'last_updated')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [last_updated] DATETIME NULL;
    PRINT '   ✓ Added: last_updated';
END
ELSE PRINT '   - last_updated (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'tracking_notes')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [tracking_notes] NVARCHAR(MAX) NULL;
    PRINT '   ✓ Added: tracking_notes';
END
ELSE PRINT '   - tracking_notes (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'phase_timeline')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [phase_timeline] NVARCHAR(MAX) NULL;
    PRINT '   ✓ Added: phase_timeline';
END
ELSE PRINT '   - phase_timeline (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'calculated_roi')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [calculated_roi] DECIMAL(10,2) NULL;
    PRINT '   ✓ Added: calculated_roi';
END
ELSE PRINT '   - calculated_roi (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'cost_savings')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [cost_savings] DECIMAL(10,2) NULL;
    PRINT '   ✓ Added: cost_savings';
END
ELSE PRINT '   - cost_savings (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'downtime_reduction')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [downtime_reduction] DECIMAL(5,2) NULL;
    PRINT '   ✓ Added: downtime_reduction';
END
ELSE PRINT '   - downtime_reduction (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'productivity_improvement')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [productivity_improvement] DECIMAL(5,2) NULL;
    PRINT '   ✓ Added: productivity_improvement';
END
ELSE PRINT '   - productivity_improvement (already exists)';

-- Additional RCA fields
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'template_id')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [template_id] VARCHAR(36) NULL;
    PRINT '   ✓ Added: template_id';
END
ELSE PRINT '   - template_id (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'team_charter')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [team_charter] NVARCHAR(MAX) NULL;
    PRINT '   ✓ Added: team_charter';
END
ELSE PRINT '   - team_charter (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'event_diagram')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [event_diagram] NVARCHAR(MAX) NULL;
    PRINT '   ✓ Added: event_diagram';
END
ELSE PRINT '   - event_diagram (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'recommendations')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [recommendations] NVARCHAR(MAX) NULL;
    PRINT '   ✓ Added: recommendations';
END
ELSE PRINT '   - recommendations (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'logic_tree')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [logic_tree] NVARCHAR(MAX) NULL;
    PRINT '   ✓ Added: logic_tree';
END
ELSE PRINT '   - logic_tree (already exists)';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[rcas]') AND name = 'evidence')
BEGIN
    ALTER TABLE [dbo].[rcas]
    ADD [evidence] NVARCHAR(MAX) NULL;
    PRINT '   ✓ Added: evidence';
END
ELSE PRINT '   - evidence (already exists)';

GO

PRINT '';
PRINT '==============================================';
PRINT '✓ Migration completed!';
PRINT '==============================================';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Update entity definitions to include these columns';
PRINT '2. Restart backend server';
PRINT '3. Test frontend functionality';
PRINT '';

