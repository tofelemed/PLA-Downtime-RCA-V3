-- =============================================
-- Fix: Add DEFAULT NEWID() to pi_sync_jobs.id column
-- =============================================
-- This script fixes the NULL constraint error when inserting into pi_sync_jobs
-- by adding a default value for the id column.

USE ProActDB;
GO

PRINT '';
PRINT '==============================================';
PRINT 'Fixing pi_sync_jobs.id DEFAULT constraint';
PRINT '==============================================';
PRINT '';

-- Check if table exists
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[pi_sync_jobs]') AND type in (N'U'))
BEGIN
    -- Check if column exists and doesn't have default
    IF EXISTS (
        SELECT * 
        FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[pi_sync_jobs]') 
        AND name = 'id'
        AND default_object_id = 0
    )
    BEGIN
        -- Add DEFAULT constraint for id column
        ALTER TABLE [dbo].[pi_sync_jobs]
        ADD CONSTRAINT [DF_pi_sync_jobs_id] DEFAULT (NEWID()) FOR [id];
        
        PRINT '  ✓ Added DEFAULT NEWID() constraint to pi_sync_jobs.id';
    END
    ELSE
    BEGIN
        PRINT '  • pi_sync_jobs.id already has a DEFAULT constraint. Skipping.';
    END;
END
ELSE
BEGIN
    PRINT '  ⚠️  pi_sync_jobs table does not exist. Please create it first.';
END;

PRINT '';
PRINT '==============================================';
PRINT '✓ Fix Complete!';
PRINT '==============================================';
PRINT '';

