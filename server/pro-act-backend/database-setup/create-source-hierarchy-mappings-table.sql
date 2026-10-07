-- =============================================
-- Migration: Create source_hierarchy_mappings table
-- =============================================
-- This script creates the universal hierarchy mapping table
-- for mapping external source identifiers to internal ProAct hierarchy

USE ProActDB;
GO

PRINT '';
PRINT '==============================================';
PRINT 'Creating source_hierarchy_mappings table';
PRINT '==============================================';
PRINT '';

-- Check if table exists
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'source_hierarchy_mappings') AND type in (N'U'))
BEGIN
    PRINT 'Table source_hierarchy_mappings already exists.';
    PRINT 'Skipping creation.';
    PRINT '';
    RETURN;
END

-- Create table
CREATE TABLE source_hierarchy_mappings (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    
    -- Source identification
    source_type VARCHAR(50) NOT NULL,  -- 'PI', 'OPCUA', 'Modbus', 'MQTT', etc.
    source_connection_id UNIQUEIDENTIFIER NULL,  -- Optional: specific connection
    source_identifier NVARCHAR(1000) NOT NULL,  -- External identifier
    source_path NVARCHAR(1000) NULL,  -- Optional: full path
    
    -- Target hierarchy
    target_type VARCHAR(50) NOT NULL,  -- 'unit', 'asset', 'tenant', 'organization'
    target_id UNIQUEIDENTIFIER NOT NULL,  -- Unit/Asset/Tenant/Organization ID
    
    -- Context
    tenant_id VARCHAR(36) NOT NULL,
    organization_id VARCHAR(36) NULL,
    
    -- Pattern matching
    is_pattern BIT DEFAULT 0,  -- Is this a pattern rule?
    pattern NVARCHAR(500) NULL,  -- Pattern expression
    priority INT DEFAULT 50,  -- Higher = checked first
    
    -- Metadata
    is_active BIT DEFAULT 1,
    description NVARCHAR(MAX) NULL,
    
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);

PRINT '✓ Table source_hierarchy_mappings created successfully.';
PRINT '';

-- Create indexes
PRINT 'Creating indexes...';

CREATE INDEX idx_source_hierarchy_mappings_tenant_id ON source_hierarchy_mappings(tenant_id);
CREATE INDEX idx_source_hierarchy_mappings_source_type ON source_hierarchy_mappings(source_type);
CREATE INDEX idx_source_hierarchy_mappings_target_type ON source_hierarchy_mappings(target_type);
-- Note: source_identifier index uses first 900 bytes to avoid key length limit
CREATE INDEX idx_source_hierarchy_mappings_source_identifier ON source_hierarchy_mappings(SUBSTRING(source_identifier, 1, 900));
-- Filtered indexes require specific SET options - using regular indexes instead
CREATE INDEX idx_source_hierarchy_mappings_pattern ON source_hierarchy_mappings(pattern);
CREATE INDEX idx_source_hierarchy_mappings_priority ON source_hierarchy_mappings(priority DESC);
CREATE INDEX idx_source_hierarchy_mappings_is_active ON source_hierarchy_mappings(is_active);
CREATE INDEX idx_source_hierarchy_mappings_connection_id ON source_hierarchy_mappings(source_connection_id);

PRINT '✓ Indexes created successfully.';
PRINT '';

PRINT '==============================================';
PRINT '✓ Migration completed successfully!';
PRINT '==============================================';
PRINT '';

GO

