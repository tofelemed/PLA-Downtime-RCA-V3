# Real Protocol Communication Implementation Guide

## Overview

This guide explains how the Connectivity module implements **real protocol communication** using actual industrial protocol libraries, not just CRUD operations. The system now supports live data exchange with OPC UA servers, Modbus devices, MQTT brokers, and other industrial protocols.

## Architecture

### 1. **Protocol Client Services**
Real protocol communication is handled by dedicated client services:

- **`OPCUAClientService`** - Real OPC UA communication using `node-opcua`
- **`ModbusClientService`** - Real Modbus communication using `modbus-serial`
- **`MQTTClientService`** - Real MQTT communication using `mqtt` library
- **`EtherNetIPClientService`** - Real EtherNet/IP communication (planned)

### 2. **WebSocket Gateway**
- **`ConnectivityGateway`** - Real-time data streaming to frontend via WebSocket
- Handles client subscriptions to specific connections
- Broadcasts live data updates to subscribed clients

### 3. **Real-time Controller**
- **`ConnectivityRealtimeController`** - API endpoints for live protocol operations
- Connect/disconnect to real devices
- Read/write data in real-time
- Subscribe to live data streams

## Protocol Implementation Details

### OPC UA Communication

#### **Libraries Used:**
```json
{
  "node-opcua": "^2.115.0"
}
```

#### **Features:**
- **Real OPC UA Client**: Connects to actual OPC UA servers
- **Session Management**: Handles OPC UA sessions with keep-alive
- **Security**: Supports None, Sign, and SignAndEncrypt security modes
- **Data Reading**: Reads real-time data from OPC UA nodes
- **Data Writing**: Writes values to OPC UA nodes
- **Subscriptions**: Real-time monitoring with data change notifications
- **Browse**: Can browse server address space (planned)

#### **Example Usage:**
```typescript
// Connect to OPC UA server
await opcuaClientService.connect('connection-id');

// Read data points
const dataPoints = await opcuaClientService.readDataPoints('connection-id', [
  'ns=2;s=Device1.Temperature',
  'ns=2;s=Device1.Pressure'
]);

// Write data point
await opcuaClientService.writeDataPoint('connection-id', 'ns=2;s=Device1.Setpoint', 75.5);

// Subscribe to real-time updates
await opcuaClientService.subscribeToNodes('connection-id', ['ns=2;s=Device1.Temperature']);
```

#### **Real-time Data Flow:**
1. **Frontend** subscribes to connection via WebSocket
2. **OPC UA Client** connects to real OPC UA server
3. **Data Changes** trigger WebSocket broadcasts to frontend
4. **Frontend** receives live data updates in real-time

### Modbus Communication

#### **Libraries Used:**
```json
{
  "modbus-serial": "^8.0.16",
  "serialport": "^12.0.0"
}
```

#### **Features:**
- **Modbus TCP**: Network-based Modbus communication
- **Modbus RTU**: Serial-based Modbus communication
- **Multiple Function Codes**: Read/Write holding registers, input registers, coils, discrete inputs
- **Real-time Polling**: Configurable polling intervals
- **Error Handling**: Robust error detection and recovery

#### **Example Usage:**
```typescript
// Connect to Modbus device
await modbusClientService.connect('connection-id');

// Read holding registers
const registers = await modbusClientService.readHoldingRegisters('connection-id', 0, 10);

// Read coils
const coils = await modbusClientService.readCoils('connection-id', 0, 16);

// Write single register
await modbusClientService.writeSingleRegister('connection-id', 0, 100);

// Write single coil
await modbusClientService.writeSingleCoil('connection-id', 0, true);
```

#### **Real-time Data Flow:**
1. **Modbus Client** connects to real Modbus device (TCP/RTU)
2. **Polling** reads data at configured intervals
3. **Data Changes** trigger WebSocket broadcasts
4. **Frontend** receives live register/coil values

### MQTT Communication

#### **Libraries Used:**
```json
{
  "mqtt": "^5.3.4"
}
```

#### **Features:**
- **Real MQTT Client**: Connects to actual MQTT brokers
- **Publish/Subscribe**: Full MQTT messaging capabilities
- **QoS Levels**: Support for QoS 0, 1, and 2
- **Topic Management**: Dynamic topic subscription/unsubscription
- **Message Handling**: Real-time message processing and forwarding

#### **Example Usage:**
```typescript
// Connect to MQTT broker
await mqttClientService.connect('connection-id');

// Subscribe to topics
await mqttClientService.subscribeToTopics('connection-id', [
  'sensors/+/temperature',
  'devices/+/status'
]);

// Publish message
await mqttClientService.publishMessage('connection-id', 'commands/device/start', 'start');

// Unsubscribe from topics
await mqttClientService.unsubscribeFromTopics('connection-id', ['sensors/+/temperature']);
```

#### **Real-time Data Flow:**
1. **MQTT Client** connects to real MQTT broker
2. **Subscriptions** receive messages from subscribed topics
3. **Message Processing** triggers WebSocket broadcasts
4. **Frontend** receives live MQTT messages

## WebSocket Real-time Communication

### **Gateway Features:**
- **Connection Management**: Handles client connections and disconnections
- **Topic-based Subscriptions**: Clients can subscribe to specific connections
- **Real-time Broadcasting**: Broadcasts data to subscribed clients
- **Event Handling**: Processes data requests from frontend

### **Frontend Integration:**
```typescript
// Connect to WebSocket
const socket = io('/connectivity');

// Subscribe to connection data
socket.emit('subscribe_connection', {
  connectionId: 'opcua-connection-1',
  protocol: 'opcua'
});

// Listen for real-time data
socket.on('connection_data', (data) => {
  console.log('Real-time data:', data);
  // Update UI with live data
});

// Request data
socket.emit('request_data', {
  connectionId: 'opcua-connection-1',
  nodes: ['ns=2;s=Device1.Temperature']
});
```

## API Endpoints for Real Protocol Communication

### **OPC UA Real-time Endpoints:**
```
POST /api/connectivity/opcua/connections/:id/connect
POST /api/connectivity/opcua/connections/:id/disconnect
POST /api/connectivity/opcua/connections/:id/read
POST /api/connectivity/opcua/connections/:id/write
POST /api/connectivity/opcua/connections/:id/subscribe
GET  /api/connectivity/opcua/connections/:id/status
```

### **Modbus Real-time Endpoints:**
```
POST /api/connectivity/modbus/connections/:id/connect
POST /api/connectivity/modbus/connections/:id/disconnect
POST /api/connectivity/modbus/connections/:id/read-holding
POST /api/connectivity/modbus/connections/:id/read-input
POST /api/connectivity/modbus/connections/:id/read-coils
POST /api/connectivity/modbus/connections/:id/write-register
POST /api/connectivity/modbus/connections/:id/write-coil
GET  /api/connectivity/modbus/connections/:id/status
```

### **MQTT Real-time Endpoints:**
```
POST /api/connectivity/mqtt/connections/:id/connect
POST /api/connectivity/mqtt/connections/:id/disconnect
POST /api/connectivity/mqtt/connections/:id/subscribe
POST /api/connectivity/mqtt/connections/:id/unsubscribe
POST /api/connectivity/mqtt/connections/:id/publish
GET  /api/connectivity/mqtt/connections/:id/status
```

### **System Status Endpoints:**
```
GET /api/connectivity/status/all
GET /api/connectivity/status/active
```

## Data Flow Architecture

### **1. Configuration Phase:**
```
Frontend → API → Database
- Create connection configurations
- Store protocol parameters
- Set up data bindings
```

### **2. Connection Phase:**
```
Frontend → Real-time API → Protocol Client → Real Device
- Connect to actual industrial devices
- Establish protocol sessions
- Start data polling/subscriptions
```

### **3. Data Exchange Phase:**
```
Real Device → Protocol Client → WebSocket Gateway → Frontend
- Live data reading/writing
- Real-time data streaming
- Event-driven updates
```

### **4. Monitoring Phase:**
```
Protocol Client → Health Service → WebSocket Gateway → Frontend
- Connection status monitoring
- Performance metrics
- Error detection and reporting
```

## Installation and Setup

### **1. Install Protocol Libraries:**
```bash
npm install node-opcua modbus-serial mqtt serialport ws
npm install --save-dev @types/ws
```

### **2. Database Setup:**
```sql
-- Run connectivity-migration.sql
-- Creates tables for connection configurations
```

### **3. Start Backend:**
```bash
npm run start:dev
```

### **4. Test Real Protocol Communication:**
```bash
# Test OPC UA connection
curl -X POST http://localhost:3000/api/connectivity/opcua/connections/{id}/connect

# Test Modbus connection
curl -X POST http://localhost:3000/api/connectivity/modbus/connections/{id}/connect

# Test MQTT connection
curl -X POST http://localhost:3000/api/connectivity/mqtt/connections/{id}/connect
```

## Frontend Integration

### **1. WebSocket Connection:**
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/connectivity');

// Subscribe to connection updates
socket.emit('subscribe_connection', {
  connectionId: 'your-connection-id',
  protocol: 'opcua'
});

// Listen for real-time data
socket.on('connection_data', (data) => {
  // Handle live data updates
  updateUI(data);
});
```

### **2. API Calls for Real Protocol Operations:**
```typescript
// Connect to OPC UA server
const response = await fetch('/api/connectivity/opcua/connections/123/connect', {
  method: 'POST'
});

// Read real-time data
const data = await fetch('/api/connectivity/opcua/connections/123/read', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nodeIds: ['ns=2;s=Device1.Temperature']
  })
});
```

## Security Considerations

### **1. Authentication:**
- All endpoints require authentication
- Protocol credentials are encrypted in database
- Session management for protocol connections

### **2. Network Security:**
- TLS/SSL for secure protocol connections
- Firewall configuration for industrial networks
- VPN support for remote access

### **3. Data Protection:**
- Sensitive data encryption
- Audit logging for all operations
- Role-based access control

## Performance Optimization

### **1. Connection Pooling:**
- Reuse protocol connections
- Connection lifecycle management
- Automatic reconnection on failures

### **2. Data Caching:**
- Cache frequently accessed data
- Optimize polling intervals
- Batch data operations

### **3. WebSocket Optimization:**
- Efficient message broadcasting
- Client-side data filtering
- Compression for large datasets

## Troubleshooting

### **Common Issues:**

1. **Protocol Connection Failures:**
   - Check network connectivity
   - Verify protocol parameters
   - Review authentication credentials

2. **WebSocket Connection Issues:**
   - Check CORS configuration
   - Verify WebSocket URL
   - Review client-side implementation

3. **Data Not Updating:**
   - Check subscription status
   - Verify polling intervals
   - Review error logs

### **Debug Mode:**
```bash
DEBUG=connectivity:* npm run start:dev
```

## Future Enhancements

### **Planned Features:**
1. **EtherNet/IP Support**: Real EtherNet/IP communication
2. **Profinet Support**: Profinet protocol implementation
3. **BACnet Support**: Building automation protocol
4. **DNP3 Support**: Utility protocol support
5. **Data Historian**: Time-series data storage
6. **Advanced Analytics**: Real-time data analysis
7. **Edge Computing**: Local data processing

## Conclusion

The Connectivity module now provides **real industrial protocol communication** with:

- ✅ **Live OPC UA** communication with actual servers
- ✅ **Real Modbus** communication with industrial devices
- ✅ **Active MQTT** messaging with IoT brokers
- ✅ **WebSocket streaming** for real-time frontend updates
- ✅ **Comprehensive API** for protocol operations
- ✅ **Robust error handling** and connection management
- ✅ **Security features** for industrial environments

This implementation enables true industrial connectivity with live data exchange, real-time monitoring, and seamless frontend integration.
