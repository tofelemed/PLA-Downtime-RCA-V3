-- =============================================
-- Migration: Create Connectivity Connection Tables
-- =============================================
-- This script creates all connectivity connection tables if they don't exist
-- Run this BEFORE add-connectivity-missing-fields-migration.sql

USE ProActDB;
GO

PRINT '';
PRINT '==============================================';
PRINT 'Creating Connectivity Connection Tables';
PRINT '==============================================';
PRINT '';

-- 1. Create opcua_connections table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('opcua_connections') AND type in (N'U'))
BEGIN
    PRINT '1. Creating opcua_connections table...';
    CREATE TABLE opcua_connections (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(500) NULL,
        endpoint NVARCHAR(500) NOT NULL,
        security_mode VARCHAR(50) NOT NULL DEFAULT 'SignAndEncrypt',
        security_policy VARCHAR(100) NOT NULL DEFAULT 'Basic256Sha256',
        authentication VARCHAR(50) NOT NULL DEFAULT 'Anonymous',
        certificate_path VARCHAR(500) NULL,
        private_key_path VARCHAR(500) NULL,
        reconnect_interval_ms INT NOT NULL DEFAULT 5000,
        max_reconnect_attempts INT NOT NULL DEFAULT 5,
        username VARCHAR(255) NULL,
        password_hash VARCHAR(255) NULL,
        timeout_ms INT NOT NULL DEFAULT 30000,
        session_timeout_ms INT NOT NULL DEFAULT 60000,
        keep_alive_ms INT NOT NULL DEFAULT 10000,
        max_message_size INT NOT NULL DEFAULT 65536,
        polling_interval_ms INT NOT NULL DEFAULT 1000,
        subscription_size INT NOT NULL DEFAULT 1000,
        default_nodes TEXT NULL,
        application_name VARCHAR(500) NULL,
        enabled BIT NOT NULL DEFAULT 1,
        tenant_id VARCHAR(36) NOT NULL,
        organization_id VARCHAR(36) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
        last_connected DATETIME NULL,
        error_count INT NOT NULL DEFAULT 0,
        last_error TEXT NULL,
        metadata NVARCHAR(MAX) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_OPCUA_Tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );
    PRINT '  ✓ Created: opcua_connections';
END
ELSE
BEGIN
    PRINT '1. opcua_connections table already exists, skipping creation.';
END;
PRINT '';

-- 2. Create modbus_connections table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('modbus_connections') AND type in (N'U'))
BEGIN
    PRINT '2. Creating modbus_connections table...';
    CREATE TABLE modbus_connections (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(500) NULL,
        connection_type VARCHAR(20) NOT NULL,
        ip_address VARCHAR(45) NULL,
        port INT NULL,
        serial_port VARCHAR(50) NULL,
        baud_rate INT NULL,
        timeout_ms INT NOT NULL DEFAULT 5000,
        retry_count INT NOT NULL DEFAULT 3,
        unit_id INT NOT NULL DEFAULT 1,
        polling_interval_ms INT NOT NULL DEFAULT 1000,
        start_address INT NOT NULL DEFAULT 0,
        register_count INT NOT NULL DEFAULT 10,
        data_type VARCHAR(20) NOT NULL DEFAULT 'uint16',
        byte_ordering VARCHAR(20) NOT NULL DEFAULT 'big-endian',
        scaling_factor DECIMAL(10,4) NOT NULL DEFAULT 1,
        unit VARCHAR(50) NULL,
        enabled BIT NOT NULL DEFAULT 1,
        tenant_id VARCHAR(36) NOT NULL,
        organization_id VARCHAR(36) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
        last_connected DATETIME NULL,
        error_count INT NOT NULL DEFAULT 0,
        last_error TEXT NULL,
        metadata NVARCHAR(MAX) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Modbus_Tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );
    PRINT '  ✓ Created: modbus_connections';
END
ELSE
BEGIN
    PRINT '2. modbus_connections table already exists, skipping creation.';
END;
PRINT '';

-- 3. Create mqtt_connections table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('mqtt_connections') AND type in (N'U'))
BEGIN
    PRINT '3. Creating mqtt_connections table...';
    CREATE TABLE mqtt_connections (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(500) NULL,
        broker_url VARCHAR(500) NOT NULL,
        port INT NOT NULL DEFAULT 1883,
        client_id VARCHAR(255) NULL,
        username VARCHAR(255) NULL,
        password_hash VARCHAR(255) NULL,
        keep_alive_seconds INT NOT NULL DEFAULT 60,
        clean_session BIT NOT NULL DEFAULT 1,
        reconnect_period_ms INT NOT NULL DEFAULT 1000,
        connect_timeout_ms INT NOT NULL DEFAULT 30000,
        subscribe_topics TEXT NULL,
        publish_topic VARCHAR(500) NULL,
        qos_level INT NOT NULL DEFAULT 1,
        use_tls BIT NOT NULL DEFAULT 0,
        ca_cert VARCHAR(500) NULL,
        client_cert VARCHAR(500) NULL,
        client_key VARCHAR(500) NULL,
        last_will_topic VARCHAR(500) NULL,
        last_will_message TEXT NULL,
        last_will_qos INT NOT NULL DEFAULT 1,
        last_will_retain BIT NOT NULL DEFAULT 0,
        enabled BIT NOT NULL DEFAULT 1,
        tenant_id VARCHAR(36) NOT NULL,
        organization_id VARCHAR(36) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
        last_connected DATETIME NULL,
        error_count INT NOT NULL DEFAULT 0,
        last_error TEXT NULL,
        metadata NVARCHAR(MAX) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_MQTT_Tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );
    PRINT '  ✓ Created: mqtt_connections';
END
ELSE
BEGIN
    PRINT '3. mqtt_connections table already exists, skipping creation.';
END;
PRINT '';

-- 4. Create ethernetip_connections table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('ethernetip_connections') AND type in (N'U'))
BEGIN
    PRINT '4. Creating ethernetip_connections table...';
    CREATE TABLE ethernetip_connections (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(500) NULL,
        ip_address VARCHAR(45) NOT NULL,
        port INT NOT NULL DEFAULT 44818,
        timeout_ms INT NOT NULL DEFAULT 10000,
        retry_count INT NOT NULL DEFAULT 3,
        backplane_slot INT NOT NULL DEFAULT 0,
        vendor_id INT NOT NULL DEFAULT 1,
        product_code INT NOT NULL DEFAULT 0,
        polling_interval_ms INT NOT NULL DEFAULT 100,
        tag_paths TEXT NULL,
        data_types TEXT NULL,
        array_sizes TEXT NULL,
        cip_security BIT NOT NULL DEFAULT 0,
        enabled BIT NOT NULL DEFAULT 1,
        tenant_id VARCHAR(36) NOT NULL,
        organization_id VARCHAR(36) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
        last_connected DATETIME NULL,
        error_count INT NOT NULL DEFAULT 0,
        last_error TEXT NULL,
        metadata NVARCHAR(MAX) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_EtherNetIP_Tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );
    PRINT '  ✓ Created: ethernetip_connections';
END
ELSE
BEGIN
    PRINT '4. ethernetip_connections table already exists, skipping creation.';
END;
PRINT '';

PRINT '==============================================';
PRINT '✓ Connectivity Tables Creation Complete!';
PRINT '==============================================';
PRINT '';
PRINT 'Next: Run add-connectivity-missing-fields-migration.sql to add any missing columns.';
PRINT '';

