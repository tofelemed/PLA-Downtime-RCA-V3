# Connectivity Module Testing Guide

## Overview

This guide provides comprehensive testing instructions for the Connectivity module backend implementation. The module includes endpoints for managing industrial protocols (OPC UA, Modbus, EtherNet/IP, MQTT), system integrations, and health monitoring.

## Prerequisites

1. **Database Setup**: Ensure your database is running and accessible
2. **Dependencies**: Install required packages (`bcrypt`, `@types/bcrypt`)
3. **Environment**: Backend server running on configured port
4. **Testing Tools**: Postman, curl, or similar API testing tool

## Database Setup

### 1. Run Database Migration

First, execute the database migration to create the required tables:

```bash
# Navigate to backend directory
cd server/pro-act-backend

# Run the migration (adjust connection string as needed)
# You can use your preferred database client or command line tool
```

The migration file `connectivity-migration.sql` contains all necessary table creation statements.

### 2. Verify Tables Created

Ensure these tables exist in your database:
- `opcua_connections`
- `modbus_connections`
- `ethernetip_connections`
- `mqtt_connections`
- `system_integrations`
- `data_bindings`
- `data_transformations`
- `connection_health`

## API Testing

### Base URL
```
http://localhost:3000/api/connectivity
```

### Authentication
For testing purposes, you may need to include authentication headers. Adjust based on your auth implementation.

## 1. OPC UA Connection Testing

### Create OPC UA Connection

```bash
curl -X POST http://localhost:3000/api/connectivity/opcua/connections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test OPC UA Server",
    "endpoint": "opc.tcp://localhost:4840",
    "securityMode": "None",
    "securityPolicy": "None",
    "username": "testuser",
    "password": "testpass",
    "timeoutMs": 30000,
    "sessionTimeoutMs": 60000,
    "keepAliveMs": 10000,
    "maxMessageSize": 65536,
    "pollingIntervalMs": 1000,
    "subscriptionSize": 1000,
    "enabled": true
  }'
```

### Get All OPC UA Connections

```bash
curl -X GET http://localhost:3000/api/connectivity/opcua/connections
```

### Get Specific OPC UA Connection

```bash
curl -X GET http://localhost:3000/api/connectivity/opcua/connections/{connectionId}
```

### Update OPC UA Connection

```bash
curl -X PUT http://localhost:3000/api/connectivity/opcua/connections/{connectionId} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated OPC UA Server",
    "pollingIntervalMs": 2000
  }'
```

### Test OPC UA Connection

```bash
curl -X POST http://localhost:3000/api/connectivity/opcua/connections/{connectionId}/test
```

### Delete OPC UA Connection

```bash
curl -X DELETE http://localhost:3000/api/connectivity/opcua/connections/{connectionId}
```

## 2. Modbus Connection Testing

### Create Modbus Connection

```bash
curl -X POST http://localhost:3000/api/connectivity/modbus/connections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Modbus Device",
    "connectionType": "tcp",
    "ipAddress": "192.168.1.100",
    "port": 502,
    "timeoutMs": 5000,
    "retryCount": 3,
    "unitId": 1,
    "pollingIntervalMs": 1000,
    "startAddress": 0,
    "registerCount": 10,
    "dataType": "uint16",
    "enabled": true
  }'
```

### Get All Modbus Connections

```bash
curl -X GET http://localhost:3000/api/connectivity/modbus/connections
```

### Test Modbus Connection

```bash
curl -X POST http://localhost:3000/api/connectivity/modbus/connections/{connectionId}/test
```

## 3. EtherNet/IP Connection Testing

### Create EtherNet/IP Connection

```bash
curl -X POST http://localhost:3000/api/connectivity/ethernetip/connections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test EtherNet/IP Device",
    "ipAddress": "192.168.1.101",
    "port": 44818,
    "timeoutMs": 10000,
    "backplaneSlot": 0,
    "vendorId": 1,
    "productCode": 0,
    "pollingIntervalMs": 100,
    "enabled": true
  }'
```

### Get All EtherNet/IP Connections

```bash
curl -X GET http://localhost:3000/api/connectivity/ethernetip/connections
```

### Test EtherNet/IP Connection

```bash
curl -X POST http://localhost:3000/api/connectivity/ethernetip/connections/{connectionId}/test
```

## 4. MQTT Connection Testing

### Create MQTT Connection

```bash
curl -X POST http://localhost:3000/api/connectivity/mqtt/connections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test MQTT Broker",
    "brokerUrl": "mqtt://localhost:1883",
    "port": 1883,
    "clientId": "ProAct_Test_Client",
    "username": "testuser",
    "password": "testpass",
    "keepAliveSeconds": 60,
    "cleanSession": true,
    "subscribeTopics": "sensors/+/temperature,devices/+/status",
    "publishTopic": "commands/device/control",
    "qosLevel": 1,
    "enabled": true
  }'
```

### Get All MQTT Connections

```bash
curl -X GET http://localhost:3000/api/connectivity/mqtt/connections
```

### Test MQTT Connection

```bash
curl -X POST http://localhost:3000/api/connectivity/mqtt/connections/{connectionId}/test
```

## 5. System Integration Testing

### Create System Integration

```bash
curl -X POST http://localhost:3000/api/connectivity/integrations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test PI Integration",
    "integrationType": "pi",
    "endpoint": "https://pi-server.company.com/piwebapi",
    "apiKey": "test-api-key",
    "username": "pi-user",
    "password": "pi-password",
    "systemType": "aveva-pi",
    "enabled": true,
    "syncIntervalSeconds": 300
  }'
```

### Get All System Integrations

```bash
curl -X GET http://localhost:3000/api/connectivity/integrations
```

### Test System Integration

```bash
curl -X POST http://localhost:3000/api/connectivity/integrations/{integrationId}/test
```

### Sync System Integration

```bash
curl -X POST http://localhost:3000/api/connectivity/integrations/{integrationId}/sync
```

## 6. Data Binding Testing

### Create Data Binding

```bash
curl -X POST http://localhost:3000/api/connectivity/bindings \
  -H "Content-Type: application/json" \
  -d '{
    "name": "OPC UA to PI Binding",
    "sourceConnectionId": "{opcua-connection-id}",
    "targetConnectionId": "{pi-integration-id}",
    "sourcePath": "ns=2;s=Device1.Temperature",
    "targetPath": "\\\\Server\\Area\\Temperature",
    "transformationRules": {
      "scaling": 1.8,
      "offset": 32
    },
    "enabled": true
  }'
```

### Get All Data Bindings

```bash
curl -X GET http://localhost:3000/api/connectivity/bindings
```

### Activate Data Binding

```bash
curl -X POST http://localhost:3000/api/connectivity/bindings/{bindingId}/activate
```

### Deactivate Data Binding

```bash
curl -X POST http://localhost:3000/api/connectivity/bindings/{bindingId}/deactivate
```

## 7. Health Monitoring Testing

### Get System Health

```bash
curl -X GET http://localhost:3000/api/connectivity/health
```

### Get Connection Health

```bash
curl -X GET http://localhost:3000/api/connectivity/health/connections
```

### Get Integration Health

```bash
curl -X GET http://localhost:3000/api/connectivity/health/integrations
```

### Run Health Check

```bash
curl -X POST http://localhost:3000/api/connectivity/health/check
```

## 8. Performance Metrics Testing

### Get All Metrics

```bash
curl -X GET http://localhost:3000/api/connectivity/metrics
```

### Get Connection Metrics

```bash
curl -X GET http://localhost:3000/api/connectivity/metrics/connections/{connectionId}
```

### Get Integration Metrics

```bash
curl -X GET http://localhost:3000/api/connectivity/metrics/integrations/{integrationId}
```

### Get Performance Metrics

```bash
curl -X GET http://localhost:3000/api/connectivity/metrics/performance
```

## 9. Real-time Data Testing

### Get Real-time Connection Data

```bash
curl -X GET http://localhost:3000/api/connectivity/realtime/connections/{connectionId}
```

### Get Real-time Integration Data

```bash
curl -X GET http://localhost:3000/api/connectivity/realtime/integrations/{integrationId}
```

## Testing Scenarios

### Scenario 1: Complete OPC UA Setup

1. Create OPC UA connection
2. Test connection
3. Create data binding to PI integration
4. Activate binding
5. Monitor health and metrics

### Scenario 2: Multi-Protocol Setup

1. Create OPC UA connection
2. Create Modbus connection
3. Create MQTT connection
4. Create system integration
5. Create multiple data bindings
6. Run health check
7. Monitor performance metrics

### Scenario 3: Error Handling

1. Create connection with invalid endpoint
2. Test connection (should fail gracefully)
3. Update connection with valid endpoint
4. Test connection again (should succeed)

## Expected Responses

### Success Response Format

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Connection Name",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Operation completed successfully"
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid connection parameters",
    "details": {
      "field": "endpoint",
      "reason": "Invalid URL format"
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure database is running and accessible
2. **Authentication**: Include proper authentication headers
3. **CORS**: Configure CORS if testing from browser
4. **Validation**: Check request body format and required fields

### Debug Mode

Enable debug logging by setting environment variable:
```bash
DEBUG=connectivity:*
```

### Log Files

Check application logs for detailed error information:
- Connection attempts
- Validation errors
- Database operations
- Service responses

## Performance Testing

### Load Testing

Use tools like Apache Bench or Artillery for load testing:

```bash
# Test connection creation endpoint
ab -n 100 -c 10 -H "Content-Type: application/json" \
  -p opcua-connection.json \
  http://localhost:3000/api/connectivity/opcua/connections
```

### Stress Testing

Test with high concurrent connections and data bindings to ensure system stability.

## Security Testing

### Authentication Testing

1. Test endpoints without authentication (should fail)
2. Test with invalid credentials (should fail)
3. Test with valid credentials (should succeed)

### Input Validation Testing

1. Test with malformed JSON
2. Test with invalid field types
3. Test with SQL injection attempts
4. Test with XSS attempts

## Integration Testing

### Frontend Integration

1. Test API endpoints from frontend application
2. Verify data flow between frontend and backend
3. Test real-time updates via WebSocket
4. Validate error handling in UI

### External System Integration

1. Test actual OPC UA server connections
2. Test real MQTT broker connections
3. Test PI system integration
4. Test CMMS system integration

## Conclusion

This testing guide provides comprehensive coverage of the Connectivity module functionality. Follow the scenarios step by step to ensure all features work correctly. For production deployment, conduct thorough load testing and security validation.

## Next Steps

1. Run database migration
2. Start backend server
3. Execute test scenarios
4. Monitor logs and performance
5. Integrate with frontend application
