-- Migration: Extend RCA knowledge base schema to match backend entity changes
-- Date: 2025-02-12

PRINT '--- Updating [dbo].[rca_knowledge_base] schema ---';
IF OBJECT_ID(N'[dbo].[rca_knowledge_base]', N'U') IS NOT NULL
BEGIN
    -- Helper to add NVARCHAR(MAX) column if missing
    IF COL_LENGTH('dbo.rca_knowledge_base', 'rca_id') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [rca_id] VARCHAR(36) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'description') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [description] NVARCHAR(MAX) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'problem_statement') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [problem_statement] NVARCHAR(MAX) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'event_type') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [event_type] VARCHAR(100) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'unit_id') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [unit_id] VARCHAR(36) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'unit_name') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [unit_name] NVARCHAR(255) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'asset_id') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [asset_id] VARCHAR(36) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'asset_name') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [asset_name] NVARCHAR(255) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'equipment_category') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [equipment_category] VARCHAR(150) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'symptoms') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [symptoms] NVARCHAR(MAX) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'impact_codes') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [impact_codes] NVARCHAR(MAX) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'oee_codes') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [oee_codes] NVARCHAR(MAX) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'root_cause') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [root_cause] NVARCHAR(MAX) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'root_cause_category') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [root_cause_category] VARCHAR(150) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'contributing_factors') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [contributing_factors] NVARCHAR(MAX) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'recommendations') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [recommendations] NVARCHAR(MAX) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'keywords') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [keywords] NVARCHAR(MAX) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'times_referenced') IS NULL
    BEGIN
        ALTER TABLE [dbo].[rca_knowledge_base]
        ADD [times_referenced] INT NOT NULL CONSTRAINT DF_rca_kb_times_referenced DEFAULT 0;
    END

    IF COL_LENGTH('dbo.rca_knowledge_base', 'helpful_votes') IS NULL
    BEGIN
        ALTER TABLE [dbo].[rca_knowledge_base]
        ADD [helpful_votes] INT NOT NULL CONSTRAINT DF_rca_kb_helpful_votes DEFAULT 0;
    END

    IF COL_LENGTH('dbo.rca_knowledge_base', 'closed_date') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [closed_date] VARCHAR(50) NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'recurrence_count') IS NULL
    BEGIN
        ALTER TABLE [dbo].[rca_knowledge_base]
        ADD [recurrence_count] INT NOT NULL CONSTRAINT DF_rca_kb_recurrence_count DEFAULT 0;
    END

    IF COL_LENGTH('dbo.rca_knowledge_base', 'effectiveness') IS NULL
    BEGIN
        ALTER TABLE [dbo].[rca_knowledge_base]
        ADD [effectiveness] FLOAT NOT NULL CONSTRAINT DF_rca_kb_effectiveness DEFAULT 0;
    END

    IF COL_LENGTH('dbo.rca_knowledge_base', 'cost_saved') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [cost_saved] FLOAT NULL;

    IF COL_LENGTH('dbo.rca_knowledge_base', 'downtime_reduced') IS NULL
        ALTER TABLE [dbo].[rca_knowledge_base] ADD [downtime_reduced] FLOAT NULL;

    -- Ensure is_published is NOT NULL with default 0
    DECLARE @df_is_published NVARCHAR(128);
    SELECT @df_is_published = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID('[dbo].[rca_knowledge_base]')
      AND c.name = 'is_published';

    IF @df_is_published IS NOT NULL
    BEGIN
        DECLARE @sql NVARCHAR(400);
        SET @sql = N'ALTER TABLE [dbo].[rca_knowledge_base] DROP CONSTRAINT ' + QUOTENAME(@df_is_published);
        EXEC sp_executesql @sql;
    END

    UPDATE [dbo].[rca_knowledge_base] SET [is_published] = 0 WHERE [is_published] IS NULL;
    ALTER TABLE [dbo].[rca_knowledge_base] ALTER COLUMN [is_published] BIT NOT NULL;
    ALTER TABLE [dbo].[rca_knowledge_base]
        ADD CONSTRAINT DF_rca_kb_is_published DEFAULT 0 FOR [is_published];

    PRINT '✓ rca_knowledge_base columns updated';
END
ELSE
BEGIN
    PRINT '⚠️  Table [dbo].[rca_knowledge_base] does not exist - skipping updates';
END
GO


