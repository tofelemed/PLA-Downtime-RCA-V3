-- =============================================
-- Fix Hierarchy Mapping Indexes
-- This script creates the missing indexes
-- =============================================

USE ProActDB;
GO

PRINT '';
PRINT '==============================================';
PRINT 'Creating missing indexes for source_hierarchy_mappings';
PRINT '==============================================';
PRINT '';

-- Pattern index: Regular index (not filtered)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_source_hierarchy_mappings_pattern' AND object_id = OBJECT_ID('source_hierarchy_mappings'))
BEGIN
    CREATE INDEX idx_source_hierarchy_mappings_pattern 
    ON source_hierarchy_mappings(pattern);
    PRINT '  ✓ Created: idx_source_hierarchy_mappings_pattern';
END
ELSE
BEGIN
    PRINT '  - Index already exists: idx_source_hierarchy_mappings_pattern';
END

-- Priority index
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_source_hierarchy_mappings_priority' AND object_id = OBJECT_ID('source_hierarchy_mappings'))
BEGIN
    CREATE INDEX idx_source_hierarchy_mappings_priority 
    ON source_hierarchy_mappings(priority DESC);
    PRINT '  ✓ Created: idx_source_hierarchy_mappings_priority';
END
ELSE
BEGIN
    PRINT '  - Index already exists: idx_source_hierarchy_mappings_priority';
END

-- Is Active index
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_source_hierarchy_mappings_is_active' AND object_id = OBJECT_ID('source_hierarchy_mappings'))
BEGIN
    CREATE INDEX idx_source_hierarchy_mappings_is_active 
    ON source_hierarchy_mappings(is_active);
    PRINT '  ✓ Created: idx_source_hierarchy_mappings_is_active';
END
ELSE
BEGIN
    PRINT '  - Index already exists: idx_source_hierarchy_mappings_is_active';
END

-- Connection ID index: Regular index (not filtered)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_source_hierarchy_mappings_connection_id' AND object_id = OBJECT_ID('source_hierarchy_mappings'))
BEGIN
    CREATE INDEX idx_source_hierarchy_mappings_connection_id 
    ON source_hierarchy_mappings(source_connection_id);
    PRINT '  ✓ Created: idx_source_hierarchy_mappings_connection_id';
END
ELSE
BEGIN
    PRINT '  - Index already exists: idx_source_hierarchy_mappings_connection_id';
END

PRINT '';
PRINT '==============================================';
PRINT '✓ Index creation completed!';
PRINT '==============================================';
PRINT '';

GO
