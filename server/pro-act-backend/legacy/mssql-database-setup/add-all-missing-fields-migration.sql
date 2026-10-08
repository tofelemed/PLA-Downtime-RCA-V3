-- =============================================
-- Comprehensive Migration: Add ALL Missing Fields from Frontend
-- =============================================
-- This script adds ALL fields required by the frontend that are missing from the database
-- Run this script to ensure database schema matches frontend expectations completely

USE ProActDB;
GO

PRINT '';
PRINT '==============================================';
PRINT 'Adding ALL Missing Fields from Frontend';
PRINT '==============================================';
PRINT '';

-- =============================================
-- 1. PRODUCTION PLANS - Add 17 missing fields
-- =============================================
PRINT '1. Adding missing columns to production_plans table...';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'tolerance_limit')
BEGIN
    ALTER TABLE production_plans ADD tolerance_limit DECIMAL(15,4) NULL;
    PRINT '  ✓ Added: tolerance_limit';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'plan_basis')
BEGIN
    ALTER TABLE production_plans ADD plan_basis VARCHAR(255) NULL;
    PRINT '  ✓ Added: plan_basis';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'useful_production_time')
BEGIN
    ALTER TABLE production_plans ADD useful_production_time NVARCHAR(MAX) NULL;
    PRINT '  ✓ Added: useful_production_time (JSON)';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'recurrence')
BEGIN
    ALTER TABLE production_plans ADD recurrence VARCHAR(100) NULL;
    PRINT '  ✓ Added: recurrence';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'data_entry_frequency')
BEGIN
    ALTER TABLE production_plans ADD data_entry_frequency VARCHAR(100) NULL;
    PRINT '  ✓ Added: data_entry_frequency';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'shift')
BEGIN
    ALTER TABLE production_plans ADD shift VARCHAR(50) NULL;
    PRINT '  ✓ Added: shift';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'crew')
BEGIN
    ALTER TABLE production_plans ADD crew VARCHAR(100) NULL;
    PRINT '  ✓ Added: crew';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'planner_notes')
BEGIN
    ALTER TABLE production_plans ADD planner_notes NVARCHAR(MAX) NULL;
    PRINT '  ✓ Added: planner_notes';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'comments')
BEGIN
    ALTER TABLE production_plans ADD comments NVARCHAR(MAX) NULL;
    PRINT '  ✓ Added: comments (JSON)';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'approval_status')
BEGIN
    ALTER TABLE production_plans ADD approval_status VARCHAR(50) NULL;
    PRINT '  ✓ Added: approval_status';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'submitted_by')
BEGIN
    ALTER TABLE production_plans ADD submitted_by VARCHAR(36) NULL;
    PRINT '  ✓ Added: submitted_by';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'submitted_at')
BEGIN
    ALTER TABLE production_plans ADD submitted_at DATETIME NULL;
    PRINT '  ✓ Added: submitted_at';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'reviewed_by')
BEGIN
    ALTER TABLE production_plans ADD reviewed_by VARCHAR(36) NULL;
    PRINT '  ✓ Added: reviewed_by';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'reviewed_at')
BEGIN
    ALTER TABLE production_plans ADD reviewed_at DATETIME NULL;
    PRINT '  ✓ Added: reviewed_at';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'approved_by')
BEGIN
    ALTER TABLE production_plans ADD approved_by VARCHAR(36) NULL;
    PRINT '  ✓ Added: approved_by';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'approved_at')
BEGIN
    ALTER TABLE production_plans ADD approved_at DATETIME NULL;
    PRINT '  ✓ Added: approved_at';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'rejection_reason')
BEGIN
    ALTER TABLE production_plans ADD rejection_reason NVARCHAR(MAX) NULL;
    PRINT '  ✓ Added: rejection_reason';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'custom_attributes')
BEGIN
    ALTER TABLE production_plans ADD custom_attributes NVARCHAR(MAX) NULL;
    PRINT '  ✓ Added: custom_attributes (JSON)';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('production_plans') AND name = 'audit_trail')
BEGIN
    ALTER TABLE production_plans ADD audit_trail NVARCHAR(MAX) NULL;
    PRINT '  ✓ Added: audit_trail (JSON)';
END;
PRINT '';

-- =============================================
-- 2. IMPACT CODES - Add 4 missing fields
-- =============================================
PRINT '2. Adding missing columns to impact_codes table...';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('impact_codes') AND name = 'category')
BEGIN
    ALTER TABLE impact_codes ADD category VARCHAR(50) NULL;
    PRINT '  ✓ Added: category';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('impact_codes') AND name = 'cost_per_unit')
BEGIN
    ALTER TABLE impact_codes ADD cost_per_unit DECIMAL(15,4) NULL;
    PRINT '  ✓ Added: cost_per_unit';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('impact_codes') AND name = 'cost_per_hour')
BEGIN
    ALTER TABLE impact_codes ADD cost_per_hour DECIMAL(15,4) NULL;
    PRINT '  ✓ Added: cost_per_hour';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('impact_codes') AND name = 'cost_basis')
BEGIN
    ALTER TABLE impact_codes ADD cost_basis VARCHAR(20) NULL;
    PRINT '  ✓ Added: cost_basis';
END;
PRINT '';

-- =============================================
-- 3. OEE CODES - Add 1 missing field
-- =============================================
PRINT '3. Adding missing columns to oee_codes table...';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('oee_codes') AND name = 'impact_type')
BEGIN
    ALTER TABLE oee_codes ADD impact_type VARCHAR(50) NULL;
    PRINT '  ✓ Added: impact_type';
END;
PRINT '';

PRINT '==============================================';
PRINT '✓ Migration completed!';
PRINT '==============================================';
PRINT '';
PRINT 'Summary:';
PRINT '  - Production Plans: 17 fields added';
PRINT '  - Impact Codes: 4 fields added';
PRINT '  - OEE Codes: 1 field added';
PRINT '  - Total: 22 fields added';
PRINT '';

