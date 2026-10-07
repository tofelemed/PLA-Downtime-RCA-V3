# Connectivity Module

The Connectivity module provides a comprehensive backend implementation for managing industrial communication protocols, system integrations, and data flows in the ProAct application.

## Overview

This module enables ProAct to connect with external systems, industrial protocols, and data sources through a unified interface. It supports multiple industrial protocols, flexible configuration options, and robust monitoring capabilities.

## Features

### Supported Protocols

#### Industrial Protocols
- **OPC UA** - Open Platform Communications Unified Architecture
- **Modbus** - RTU, TCP, and ASCII variants
- **EtherNet/IP** - Ethernet-based industrial protocol
- **MQTT** - Lightweight messaging for IoT devices

#### System Integrations
- **Aveva PI** - Event frame management and data historian
- **CMMS Systems** - SAP PM, IBM Maximo, Infor EAM, eMaint
- **Historian Databases** - Time-series data storage
- **Custom APIs** - RESTful API integrations

### Core Functionality

1. **Connection Management** - Create, configure, and manage protocol connections
2. **Data Binding** - Map data between different systems and protocols
3. **Data Transformation** - Transform data during transfer between systems
4. **Health Monitoring** - Real-time connection health and performance monitoring
5. **Protocol Management** - Unified management of all communication protocols

## Architecture

### Entities

- `OPCUAConnection` - OPC UA server connections
- `ModbusConnection` - Modbus device connections
- `EtherNetIPConnection` - EtherNet/IP device connections
- `MQTTConnection` - MQTT broker connections
- `SystemIntegration` - External system integrations
- `DataBinding` - Data flow bindings between connections
- `DataTransformation` - Data transformation rules
- `ConnectionHealth` - Health monitoring records

### Services

- `OPCUAService` - OPC UA connection management
- `ModbusService` - Modbus connection management
- `EtherNetIPService` - EtherNet/IP connection management
- `MQTTService` - MQTT connection management
- `SystemIntegrationService` - System integration management
- `DataBindingService` - Data binding management
- `HealthMonitoringService` - Health monitoring and metrics
- `ProtocolManagerService` - Protocol overview and management

## API Endpoints

### OPC UA Endpoints
```
GET    /api/connectivity/opcua/connections
POST   /api/connectivity/opcua/connections
GET    /api/connectivity/opcua/connections/:id
PUT    /api/connectivity/opcua/connections/:id
DELETE /api/connectivity/opcua/connections/:id
POST   /api/connectivity/opcua/connections/:id/test
GET    /api/connectivity/opcua/connections/:id/browse
POST   /api/connectivity/opcua/connections/:id/read
```

### Modbus Endpoints
```
GET    /api/connectivity/modbus/connections
POST   /api/connectivity/modbus/connections
GET    /api/connectivity/modbus/connections/:id
PUT    /api/connectivity/modbus/connections/:id
DELETE /api/connectivity/modbus/connections/:id
POST   /api/connectivity/modbus/connections/:id/test
GET    /api/connectivity/modbus/connections/:id/registers
POST   /api/connectivity/modbus/connections/:id/registers
POST   /api/connectivity/modbus/connections/:id/registers/multiple
```

### EtherNet/IP Endpoints
```
GET    /api/connectivity/ethernetip/connections
POST   /api/connectivity/ethernetip/connections
GET    /api/connectivity/ethernetip/connections/:id
PUT    /api/connectivity/ethernetip/connections/:id
DELETE /api/connectivity/ethernetip/connections/:id
POST   /api/connectivity/ethernetip/connections/:id/test
POST   /api/connectivity/ethernetip/connections/:id/tags/read
POST   /api/connectivity/ethernetip/connections/:id/tags/write
GET    /api/connectivity/ethernetip/connections/:id/tags/browse
```

### MQTT Endpoints
```
GET    /api/connectivity/mqtt/connections
POST   /api/connectivity/mqtt/connections
GET    /api/connectivity/mqtt/connections/:id
PUT    /api/connectivity/mqtt/connections/:id
DELETE /api/connectivity/mqtt/connections/:id
POST   /api/connectivity/mqtt/connections/:id/test
POST   /api/connectivity/mqtt/connections/:id/publish
POST   /api/connectivity/mqtt/connections/:id/subscribe
POST   /api/connectivity/mqtt/connections/:id/unsubscribe
GET    /api/connectivity/mqtt/connections/:id/info
```

### System Integration Endpoints
```
GET    /api/connectivity/integrations
POST   /api/connectivity/integrations
GET    /api/connectivity/integrations/:id
PUT    /api/connectivity/integrations/:id
DELETE /api/connectivity/integrations/:id
POST   /api/connectivity/integrations/:id/test
POST   /api/connectivity/integrations/:id/sync
GET    /api/connectivity/integrations/:id/status
GET    /api/connectivity/integrations/pi
GET    /api/connectivity/integrations/cmms
```

### Data Binding Endpoints
```
GET    /api/connectivity/bindings
POST   /api/connectivity/bindings
GET    /api/connectivity/bindings/:id
PUT    /api/connectivity/bindings/:id
DELETE /api/connectivity/bindings/:id
POST   /api/connectivity/bindings/:id/activate
POST   /api/connectivity/bindings/:id/deactivate
GET    /api/connectivity/bindings/:id/status
POST   /api/connectivity/bindings/:id/execute
GET    /api/connectivity/bindings/:id/metrics
```

### Health Monitoring Endpoints
```
GET    /api/connectivity/health
GET    /api/connectivity/health/connections/:type/:id
GET    /api/connectivity/health/performance
POST   /api/connectivity/health/check
```

### Protocol Manager Endpoints
```
GET    /api/connectivity/overview
GET    /api/connectivity/protocols/:type/status
GET    /api/connectivity/dataflow/overview
GET    /api/connectivity/performance/metrics
```

## Usage Examples

### Creating an OPC UA Connection

```typescript
const opcuaConnection = {
  name: "Production OPC UA Server",
  endpoint: "opc.tcp://192.168.1.100:4840",
  securityMode: "SignAndEncrypt",
  securityPolicy: "Basic256Sha256",
  username: "admin",
  password: "password123",
  timeoutMs: 30000,
  sessionTimeoutMs: 60000,
  keepAliveMs: 10000,
  pollingIntervalMs: 1000,
  subscriptionSize: 1000,
  tenantId: "tenant-uuid"
};

const response = await fetch('/api/connectivity/opcua/connections', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(opcuaConnection)
});
```

### Creating a Modbus Connection

```typescript
const modbusConnection = {
  name: "Modbus TCP Device",
  connectionType: "tcp",
  ipAddress: "192.168.1.101",
  port: 502,
  unitId: 1,
  timeoutMs: 5000,
  retryCount: 3,
  pollingIntervalMs: 1000,
  startAddress: 0,
  registerCount: 10,
  dataType: "uint16",
  tenantId: "tenant-uuid"
};

const response = await fetch('/api/connectivity/modbus/connections', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(modbusConnection)
});
```

### Creating a Data Binding

```typescript
const dataBinding = {
  name: "Modbus to PI Binding",
  description: "Bind Modbus data to PI Event Frames",
  sourceModbusConnectionId: "modbus-connection-uuid",
  targetSystemIntegrationId: "pi-integration-uuid",
  sourcePath: "registers/0-10",
  targetPath: "eventframes/production",
  pollingIntervalMs: 1000,
  triggerMode: "scheduled",
  enabled: true,
  tenantId: "tenant-uuid"
};

const response = await fetch('/api/connectivity/bindings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(dataBinding)
});
```

### Testing a Connection

```typescript
const testResult = await fetch('/api/connectivity/opcua/connections/connection-uuid/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    endpoint: "opc.tcp://192.168.1.100:4840",
    username: "admin",
    password: "password123"
  })
});
```

### Getting System Health

```typescript
const healthStatus = await fetch('/api/connectivity/health?tenantId=tenant-uuid');
const health = await healthStatus.json();

console.log(`Overall Health: ${health.overallHealth}%`);
console.log(`Total Connections: ${health.totalConnections}`);
console.log(`Connected: ${health.connectedConnections}`);
```

## Database Schema

The module uses the following main tables:

- `opcua_connections` - OPC UA connection configurations
- `modbus_connections` - Modbus connection configurations
- `ethernetip_connections` - EtherNet/IP connection configurations
- `mqtt_connections` - MQTT connection configurations
- `system_integrations` - System integration configurations
- `data_bindings` - Data binding configurations
- `data_transformations` - Data transformation rules
- `connection_health` - Health monitoring records

## Security Features

- **Password Hashing** - All passwords are hashed using bcrypt
- **Tenant Isolation** - All connections are isolated by tenant
- **Input Validation** - Comprehensive input validation using class-validator
- **SQL Injection Protection** - Using TypeORM parameterized queries
- **Authentication** - Bearer token authentication required

## Performance Considerations

- **Connection Pooling** - Efficient connection management
- **Health Monitoring** - Real-time health status tracking
- **Performance Metrics** - Detailed performance monitoring
- **Indexing** - Optimized database indexes for fast queries
- **Caching** - Health status and metrics caching

## Error Handling

The module provides comprehensive error handling with:

- **Validation Errors** - Input validation with detailed error messages
- **Connection Errors** - Protocol-specific error handling
- **Health Monitoring** - Automatic error detection and reporting
- **Retry Logic** - Configurable retry mechanisms
- **Graceful Degradation** - Fallback mechanisms for failed connections

## Monitoring and Alerting

- **Real-time Health Checks** - Continuous connection monitoring
- **Performance Metrics** - Response times, throughput, error rates
- **Alert System** - Configurable alerts for connection issues
- **Historical Data** - Long-term performance tracking
- **Dashboard Integration** - Real-time status dashboards

## Configuration

The module supports extensive configuration options:

- **Protocol-specific Settings** - Tailored configuration for each protocol
- **Security Options** - Various security modes and policies
- **Performance Tuning** - Timeouts, retry counts, polling intervals
- **Data Transformation** - Flexible data mapping and transformation
- **Scheduling** - Configurable sync intervals and schedules

## Testing

The module includes comprehensive testing capabilities:

- **Connection Testing** - Built-in connection validation
- **Mock Data** - Simulated responses for development
- **Health Checks** - Automated health monitoring
- **Performance Testing** - Load and stress testing support

## Future Enhancements

Planned features include:

- **Additional Protocols** - Support for more industrial protocols
- **Advanced Analytics** - Machine learning and predictive analytics
- **Cloud Integration** - Cloud-based data storage and processing
- **Mobile Support** - Mobile device integration
- **Edge Computing** - Edge device support
- **AI/ML Integration** - Artificial intelligence capabilities

## Support

For technical support and questions:

- **Documentation** - Comprehensive API documentation
- **Examples** - Code examples and tutorials
- **Community** - User community and forums
- **Professional Support** - Enterprise support options

## License

This module is part of the ProAct application and follows the same licensing terms.
