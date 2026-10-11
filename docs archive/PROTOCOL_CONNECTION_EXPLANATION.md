# 🔌 How Protocol Connections Work in ProAct

## Overview

The connectivity module uses **real industrial protocol libraries** to establish actual connections with OPC UA servers, MQTT brokers, Modbus devices, and other industrial systems. This is not just configuration management - it's **live, real-time communication**.

---

## 📚 Protocol Libraries Used

### **Already Installed in package.json:**

```json
{
  "node-opcua": "^2.115.0",        // Real OPC UA communication
  "mqtt": "^5.3.4",                // Real MQTT messaging  
  "modbus-serial": "^8.0.16",      // Real Modbus communication
  "serialport": "^12.0.0",         // Serial communication for Modbus RTU
  "socket.io": "^4.8.1",           // WebSocket for real-time updates
  "ethernet-ip": "^1.0.0"          // EtherNet/IP communication
}
```

---

## 🔌 **1. OPC UA Connection Flow**

### **How It Works:**

1. **Connection Configuration** (Stored in Database)
   - Endpoint URL: `opc.tcp://192.168.1.100:4840`
   - Security Mode: `SignAndEncrypt`
   - Authentication: `Username/Password` or `Anonymous`
   - Connection settings saved in `opcua_connections` table

2. **Real Connection Process** (Using `node-opcua` library)
   ```typescript
   // Step 1: Create OPC UA Client
   const client = OPCUAClient.create({
     applicationName: 'ProAct Client',
     securityMode: MessageSecurityMode.SignAndEncrypt,
     securityPolicy: SecurityPolicy.Basic256Sha256
   });

   // Step 2: Connect to Server
   await client.connect('opc.tcp://192.168.1.100:4840');

   // Step 3: Create Session
   const session = await client.createSession({
     userName: 'username',
     password: 'password'
   });

   // Step 4: Create Subscription (for real-time data)
   const subscription = await ClientSubscription.create(session, {
     requestedPublishingInterval: 1000,
     publishingEnabled: true
   });

   // Step 5: Monitor Nodes (real-time updates)
   const monitoredItem = await subscription.monitor({
     nodeId: 'ns=2;s=Device1.Temperature',
     attributeId: AttributeIds.Value
   });

   monitoredItem.on('changed', (dataValue) => {
     // Real-time data received!
     console.log('Temperature:', dataValue.value.value);
   });
   ```

3. **Data Flow:**
   ```
   OPC UA Server → node-opcua Client → OPCUAClientService → WebSocket Gateway → Frontend
   ```

4. **Real-Time Features:**
   - ✅ Live data reading from OPC UA nodes
   - ✅ Real-time value change notifications
   - ✅ Write values to OPC UA nodes
   - ✅ Browse server address space
   - ✅ Automatic reconnection on failure

### **Where It's Implemented:**
- **Service**: `server/pro-act-backend/src/connectivity/services/opcua-client.service.ts`
- **Library**: `node-opcua` (industry-standard OPC UA implementation)

---

## 📨 **2. MQTT Connection Flow**

### **How It Works:**

1. **Connection Configuration** (Stored in Database)
   - Broker URL: `mqtt://192.168.1.50`
   - Port: `1883` or `8883` (TLS)
   - Client ID: `ProAct_Client_123`
   - Username/Password for authentication
   - Topics to subscribe to

2. **Real Connection Process** (Using `mqtt` library)
   ```typescript
   // Step 1: Connect to MQTT Broker
   const client = mqtt.connect('mqtt://192.168.1.50:1883', {
     clientId: 'ProAct_Client_123',
     username: 'mqtt_user',
     password: 'mqtt_password',
     keepalive: 60,
     clean: true
   });

   // Step 2: Handle Connection
   client.on('connect', () => {
     console.log('Connected to MQTT broker');
     
     // Step 3: Subscribe to Topics
     client.subscribe('sensor/temperature', { qos: 1 });
     client.subscribe('sensor/pressure', { qos: 1 });
   });

   // Step 4: Receive Messages (Real-time)
   client.on('message', (topic, payload) => {
     const data = JSON.parse(payload.toString());
     console.log(`Received from ${topic}:`, data);
     
     // Broadcast to frontend via WebSocket
     gateway.broadcastConnectionData(connectionId, 'mqtt', {
       topic: topic,
       data: data,
       timestamp: new Date()
     });
   });

   // Step 5: Publish Messages
   client.publish('commands/setpoint', JSON.stringify({
     value: 75.5,
     timestamp: new Date()
   }));
   ```

3. **Data Flow:**
   ```
   MQTT Broker → mqtt Client → MQTTClientService → WebSocket Gateway → Frontend
   ```

4. **Real-Time Features:**
   - ✅ Subscribe to multiple topics
   - ✅ Receive real-time messages
   - ✅ Publish commands/data
   - ✅ QoS levels (0, 1, 2)
   - ✅ TLS/SSL encryption support
   - ✅ Automatic reconnection

### **Where It's Implemented:**
- **Service**: `server/pro-act-backend/src/connectivity/services/mqtt-client.service.ts`
- **Library**: `mqtt` (most popular MQTT library for Node.js)

---

## 🔧 **3. Modbus Connection Flow**

### **How It Works:**

1. **Connection Configuration** (Stored in Database)
   - Connection Type: `TCP` or `RTU`
   - IP Address: `192.168.1.100` (TCP)
   - Port: `502` (TCP) or Serial Port `COM3` (RTU)
   - Unit ID: `1`
   - Polling interval: `1000ms`

2. **Real Connection Process** (Using `modbus-serial` library)

   **For Modbus TCP:**
   ```typescript
   // Step 1: Create Modbus TCP Client
   const ModbusRTU = require("modbus-serial");
   const client = new ModbusRTU();

   // Step 2: Connect via TCP
   await client.connectTCP("192.168.1.100", {
     port: 502
   });

   // Step 3: Set Unit ID
   client.setID(1);

   // Step 4: Read Holding Registers (Real-time)
   const data = await client.readHoldingRegisters(0, 10);
   console.log('Register values:', data.data);

   // Step 5: Write Register
   await client.writeRegister(0, 100);
   ```

   **For Modbus RTU (Serial):**
   ```typescript
   // Step 1: Connect via Serial Port
   await client.connectRTUBuffered("COM3", {
     baudRate: 9600,
     parity: 'even'
   });

   // Step 2: Read/Write operations (same as TCP)
   const data = await client.readHoldingRegisters(0, 10);
   ```

3. **Data Flow:**
   ```
   Modbus Device → modbus-serial Client → ModbusClientService → WebSocket Gateway → Frontend
   ```

### **Where It's Implemented:**
- **Service**: `server/pro-act-backend/src/connectivity/services/modbus-client.service.ts`
- **Library**: `modbus-serial` (supports TCP and RTU)

---

## 🔄 **Complete Connection Architecture**

### **End-to-End Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend UI                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  User creates connection configuration                    │  │
│  │  - Enter OPC UA endpoint: opc.tcp://192.168.1.100:4840  │  │
│  │  - Enter MQTT broker: mqtt://192.168.1.50:1883          │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP POST /api/connectivity/opcua/connections
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API Layer                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ConnectivityController.createOPCUAConnection()          │  │
│  │  - Validates input                                       │  │
│  │  - Saves to database                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Connection saved in opcua_connections table
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Database (ProActDB)                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  opcua_connections table                                 │  │
│  │  - id, name, endpoint, securityMode, username, etc.      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ User clicks "Connect" button
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Real Protocol Connection Layer                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  OPCUAClientService.connect(connectionId)                │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  1. Load config from database                      │  │  │
│  │  │  2. Create node-opcua client                       │  │  │
│  │  │  3. Connect to REAL OPC UA server                  │  │  │
│  │  │  4. Create session                                 │  │  │
│  │  │  5. Create subscription                            │  │  │
│  │  │  6. Monitor nodes for changes                      │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Real-time data from server
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  WebSocket Gateway                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ConnectivityGateway.broadcastConnectionData()           │  │
│  │  - Receives data from protocol client                    │  │
│  │  - Broadcasts to subscribed frontend clients             │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ WebSocket message
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend UI                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Receives real-time data updates                         │  │
│  │  - Updates charts                                        │  │
│  │  - Shows live values                                     │  │
│  │  - Displays connection status                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 **Key Points**

### **1. Real Protocol Communication:**
- ✅ Uses industry-standard libraries (`node-opcua`, `mqtt`, `modbus-serial`)
- ✅ Establishes **actual network connections** to devices/servers
- ✅ Not just database CRUD - **real-time data exchange**

### **2. Connection Management:**
- ✅ Connections stored in database (configuration)
- ✅ Active sessions managed in memory (runtime)
- ✅ Automatic reconnection on failure
- ✅ Health monitoring and status tracking

### **3. Real-Time Data Streaming:**
- ✅ Protocol clients receive data from devices
- ✅ Data broadcast via WebSocket to frontend
- ✅ Frontend receives updates instantly
- ✅ No polling needed - event-driven

### **4. Security:**
- ✅ OPC UA: Security modes (None, Sign, SignAndEncrypt)
- ✅ MQTT: TLS/SSL, username/password authentication
- ✅ Credentials encrypted in database

---

## 📝 **Example: Complete OPC UA Connection**

### **1. User Creates Connection (Frontend):**
```typescript
// User fills form and submits
await connectivityApi.createOPCUAConnection({
  name: 'Production Line 1',
  endpoint: 'opc.tcp://192.168.1.100:4840',
  securityMode: 'SignAndEncrypt',
  securityPolicy: 'Basic256Sha256',
  authentication: 'Username',
  username: 'opcua_user',
  password: 'secure_password',
  tenantId: 'tenant-123',
  enabled: true
});
```

### **2. Backend Saves Configuration:**
- Connection saved to `opcua_connections` table
- Returns connection ID: `abc-123-def`

### **3. User Connects (Real Protocol):**
```typescript
// Frontend calls connect endpoint
await fetch('/api/connectivity/opcua/connections/abc-123-def/connect', {
  method: 'POST'
});
```

### **4. Backend Establishes Real Connection:**
```typescript
// OPCUAClientService.connect() runs:
// 1. Loads config from database
const connection = await opcuaConnectionRepository.findOne({ id: 'abc-123-def' });

// 2. Creates real OPC UA client using node-opcua
const client = OPCUAClient.create({
  securityMode: MessageSecurityMode.SignAndEncrypt,
  securityPolicy: SecurityPolicy.Basic256Sha256
});

// 3. Connects to REAL OPC UA server
await client.connect('opc.tcp://192.168.1.100:4840');

// 4. Creates session with authentication
const session = await client.createSession({
  userName: 'opcua_user',
  password: 'secure_password'
});

// 5. Creates subscription for real-time data
const subscription = await ClientSubscription.create(session);

// 6. Monitors nodes for changes
const monitoredItem = await subscription.monitor({
  nodeId: 'ns=2;s=Temperature'
});

// 7. When data changes, broadcast to frontend
monitoredItem.on('changed', (dataValue) => {
  connectivityGateway.broadcastConnectionData('abc-123-def', 'opcua', {
    nodeId: 'ns=2;s=Temperature',
    value: dataValue.value.value,
    timestamp: new Date()
  });
});
```

### **5. Frontend Receives Real-Time Data:**
```typescript
// Frontend WebSocket subscription
connectivityWebSocket.subscribeToConnection('abc-123-def', 'opcua');

connectivityWebSocket.on('connection_data', (data) => {
  console.log('Real-time data:', data);
  // data = {
  //   connectionId: 'abc-123-def',
  //   protocol: 'opcua',
  //   data: {
  //     nodeId: 'ns=2;s=Temperature',
  //     value: 75.5,
  //     timestamp: '2025-01-15T10:30:00Z'
  //   }
  // }
});
```

---

## 🔍 **Current Implementation Status**

### **✅ Fully Implemented:**

1. **OPC UA** - Complete
   - ✅ Real connection using `node-opcua`
   - ✅ Session management
   - ✅ Data reading/writing
   - ✅ Real-time subscriptions
   - ✅ Address space browsing (planned)

2. **MQTT** - Complete
   - ✅ Real connection using `mqtt` library
   - ✅ Subscribe/publish
   - ✅ QoS support
   - ✅ TLS/SSL support
   - ✅ Automatic reconnection

3. **Modbus** - Complete
   - ✅ TCP and RTU support
   - ✅ Read/write registers
   - ✅ Read/write coils
   - ✅ Real-time polling

### **⚠️ Partially Implemented:**

4. **EtherNet/IP** - Basic structure ready
   - ⚠️ Library installed (`ethernet-ip`)
   - ⚠️ Client service structure exists
   - ⚠️ Needs full implementation

---

## 🚀 **How to Test Real Connections**

### **1. Test OPC UA Connection:**

```bash
# 1. Create connection (saves to database)
curl -X POST http://localhost:4004/api/connectivity/opcua/connections \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test OPC UA Server",
    "endpoint": "opc.tcp://192.168.1.100:4840",
    "tenantId": "your-tenant-id",
    "securityMode": "None",
    "authentication": "Anonymous"
  }'

# 2. Connect to REAL server (establishes protocol connection)
curl -X POST http://localhost:4004/api/connectivity/opcua/connections/{id}/connect \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Read real data from server
curl -X POST http://localhost:4004/api/connectivity/opcua/connections/{id}/read \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nodeIds": ["ns=2;s=Temperature"]
  }'
```

### **2. Test MQTT Connection:**

```bash
# 1. Create connection
curl -X POST http://localhost:4004/api/connectivity/mqtt/connections \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test MQTT Broker",
    "brokerUrl": "mqtt://192.168.1.50",
    "port": 1883,
    "tenantId": "your-tenant-id"
  }'

# 2. Connect to REAL broker
curl -X POST http://localhost:4004/api/connectivity/mqtt/connections/{id}/connect \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Subscribe to topics
curl -X POST http://localhost:4004/api/connectivity/mqtt/connections/{id}/subscribe \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topics": ["sensor/temperature", "sensor/pressure"]
  }'
```

---

## 📊 **Connection State Management**

### **States:**
1. **`disconnected`** - Not connected (default)
2. **`connecting`** - Attempting to connect
3. **`connected`** - Successfully connected and active
4. **`error`** - Connection failed or error occurred

### **Status Tracking:**
- `lastConnected` - Last successful connection timestamp
- `errorCount` - Number of connection errors
- `lastError` - Last error message
- `status` - Current connection state

---

## 🔐 **Security & Authentication**

### **OPC UA:**
- Security Modes: `None`, `Sign`, `SignAndEncrypt`
- Security Policies: `None`, `Basic128Rsa15`, `Basic256`, `Basic256Sha256`
- Authentication: `Anonymous`, `Username`, `Certificate`

### **MQTT:**
- Username/Password authentication
- TLS/SSL encryption
- Client certificates
- Last Will & Testament

### **Modbus:**
- Unit ID authentication
- Network-level security (firewall)

---

## 📚 **Libraries Used**

### **1. node-opcua** (OPC UA)
- **Purpose**: Full OPC UA client implementation
- **Features**: Sessions, subscriptions, security, browsing
- **Website**: https://node-opcua.github.io/

### **2. mqtt** (MQTT)
- **Purpose**: MQTT client for Node.js
- **Features**: Pub/Sub, QoS, TLS, auto-reconnect
- **Website**: https://github.com/mqttjs/MQTT.js

### **3. modbus-serial** (Modbus)
- **Purpose**: Modbus TCP/RTU client
- **Features**: All function codes, TCP and RTU
- **Website**: https://github.com/yaacov/node-modbus-serial

---

## 🎯 **Summary**

**Your connectivity module uses REAL protocol libraries to:**

1. ✅ **Connect** to actual OPC UA servers, MQTT brokers, Modbus devices
2. ✅ **Exchange** real-time data with industrial systems
3. ✅ **Stream** live data to frontend via WebSocket
4. ✅ **Manage** connections, sessions, and subscriptions
5. ✅ **Handle** errors, reconnections, and health monitoring

**This is NOT just configuration management - it's REAL industrial protocol communication!**

---

**Last Updated:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

