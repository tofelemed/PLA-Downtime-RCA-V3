-- =============================================
-- Migration: Add Missing Fields to Connectivity Connection Tables
-- =============================================
-- This script adds fields required by the frontend that are missing from connectivity connection tables
-- Run this script to ensure database schema matches frontend expectations

USE ProActDB;
GO

PRINT '';
PRINT '==============================================';
PRINT 'Adding Missing Fields to Connectivity Connection Tables';
PRINT '==============================================';
PRINT '';

-- 1. Add missing columns to opcua_connections table
PRINT '1. Adding missing columns to opcua_connections...';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('opcua_connections') AND name = 'description')
BEGIN
    ALTER TABLE opcua_connections ADD description NVARCHAR(500) NULL;
    PRINT '  ✓ Added: description';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('opcua_connections') AND name = 'authentication')
BEGIN
    ALTER TABLE opcua_connections ADD authentication VARCHAR(50) DEFAULT 'Anonymous';
    PRINT '  ✓ Added: authentication';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('opcua_connections') AND name = 'certificate_path')
BEGIN
    ALTER TABLE opcua_connections ADD certificate_path VARCHAR(500) NULL;
    PRINT '  ✓ Added: certificate_path';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('opcua_connections') AND name = 'private_key_path')
BEGIN
    ALTER TABLE opcua_connections ADD private_key_path VARCHAR(500) NULL;
    PRINT '  ✓ Added: private_key_path';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('opcua_connections') AND name = 'reconnect_interval_ms')
BEGIN
    ALTER TABLE opcua_connections ADD reconnect_interval_ms INT DEFAULT 5000;
    PRINT '  ✓ Added: reconnect_interval_ms';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('opcua_connections') AND name = 'max_reconnect_attempts')
BEGIN
    ALTER TABLE opcua_connections ADD max_reconnect_attempts INT DEFAULT 5;
    PRINT '  ✓ Added: max_reconnect_attempts';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('opcua_connections') AND name = 'organization_id')
BEGIN
    ALTER TABLE opcua_connections ADD organization_id VARCHAR(36) NULL;
    PRINT '  ✓ Added: organization_id';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('opcua_connections') AND name = 'status')
BEGIN
    ALTER TABLE opcua_connections ADD status VARCHAR(50) DEFAULT 'disconnected';
    PRINT '  ✓ Added: status';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('opcua_connections') AND name = 'last_connected')
BEGIN
    ALTER TABLE opcua_connections ADD last_connected DATETIME NULL;
    PRINT '  ✓ Added: last_connected';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('opcua_connections') AND name = 'error_count')
BEGIN
    ALTER TABLE opcua_connections ADD error_count INT DEFAULT 0;
    PRINT '  ✓ Added: error_count';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('opcua_connections') AND name = 'last_error')
BEGIN
    ALTER TABLE opcua_connections ADD last_error NVARCHAR(MAX) NULL;
    PRINT '  ✓ Added: last_error';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('opcua_connections') AND name = 'metadata')
BEGIN
    ALTER TABLE opcua_connections ADD metadata NVARCHAR(MAX) NULL;
    PRINT '  ✓ Added: metadata';
END;
PRINT '';

-- 2. Add missing columns to modbus_connections table
PRINT '2. Adding missing columns to modbus_connections...';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('modbus_connections') AND name = 'description')
BEGIN
    ALTER TABLE modbus_connections ADD description NVARCHAR(500) NULL;
    PRINT '  ✓ Added: description';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('modbus_connections') AND name = 'organization_id')
BEGIN
    ALTER TABLE modbus_connections ADD organization_id VARCHAR(36) NULL;
    PRINT '  ✓ Added: organization_id';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('modbus_connections') AND name = 'status')
BEGIN
    ALTER TABLE modbus_connections ADD status VARCHAR(50) DEFAULT 'disconnected';
    PRINT '  ✓ Added: status';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('modbus_connections') AND name = 'last_connected')
BEGIN
    ALTER TABLE modbus_connections ADD last_connected DATETIME NULL;
    PRINT '  ✓ Added: last_connected';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('modbus_connections') AND name = 'error_count')
BEGIN
    ALTER TABLE modbus_connections ADD error_count INT DEFAULT 0;
    PRINT '  ✓ Added: error_count';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('modbus_connections') AND name = 'last_error')
BEGIN
    ALTER TABLE modbus_connections ADD last_error NVARCHAR(MAX) NULL;
    PRINT '  ✓ Added: last_error';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('modbus_connections') AND name = 'metadata')
BEGIN
    ALTER TABLE modbus_connections ADD metadata NVARCHAR(MAX) NULL;
    PRINT '  ✓ Added: metadata';
END;
PRINT '';

-- 3. Add missing columns to mqtt_connections table
PRINT '3. Adding missing columns to mqtt_connections...';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('mqtt_connections') AND name = 'description')
BEGIN
    ALTER TABLE mqtt_connections ADD description NVARCHAR(500) NULL;
    PRINT '  ✓ Added: description';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('mqtt_connections') AND name = 'reconnect_period_ms')
BEGIN
    ALTER TABLE mqtt_connections ADD reconnect_period_ms INT DEFAULT 1000;
    PRINT '  ✓ Added: reconnect_period_ms';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('mqtt_connections') AND name = 'connect_timeout_ms')
BEGIN
    ALTER TABLE mqtt_connections ADD connect_timeout_ms INT DEFAULT 30000;
    PRINT '  ✓ Added: connect_timeout_ms';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('mqtt_connections') AND name = 'organization_id')
BEGIN
    ALTER TABLE mqtt_connections ADD organization_id VARCHAR(36) NULL;
    PRINT '  ✓ Added: organization_id';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('mqtt_connections') AND name = 'status')
BEGIN
    ALTER TABLE mqtt_connections ADD status VARCHAR(50) DEFAULT 'disconnected';
    PRINT '  ✓ Added: status';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('mqtt_connections') AND name = 'last_connected')
BEGIN
    ALTER TABLE mqtt_connections ADD last_connected DATETIME NULL;
    PRINT '  ✓ Added: last_connected';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('mqtt_connections') AND name = 'error_count')
BEGIN
    ALTER TABLE mqtt_connections ADD error_count INT DEFAULT 0;
    PRINT '  ✓ Added: error_count';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('mqtt_connections') AND name = 'last_error')
BEGIN
    ALTER TABLE mqtt_connections ADD last_error NVARCHAR(MAX) NULL;
    PRINT '  ✓ Added: last_error';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('mqtt_connections') AND name = 'metadata')
BEGIN
    ALTER TABLE mqtt_connections ADD metadata NVARCHAR(MAX) NULL;
    PRINT '  ✓ Added: metadata';
END;
PRINT '';

-- 4. Add missing columns to ethernetip_connections table
PRINT '4. Adding missing columns to ethernetip_connections...';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ethernetip_connections') AND name = 'description')
BEGIN
    ALTER TABLE ethernetip_connections ADD description NVARCHAR(500) NULL;
    PRINT '  ✓ Added: description';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ethernetip_connections') AND name = 'retry_count')
BEGIN
    ALTER TABLE ethernetip_connections ADD retry_count INT DEFAULT 3;
    PRINT '  ✓ Added: retry_count';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ethernetip_connections') AND name = 'cip_security')
BEGIN
    ALTER TABLE ethernetip_connections ADD cip_security BIT DEFAULT 0;
    PRINT '  ✓ Added: cip_security';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ethernetip_connections') AND name = 'organization_id')
BEGIN
    ALTER TABLE ethernetip_connections ADD organization_id VARCHAR(36) NULL;
    PRINT '  ✓ Added: organization_id';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ethernetip_connections') AND name = 'status')
BEGIN
    ALTER TABLE ethernetip_connections ADD status VARCHAR(50) DEFAULT 'disconnected';
    PRINT '  ✓ Added: status';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ethernetip_connections') AND name = 'last_connected')
BEGIN
    ALTER TABLE ethernetip_connections ADD last_connected DATETIME NULL;
    PRINT '  ✓ Added: last_connected';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ethernetip_connections') AND name = 'error_count')
BEGIN
    ALTER TABLE ethernetip_connections ADD error_count INT DEFAULT 0;
    PRINT '  ✓ Added: error_count';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ethernetip_connections') AND name = 'last_error')
BEGIN
    ALTER TABLE ethernetip_connections ADD last_error NVARCHAR(MAX) NULL;
    PRINT '  ✓ Added: last_error';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ethernetip_connections') AND name = 'metadata')
BEGIN
    ALTER TABLE ethernetip_connections ADD metadata NVARCHAR(MAX) NULL;
    PRINT '  ✓ Added: metadata';
END;
PRINT '';

PRINT '==============================================';
PRINT '✓ Migration completed!';
PRINT '==============================================';
PRINT '';

