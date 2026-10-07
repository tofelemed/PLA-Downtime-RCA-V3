-- =============================================
-- DELETE ALL DATA FROM DATABASE
-- =============================================
-- WARNING: This script will DELETE ALL DATA from all tables
-- Use with caution! This is irreversible.
-- =============================================

USE [ProActDB];
GO

-- Disable foreign key constraints temporarily
EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT all";
GO

-- Delete all data from all tables
-- Order matters due to foreign key relationships

PRINT 'Starting data deletion...';
GO

-- Delete from child tables first (tables with foreign keys)
DELETE FROM [custom_attribute_values];
DELETE FROM [custom_attribute_definitions];
DELETE FROM [historian_history];
DELETE FROM [historian_tags];
DELETE FROM [pi_sync_watermarks];
DELETE FROM [pi_sync_jobs];
DELETE FROM [pi_events];
DELETE FROM [pi_af_elements];
DELETE FROM [af_bindings];
DELETE FROM [pi_mappings];
DELETE FROM [pi_connections];
DELETE FROM [production_events];
DELETE FROM [production_plans];
DELETE FROM [production_plan_templates];
DELETE FROM [production_losses];
DELETE FROM [oee_summaries];
DELETE FROM [reconcile_forms];
DELETE FROM [unmapped_events];
DELETE FROM [rca_recommendations];
DELETE FROM [rca_evidences];
DELETE FROM [rca_analysis_configs];
DELETE FROM [rca_analysis_methodologies];
DELETE FROM [rca_knowledge_bases];
DELETE FROM [rca_trigger_configs];
DELETE FROM [rca_templates];
DELETE FROM [rca_cause_codes];
DELETE FROM [reason_codes];
DELETE FROM [verification_status_codes];
DELETE FROM [impact_codes];
DELETE FROM [oee_codes];
DELETE FROM [tasks];
DELETE FROM [audit_logs];
DELETE FROM [dashboard_configurations];
DELETE FROM [app_settings];
DELETE FROM [logic_tree_nodes];
DELETE FROM [evidence_categories];
DELETE FROM [evidence_locations];
DELETE FROM [loss_categories];
DELETE FROM [assets];
DELETE FROM [units];
DELETE FROM [products];
DELETE FROM [tenants];
DELETE FROM [organizations];
DELETE FROM [users];
DELETE FROM [roles];

-- Delete from connectivity tables
DELETE FROM [stream_alerts];
DELETE FROM [stream_metrics];
DELETE FROM [stream_data_sinks];
DELETE FROM [stream_data_sources];
DELETE FROM [stream_processors];
DELETE FROM [stream_connection_configs];
DELETE FROM [data_sources];
DELETE FROM [system_integrations];
DELETE FROM [database_connections];
DELETE FROM [restapi_connections];
DELETE FROM [mqtt_connections];
DELETE FROM [modbus_connections];
DELETE FROM [opcua_connections];
DELETE FROM [ethernetip_connections];
DELETE FROM [profinet_connections];
DELETE FROM [dnp3_connections];
DELETE FROM [bacnet_connections];
DELETE FROM [websocket_connections];
DELETE FROM [scada_connections];
DELETE FROM [data_transformations];
DELETE FROM [data_bindings];

-- Delete from hierarchy mapping tables
DELETE FROM [source_hierarchy_mappings];

-- Delete from RCA analysis tables
DELETE FROM [five_why_analyses];
DELETE FROM [fishbone_diagrams];
DELETE FROM [fmea_analyses];
DELETE FROM [fault_tree_analyses];
DELETE FROM [barrier_analyses];
DELETE FROM [change_analyses];

-- Delete from RCA main table (after deleting related data)
DELETE FROM [rcas];

PRINT 'All data deleted successfully!';
GO

-- Re-enable foreign key constraints
EXEC sp_MSforeachtable "ALTER TABLE ? CHECK CONSTRAINT all";
GO

PRINT 'Foreign key constraints re-enabled.';
PRINT 'Database is now empty.';
GO

