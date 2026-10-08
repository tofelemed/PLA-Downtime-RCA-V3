-- =============================================
-- Migration: Add Missing Fields to Hierarchy Tables
-- =============================================
-- This script adds fields required by the frontend that are missing from the database
-- For: Tenants, Units, and Assets tables

USE ProActDB;
GO

PRINT '';
PRINT '==============================================';
PRINT 'Adding Missing Fields to Hierarchy Tables';
PRINT '==============================================';
PRINT '';

-- =============================================
-- 1. TENANTS TABLE
-- =============================================
PRINT '1. Adding missing columns to tenants table...';

-- Add is_active column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'is_active')
BEGIN
    ALTER TABLE tenants ADD is_active BIT NOT NULL DEFAULT 1;
    PRINT '  ✓ Added: is_active (BIT, DEFAULT 1)';
END
ELSE
BEGIN
    PRINT '  ⚠ Column is_active already exists';
END;

-- Add address column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'address')
BEGIN
    ALTER TABLE tenants ADD address NVARCHAR(500) NULL;
    PRINT '  ✓ Added: address (NVARCHAR(500))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column address already exists';
END;

-- Add contact_person column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'contact_person')
BEGIN
    ALTER TABLE tenants ADD contact_person VARCHAR(255) NULL;
    PRINT '  ✓ Added: contact_person (VARCHAR(255))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column contact_person already exists';
END;

-- Add contact_email column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'contact_email')
BEGIN
    ALTER TABLE tenants ADD contact_email VARCHAR(255) NULL;
    PRINT '  ✓ Added: contact_email (VARCHAR(255))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column contact_email already exists';
END;

-- Add contact_phone column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'contact_phone')
BEGIN
    ALTER TABLE tenants ADD contact_phone VARCHAR(50) NULL;
    PRINT '  ✓ Added: contact_phone (VARCHAR(50))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column contact_phone already exists';
END;

-- Add timezone column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tenants') AND name = 'timezone')
BEGIN
    ALTER TABLE tenants ADD timezone VARCHAR(100) NULL;
    PRINT '  ✓ Added: timezone (VARCHAR(100))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column timezone already exists';
END;

PRINT '';

-- =============================================
-- 2. UNITS TABLE
-- =============================================
PRINT '2. Adding missing columns to units table...';

-- Add capacity column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('units') AND name = 'capacity')
BEGIN
    ALTER TABLE units ADD capacity DECIMAL(15,4) NULL;
    PRINT '  ✓ Added: capacity (DECIMAL(15,4))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column capacity already exists';
END;

-- Add unit_of_measure column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('units') AND name = 'unit_of_measure')
BEGIN
    ALTER TABLE units ADD unit_of_measure VARCHAR(50) NULL;
    PRINT '  ✓ Added: unit_of_measure (VARCHAR(50))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column unit_of_measure already exists';
END;

-- Add ideal_cycle_time column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('units') AND name = 'ideal_cycle_time')
BEGIN
    ALTER TABLE units ADD ideal_cycle_time DECIMAL(10,2) NULL;
    PRINT '  ✓ Added: ideal_cycle_time (DECIMAL(10,2))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column ideal_cycle_time already exists';
END;

PRINT '';

-- =============================================
-- 3. ASSETS TABLE
-- =============================================
PRINT '3. Adding missing columns to assets table...';

-- Add asset_type column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('assets') AND name = 'asset_type')
BEGIN
    ALTER TABLE assets ADD asset_type VARCHAR(50) NULL;
    PRINT '  ✓ Added: asset_type (VARCHAR(50))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column asset_type already exists';
END;

-- Add manufacturer column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('assets') AND name = 'manufacturer')
BEGIN
    ALTER TABLE assets ADD manufacturer VARCHAR(255) NULL;
    PRINT '  ✓ Added: manufacturer (VARCHAR(255))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column manufacturer already exists';
END;

-- Add model column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('assets') AND name = 'model')
BEGIN
    ALTER TABLE assets ADD model VARCHAR(255) NULL;
    PRINT '  ✓ Added: model (VARCHAR(255))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column model already exists';
END;

-- Add serial_number column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('assets') AND name = 'serial_number')
BEGIN
    ALTER TABLE assets ADD serial_number VARCHAR(255) NULL;
    PRINT '  ✓ Added: serial_number (VARCHAR(255))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column serial_number already exists';
END;

-- Add criticality column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('assets') AND name = 'criticality')
BEGIN
    ALTER TABLE assets ADD criticality VARCHAR(50) NULL;
    PRINT '  ✓ Added: criticality (VARCHAR(50))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column criticality already exists';
END;

-- Add status column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('assets') AND name = 'status')
BEGIN
    ALTER TABLE assets ADD status VARCHAR(50) NULL;
    PRINT '  ✓ Added: status (VARCHAR(50))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column status already exists';
END;

-- Add location column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('assets') AND name = 'location')
BEGIN
    ALTER TABLE assets ADD location NVARCHAR(255) NULL;
    PRINT '  ✓ Added: location (NVARCHAR(255))';
END
ELSE
BEGIN
    PRINT '  ⚠ Column location already exists';
END;

-- Add installation_date column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('assets') AND name = 'installation_date')
BEGIN
    ALTER TABLE assets ADD installation_date DATETIME NULL;
    PRINT '  ✓ Added: installation_date (DATETIME)';
END
ELSE
BEGIN
    PRINT '  ⚠ Column installation_date already exists';
END;

-- Add last_maintenance_date column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('assets') AND name = 'last_maintenance_date')
BEGIN
    ALTER TABLE assets ADD last_maintenance_date DATETIME NULL;
    PRINT '  ✓ Added: last_maintenance_date (DATETIME)';
END
ELSE
BEGIN
    PRINT '  ⚠ Column last_maintenance_date already exists';
END;

-- Add next_maintenance_date column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('assets') AND name = 'next_maintenance_date')
BEGIN
    ALTER TABLE assets ADD next_maintenance_date DATETIME NULL;
    PRINT '  ✓ Added: next_maintenance_date (DATETIME)';
END
ELSE
BEGIN
    PRINT '  ⚠ Column next_maintenance_date already exists';
END;

PRINT '';
PRINT '==============================================';
PRINT '✓ Migration completed!';
PRINT '==============================================';
PRINT '';

