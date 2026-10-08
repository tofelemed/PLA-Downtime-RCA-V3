-- =============================================
-- Migration: Add Missing Fields to Organizations Table
-- =============================================
-- This script adds fields required by the frontend that are missing from the database

USE ProActDB;
GO

PRINT '';
PRINT '==============================================';
PRINT 'Adding Missing Fields to Organizations Table';
PRINT '==============================================';
PRINT '';

-- Add is_active column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('organizations') AND name = 'is_active')
BEGIN
    ALTER TABLE organizations ADD is_active BIT NOT NULL DEFAULT 1;
    PRINT '  ✓ Added: is_active (BIT, DEFAULT 1)';
END
ELSE
BEGIN
    PRINT '  ⚠ Column is_active already exists';
END;

-- Add address column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('organizations') AND name = 'address')
BEGIN
    ALTER TABLE organizations ADD address NVARCHAR(500) NULL;
    PRINT '  ✓ Added: address (NVARCHAR(500))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column address already exists';
END;

-- Add contact_email column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('organizations') AND name = 'contact_email')
BEGIN
    ALTER TABLE organizations ADD contact_email VARCHAR(255) NULL;
    PRINT '  ✓ Added: contact_email (VARCHAR(255))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column contact_email already exists';
END;

-- Add contact_phone column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('organizations') AND name = 'contact_phone')
BEGIN
    ALTER TABLE organizations ADD contact_phone VARCHAR(50) NULL;
    PRINT '  ✓ Added: contact_phone (VARCHAR(50))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column contact_phone already exists';
END;

PRINT '';
PRINT '==============================================';
PRINT '✓ Migration completed!';
PRINT '==============================================';
PRINT '';

