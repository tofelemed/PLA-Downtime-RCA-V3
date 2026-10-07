-- =============================================
-- Fix: Add DEFAULT NEWID() to af_bindings.id column
-- =============================================
-- This script fixes the NULL constraint error when inserting into af_bindings
-- by adding a default value for the id column.

USE ProActDB;
GO

PRINT '';
PRINT '==============================================';
PRINT 'Fixing af_bindings.id DEFAULT constraint';
PRINT '==============================================';
PRINT '';

-- Check if table exists
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[af_bindings]') AND type in (N'U'))
BEGIN
    -- Check if column exists and doesn't have default
    IF EXISTS (
        SELECT * 
        FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[af_bindings]') 
        AND name = 'id'
        AND default_object_id = 0
    )
    BEGIN
        -- Add DEFAULT constraint for id column
        ALTER TABLE [dbo].[af_bindings]
        ADD CONSTRAINT [DF_af_bindings_id] DEFAULT (NEWID()) FOR [id];
        
        PRINT '  ✓ Added DEFAULT NEWID() constraint to af_bindings.id';
    END
    ELSE
    BEGIN
        PRINT '  • af_bindings.id already has a DEFAULT constraint. Skipping.';
    END;
END
ELSE
BEGIN
    PRINT '  ⚠️  af_bindings table does not exist. Please create it first.';
END;

PRINT '';
PRINT '==============================================';
PRINT '✓ Fix Complete!';
PRINT '==============================================';
PRINT '';


