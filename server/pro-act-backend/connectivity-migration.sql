-- Connectivity Module Database Migration
-- This script creates all the necessary tables for the connectivity module

-- OPC UA Connections Table
CREATE TABLE opcua_connections (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    endpoint NVARCHAR(500) NOT NULL,
    security_mode NVARCHAR(50) DEFAULT 'SignAndEncrypt',
    security_policy NVARCHAR(100) DEFAULT 'Basic256Sha256',
    username NVARCHAR(255),
    password_hash NVARCHAR(255),
    timeout_ms INT DEFAULT 30000,
    session_timeout_ms INT DEFAULT 60000,
    keep_alive_ms INT DEFAULT 10000,
    max_message_size INT DEFAULT 65536,
    polling_interval_ms INT DEFAULT 1000,
    subscription_size INT DEFAULT 1000,
    default_nodes NTEXT,
    application_name NVARCHAR(500),
    enabled BIT DEFAULT 1,
    tenant_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Modbus Connections Table
CREATE TABLE modbus_connections (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    connection_type NVARCHAR(20) NOT NULL,
    ip_address NVARCHAR(45),
    port INT,
    serial_port NVARCHAR(50),
    baud_rate INT,
    timeout_ms INT DEFAULT 5000,
    retry_count INT DEFAULT 3,
    unit_id INT DEFAULT 1,
    polling_interval_ms INT DEFAULT 1000,
    start_address INT DEFAULT 0,
    register_count INT DEFAULT 10,
    data_type NVARCHAR(20) DEFAULT 'uint16',
    byte_ordering NVARCHAR(20) DEFAULT 'big-endian',
    scaling_factor DECIMAL(10,4) DEFAULT 1,
    unit NVARCHAR(50),
    enabled BIT DEFAULT 1,
    tenant_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- EtherNet/IP Connections Table
CREATE TABLE ethernetip_connections (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    ip_address NVARCHAR(45) NOT NULL,
    port INT DEFAULT 44818,
    timeout_ms INT DEFAULT 10000,
    backplane_slot INT DEFAULT 0,
    vendor_id INT DEFAULT 1,
    product_code INT DEFAULT 0,
    polling_interval_ms INT DEFAULT 100,
    tag_paths NTEXT,
    data_types NTEXT,
    array_sizes NTEXT,
    enabled BIT DEFAULT 1,
    tenant_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- MQTT Connections Table
CREATE TABLE mqtt_connections (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    broker_url NVARCHAR(500) NOT NULL,
    port INT DEFAULT 1883,
    client_id NVARCHAR(255),
    username NVARCHAR(255),
    password_hash NVARCHAR(255),
    keep_alive_seconds INT DEFAULT 60,
    clean_session BIT DEFAULT 1,
    subscribe_topics NTEXT,
    publish_topic NVARCHAR(500),
    qos_level INT DEFAULT 1,
    use_tls BIT DEFAULT 0,
    ca_cert NVARCHAR(500),
    client_cert NVARCHAR(500),
    client_key NVARCHAR(500),
    last_will_topic NVARCHAR(500),
    last_will_message NTEXT,
    last_will_qos INT DEFAULT 1,
    last_will_retain BIT DEFAULT 0,
    enabled BIT DEFAULT 1,
    tenant_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- BACnet Connections Table
CREATE TABLE bacnet_connections (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(500),
    ip_address NVARCHAR(45) NOT NULL,
    port INT DEFAULT 47808,
    device_id INT DEFAULT 123,
    timeout_ms INT DEFAULT 10000,
    retry_count INT DEFAULT 3,
    polling_interval_ms INT DEFAULT 1000,
    operation_type NVARCHAR(50) DEFAULT 'readProperty',
    object_type NVARCHAR(100),
    object_instance INT,
    property_id NVARCHAR(100),
    enabled BIT DEFAULT 1,
    tenant_id UNIQUEIDENTIFIER NOT NULL,
    status NVARCHAR(50) DEFAULT 'disconnected',
    last_connected DATETIME2,
    error_count INT DEFAULT 0,
    last_error NTEXT,
    metadata NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- DNP3 Connections Table
CREATE TABLE dnp3_connections (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(500),
    ip_address NVARCHAR(45) NOT NULL,
    port INT DEFAULT 20000,
    connection_type NVARCHAR(20) DEFAULT 'tcp',
    source_address INT DEFAULT 1,
    destination_address INT DEFAULT 1,
    timeout_ms INT DEFAULT 10000,
    retry_count INT DEFAULT 3,
    polling_interval_ms INT DEFAULT 1000,
    operation_type NVARCHAR(50) DEFAULT 'read',
    object_group NVARCHAR(100),
    object_variation INT,
    start_index INT,
    stop_index INT,
    enabled BIT DEFAULT 1,
    tenant_id UNIQUEIDENTIFIER NOT NULL,
    status NVARCHAR(50) DEFAULT 'disconnected',
    last_connected DATETIME2,
    error_count INT DEFAULT 0,
    last_error NTEXT,
    metadata NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Profinet Connections Table
CREATE TABLE profinet_connections (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(500),
    ip_address NVARCHAR(45) NOT NULL,
    port INT DEFAULT 34964,
    connection_type NVARCHAR(20) DEFAULT 'tcp',
    device_id INT DEFAULT 1,
    timeout_ms INT DEFAULT 10000,
    retry_count INT DEFAULT 3,
    polling_interval_ms INT DEFAULT 100,
    operation_type NVARCHAR(50) DEFAULT 'read',
    slot_number NVARCHAR(100),
    subslot_number NVARCHAR(100),
    index NVARCHAR(100),
    subindex NVARCHAR(100),
    enabled BIT DEFAULT 1,
    tenant_id UNIQUEIDENTIFIER NOT NULL,
    status NVARCHAR(50) DEFAULT 'disconnected',
    last_connected DATETIME2,
    error_count INT DEFAULT 0,
    last_error NTEXT,
    metadata NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- SCADA Connections Table
CREATE TABLE scada_connections (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(500),
    ip_address NVARCHAR(45) NOT NULL,
    port INT DEFAULT 502,
    protocol NVARCHAR(20) DEFAULT 'modbus',
    connection_type NVARCHAR(20) DEFAULT 'tcp',
    unit_id INT DEFAULT 1,
    timeout_ms INT DEFAULT 10000,
    retry_count INT DEFAULT 3,
    polling_interval_ms INT DEFAULT 1000,
    operation_type NVARCHAR(50) DEFAULT 'read',
    register_type NVARCHAR(100),
    start_address INT,
    register_count INT,
    data_type NVARCHAR(20) DEFAULT 'uint16',
    enabled BIT DEFAULT 1,
    tenant_id UNIQUEIDENTIFIER NOT NULL,
    status NVARCHAR(50) DEFAULT 'disconnected',
    last_connected DATETIME2,
    error_count INT DEFAULT 0,
    last_error NTEXT,
    metadata NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- WebSocket Connections Table
CREATE TABLE websocket_connections (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(500),
    url NVARCHAR(500) NOT NULL,
    protocol NVARCHAR(20) DEFAULT 'ws',
    subprotocol NVARCHAR(100),
    timeout_ms INT DEFAULT 30000,
    retry_count INT DEFAULT 3,
    reconnect_interval_ms INT DEFAULT 5000,
    operation_type NVARCHAR(50) DEFAULT 'connect',
    message_handlers NTEXT,
    event_handlers NTEXT,
    auto_reconnect BIT DEFAULT 1,
    enabled BIT DEFAULT 1,
    tenant_id UNIQUEIDENTIFIER NOT NULL,
    status NVARCHAR(50) DEFAULT 'disconnected',
    last_connected DATETIME2,
    error_count INT DEFAULT 0,
    last_error NTEXT,
    metadata NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- REST API Connections Table
CREATE TABLE restapi_connections (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(500),
    base_url NVARCHAR(500) NOT NULL,
    protocol NVARCHAR(20) DEFAULT 'https',
    default_method NVARCHAR(50) DEFAULT 'GET',
    username NVARCHAR(100),
    password_hash NVARCHAR(255),
    api_key NVARCHAR(255),
    auth_type NVARCHAR(100),
    timeout_ms INT DEFAULT 30000,
    retry_count INT DEFAULT 3,
    polling_interval_ms INT DEFAULT 1000,
    operation_type NVARCHAR(50) DEFAULT 'request',
    headers NTEXT,
    query_params NTEXT,
    enabled BIT DEFAULT 1,
    tenant_id UNIQUEIDENTIFIER NOT NULL,
    status NVARCHAR(50) DEFAULT 'disconnected',
    last_connected DATETIME2,
    error_count INT DEFAULT 0,
    last_error NTEXT,
    metadata NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Database Connections Table
CREATE TABLE database_connections (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(500),
    database_type NVARCHAR(50) NOT NULL,
    host NVARCHAR(45) NOT NULL,
    port INT DEFAULT 5432,
    database NVARCHAR(100) NOT NULL,
    username NVARCHAR(100),
    password_hash NVARCHAR(255),
    schema NVARCHAR(100),
    table NVARCHAR(100),
    timeout_ms INT DEFAULT 30000,
    retry_count INT DEFAULT 3,
    polling_interval_ms INT DEFAULT 1000,
    operation_type NVARCHAR(50) DEFAULT 'query',
    query NTEXT,
    connection_string NVARCHAR(500),
    enabled BIT DEFAULT 1,
    tenant_id UNIQUEIDENTIFIER NOT NULL,
    status NVARCHAR(50) DEFAULT 'disconnected',
    last_connected DATETIME2,
    error_count INT DEFAULT 0,
    last_error NTEXT,
    metadata NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- System Integrations Table
CREATE TABLE system_integrations (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    integration_type NVARCHAR(50) NOT NULL,
    endpoint NVARCHAR(500),
    api_key NVARCHAR(255),
    username NVARCHAR(255),
    password_hash NVARCHAR(255),
    system_type NVARCHAR(50),
    database NVARCHAR(500),
    sync_interval_seconds INT DEFAULT 300,
    enabled BIT DEFAULT 1,
    configuration NVARCHAR(MAX),
    authentication NVARCHAR(MAX),
    description NVARCHAR(500),
    tenant_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Data Bindings Table
CREATE TABLE data_bindings (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(500),
    source_opcua_connection_id UNIQUEIDENTIFIER,
    source_modbus_connection_id UNIQUEIDENTIFIER,
    source_ethernetip_connection_id UNIQUEIDENTIFIER,
    source_mqtt_connection_id UNIQUEIDENTIFIER,
    source_system_integration_id UNIQUEIDENTIFIER,
    target_opcua_connection_id UNIQUEIDENTIFIER,
    target_modbus_connection_id UNIQUEIDENTIFIER,
    target_ethernetip_connection_id UNIQUEIDENTIFIER,
    target_mqtt_connection_id UNIQUEIDENTIFIER,
    target_system_integration_id UNIQUEIDENTIFIER,
    source_path NVARCHAR(500),
    target_path NVARCHAR(500),
    transformation_rules NVARCHAR(MAX),
    polling_interval_ms INT DEFAULT 1000,
    enabled BIT DEFAULT 1,
    active BIT DEFAULT 0,
    trigger_mode NVARCHAR(50) DEFAULT 'manual',
    schedule NVARCHAR(MAX),
    filters NVARCHAR(MAX),
    tenant_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Data Transformations Table
CREATE TABLE data_transformations (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    binding_id UNIQUEIDENTIFIER NOT NULL,
    transformation_type NVARCHAR(50) NOT NULL,
    parameters NVARCHAR(MAX),
    order_index INT DEFAULT 0,
    enabled BIT DEFAULT 1,
    description NVARCHAR(500),
    input_mapping NVARCHAR(MAX),
    output_mapping NVARCHAR(MAX),
    formula NVARCHAR(1000),
    conditions NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Connection Health Table
CREATE TABLE connection_health (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    connection_type NVARCHAR(50) NOT NULL,
    opcua_connection_id UNIQUEIDENTIFIER,
    modbus_connection_id UNIQUEIDENTIFIER,
    ethernetip_connection_id UNIQUEIDENTIFIER,
    mqtt_connection_id UNIQUEIDENTIFIER,
    system_integration_id UNIQUEIDENTIFIER,
    status NVARCHAR(20) NOT NULL,
    response_time_ms INT,
    data_point_count INT,
    error_rate DECIMAL(10,4),
    last_data_received_ms INT,
    error_message NTEXT,
    metrics NVARCHAR(MAX),
    configuration NVARCHAR(MAX),
    checked_at DATETIME2 DEFAULT GETUTCDATE(),
    created_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Create Indexes for better performance
CREATE INDEX IX_opcua_connections_tenant_id ON opcua_connections(tenant_id);
CREATE INDEX IX_opcua_connections_enabled ON opcua_connections(enabled);

CREATE INDEX IX_modbus_connections_tenant_id ON modbus_connections(tenant_id);
CREATE INDEX IX_modbus_connections_enabled ON modbus_connections(enabled);

CREATE INDEX IX_ethernetip_connections_tenant_id ON ethernetip_connections(tenant_id);
CREATE INDEX IX_ethernetip_connections_enabled ON ethernetip_connections(enabled);

CREATE INDEX IX_mqtt_connections_tenant_id ON mqtt_connections(tenant_id);
CREATE INDEX IX_mqtt_connections_enabled ON mqtt_connections(enabled);

CREATE INDEX IX_bacnet_connections_tenant_id ON bacnet_connections(tenant_id);
CREATE INDEX IX_bacnet_connections_enabled ON bacnet_connections(enabled);

CREATE INDEX IX_dnp3_connections_tenant_id ON dnp3_connections(tenant_id);
CREATE INDEX IX_dnp3_connections_enabled ON dnp3_connections(enabled);

CREATE INDEX IX_profinet_connections_tenant_id ON profinet_connections(tenant_id);
CREATE INDEX IX_profinet_connections_enabled ON profinet_connections(enabled);

CREATE INDEX IX_scada_connections_tenant_id ON scada_connections(tenant_id);
CREATE INDEX IX_scada_connections_enabled ON scada_connections(enabled);

CREATE INDEX IX_websocket_connections_tenant_id ON websocket_connections(tenant_id);
CREATE INDEX IX_websocket_connections_enabled ON websocket_connections(enabled);

CREATE INDEX IX_restapi_connections_tenant_id ON restapi_connections(tenant_id);
CREATE INDEX IX_restapi_connections_enabled ON restapi_connections(enabled);

CREATE INDEX IX_database_connections_tenant_id ON database_connections(tenant_id);
CREATE INDEX IX_database_connections_enabled ON database_connections(enabled);

CREATE INDEX IX_system_integrations_tenant_id ON system_integrations(tenant_id);
CREATE INDEX IX_system_integrations_enabled ON system_integrations(enabled);
CREATE INDEX IX_system_integrations_type ON system_integrations(integration_type);

CREATE INDEX IX_data_bindings_tenant_id ON data_bindings(tenant_id);
CREATE INDEX IX_data_bindings_enabled ON data_bindings(enabled);
CREATE INDEX IX_data_bindings_active ON data_bindings(active);

CREATE INDEX IX_data_transformations_binding_id ON data_transformations(binding_id);

CREATE INDEX IX_connection_health_connection_type ON connection_health(connection_type);
CREATE INDEX IX_connection_health_checked_at ON connection_health(checked_at);
CREATE INDEX IX_connection_health_status ON connection_health(status);

-- Add Foreign Key Constraints (if tenant table exists)
-- ALTER TABLE opcua_connections ADD CONSTRAINT FK_opcua_connections_tenant 
--     FOREIGN KEY (tenant_id) REFERENCES tenants(id);
-- ALTER TABLE modbus_connections ADD CONSTRAINT FK_modbus_connections_tenant 
--     FOREIGN KEY (tenant_id) REFERENCES tenants(id);
-- ALTER TABLE ethernetip_connections ADD CONSTRAINT FK_ethernetip_connections_tenant 
--     FOREIGN KEY (tenant_id) REFERENCES tenants(id);
-- ALTER TABLE mqtt_connections ADD CONSTRAINT FK_mqtt_connections_tenant 
--     FOREIGN KEY (tenant_id) REFERENCES tenants(id);
-- ALTER TABLE system_integrations ADD CONSTRAINT FK_system_integrations_tenant 
--     FOREIGN KEY (tenant_id) REFERENCES tenants(id);
-- ALTER TABLE data_bindings ADD CONSTRAINT FK_data_bindings_tenant 
--     FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- Add Foreign Key Constraints for Data Transformations
ALTER TABLE data_transformations ADD CONSTRAINT FK_data_transformations_binding 
    FOREIGN KEY (binding_id) REFERENCES data_bindings(id) ON DELETE CASCADE;

-- Add Foreign Key Constraints for Connection Health
ALTER TABLE connection_health ADD CONSTRAINT FK_connection_health_opcua 
    FOREIGN KEY (opcua_connection_id) REFERENCES opcua_connections(id) ON DELETE CASCADE;
ALTER TABLE connection_health ADD CONSTRAINT FK_connection_health_modbus 
    FOREIGN KEY (modbus_connection_id) REFERENCES modbus_connections(id) ON DELETE CASCADE;
ALTER TABLE connection_health ADD CONSTRAINT FK_connection_health_ethernetip 
    FOREIGN KEY (ethernetip_connection_id) REFERENCES ethernetip_connections(id) ON DELETE CASCADE;
ALTER TABLE connection_health ADD CONSTRAINT FK_connection_health_mqtt 
    FOREIGN KEY (mqtt_connection_id) REFERENCES mqtt_connections(id) ON DELETE CASCADE;
ALTER TABLE connection_health ADD CONSTRAINT FK_connection_health_system_integration 
    FOREIGN KEY (system_integration_id) REFERENCES system_integrations(id) ON DELETE CASCADE;

-- Insert Sample Data for Testing
INSERT INTO opcua_connections (name, endpoint, security_mode, security_policy, username, password_hash, tenant_id, enabled)
VALUES 
('OPC UA Test Server', 'opc.tcp://localhost:4840', 'SignAndEncrypt', 'Basic256Sha256', 'admin', '$2b$10$example', '00000000-0000-0000-0000-000000000001', 1),
('Production OPC UA Server', 'opc.tcp://192.168.1.100:4840', 'SignAndEncrypt', 'Basic256Sha256', 'proact', '$2b$10$example', '00000000-0000-0000-0000-000000000001', 1);

INSERT INTO modbus_connections (name, connection_type, ip_address, port, unit_id, tenant_id, enabled)
VALUES 
('Modbus TCP Device', 'tcp', '192.168.1.101', 502, 1, '00000000-0000-0000-0000-000000000001', 1),
('Modbus RTU Device', 'rtu', NULL, NULL, 1, '00000000-0000-0000-0000-000000000001', 1);

INSERT INTO ethernetip_connections (name, ip_address, port, vendor_id, product_code, tenant_id, enabled)
VALUES 
('EtherNet/IP PLC', '192.168.1.102', 44818, 1, 14, '00000000-0000-0000-0000-000000000001', 1);

INSERT INTO mqtt_connections (name, broker_url, port, client_id, username, password_hash, tenant_id, enabled)
VALUES 
('IoT MQTT Broker', 'mqtt://192.168.1.103:1883', 1883, 'ProAct_Client', 'iot_user', '$2b$10$example', '00000000-0000-0000-0000-000000000001', 1);

INSERT INTO system_integrations (name, integration_type, endpoint, username, password_hash, system_type, tenant_id, enabled)
VALUES 
('PI Event Frames', 'PI', 'https://pi-server.company.com/piwebapi', 'pi_user', '$2b$10$example', 'Aveva PI', '00000000-0000-0000-0000-000000000001', 1),
('SAP PM Integration', 'CMMS', 'https://sap-server.company.com/api', 'sap_user', '$2b$10$example', 'SAP', '00000000-0000-0000-0000-000000000001', 1);

INSERT INTO data_bindings (name, description, source_modbus_connection_id, target_system_integration_id, source_path, target_path, tenant_id, enabled)
VALUES 
('Modbus to PI Binding', 'Bind Modbus data to PI Event Frames', 
 (SELECT id FROM modbus_connections WHERE name = 'Modbus TCP Device' LIMIT 1),
 (SELECT id FROM system_integrations WHERE name = 'PI Event Frames' LIMIT 1),
 'registers/0-10', 'eventframes/production', '00000000-0000-0000-0000-000000000001', 1);

-- Create Views for easier querying
CREATE VIEW v_connection_overview AS
SELECT 
    'OPC UA' as protocol_type,
    id,
    name,
    endpoint as connection_info,
    enabled,
    created_at
FROM opcua_connections
UNION ALL
SELECT 
    'Modbus' as protocol_type,
    id,
    name,
    CASE 
        WHEN connection_type = 'tcp' THEN CONCAT(ip_address, ':', port)
        ELSE CONCAT(serial_port, '@', baud_rate)
    END as connection_info,
    enabled,
    created_at
FROM modbus_connections
UNION ALL
SELECT 
    'EtherNet/IP' as protocol_type,
    id,
    name,
    CONCAT(ip_address, ':', port) as connection_info,
    enabled,
    created_at
FROM ethernetip_connections
UNION ALL
SELECT 
    'MQTT' as protocol_type,
    id,
    name,
    CONCAT(broker_url, ':', port) as connection_info,
    enabled,
    created_at
FROM mqtt_connections
UNION ALL
SELECT 
    'BACnet' as protocol_type,
    id,
    name,
    CONCAT(ip_address, ':', port) as connection_info,
    enabled,
    created_at
FROM bacnet_connections
UNION ALL
SELECT 
    'DNP3' as protocol_type,
    id,
    name,
    CONCAT(ip_address, ':', port) as connection_info,
    enabled,
    created_at
FROM dnp3_connections
UNION ALL
SELECT 
    'Profinet' as protocol_type,
    id,
    name,
    CONCAT(ip_address, ':', port) as connection_info,
    enabled,
    created_at
FROM profinet_connections
UNION ALL
SELECT 
    'SCADA' as protocol_type,
    id,
    name,
    CONCAT(ip_address, ':', port) as connection_info,
    enabled,
    created_at
FROM scada_connections
UNION ALL
SELECT 
    'WebSocket' as protocol_type,
    id,
    name,
    url as connection_info,
    enabled,
    created_at
FROM websocket_connections
UNION ALL
SELECT 
    'REST API' as protocol_type,
    id,
    name,
    base_url as connection_info,
    enabled,
    created_at
FROM restapi_connections
UNION ALL
SELECT 
    'Database' as protocol_type,
    id,
    name,
    CONCAT(host, ':', port, '/', database) as connection_info,
    enabled,
    created_at
FROM database_connections
UNION ALL
SELECT 
    integration_type as protocol_type,
    id,
    name,
    endpoint as connection_info,
    enabled,
    created_at
FROM system_integrations;

-- Create a view for active data bindings
CREATE VIEW v_active_data_bindings AS
SELECT 
    db.id,
    db.name,
    db.description,
    db.trigger_mode,
    db.polling_interval_ms,
    db.enabled,
    db.active,
    db.created_at,
    -- Source connection info
    CASE 
        WHEN db.source_opcua_connection_id IS NOT NULL THEN 'OPC UA'
        WHEN db.source_modbus_connection_id IS NOT NULL THEN 'Modbus'
        WHEN db.source_ethernetip_connection_id IS NOT NULL THEN 'EtherNet/IP'
        WHEN db.source_mqtt_connection_id IS NOT NULL THEN 'MQTT'
        WHEN db.source_system_integration_id IS NOT NULL THEN 'System Integration'
        ELSE 'Unknown'
    END as source_type,
    -- Target connection info
    CASE 
        WHEN db.target_opcua_connection_id IS NOT NULL THEN 'OPC UA'
        WHEN db.target_modbus_connection_id IS NOT NULL THEN 'Modbus'
        WHEN db.target_ethernetip_connection_id IS NOT NULL THEN 'EtherNet/IP'
        WHEN db.target_mqtt_connection_id IS NOT NULL THEN 'MQTT'
        WHEN db.target_system_integration_id IS NOT NULL THEN 'System Integration'
        ELSE 'Unknown'
    END as target_type
FROM data_bindings db
WHERE db.enabled = 1;

PRINT 'Connectivity module database migration completed successfully!';
