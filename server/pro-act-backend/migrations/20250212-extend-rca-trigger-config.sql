-- Migration: Extend RCA trigger configuration schema
-- Date: 2025-02-12

PRINT '--- Updating [dbo].[rca_trigger_configs] schema ---';

IF COL_LENGTH('dbo.rca_trigger_configs', 'rules') IS NULL
BEGIN
    ALTER TABLE [dbo].[rca_trigger_configs]
    ADD [rules] NVARCHAR(MAX) NULL;
    PRINT '  • Added rules column';
END

IF COL_LENGTH('dbo.rca_trigger_configs', 'global_settings') IS NULL
BEGIN
    ALTER TABLE [dbo].[rca_trigger_configs]
    ADD [global_settings] NVARCHAR(MAX) NULL;
    PRINT '  • Added global_settings column';
END

IF COL_LENGTH('dbo.rca_trigger_configs', 'legacy_conditions') IS NULL
BEGIN
    ALTER TABLE [dbo].[rca_trigger_configs]
    ADD [legacy_conditions] NVARCHAR(MAX) NULL;
    PRINT '  • Added legacy_conditions column';
END

IF COL_LENGTH('dbo.rca_trigger_configs', 'conditions') IS NOT NULL
BEGIN
    EXEC('UPDATE dbo.rca_trigger_configs SET legacy_conditions = conditions WHERE legacy_conditions IS NULL AND conditions IS NOT NULL');
    PRINT '  • Copied legacy conditions data';
END

PRINT '✓ RCA trigger configuration schema updated';

