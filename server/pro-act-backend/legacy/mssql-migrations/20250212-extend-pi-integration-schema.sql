-- Migration: Extend PI integration and historian tables
-- Date: 2025-02-12

PRINT '--- Updating PI integration schema ---';

IF COL_LENGTH('dbo.pi_connections', 'connection_config') IS NULL
BEGIN
    ALTER TABLE [dbo].[pi_connections]
    ADD [connection_config] NVARCHAR(MAX) NULL;
    PRINT '  • Added connection_config column to pi_connections';
END

IF COL_LENGTH('dbo.pi_af_elements', 'categories') IS NULL
BEGIN
    ALTER TABLE [dbo].[pi_af_elements]
    ADD [categories] NVARCHAR(MAX) NULL;
    PRINT '  • Added categories column to pi_af_elements';
END

IF COL_LENGTH('dbo.pi_af_elements', 'hierarchy_level') IS NULL
BEGIN
    ALTER TABLE [dbo].[pi_af_elements]
    ADD [hierarchy_level] INT NULL;
    PRINT '  • Added hierarchy_level column to pi_af_elements';
END

IF COL_LENGTH('dbo.pi_af_elements', 'last_seen_at') IS NULL
BEGIN
    ALTER TABLE [dbo].[pi_af_elements]
    ADD [last_seen_at] DATETIME NULL;
    PRINT '  • Added last_seen_at column to pi_af_elements';
END

IF COL_LENGTH('dbo.pi_af_elements', 'metadata') IS NULL
BEGIN
    ALTER TABLE [dbo].[pi_af_elements]
    ADD [metadata] NVARCHAR(MAX) NULL;
    PRINT '  • Added metadata column to pi_af_elements';
END

IF COL_LENGTH('dbo.historian_tags', 'tag_path') IS NULL
BEGIN
    ALTER TABLE [dbo].[historian_tags]
    ADD [tag_path] VARCHAR(1000) NULL;
    PRINT '  • Added tag_path column to historian_tags';
END

IF COL_LENGTH('dbo.historian_tags', 'update_interval') IS NULL
BEGIN
    ALTER TABLE [dbo].[historian_tags]
    ADD [update_interval] INT NULL;
    PRINT '  • Added update_interval column to historian_tags';
END

IF COL_LENGTH('dbo.historian_tags', 'warning_threshold') IS NULL
BEGIN
    ALTER TABLE [dbo].[historian_tags]
    ADD [warning_threshold] FLOAT NULL;
    PRINT '  • Added warning_threshold column to historian_tags';
END

IF COL_LENGTH('dbo.historian_tags', 'alarm_threshold') IS NULL
BEGIN
    ALTER TABLE [dbo].[historian_tags]
    ADD [alarm_threshold] FLOAT NULL;
    PRINT '  • Added alarm_threshold column to historian_tags';
END

IF COL_LENGTH('dbo.historian_tags', 'config') IS NULL
BEGIN
    ALTER TABLE [dbo].[historian_tags]
    ADD [config] NVARCHAR(MAX) NULL;
    PRINT '  • Added config column to historian_tags';
END

PRINT '✓ PI integration schema updates applied';

