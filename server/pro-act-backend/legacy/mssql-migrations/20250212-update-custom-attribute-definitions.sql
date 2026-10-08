-- Migration: Extend custom_attribute_definitions with select options and created by
-- Date: 2025-02-12

PRINT '--- Updating [dbo].[custom_attribute_definitions] schema ---';

IF COL_LENGTH('dbo.custom_attribute_definitions', 'select_options') IS NULL
BEGIN
    ALTER TABLE [dbo].[custom_attribute_definitions]
    ADD [select_options] NVARCHAR(MAX) NULL;
    PRINT '  • Added select_options column';
END

IF COL_LENGTH('dbo.custom_attribute_definitions', 'created_by') IS NULL
BEGIN
    ALTER TABLE [dbo].[custom_attribute_definitions]
    ADD [created_by] VARCHAR(255) NULL;
    PRINT '  • Added created_by column';
END

PRINT '✓ custom_attribute_definitions columns ensured';

