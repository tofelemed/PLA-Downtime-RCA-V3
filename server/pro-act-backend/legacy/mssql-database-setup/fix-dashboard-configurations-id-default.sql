-- Add DEFAULT NEWID() to dashboard_configurations.id (MSSQL)
USE ProActDB;
GO

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[dashboard_configurations]') AND type in (N'U'))
BEGIN
    IF EXISTS (
        SELECT *
        FROM sys.columns
        WHERE object_id = OBJECT_ID(N'[dbo].[dashboard_configurations]')
          AND name = 'id'
          AND default_object_id = 0
    )
    BEGIN
        ALTER TABLE [dbo].[dashboard_configurations]
        ADD CONSTRAINT [DF_dashboard_configurations_id] DEFAULT (NEWID()) FOR [id];
        PRINT 'Added DEFAULT NEWID() to dashboard_configurations.id';
    END
    ELSE
        PRINT 'dashboard_configurations.id already has a DEFAULT constraint';
END
GO
