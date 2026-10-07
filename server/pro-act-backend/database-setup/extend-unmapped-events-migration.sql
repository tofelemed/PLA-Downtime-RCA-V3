-- Extend unmapped_events table for PI integration (idempotent for MSSQL)
IF COL_LENGTH('unmapped_events', 'organization_id') IS NULL
  ALTER TABLE unmapped_events ADD organization_id VARCHAR(36) NULL;
GO
IF COL_LENGTH('unmapped_events', 'event_name') IS NULL
  ALTER TABLE unmapped_events ADD event_name NVARCHAR(255) NULL;
GO
IF COL_LENGTH('unmapped_events', 'event_type') IS NULL
  ALTER TABLE unmapped_events ADD event_type VARCHAR(100) NULL;
GO
IF COL_LENGTH('unmapped_events', 'start_time') IS NULL
  ALTER TABLE unmapped_events ADD start_time DATETIME NULL;
GO
IF COL_LENGTH('unmapped_events', 'end_time') IS NULL
  ALTER TABLE unmapped_events ADD end_time DATETIME NULL;
GO
IF COL_LENGTH('unmapped_events', 'source_system') IS NULL
  ALTER TABLE unmapped_events ADD source_system VARCHAR(100) NULL;
GO
IF COL_LENGTH('unmapped_events', 'source_id') IS NULL
  ALTER TABLE unmapped_events ADD source_id VARCHAR(255) NULL;
GO
IF COL_LENGTH('unmapped_events', 'event_data') IS NULL
  ALTER TABLE unmapped_events ADD event_data NVARCHAR(MAX) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_unmapped_events_source' AND object_id = OBJECT_ID('unmapped_events'))
  CREATE INDEX idx_unmapped_events_source ON unmapped_events(tenant_id, source_system, source_id);
GO
