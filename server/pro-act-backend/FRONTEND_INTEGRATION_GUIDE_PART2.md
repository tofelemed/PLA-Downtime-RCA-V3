# Frontend Integration Guide - Part 2: Real-time Communication & Implementation

## Real-time Communication

### WebSocket Connection

#### Connect to WebSocket
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/connectivity', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

// Connection events
socket.on('connect', () => {
  console.log('Connected to Connectivity WebSocket');
});

socket.on('disconnect', () => {
  console.log('Disconnected from Connectivity WebSocket');
});

socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

#### Listen for Real-time Updates

```typescript
// Connection status updates
socket.on('connection_status', (data) => {
  console.log('Connection status update:', data);
  // data: { connectionId, status, message, timestamp, sessionId?, error? }
  
  // Update UI based on status
  updateConnectionStatus(data.connectionId, data.status, data.message);
});

// Health updates
socket.on('health_update', (data) => {
  console.log('Health update:', data);
  // data: { connectionType, status, metrics, timestamp }
  
  // Update health dashboard
  updateHealthDashboard(data);
});

// Data updates
socket.on('data_update', (data) => {
  console.log('Data update:', data);
  // data: { connectionId, type, data, timestamp }
  
  // Update real-time data display
  updateRealTimeData(data);
});
```

#### Emit Events

```typescript
// Request connection test
socket.emit('test_connection', {
  connectionId: 'uuid',
  protocol: 'opcua'
});

// Subscribe to specific connection updates
socket.emit('subscribe_connection', {
  connectionId: 'uuid'
});

// Unsubscribe from connection updates
socket.emit('unsubscribe_connection', {
  connectionId: 'uuid'
});
```

## Frontend Integration Patterns

### 1. Connection Management Component

```typescript
// React component for managing connections
import React, { useState, useEffect } from 'react';
import { useConnectivity } from '../hooks/useConnectivity';

interface ConnectionManagerProps {
  protocol: 'opcua' | 'modbus' | 'ethernetip' | 'mqtt' | 'dnp3' | 'profinet' | 'scada';
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({ protocol }) => {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { 
    getConnections, 
    createConnection, 
    updateConnection, 
    deleteConnection, 
    testConnection 
  } = useConnectivity(protocol);

  useEffect(() => {
    loadConnections();
  }, [protocol]);

  const loadConnections = async () => {
    setLoading(true);
    try {
      const data = await getConnections();
      setConnections(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (connectionData) => {
    try {
      await createConnection(connectionData);
      await loadConnections();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTest = async (connectionId) => {
    try {
      const result = await testConnection(connectionId);
      // Show test result in UI
      showTestResult(result);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="connection-manager">
      <h2>{protocol.toUpperCase()} Connections</h2>
      
      {error && <div className="error">{error}</div>}
      
      <ConnectionForm 
        protocol={protocol} 
        onSubmit={handleCreate} 
      />
      
      <ConnectionList 
        connections={connections}
        onTest={handleTest}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};
```

### 2. Custom Hook for Connectivity

```typescript
// Custom hook for connectivity operations
import { useState, useCallback } from 'react';
import { apiClient } from '../utils/apiClient';

export const useConnectivity = (protocol: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getConnections = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/connectivity/${protocol}/connections`);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [protocol]);

  const createConnection = useCallback(async (connectionData) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.post(`/connectivity/${protocol}/connections`, connectionData);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [protocol]);

  const updateConnection = useCallback(async (connectionId, updateData) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.put(`/connectivity/${protocol}/connections/${connectionId}`, updateData);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [protocol]);

  const deleteConnection = useCallback(async (connectionId) => {
    setLoading(true);
    setError(null);
    
    try {
      await apiClient.delete(`/connectivity/${protocol}/connections/${connectionId}`);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [protocol]);

  const testConnection = useCallback(async (connectionId) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.post(`/connectivity/${protocol}/connections/${connectionId}/test`);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [protocol]);

  return {
    loading,
    error,
    getConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection
  };
};
```

### 3. Health Dashboard Component

```typescript
// Health monitoring dashboard
import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

export const HealthDashboard: React.FC = () => {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const { socket, connected } = useWebSocket();

  useEffect(() => {
    loadHealthData();
    
    if (socket) {
      socket.on('health_update', handleHealthUpdate);
      socket.on('connection_status', handleConnectionStatus);
      
      return () => {
        socket.off('health_update', handleHealthUpdate);
        socket.off('connection_status', handleConnectionStatus);
      };
    }
  }, [socket]);

  const loadHealthData = async () => {
    try {
      const response = await fetch('/api/connectivity/health', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      setHealthData(data.data);
    } catch (err) {
      console.error('Failed to load health data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleHealthUpdate = (data) => {
    setHealthData(prev => ({
      ...prev,
      connections: {
        ...prev.connections,
        [data.connectionType]: {
          ...prev.connections[data.connectionType],
          ...data.metrics
        }
      }
    }));
  };

  const handleConnectionStatus = (data) => {
    // Update specific connection status
    updateConnectionStatus(data);
  };

  if (loading) return <div>Loading health data...</div>;

  return (
    <div className="health-dashboard">
      <h2>System Health Overview</h2>
      
      <div className="health-summary">
        <div className={`status-indicator ${healthData.overallStatus}`}>
          {healthData.overallStatus.toUpperCase()}
        </div>
        <div className="last-checked">
          Last checked: {new Date(healthData.lastChecked).toLocaleString()}
        </div>
      </div>

      <div className="protocol-status">
        {Object.entries(healthData.connections).map(([protocol, status]) => (
          <ProtocolStatusCard 
            key={protocol}
            protocol={protocol}
            status={status}
          />
        ))}
      </div>

      <div className="integration-status">
        {Object.entries(healthData.integrations).map(([type, status]) => (
          <IntegrationStatusCard 
            key={type}
            type={type}
            status={status}
          />
        ))}
      </div>
    </div>
  );
};
```

## Data Models & Types

### TypeScript Interfaces

```typescript
// Connection base interface
interface BaseConnection {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// OPC UA Connection
interface OPCUAConnection extends BaseConnection {
  endpoint: string;
  securityMode: 'None' | 'Sign' | 'SignAndEncrypt';
  securityPolicy: string;
  username?: string;
  password?: string;
  timeoutMs: number;
  sessionTimeoutMs: number;
  keepAliveMs: number;
  maxMessageSize: number;
  pollingIntervalMs: number;
  subscriptionSize: number;
}

// Modbus Connection
interface ModbusConnection extends BaseConnection {
  connectionType: 'tcp' | 'rtu' | 'ascii';
  ipAddress?: string;
  port?: number;
  serialPort?: string;
  baudRate?: number;
  timeoutMs: number;
  retryCount: number;
  unitId: number;
  pollingIntervalMs: number;
  startAddress: number;
  registerCount: number;
  dataType: string;
}

// Connection Health
interface ConnectionHealth {
  id: string;
  connectionType: string;
  status: 'connected' | 'disconnected' | 'error' | 'unknown';
  errorMessage?: string;
  metrics: Record<string, any>;
  checkedAt: Date;
}

// WebSocket Events
interface ConnectionStatusEvent {
  connectionId: string;
  status: string;
  message: string;
  timestamp: Date;
  sessionId?: string;
  error?: string;
}

interface HealthUpdateEvent {
  connectionType: string;
  status: string;
  metrics: Record<string, any>;
  timestamp: Date;
}
```

## Error Handling

### API Error Response Format

```typescript
interface APIError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}
```

### Common Error Codes

```typescript
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR'
};
```

### Error Handling in Components

```typescript
const handleError = (error: any) => {
  if (error.response?.data?.error) {
    const apiError = error.response.data.error;
    
    switch (apiError.code) {
      case 'VALIDATION_ERROR':
        showValidationErrors(apiError.details);
        break;
      case 'CONNECTION_FAILED':
        showConnectionError(apiError.message);
        break;
      case 'AUTHENTICATION_FAILED':
        redirectToLogin();
        break;
      default:
        showGenericError(apiError.message);
    }
  } else {
    showGenericError('An unexpected error occurred');
  }
};
```

## Authentication & Security

### JWT Token Management

```typescript
// Token storage and management
class TokenManager {
  private static readonly TOKEN_KEY = 'connectivity_token';
  private static readonly REFRESH_KEY = 'connectivity_refresh_token';

  static setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem(this.TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_KEY, refreshToken);
  }

  static getAccessToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
  }

  static clearTokens() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
  }

  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}
```

### API Client with Authentication

```typescript
// API client with automatic token handling
class APIClient {
  private baseURL: string;
  private tokenManager: TokenManager;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.tokenManager = new TokenManager();
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = this.tokenManager.getAccessToken();
    
    if (token && this.tokenManager.isTokenExpired(token)) {
      await this.refreshToken();
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      await this.refreshToken();
      // Retry request with new token
      return this.request(endpoint, options);
    }

    return response;
  }

  private async refreshToken() {
    const refreshToken = this.tokenManager.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const { accessToken, refreshToken: newRefreshToken } = await response.json();
        this.tokenManager.setTokens(accessToken, newRefreshToken);
      } else {
        this.tokenManager.clearTokens();
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      this.tokenManager.clearTokens();
      throw error;
    }
  }

  async get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async put(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}
```

## Implementation Examples

### 1. Connection Form Component

```typescript
// Generic connection form component
import React, { useState } from 'react';

interface ConnectionFormProps {
  protocol: string;
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  protocol,
  initialData,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState(initialData || getDefaultData(protocol));
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getDefaultData = (protocol: string) => {
    const defaults = {
      opcua: {
        name: '',
        endpoint: '',
        securityMode: 'None',
        securityPolicy: 'None',
        timeoutMs: 30000,
        sessionTimeoutMs: 60000,
        keepAliveMs: 10000,
        maxMessageSize: 65536,
        pollingIntervalMs: 1000,
        subscriptionSize: 1000,
        enabled: true
      },
      modbus: {
        name: '',
        connectionType: 'tcp',
        ipAddress: '',
        port: 502,
        timeoutMs: 5000,
        retryCount: 3,
        unitId: 1,
        pollingIntervalMs: 1000,
        startAddress: 0,
        registerCount: 100,
        dataType: 'uint16',
        enabled: true
      }
      // Add other protocols...
    };
    return defaults[protocol] || {};
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      await onSubmit(formData);
    } catch (error) {
      if (error.response?.data?.error?.details) {
        setErrors(error.response.data.error.details);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderFields = () => {
    switch (protocol) {
      case 'opcua':
        return (
          <>
            <FormField
              label="Name"
              name="name"
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              error={errors.name}
              required
            />
            <FormField
              label="Endpoint"
              name="endpoint"
              value={formData.endpoint}
              onChange={(value) => setFormData({ ...formData, endpoint: value })}
              error={errors.endpoint}
              placeholder="opc.tcp://server:4840"
              required
            />
            <FormField
              label="Security Mode"
              name="securityMode"
              type="select"
              value={formData.securityMode}
              onChange={(value) => setFormData({ ...formData, securityMode: value })}
              options={[
                { value: 'None', label: 'None' },
                { value: 'Sign', label: 'Sign' },
                { value: 'SignAndEncrypt', label: 'Sign and Encrypt' }
              ]}
            />
            {/* Add other OPC UA fields */}
          </>
        );
      case 'modbus':
        return (
          <>
            <FormField
              label="Name"
              name="name"
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              error={errors.name}
              required
            />
            <FormField
              label="Connection Type"
              name="connectionType"
              type="select"
              value={formData.connectionType}
              onChange={(value) => setFormData({ ...formData, connectionType: value })}
              options={[
                { value: 'tcp', label: 'TCP' },
                { value: 'rtu', label: 'RTU' },
                { value: 'ascii', label: 'ASCII' }
              ]}
            />
            {/* Add other Modbus fields */}
          </>
        );
      default:
        return <div>Unsupported protocol: {protocol}</div>;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="connection-form">
      <h3>Create {protocol.toUpperCase()} Connection</h3>
      
      {renderFields()}
      
      <div className="form-actions">
        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Connection'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
};
```

### 2. Real-time Data Display

```typescript
// Real-time data display component
import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface RealTimeDataProps {
  connectionId: string;
  protocol: string;
}

export const RealTimeData: React.FC<RealTimeDataProps> = ({
  connectionId,
  protocol
}) => {
  const [data, setData] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  
  const { socket } = useWebSocket();

  useEffect(() => {
    if (socket && connectionId) {
      // Subscribe to connection updates
      socket.emit('subscribe_connection', { connectionId });
      
      socket.on('data_update', handleDataUpdate);
      socket.on('connection_status', handleConnectionStatus);
      
      return () => {
        socket.emit('unsubscribe_connection', { connectionId });
        socket.off('data_update', handleDataUpdate);
        socket.off('connection_status', handleConnectionStatus);
      };
    }
  }, [socket, connectionId]);

  const handleDataUpdate = (updateData: any) => {
    if (updateData.connectionId === connectionId) {
      setData(prev => [...prev, updateData].slice(-100)); // Keep last 100 updates
    }
  };

  const handleConnectionStatus = (statusData: any) => {
    if (statusData.connectionId === connectionId) {
      setConnected(statusData.status === 'connected');
    }
  };

  const renderData = () => {
    switch (protocol) {
      case 'opcua':
        return data.map((item, index) => (
          <div key={index} className="data-item">
            <span className="timestamp">{new Date(item.timestamp).toLocaleTimeString()}</span>
            <span className="node">{item.data.nodeId}</span>
            <span className="value">{item.data.value}</span>
            <span className="quality">{item.data.quality}</span>
          </div>
        ));
      case 'modbus':
        return data.map((item, index) => (
          <div key={index} className="data-item">
            <span className="timestamp">{new Date(item.timestamp).toLocaleTimeString()}</span>
            <span className="address">{item.data.address}</span>
            <span className="value">{item.data.value}</span>
            <span className="type">{item.data.type}</span>
          </div>
        ));
      default:
        return <div>Unsupported protocol for real-time display</div>;
    }
  };

  return (
    <div className="real-time-data">
      <div className="header">
        <h3>Real-time Data - {protocol.toUpperCase()}</h3>
        <div className={`status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
      
      <div className="data-container">
        {data.length === 0 ? (
          <div className="no-data">No data available</div>
        ) : (
          renderData()
        )}
      </div>
    </div>
  );
};
```

## Testing & Validation

### 1. Connection Testing

```typescript
// Test connection functionality
const testConnection = async (connectionId: string, protocol: string) => {
  try {
    setTesting(connectionId);
    
    const response = await apiClient.post(`/connectivity/${protocol}/connections/${connectionId}/test`);
    
    if (response.data.success) {
      showSuccess(`Connection test successful: ${response.data.data.message}`);
      
      // Update connection status in UI
      updateConnectionStatus(connectionId, response.data.data.status);
      
      // If successful, start real-time monitoring
      if (response.data.data.status === 'connected') {
        startRealTimeMonitoring(connectionId, protocol);
      }
    }
  } catch (error) {
    showError(`Connection test failed: ${error.message}`);
  } finally {
    setTesting(null);
  }
};
```

### 2. Data Validation

```typescript
// Validate connection data before submission
const validateConnectionData = (data: any, protocol: string): string[] => {
  const errors: string[] = [];
  
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name is required');
  }
  
  switch (protocol) {
    case 'opcua':
      if (!data.endpoint || !isValidOPCUAEndpoint(data.endpoint)) {
        errors.push('Valid OPC UA endpoint is required (opc.tcp://server:port)');
      }
      if (data.timeoutMs && (data.timeoutMs < 1000 || data.timeoutMs > 60000)) {
        errors.push('Timeout must be between 1000ms and 60000ms');
      }
      break;
      
    case 'modbus':
      if (data.connectionType === 'tcp') {
        if (!data.ipAddress || !isValidIPAddress(data.ipAddress)) {
          errors.push('Valid IP address is required for TCP connections');
        }
        if (!data.port || data.port < 1 || data.port > 65535) {
          errors.push('Valid port number is required (1-65535)');
        }
      }
      break;
      
    case 'mqtt':
      if (!data.brokerUrl || !isValidURL(data.brokerUrl)) {
        errors.push('Valid broker URL is required');
      }
      break;
  }
  
  return errors;
};

const isValidOPCUAEndpoint = (endpoint: string): boolean => {
  const pattern = /^opc\.tcp:\/\/[^:]+:\d+$/;
  return pattern.test(endpoint);
};

const isValidIPAddress = (ip: string): boolean => {
  const pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return pattern.test(ip);
};

const isValidURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
```

## Troubleshooting

### Common Issues & Solutions

#### 1. WebSocket Connection Issues

```typescript
// WebSocket connection troubleshooting
const troubleshootWebSocket = () => {
  // Check if WebSocket is supported
  if (!window.WebSocket) {
    console.error('WebSocket not supported in this browser');
    return false;
  }
  
  // Check connection status
  if (!socket.connected) {
    console.error('WebSocket not connected');
    
    // Try to reconnect
    socket.connect();
    return false;
  }
  
  // Check authentication
  const token = TokenManager.getAccessToken();
  if (!token) {
    console.error('No authentication token available');
    return false;
  }
  
  return true;
};
```

#### 2. API Authentication Issues

```typescript
// Handle authentication errors
const handleAuthError = async (error: any) => {
  if (error.response?.status === 401) {
    // Token expired, try to refresh
    try {
      await refreshToken();
      // Retry original request
      return retryRequest();
    } catch (refreshError) {
      // Refresh failed, redirect to login
      redirectToLogin();
    }
  }
  
  if (error.response?.status === 403) {
    showError('Insufficient permissions to perform this action');
  }
};
```

#### 3. Connection Testing Issues

```typescript
// Enhanced connection testing with retry logic
const testConnectionWithRetry = async (connectionId: string, protocol: string, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await testConnection(connectionId, protocol);
      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      
      console.log(`Connection test attempt ${attempt} failed, retrying...`);
    }
  }
};
```

### Debug Mode

```typescript
// Enable debug mode for troubleshooting
const enableDebugMode = () => {
  if (process.env.NODE_ENV === 'development') {
    // Enable detailed logging
    console.log('Debug mode enabled');
    
    // Log all WebSocket events
    if (socket) {
      socket.onAny((eventName, ...args) => {
        console.log(`WebSocket Event: ${eventName}`, args);
      });
    }
    
    // Log all API requests
    apiClient.enableLogging();
  }
};
```

## Conclusion

This integration guide provides comprehensive details for connecting your frontend with the ProAct Connectivity Module. The module offers:

- **8 Industrial Protocols**: OPC UA, Modbus, EtherNet/IP, MQTT, BACnet, DNP3, Profinet, SCADA
- **Real-time Communication**: WebSocket-based status updates and monitoring
- **Comprehensive APIs**: RESTful endpoints for all operations
- **Health Monitoring**: Real-time connection status and performance metrics
- **Error Handling**: Robust error handling and recovery mechanisms
- **Security**: JWT-based authentication and authorization

Follow the patterns and examples provided to integrate the connectivity module seamlessly with your frontend application. The modular architecture ensures scalability and maintainability for future protocol additions.

For additional support or questions, refer to the backend API documentation or contact the development team.
