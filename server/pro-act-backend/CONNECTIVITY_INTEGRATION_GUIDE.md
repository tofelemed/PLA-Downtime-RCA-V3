# Connectivity Module Integration Guide

This guide provides comprehensive instructions for integrating the Connectivity module backend with your frontend application.

## Overview

The Connectivity module provides a complete backend implementation for managing industrial communication protocols, system integrations, and data flows. This guide covers how to integrate it with your existing frontend application.

## Prerequisites

1. **Backend Setup**: Ensure the connectivity module is properly installed and configured
2. **Database Migration**: Run the connectivity migration script
3. **Dependencies**: Install required npm packages
4. **Authentication**: Ensure proper authentication is configured

## Installation Steps

### 1. Database Migration

Run the connectivity migration script to create all necessary tables:

```sql
-- Execute the connectivity-migration.sql script
-- This creates all tables, indexes, and sample data
```

### 2. Install Dependencies

```bash
cd server/pro-act-backend
npm install bcrypt @types/bcrypt
```

### 3. Update App Module

The connectivity module is already added to the app module. Verify it's included:

```typescript
// src/app.module.ts
import { ConnectivityModule } from './connectivity/connectivity.module';

@Module({
  imports: [
    // ... other modules
    ConnectivityModule,
  ],
})
export class AppModule {}
```

## API Integration

### Base URL

All connectivity endpoints are prefixed with `/api/connectivity`:

```
Base URL: http://localhost:3000/api/connectivity
```

### Authentication

All endpoints require Bearer token authentication:

```typescript
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

## Frontend Integration Examples

### 1. OPC UA Connection Management

#### Create OPC UA Connection

```typescript
const createOPCUAConnection = async (connectionData: any) => {
  const response = await fetch('/api/connectivity/opcua/connections', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Production OPC UA Server',
      endpoint: 'opc.tcp://192.168.1.100:4840',
      securityMode: 'SignAndEncrypt',
      securityPolicy: 'Basic256Sha256',
      username: 'admin',
      password: 'password123',
      timeoutMs: 30000,
      sessionTimeoutMs: 60000,
      keepAliveMs: 10000,
      pollingIntervalMs: 1000,
      subscriptionSize: 1000,
      tenantId: tenantId
    })
  });
  
  return await response.json();
};
```

#### Test OPC UA Connection

```typescript
const testOPCUAConnection = async (connectionId: string) => {
  const response = await fetch(`/api/connectivity/opcua/connections/${connectionId}/test`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      endpoint: 'opc.tcp://192.168.1.100:4840',
      username: 'admin',
      password: 'password123'
    })
  });
  
  return await response.json();
};
```

#### Browse OPC UA Address Space

```typescript
const browseOPCUAAddressSpace = async (connectionId: string, nodeId: string = 'i=84') => {
  const response = await fetch(`/api/connectivity/opcua/connections/${connectionId}/browse?nodeId=${nodeId}&tenantId=${tenantId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};
```

### 2. Modbus Connection Management

#### Create Modbus Connection

```typescript
const createModbusConnection = async (connectionData: any) => {
  const response = await fetch('/api/connectivity/modbus/connections', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Modbus TCP Device',
      connectionType: 'tcp',
      ipAddress: '192.168.1.101',
      port: 502,
      unitId: 1,
      timeoutMs: 5000,
      retryCount: 3,
      pollingIntervalMs: 1000,
      startAddress: 0,
      registerCount: 10,
      dataType: 'uint16',
      tenantId: tenantId
    })
  });
  
  return await response.json();
};
```

#### Read Modbus Registers

```typescript
const readModbusRegisters = async (connectionId: string, startAddress: number, count: number) => {
  const response = await fetch(`/api/connectivity/modbus/connections/${connectionId}/registers?startAddress=${startAddress}&count=${count}&tenantId=${tenantId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};
```

### 3. MQTT Connection Management

#### Create MQTT Connection

```typescript
const createMQTTConnection = async (connectionData: any) => {
  const response = await fetch('/api/connectivity/mqtt/connections', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'IoT MQTT Broker',
      brokerUrl: 'mqtt://192.168.1.103:1883',
      port: 1883,
      clientId: 'ProAct_Client',
      username: 'iot_user',
      password: 'password123',
      keepAliveSeconds: 60,
      cleanSession: true,
      subscribeTopics: 'sensors/+,devices/+',
      publishTopic: 'commands/device/control',
      qosLevel: 1,
      tenantId: tenantId
    })
  });
  
  return await response.json();
};
```

#### Publish MQTT Message

```typescript
const publishMQTTMessage = async (connectionId: string, topic: string, message: string) => {
  const response = await fetch(`/api/connectivity/mqtt/connections/${connectionId}/publish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      topic: topic,
      message: message,
      qos: 1,
      retain: false
    })
  });
  
  return await response.json();
};
```

### 4. System Integration Management

#### Create PI Integration

```typescript
const createPIIntegration = async (integrationData: any) => {
  const response = await fetch('/api/connectivity/integrations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'PI Event Frames',
      integrationType: 'PI',
      endpoint: 'https://pi-server.company.com/piwebapi',
      username: 'pi_user',
      password: 'password123',
      systemType: 'Aveva PI',
      syncIntervalSeconds: 300,
      tenantId: tenantId
    })
  });
  
  return await response.json();
};
```

#### Sync System Integration

```typescript
const syncSystemIntegration = async (integrationId: string, forceFullSync: boolean = false) => {
  const response = await fetch(`/api/connectivity/integrations/${integrationId}/sync`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      forceFullSync: forceFullSync
    })
  });
  
  return await response.json();
};
```

### 5. Data Binding Management

#### Create Data Binding

```typescript
const createDataBinding = async (bindingData: any) => {
  const response = await fetch('/api/connectivity/bindings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Modbus to PI Binding',
      description: 'Bind Modbus data to PI Event Frames',
      sourceModbusConnectionId: 'modbus-connection-uuid',
      targetSystemIntegrationId: 'pi-integration-uuid',
      sourcePath: 'registers/0-10',
      targetPath: 'eventframes/production',
      pollingIntervalMs: 1000,
      triggerMode: 'scheduled',
      enabled: true,
      tenantId: tenantId
    })
  });
  
  return await response.json();
};
```

#### Activate Data Binding

```typescript
const activateDataBinding = async (bindingId: string) => {
  const response = await fetch(`/api/connectivity/bindings/${bindingId}/activate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  
  return await response.json();
};
```

### 6. Health Monitoring

#### Get System Health

```typescript
const getSystemHealth = async () => {
  const response = await fetch(`/api/connectivity/health?tenantId=${tenantId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};
```

#### Perform Health Check

```typescript
const performHealthCheck = async () => {
  const response = await fetch(`/api/connectivity/health/check?tenantId=${tenantId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};
```

### 7. Protocol Overview

#### Get Protocol Overview

```typescript
const getProtocolOverview = async () => {
  const response = await fetch(`/api/connectivity/overview?tenantId=${tenantId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};
```

#### Get Data Flow Overview

```typescript
const getDataFlowOverview = async () => {
  const response = await fetch(`/api/connectivity/dataflow/overview?tenantId=${tenantId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};
```

## React Hook Examples

### Custom Hook for Connectivity Management

```typescript
import { useState, useEffect } from 'react';

export const useConnectivity = (tenantId: string) => {
  const [connections, setConnections] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/connectivity/overview?tenantId=${tenantId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setConnections(data.protocols);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
    try {
      const response = await fetch(`/api/connectivity/health?tenantId=${tenantId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setHealth(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchConnections();
    fetchHealth();
  }, [tenantId]);

  return {
    connections,
    health,
    loading,
    error,
    refetch: fetchConnections,
    refreshHealth: fetchHealth
  };
};
```

### Custom Hook for Connection Management

```typescript
export const useConnectionManager = (protocolType: string, tenantId: string) => {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/connectivity/${protocolType}/connections?tenantId=${tenantId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setConnections(data);
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const createConnection = async (connectionData: any) => {
    try {
      const response = await fetch(`/api/connectivity/${protocolType}/connections`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(connectionData)
      });
      const data = await response.json();
      await fetchConnections(); // Refresh the list
      return data;
    } catch (err) {
      console.error('Failed to create connection:', err);
      throw err;
    }
  };

  const testConnection = async (connectionId: string, testData: any = {}) => {
    try {
      const response = await fetch(`/api/connectivity/${protocolType}/connections/${connectionId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      });
      return await response.json();
    } catch (err) {
      console.error('Failed to test connection:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [protocolType, tenantId]);

  return {
    connections,
    loading,
    createConnection,
    testConnection,
    refetch: fetchConnections
  };
};
```

## Error Handling

### Global Error Handler

```typescript
const handleConnectivityError = (error: any) => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    switch (status) {
      case 400:
        return `Validation Error: ${data.message}`;
      case 401:
        return 'Authentication required';
      case 403:
        return 'Access denied';
      case 404:
        return 'Connection not found';
      case 500:
        return 'Internal server error';
      default:
        return `Error ${status}: ${data.message}`;
    }
  } else if (error.request) {
    // Network error
    return 'Network error - please check your connection';
  } else {
    // Other error
    return error.message || 'An unexpected error occurred';
  }
};
```

## Real-time Updates

### WebSocket Integration

```typescript
import { io } from 'socket.io-client';

export const useConnectivityWebSocket = (tenantId: string) => {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({});

  useEffect(() => {
    const newSocket = io('ws://localhost:3000', {
      auth: { token }
    });

    newSocket.on('connectivity:health_update', (data) => {
      setConnectionStatus(prev => ({
        ...prev,
        [data.connectionId]: data.status
      }));
    });

    newSocket.on('connectivity:connection_status', (data) => {
      setConnectionStatus(prev => ({
        ...prev,
        [data.connectionId]: data.status
      }));
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [tenantId]);

  return { socket, connectionStatus };
};
```

## Testing

### Unit Test Example

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConnectivityController } from './connectivity.controller';
import { ConnectivityService } from './connectivity.service';

describe('ConnectivityController', () => {
  let controller: ConnectivityController;
  let service: ConnectivityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConnectivityController],
      providers: [
        {
          provide: ConnectivityService,
          useValue: {
            getOPCUAConnections: jest.fn(),
            createOPCUAConnection: jest.fn(),
            testOPCUAConnection: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ConnectivityController>(ConnectivityController);
    service = module.get<ConnectivityService>(ConnectivityService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get OPC UA connections', async () => {
    const mockConnections = [
      { id: '1', name: 'Test Connection', endpoint: 'opc.tcp://test:4840' }
    ];
    
    jest.spyOn(service, 'getOPCUAConnections').mockResolvedValue(mockConnections);

    const result = await controller.getOPCUAConnections('tenant-id');
    expect(result).toEqual(mockConnections);
  });
});
```

## Performance Optimization

### Connection Pooling

```typescript
// Implement connection pooling for better performance
const connectionPool = new Map();

const getConnection = async (connectionId: string) => {
  if (connectionPool.has(connectionId)) {
    return connectionPool.get(connectionId);
  }
  
  // Create new connection
  const connection = await createConnection(connectionId);
  connectionPool.set(connectionId, connection);
  return connection;
};
```

### Caching

```typescript
// Implement caching for frequently accessed data
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedData = async (key: string, fetchFn: () => Promise<any>) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};
```

## Security Considerations

1. **Authentication**: Always include Bearer token in requests
2. **Input Validation**: Validate all user inputs on the frontend
3. **Error Handling**: Don't expose sensitive information in error messages
4. **HTTPS**: Use HTTPS in production environments
5. **Rate Limiting**: Implement rate limiting for API calls

## Troubleshooting

### Common Issues

1. **Connection Timeouts**: Check network connectivity and firewall settings
2. **Authentication Errors**: Verify token validity and permissions
3. **Database Errors**: Ensure database migration is complete
4. **CORS Issues**: Configure CORS properly for cross-origin requests

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
DEBUG=connectivity:*
```

## Support

For additional support:

1. Check the API documentation at `/api/docs`
2. Review the connectivity module README
3. Check the database migration script
4. Verify all dependencies are installed

## Conclusion

This integration guide provides comprehensive instructions for integrating the Connectivity module with your frontend application. The module offers a complete solution for managing industrial communication protocols and system integrations with robust monitoring and health checking capabilities.

Follow the examples provided to implement the connectivity features in your application, and refer to the troubleshooting section for common issues and solutions.
