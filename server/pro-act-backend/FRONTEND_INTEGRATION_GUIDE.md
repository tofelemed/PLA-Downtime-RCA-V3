# Frontend Integration Guide - Connectivity Module

## Overview

This document provides comprehensive integration details for connecting your frontend application with the ProAct Connectivity Module backend. The module provides a unified interface for managing industrial protocols, system integrations, and real-time connectivity monitoring.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [API Endpoints Reference](#api-endpoints-reference)
3. [Real-time Communication](#real-time-communication)
4. [Frontend Integration Patterns](#frontend-integration-patterns)
5. [Data Models & Types](#data-models--types)
6. [Error Handling](#error-handling)
7. [Authentication & Security](#authentication--security)
8. [Implementation Examples](#implementation-examples)
9. [Testing & Validation](#testing--validation)
10. [Troubleshooting](#troubleshooting)

## Architecture Overview

### Backend Structure
```
src/connectivity/
├── controllers/          # REST API endpoints
├── services/            # Business logic for each protocol
├── entities/            # Database models
├── gateways/            # WebSocket real-time communication
├── dto/                 # Data transfer objects
└── interfaces/          # TypeScript interfaces
```

### Frontend Integration Points
- **REST APIs**: CRUD operations for connections and configurations
- **WebSocket**: Real-time status updates and monitoring
- **Health Monitoring**: Connection status and performance metrics
- **Protocol Management**: Individual protocol configuration and testing

## API Endpoints Reference

### Base URL
```
http://localhost:3000/api/connectivity
```

### Authentication Headers
```typescript
const headers = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer YOUR_JWT_TOKEN'
};
```

### 1. OPC UA Connections

#### Create OPC UA Connection
```typescript
POST /opcua/connections
Content-Type: application/json

{
  "name": "Production Line OPC UA",
  "endpoint": "opc.tcp://192.168.1.100:4840",
  "securityMode": "None",
  "securityPolicy": "None",
  "username": "operator",
  "password": "secure123",
  "timeoutMs": 30000,
  "sessionTimeoutMs": 60000,
  "keepAliveMs": 10000,
  "maxMessageSize": 65536,
  "pollingIntervalMs": 1000,
  "subscriptionSize": 1000,
  "enabled": true
}
```

#### Get All OPC UA Connections
```typescript
GET /opcua/connections
Authorization: Bearer YOUR_JWT_TOKEN

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Production Line OPC UA",
      "endpoint": "opc.tcp://192.168.1.100:4840",
      "status": "connected",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Test OPC UA Connection
```typescript
POST /opcua/connections/{connectionId}/test
Authorization: Bearer YOUR_JWT_TOKEN

Response:
{
  "success": true,
  "data": {
    "status": "connected",
    "message": "Successfully connected to OPC UA server",
    "sessionId": "opcua_1704067200000_abc123",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. Modbus Connections

#### Create Modbus Connection
```typescript
POST /modbus/connections
Content-Type: application/json

{
  "name": "PLC Modbus Device",
  "connectionType": "tcp",
  "ipAddress": "192.168.1.101",
  "port": 502,
  "timeoutMs": 5000,
  "retryCount": 3,
  "unitId": 1,
  "pollingIntervalMs": 1000,
  "startAddress": 0,
  "registerCount": 100,
  "dataType": "uint16",
  "enabled": true
}
```

#### Test Modbus Connection
```typescript
POST /modbus/connections/{connectionId}/test
Authorization: Bearer YOUR_JWT_TOKEN
```

### 3. EtherNet/IP Connections

#### Create EtherNet/IP Connection
```typescript
POST /ethernetip/connections
Content-Type: application/json

{
  "name": "Allen Bradley PLC",
  "ipAddress": "192.168.1.102",
  "port": 44818,
  "timeoutMs": 10000,
  "backplaneSlot": 0,
  "vendorId": 1,
  "productCode": 0,
  "pollingIntervalMs": 100,
  "enabled": true
}
```

### 4. MQTT Connections

#### Create MQTT Connection
```typescript
POST /mqtt/connections
Content-Type: application/json

{
  "name": "IoT MQTT Broker",
  "brokerUrl": "mqtt://192.168.1.103",
  "port": 1883,
  "clientId": "ProAct_MQTT_Client",
  "username": "mqtt_user",
  "password": "mqtt_pass",
  "keepAliveSeconds": 60,
  "cleanSession": true,
  "subscribeTopics": "sensors/+/temperature,devices/+/status",
  "publishTopic": "commands/device/control",
  "qosLevel": 1,
  "enabled": true
}
```

### 5. System Integrations

#### Create System Integration
```typescript
POST /integrations
Content-Type: application/json

{
  "name": "Aveva PI Integration",
  "integrationType": "pi",
  "endpoint": "https://pi-server.company.com/piwebapi",
  "apiKey": "your-api-key",
  "username": "pi-user",
  "password": "pi-password",
  "systemType": "aveva-pi",
  "enabled": true,
  "syncIntervalSeconds": 300
}
```

### 6. Health Monitoring

#### Get System Health
```typescript
GET /health
Authorization: Bearer YOUR_JWT_TOKEN

Response:
{
  "success": true,
  "data": {
    "overallStatus": "healthy",
    "connections": {
      "opcua": { "total": 5, "connected": 4, "failed": 1 },
      "modbus": { "total": 3, "connected": 3, "failed": 0 },
      "ethernetip": { "total": 2, "connected": 2, "failed": 0 },
      "mqtt": { "total": 1, "connected": 1, "failed": 0 }
    },
    "integrations": {
      "pi": { "status": "connected", "lastSync": "2024-01-01T00:00:00.000Z" },
      "cmms": { "status": "connected", "lastSync": "2024-01-01T00:00:00.000Z" }
    },
    "lastChecked": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Get Connection Health
```typescript
GET /health/connections
Authorization: Bearer YOUR_JWT_TOKEN

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "connectionType": "opcua",
      "status": "connected",
      "errorMessage": null,
      "metrics": {
        "ipAddress": "192.168.1.100",
        "port": 4840,
        "responseTime": 45,
        "lastActivity": "2024-01-01T00:00:00.000Z"
      },
      "checkedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```
