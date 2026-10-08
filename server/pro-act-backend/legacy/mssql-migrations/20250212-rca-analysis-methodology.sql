-- Migration: Add RCA analysis methodology tables
-- Date: 2025-02-12

PRINT '--- Ensuring RCA methodology tables exist ---';

-- Helper macros
IF OBJECT_ID(N'[dbo].[rca_five_why_analyses]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[rca_five_why_analyses] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [problem] NVARCHAR(MAX) NOT NULL,
        [why_levels] NVARCHAR(MAX) NOT NULL,
        [root_cause] NVARCHAR(MAX) NOT NULL,
        [verified_by] VARCHAR(255) NULL,
        [verified_date] DATETIME NULL
    );
    CREATE INDEX idx_rca_five_why_tenant ON [dbo].[rca_five_why_analyses]([tenant_id]);
    CREATE INDEX idx_rca_five_why_org ON [dbo].[rca_five_why_analyses]([organization_id]);
    CREATE INDEX idx_rca_five_why_rca ON [dbo].[rca_five_why_analyses]([rca_id]);
END

IF OBJECT_ID(N'[dbo].[rca_fishbone_diagrams]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[rca_fishbone_diagrams] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [effect] NVARCHAR(MAX) NOT NULL,
        [categories] NVARCHAR(MAX) NOT NULL
    );
    CREATE INDEX idx_rca_fishbone_tenant ON [dbo].[rca_fishbone_diagrams]([tenant_id]);
    CREATE INDEX idx_rca_fishbone_org ON [dbo].[rca_fishbone_diagrams]([organization_id]);
    CREATE INDEX idx_rca_fishbone_rca ON [dbo].[rca_fishbone_diagrams]([rca_id]);
END

IF OBJECT_ID(N'[dbo].[rca_fmea_analyses]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[rca_fmea_analyses] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [failure_mode] NVARCHAR(255) NOT NULL,
        [effects] NVARCHAR(MAX) NOT NULL,
        [causes] NVARCHAR(MAX) NOT NULL
    );
    CREATE INDEX idx_rca_fmea_tenant ON [dbo].[rca_fmea_analyses]([tenant_id]);
    CREATE INDEX idx_rca_fmea_org ON [dbo].[rca_fmea_analyses]([organization_id]);
    CREATE INDEX idx_rca_fmea_rca ON [dbo].[rca_fmea_analyses]([rca_id]);
END

IF OBJECT_ID(N'[dbo].[rca_fault_tree_analyses]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[rca_fault_tree_analyses] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [top_event] NVARCHAR(255) NOT NULL,
        [nodes] NVARCHAR(MAX) NOT NULL,
        [minimum_cut_sets] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_rca_fault_tree_tenant ON [dbo].[rca_fault_tree_analyses]([tenant_id]);
    CREATE INDEX idx_rca_fault_tree_org ON [dbo].[rca_fault_tree_analyses]([organization_id]);
    CREATE INDEX idx_rca_fault_tree_rca ON [dbo].[rca_fault_tree_analyses]([rca_id]);
END

IF OBJECT_ID(N'[dbo].[rca_barrier_analyses]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[rca_barrier_analyses] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [hazard] NVARCHAR(255) NOT NULL,
        [barriers] NVARCHAR(MAX) NOT NULL
    );
    CREATE INDEX idx_rca_barrier_tenant ON [dbo].[rca_barrier_analyses]([tenant_id]);
    CREATE INDEX idx_rca_barrier_org ON [dbo].[rca_barrier_analyses]([organization_id]);
    CREATE INDEX idx_rca_barrier_rca ON [dbo].[rca_barrier_analyses]([rca_id]);
END

IF OBJECT_ID(N'[dbo].[rca_change_analyses]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[rca_change_analyses] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [tenant_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NULL,
        [rca_id] VARCHAR(36) NOT NULL,
        [question] NVARCHAR(255) NOT NULL,
        [changes] NVARCHAR(MAX) NOT NULL
    );
    CREATE INDEX idx_rca_change_tenant ON [dbo].[rca_change_analyses]([tenant_id]);
    CREATE INDEX idx_rca_change_org ON [dbo].[rca_change_analyses]([organization_id]);
    CREATE INDEX idx_rca_change_rca ON [dbo].[rca_change_analyses]([rca_id]);
END

PRINT '✓ RCA methodology tables ensured';
GO


