import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Settings, 
  Database, 
  Wifi, 
  Server, 
  Zap, 
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
  Edit,
  Play,
  Pause,
  RotateCcw,
  Filter,
  Zap as Transform,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { globalProtocolManager, ProtocolType, ProtocolConnection } from '@/services/integrations/ProtocolManager';
import { ConnectionConfig, TransformConfig, FilterConfig } from '@/services/integrations/base/IConnector';
import { DataTransformationPanel } from './DataTransformationPanel';
import { RealTimePipelineMonitoring } from './RealTimePipelineMonitoring';
import { DataFlowVisualization } from './DataFlowVisualization';
import { globalEventBus } from '@/services/events/EventBus';

interface DataSourceForm {
  name: string;
  type: ProtocolType;
  endpoint: string;
  port: number;
  username?: string;
  password?: string;
  description?: string;
  enabled: boolean;
  options: Record<string, any>;
  // Protocol-specific fields
  opcua?: {
    securityMode: 'None' | 'Sign' | 'SignAndEncrypt';
    securityPolicy: 'None' | 'Basic128Rsa15' | 'Basic256' | 'Basic256Sha256';
    authentication: 'Anonymous' | 'Username' | 'Certificate';
    certificatePath?: string;
    privateKeyPath?: string;
    requestTimeout: number;
    keepAliveInterval: number;
    reconnectInterval: number;
    maxReconnectAttempts: number;
  };
  mqtt?: {
    clientId: string;
    keepalive: number;
    reconnectPeriod: number;
    connectTimeout: number;
    clean: boolean;
    qos: 0 | 1 | 2;
    retain: boolean;
    willTopic?: string;
    willPayload?: string;
    willQos?: 0 | 1 | 2;
    willRetain?: boolean;
  };
  database?: {
    databaseName: string;
    connectionTimeout: number;
    queryTimeout: number;
    maxConnections: number;
    ssl: boolean;
    sslMode?: 'require' | 'verify-ca' | 'verify-full';
  };
  modbus?: {
    unitId: number;
    timeout: number;
    retries: number;
    scanRate: number;
  };
  websocket?: {
    protocols: string[];
    headers: Record<string, string>;
    heartbeat: number;
  };
  scada?: {
    pollingInterval: number;
    timeout: number;
    retries: number;
    bufferSize: number;
    realTime: boolean;
  };
  bacnet?: {
    deviceId: number;
    vendorId: number;
    timeout: number;
    retries: number;
    bbmd: boolean;
  };
  dnp3?: {
    outstationAddress: number;
    masterAddress: number;
    timeout: number;
    retries: number;
    secureAuthentication: boolean;
  };
  ethernetip?: {
    slot: number;
    timeout: number;
    retries: number;
    scanRate: number;
    cipSecurity: boolean;
  };
  profinet?: {
    deviceName: string;
    timeout: number;
    retries: number;
    scanRate: number;
    realTime: boolean;
  };
  restapi?: {
    basePath: string;
    timeout: number;
    retries: number;
    rateLimit: number;
    sslVerify: boolean;
  };
}

const defaultPorts: Record<ProtocolType, number> = {
  websocket: 80,
  mqtt: 1883,
  opcua: 4840,
  database: 1433,
  scada: 502,
  bacnet: 47808,
  dnp3: 20000,
  modbus: 502,
  ethernetip: 44818,
  profinet: 34964,
  restapi: 80
};

const protocolDescriptions: Record<ProtocolType, string> = {
  websocket: 'Real-time bidirectional communication',
  mqtt: 'Lightweight messaging protocol for IoT',
  opcua: 'Industrial automation data exchange',
  database: 'Structured data storage and querying',
  scada: 'Supervisory control and data acquisition',
  bacnet: 'Building automation and control networks',
  dnp3: 'Distributed Network Protocol 3',
  modbus: 'Industrial communication protocol',
  ethernetip: 'Industrial Ethernet protocol',
  profinet: 'Process Field Network',
  restapi: 'Representational State Transfer API'
};

export const DataSourceManager: React.FC = () => {
  const { toast } = useToast();
  const [connections, setConnections] = useState<Map<string, ProtocolConnection>>(new Map());
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [activeTab, setActiveTab] = useState('connections');
  const [formData, setFormData] = useState<DataSourceForm>({
    name: '',
    type: 'websocket',
    endpoint: '',
    port: 80,
    username: '',
    password: '',
    description: '',
    enabled: true,
    options: {},
    opcua: {
      securityMode: 'None',
      securityPolicy: 'None',
      authentication: 'Anonymous',
      requestTimeout: 30000,
      keepAliveInterval: 10000,
      reconnectInterval: 5000,
      maxReconnectAttempts: 5
    },
    mqtt: {
      clientId: `mqtt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      keepalive: 60,
      reconnectPeriod: 1000,
      connectTimeout: 30000,
      clean: true,
      qos: 1,
      retain: false
    },
    database: {
      databaseName: '',
      connectionTimeout: 30000,
      queryTimeout: 60000,
      maxConnections: 10,
      ssl: false
    },
    modbus: {
      unitId: 1,
      timeout: 5000,
      retries: 3,
      scanRate: 1000
    },
    websocket: {
      protocols: [],
      headers: {},
      heartbeat: 30000
    },
    scada: {
      pollingInterval: 1000,
      timeout: 5000,
      retries: 3,
      bufferSize: 1024,
      realTime: true
    },
    bacnet: {
      deviceId: 1,
      vendorId: 0,
      timeout: 3000,
      retries: 2,
      bbmd: false
    },
    dnp3: {
      outstationAddress: 1,
      masterAddress: 1,
      timeout: 5000,
      retries: 3,
      secureAuthentication: false
    },
    ethernetip: {
      slot: 0,
      timeout: 5000,
      retries: 3,
      scanRate: 100,
      cipSecurity: false
    },
    profinet: {
      deviceName: '',
      timeout: 5000,
      retries: 3,
      scanRate: 100,
      realTime: true
    },
    restapi: {
      basePath: '',
      timeout: 30000,
      retries: 3,
      rateLimit: 1000,
      sslVerify: true
    }
  });

  useEffect(() => {
    loadConnections();
    
    // Listen for connection events to refresh the display
    const handleConnectionEvent = () => {
      console.log('🔄 DataSourceManager: Connection event received, refreshing connections...');
      loadConnections();
    };
    
    // Subscribe to connection events
    const subscriptionCreated = globalEventBus.subscribe('protocol.connection.created', handleConnectionEvent);
    const subscriptionRestored = globalEventBus.subscribe('opcua.manager.connection.restored', handleConnectionEvent);
    const subscriptionRemoved = globalEventBus.subscribe('protocol.connection.removed', handleConnectionEvent);
    
    // Also refresh after a delay to catch restored connections
    const refreshTimer = setTimeout(() => {
      console.log('🔄 DataSourceManager: Refreshing connections after delay...');
      loadConnections();
    }, 3000);
    
    return () => {
      globalEventBus.unsubscribe(subscriptionCreated.id);
      globalEventBus.unsubscribe(subscriptionRestored.id);
      globalEventBus.unsubscribe(subscriptionRemoved.id);
      clearTimeout(refreshTimer);
    };
  }, []);

  const loadConnections = () => {
    console.log('🔄 DataSourceManager: Loading connections...');
    const allConnections = globalProtocolManager.getAllConnections();
    console.log('📊 DataSourceManager: Found connections:', allConnections);
    console.log('📊 DataSourceManager: Connection count:', allConnections.size);
    
    // Log each connection
    for (const [id, conn] of allConnections.entries()) {
      console.log(`  - ${id}: ${conn.name} (${conn.type}) - Connected: ${conn.connector?.isConnected?.() || 'unknown'}`);
    }
    
    setConnections(allConnections);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const connectionId = editingConnection || `conn_${Date.now()}`;
      
      // Create endpoint based on protocol type
      let endpoint: string;
      if (formData.type === 'restapi') {
        // For REST API, use the full URL format
        const protocol = formData.port === 443 ? 'https' : 'http';
        endpoint = `${protocol}://${formData.endpoint}${formData.port !== 80 && formData.port !== 443 ? `:${formData.port}` : ''}`;
      } else {
        // For other protocols, use the standard format
        endpoint = `${formData.type}://${formData.endpoint}:${formData.port}`;
      }

      // Prepare protocol-specific options
      const protocolOptions: Record<string, any> = {
        description: formData.description
      };

      // Add protocol-specific options based on type
      switch (formData.type) {
        case 'opcua':
          protocolOptions.opcua = formData.opcua;
          break;
        case 'mqtt':
          protocolOptions.mqtt = formData.mqtt;
          break;
        case 'database':
          protocolOptions.database = formData.database;
          break;
        case 'modbus':
          protocolOptions.modbus = formData.modbus;
          break;
        case 'websocket':
          protocolOptions.websocket = formData.websocket;
          break;
        case 'scada':
          protocolOptions.scada = formData.scada;
          break;
        case 'bacnet':
          protocolOptions.bacnet = formData.bacnet;
          break;
        case 'dnp3':
          protocolOptions.dnp3 = formData.dnp3;
          break;
        case 'ethernetip':
          protocolOptions.ethernetip = formData.ethernetip;
          break;
        case 'profinet':
          protocolOptions.profinet = formData.profinet;
          break;
        case 'restapi':
          protocolOptions.restapi = formData.restapi;
          break;
      }

      const config: ConnectionConfig = {
        id: connectionId,
        name: formData.name,
        type: formData.type,
        endpoint: endpoint,
        enabled: formData.enabled,
        authentication: formData.username ? {
          type: 'basic',
          username: formData.username,
          password: formData.password || ''
        } : undefined,
        options: {
          ...formData.options,
          ...protocolOptions
        }
      };

      if (editingConnection) {
        // Remove existing connection first
        await globalProtocolManager.removeConnection(editingConnection);
      }

      // Create new connection
      await globalProtocolManager.createConnection(
        connectionId,
        formData.type,
        config,
        formData.options
      );

      toast({
        title: 'Success',
        description: `Data source ${editingConnection ? 'updated' : 'created'} successfully`,
      });

      setIsFormOpen(false);
      setEditingConnection(null);
      resetForm();
      loadConnections();

    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${editingConnection ? 'update' : 'create'} data source: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (connectionId: string) => {
    const connection = connections.get(connectionId);
    if (!connection) return;

    // Parse endpoint properly
    const endpoint = connection.config.endpoint;
    let host = '';
    let port = defaultPorts[connection.type];
    
    if (connection.type === 'restapi') {
      // For REST API, endpoint is the full URL
      try {
        const url = new URL(endpoint);
        host = url.hostname;
        port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);
      } catch {
        host = endpoint;
      }
    } else {
      // For other protocols, parse the endpoint format
      const parts = endpoint.split('://');
      if (parts.length > 1) {
        const hostPort = parts[1];
        const hostPortParts = hostPort.split(':');
        host = hostPortParts[0];
        if (hostPortParts.length > 1) {
          port = parseInt(hostPortParts[1]) || defaultPorts[connection.type];
        }
      }
    }
    
    // Load protocol-specific options from existing connection
    const loadProtocolOptions = () => {
      const options = connection.config.options || {};
      switch (connection.type) {
        case 'opcua':
          return {
            opcua: {
              securityMode: (options.opcua?.securityMode === 'Sign' || options.opcua?.securityMode === 'SignAndEncrypt') ? options.opcua.securityMode : 'None',
              securityPolicy: (options.opcua?.securityPolicy === 'Basic128Rsa15' || options.opcua?.securityPolicy === 'Basic256' || options.opcua?.securityPolicy === 'Basic256Sha256') ? options.opcua.securityPolicy : 'None',
              authentication: (options.opcua?.authentication === 'Username' || options.opcua?.authentication === 'Certificate') ? options.opcua.authentication : 'Anonymous',
              requestTimeout: options.opcua?.requestTimeout || 30000,
              keepAliveInterval: options.opcua?.keepAliveInterval || 10000,
              reconnectInterval: options.opcua?.reconnectInterval || 5000,
              maxReconnectAttempts: options.opcua?.maxReconnectAttempts || 5
            }
          };
        case 'mqtt':
          return {
            mqtt: {
              clientId: options.mqtt?.clientId || `mqtt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              keepalive: options.mqtt?.keepalive || 60,
              reconnectPeriod: options.mqtt?.reconnectPeriod || 1000,
              connectTimeout: options.mqtt?.connectTimeout || 30000,
              clean: options.mqtt?.clean ?? true,
              qos: (options.mqtt?.qos === 0 || options.mqtt?.qos === 2) ? options.mqtt.qos : 1,
              retain: options.mqtt?.retain ?? false
            }
          };
        case 'database':
          return {
            database: {
              databaseName: options.database?.databaseName || '',
              connectionTimeout: options.database?.connectionTimeout || 30000,
              queryTimeout: options.database?.queryTimeout || 60000,
              maxConnections: options.database?.maxConnections || 10,
              ssl: options.database?.ssl ?? false,
              sslMode: options.database?.sslMode
            }
          };
        case 'modbus':
          return {
            modbus: {
              unitId: options.modbus?.unitId || 1,
              timeout: options.modbus?.timeout || 5000,
              retries: options.modbus?.retries || 3,
              scanRate: options.modbus?.scanRate || 1000
            }
          };
        case 'websocket':
          return {
            websocket: {
              protocols: options.websocket?.protocols || [],
              headers: options.websocket?.headers || {},
              heartbeat: options.websocket?.heartbeat || 30000
            }
          };
        case 'scada':
          return {
            scada: {
              pollingInterval: options.scada?.pollingInterval || 1000,
              timeout: options.scada?.timeout || 5000,
              retries: options.scada?.retries || 3,
              bufferSize: options.scada?.bufferSize || 1024,
              realTime: options.scada?.realTime ?? true
            }
          };
        case 'bacnet':
          return {
            bacnet: {
              deviceId: options.bacnet?.deviceId || 1,
              vendorId: options.bacnet?.vendorId || 0,
              timeout: options.bacnet?.timeout || 3000,
              retries: options.bacnet?.retries || 2,
              bbmd: options.bacnet?.bbmd ?? false
            }
          };
        case 'dnp3':
          return {
            dnp3: {
              outstationAddress: options.dnp3?.outstationAddress || 1,
              masterAddress: options.dnp3?.masterAddress || 1,
              timeout: options.dnp3?.timeout || 5000,
              retries: options.dnp3?.retries || 3,
              secureAuthentication: options.dnp3?.secureAuthentication ?? false
            }
          };
        case 'ethernetip':
          return {
            ethernetip: {
              slot: options.ethernetip?.slot || 0,
              timeout: options.ethernetip?.timeout || 5000,
              retries: options.ethernetip?.retries || 3,
              scanRate: options.ethernetip?.scanRate || 100,
              cipSecurity: options.ethernetip?.cipSecurity ?? false
            }
          };
        case 'profinet':
          return {
            profinet: {
              deviceName: options.profinet?.deviceName || '',
              timeout: options.profinet?.timeout || 5000,
              retries: options.profinet?.retries || 3,
              scanRate: options.profinet?.scanRate || 100,
              realTime: options.profinet?.realTime ?? true
            }
          };
        case 'restapi':
          return {
            restapi: {
              basePath: options.restapi?.basePath || '',
              timeout: options.restapi?.timeout || 30000,
              retries: options.restapi?.retries || 3,
              rateLimit: options.restapi?.rateLimit || 1000,
              sslVerify: options.restapi?.sslVerify ?? true
            }
          };
        default:
          return {
            opcua: { securityMode: 'None', securityPolicy: 'None', authentication: 'Anonymous', requestTimeout: 30000, keepAliveInterval: 10000, reconnectInterval: 5000, maxReconnectAttempts: 5 },
            mqtt: { clientId: `mqtt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, keepalive: 60, reconnectPeriod: 1000, connectTimeout: 30000, clean: true, qos: 1, retain: false },
            database: { databaseName: '', connectionTimeout: 30000, queryTimeout: 60000, maxConnections: 10, ssl: false },
            modbus: { unitId: 1, timeout: 5000, retries: 3, scanRate: 1000 },
            websocket: { protocols: [], headers: {}, heartbeat: 30000 },
            scada: { pollingInterval: 1000, timeout: 5000, retries: 3, bufferSize: 1024, realTime: true },
            bacnet: { deviceId: 1, vendorId: 0, timeout: 3000, retries: 2, bbmd: false },
            dnp3: { outstationAddress: 1, masterAddress: 1, timeout: 5000, retries: 3, secureAuthentication: false },
            ethernetip: { slot: 0, timeout: 5000, retries: 3, scanRate: 100, cipSecurity: false },
            profinet: { deviceName: '', timeout: 5000, retries: 3, scanRate: 100, realTime: true },
            restapi: { basePath: '', timeout: 30000, retries: 3, rateLimit: 1000, sslVerify: true }
          };
      }
    };

    setFormData({
      name: connection.name,
      type: connection.type,
      endpoint: host,
      port: port,
      username: connection.config.authentication?.username || '',
      password: connection.config.authentication?.password || '',
      description: connection.config.options?.description || '',
      enabled: connection.config.enabled,
      options: connection.config.options || {},
      ...loadProtocolOptions()
    });

    setEditingConnection(connectionId);
    setIsFormOpen(true);
  };

  const handleDelete = async (connectionId: string) => {
    try {
      await globalProtocolManager.removeConnection(connectionId);
      toast({
        title: 'Success',
        description: 'Data source deleted successfully',
      });
      loadConnections();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to delete data source: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleConnect = async (connectionId: string) => {
    try {
      await globalProtocolManager.connect(connectionId);
      toast({
        title: 'Success',
        description: 'Connection established successfully',
      });
      loadConnections();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      await globalProtocolManager.disconnect(connectionId);
      toast({
        title: 'Success',
        description: 'Connection disconnected successfully',
      });
      loadConnections();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleReconnect = async (connectionId: string) => {
    try {
      await globalProtocolManager.reconnect(connectionId);
      toast({
        title: 'Success',
        description: 'Connection reconnected successfully',
      });
      loadConnections();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to reconnect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'websocket',
      endpoint: '',
      port: 80,
      username: '',
      password: '',
      description: '',
      enabled: true,
      options: {},
      opcua: {
        securityMode: 'None',
        securityPolicy: 'None',
        authentication: 'Anonymous',
        requestTimeout: 30000,
        keepAliveInterval: 10000,
        reconnectInterval: 5000,
        maxReconnectAttempts: 5
      },
      mqtt: {
        clientId: `mqtt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        keepalive: 60,
        reconnectPeriod: 1000,
        connectTimeout: 30000,
        clean: true,
        qos: 1,
        retain: false
      },
      database: {
        databaseName: '',
        connectionTimeout: 30000,
        queryTimeout: 60000,
        maxConnections: 10,
        ssl: false
      },
      modbus: {
        unitId: 1,
        timeout: 5000,
        retries: 3,
        scanRate: 1000
      },
      websocket: {
        protocols: [],
        headers: {},
        heartbeat: 30000
      },
      scada: {
        pollingInterval: 1000,
        timeout: 5000,
        retries: 3,
        bufferSize: 1024,
        realTime: true
      },
      bacnet: {
        deviceId: 1,
        vendorId: 0,
        timeout: 3000,
        retries: 2,
        bbmd: false
      },
      dnp3: {
        outstationAddress: 1,
        masterAddress: 1,
        timeout: 5000,
        retries: 3,
        secureAuthentication: false
      },
      ethernetip: {
        slot: 0,
        timeout: 5000,
        retries: 3,
        scanRate: 100,
        cipSecurity: false
      },
      profinet: {
        deviceName: '',
        timeout: 5000,
        retries: 3,
        scanRate: 100,
        realTime: true
      },
      restapi: {
        basePath: '',
        timeout: 30000,
        retries: 3,
        rateLimit: 1000,
        sslVerify: true
      }
    });
  };

  const getStatusIcon = (status: any) => {
    if (status?.connected) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else if (status?.errorCount > 0) {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    } else {
      return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: any) => {
    if (status?.connected) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Connected</Badge>;
    } else if (status?.errorCount > 0) {
      return <Badge variant="destructive">Error</Badge>;
    } else {
      return <Badge variant="secondary">Disconnected</Badge>;
    }
  };

  const getProtocolIcon = (type: ProtocolType) => {
    switch (type) {
      case 'websocket': return <Wifi className="w-4 h-4" />;
      case 'mqtt': return <Zap className="w-4 h-4" />;
      case 'opcua': return <Server className="w-4 h-4" />;
      case 'database': return <Database className="w-4 h-4" />;
      case 'scada': return <Activity className="w-4 h-4" />;
      case 'bacnet': return <Settings className="w-4 h-4" />;
      case 'dnp3': return <Settings className="w-4 h-4" />;
      case 'modbus': return <Settings className="w-4 h-4" />;
      case 'ethernetip': return <Settings className="w-4 h-4" />;
      case 'profinet': return <Settings className="w-4 h-4" />;
      case 'restapi': return <Server className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  // Transform and Filter Management
  const handleAddTransform = async (connectionId: string, transform: TransformConfig) => {
    try {
      // Get the connection from the protocol manager
      const connection = globalProtocolManager.getConnection(connectionId);
      if (!connection) return;

      // Store transforms in the connection config options
      const currentTransforms = connection.config.options?.transforms || [];
      connection.config.options = {
        ...connection.config.options,
        transforms: [...currentTransforms, transform]
      };
      
      toast({
        title: 'Success',
        description: `Transform "${transform.name}" added successfully`,
      });
      
      loadConnections();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to add transform: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveTransform = async (connectionId: string, transformId: string) => {
    try {
      const connection = globalProtocolManager.getConnection(connectionId);
      if (!connection) return;

      const currentTransforms = connection.config.options?.transforms || [];
      connection.config.options = {
        ...connection.config.options,
        transforms: currentTransforms.filter(t => t.id !== transformId)
      };
      
      toast({
        title: 'Success',
        description: 'Transform removed successfully',
      });
      
      loadConnections();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to remove transform: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleAddFilter = async (connectionId: string, filter: FilterConfig) => {
    try {
      const connection = globalProtocolManager.getConnection(connectionId);
      if (!connection) return;

      const currentFilters = connection.config.options?.filters || [];
      connection.config.options = {
        ...connection.config.options,
        filters: [...currentFilters, filter]
      };
      
      toast({
        title: 'Success',
        description: `Filter "${filter.name}" added successfully`,
      });
      
      loadConnections();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to add filter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveFilter = async (connectionId: string, filterId: string) => {
    try {
      const connection = globalProtocolManager.getConnection(connectionId);
      if (!connection) return;

      const currentFilters = connection.config.options?.filters || [];
      connection.config.options = {
        ...connection.config.options,
        filters: currentFilters.filter(f => f.id !== filterId)
      };
      
      toast({
        title: 'Success',
        description: 'Filter removed successfully',
      });
      
      loadConnections();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to remove filter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleToggleTransform = async (connectionId: string, transformId: string, enabled: boolean) => {
    try {
      const connection = globalProtocolManager.getConnection(connectionId);
      if (!connection) return;

      const currentTransforms = connection.config.options?.transforms || [];
      const updatedTransforms = currentTransforms.map(t => 
        t.id === transformId ? { ...t, enabled } : t
      );
      
      connection.config.options = {
        ...connection.config.options,
        transforms: updatedTransforms
      };
      
      toast({
        title: 'Success',
        description: `Transform ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
      
      loadConnections();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to toggle transform: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleToggleFilter = async (connectionId: string, filterId: string, enabled: boolean) => {
    try {
      const connection = globalProtocolManager.getConnection(connectionId);
      if (!connection) return;

      const currentFilters = connection.config.options?.filters || [];
      const updatedFilters = currentFilters.map(f => 
        f.id === filterId ? { ...f, enabled } : f
      );
      
      connection.config.options = {
        ...connection.config.options,
        filters: updatedFilters
      };
      
      toast({
        title: 'Success',
        description: `Filter ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
      
      loadConnections();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to toggle filter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const getConnectionTransforms = (connectionId: string): TransformConfig[] => {
    const connection = globalProtocolManager.getConnection(connectionId);
    return connection?.config.options?.transforms || [];
  };

  const getConnectionFilters = (connectionId: string): FilterConfig[] => {
    const connection = globalProtocolManager.getConnection(connectionId);
    return connection?.config.options?.filters || [];
  };

  // Protocol-specific form sections
  const renderProtocolSpecificFields = () => {
    switch (formData.type) {
      case 'opcua':
        return (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">OPC UA Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="opcua-security-mode">Security Mode</Label>
                <Select
                  value={formData.opcua?.securityMode}
                  onValueChange={(value: 'None' | 'Sign' | 'SignAndEncrypt') => 
                    setFormData({ 
                      ...formData, 
                      opcua: { ...formData.opcua!, securityMode: value } 
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Sign">Sign</SelectItem>
                    <SelectItem value="SignAndEncrypt">Sign and Encrypt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="opcua-security-policy">Security Policy</Label>
                <Select
                  value={formData.opcua?.securityPolicy}
                  onValueChange={(value: 'None' | 'Basic128Rsa15' | 'Basic256' | 'Basic256Sha256') => 
                    setFormData({ 
                      ...formData, 
                      opcua: { ...formData.opcua!, securityPolicy: value } 
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Basic128Rsa15">Basic128Rsa15</SelectItem>
                    <SelectItem value="Basic256">Basic256</SelectItem>
                    <SelectItem value="Basic256Sha256">Basic256Sha256</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="opcua-authentication">Authentication</Label>
                <Select
                  value={formData.opcua?.authentication}
                  onValueChange={(value: 'Anonymous' | 'Username' | 'Certificate') => 
                    setFormData({ 
                      ...formData, 
                      opcua: { ...formData.opcua!, authentication: value } 
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Anonymous">Anonymous</SelectItem>
                    <SelectItem value="Username">Username</SelectItem>
                    <SelectItem value="Certificate">Certificate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="opcua-request-timeout">Request Timeout (ms)</Label>
                <Input
                  id="opcua-request-timeout"
                  type="number"
                  value={formData.opcua?.requestTimeout}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    opcua: { ...formData.opcua!, requestTimeout: parseInt(e.target.value) } 
                  })}
                />
              </div>
            </div>
            {formData.opcua?.authentication === 'Certificate' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="opcua-certificate-path">Certificate Path</Label>
                  <Input
                    id="opcua-certificate-path"
                    value={formData.opcua?.certificatePath || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      opcua: { ...formData.opcua!, certificatePath: e.target.value } 
                    })}
                    placeholder="/path/to/certificate.pem"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="opcua-private-key-path">Private Key Path</Label>
                  <Input
                    id="opcua-private-key-path"
                    value={formData.opcua?.privateKeyPath || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      opcua: { ...formData.opcua!, privateKeyPath: e.target.value } 
                    })}
                    placeholder="/path/to/private.key"
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 'mqtt':
        return (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">MQTT Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mqtt-client-id">Client ID</Label>
                <Input
                  id="mqtt-client-id"
                  value={formData.mqtt?.clientId}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    mqtt: { ...formData.mqtt!, clientId: e.target.value } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mqtt-qos">QoS Level</Label>
                <Select
                  value={formData.mqtt?.qos?.toString()}
                  onValueChange={(value) => 
                    setFormData({ 
                      ...formData, 
                      mqtt: { ...formData.mqtt!, qos: parseInt(value) as 0 | 1 | 2 } 
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - At most once</SelectItem>
                    <SelectItem value="1">1 - At least once</SelectItem>
                    <SelectItem value="2">2 - Exactly once</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mqtt-keepalive">Keep Alive (seconds)</Label>
                <Input
                  id="mqtt-keepalive"
                  type="number"
                  value={formData.mqtt?.keepalive}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    mqtt: { ...formData.mqtt!, keepalive: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mqtt-connect-timeout">Connect Timeout (ms)</Label>
                <Input
                  id="mqtt-connect-timeout"
                  type="number"
                  value={formData.mqtt?.connectTimeout}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    mqtt: { ...formData.mqtt!, connectTimeout: parseInt(e.target.value) } 
                  })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="mqtt-clean"
                  checked={formData.mqtt?.clean}
                  onCheckedChange={(checked) => setFormData({ 
                    ...formData, 
                    mqtt: { ...formData.mqtt!, clean: checked } 
                  })}
                />
                <Label htmlFor="mqtt-clean">Clean Session</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="mqtt-retain"
                  checked={formData.mqtt?.retain}
                  onCheckedChange={(checked) => setFormData({ 
                    ...formData, 
                    mqtt: { ...formData.mqtt!, retain: checked } 
                  })}
                />
                <Label htmlFor="mqtt-retain">Retain Messages</Label>
              </div>
            </div>
          </div>
        );

      case 'database':
        return (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">Database Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="db-name">Database Name</Label>
                <Input
                  id="db-name"
                  value={formData.database?.databaseName}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    database: { ...formData.database!, databaseName: e.target.value } 
                  })}
                  placeholder="mydatabase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-connection-timeout">Connection Timeout (ms)</Label>
                <Input
                  id="db-connection-timeout"
                  type="number"
                  value={formData.database?.connectionTimeout}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    database: { ...formData.database!, connectionTimeout: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-query-timeout">Query Timeout (ms)</Label>
                <Input
                  id="db-query-timeout"
                  type="number"
                  value={formData.database?.queryTimeout}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    database: { ...formData.database!, queryTimeout: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db-max-connections">Max Connections</Label>
                <Input
                  id="db-max-connections"
                  type="number"
                  value={formData.database?.maxConnections}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    database: { ...formData.database!, maxConnections: parseInt(e.target.value) } 
                  })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="db-ssl"
                checked={formData.database?.ssl}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  database: { ...formData.database!, ssl: checked } 
                })}
              />
              <Label htmlFor="db-ssl">Enable SSL</Label>
            </div>
            {formData.database?.ssl && (
              <div className="space-y-2">
                <Label htmlFor="db-ssl-mode">SSL Mode</Label>
                <Select
                  value={formData.database?.sslMode}
                  onValueChange={(value: 'require' | 'verify-ca' | 'verify-full') => 
                    setFormData({ 
                      ...formData, 
                      database: { ...formData.database!, sslMode: value } 
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="require">Require</SelectItem>
                    <SelectItem value="verify-ca">Verify CA</SelectItem>
                    <SelectItem value="verify-full">Verify Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        );

      case 'modbus':
        return (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">Modbus Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modbus-unit-id">Unit ID</Label>
                <Input
                  id="modbus-unit-id"
                  type="number"
                  value={formData.modbus?.unitId}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    modbus: { ...formData.modbus!, unitId: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modbus-timeout">Timeout (ms)</Label>
                <Input
                  id="modbus-timeout"
                  type="number"
                  value={formData.modbus?.timeout}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    modbus: { ...formData.modbus!, timeout: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modbus-retries">Retries</Label>
                <Input
                  id="modbus-retries"
                  type="number"
                  value={formData.modbus?.retries}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    modbus: { ...formData.modbus!, retries: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modbus-scan-rate">Scan Rate (ms)</Label>
                <Input
                  id="modbus-scan-rate"
                  type="number"
                  value={formData.modbus?.scanRate}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    modbus: { ...formData.modbus!, scanRate: parseInt(e.target.value) } 
                  })}
                />
              </div>
            </div>
          </div>
        );

      case 'websocket':
        return (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">WebSocket Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ws-heartbeat">Heartbeat Interval (ms)</Label>
                <Input
                  id="ws-heartbeat"
                  type="number"
                  value={formData.websocket?.heartbeat}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    websocket: { ...formData.websocket!, heartbeat: parseInt(e.target.value) } 
                  })}
                />
              </div>
            </div>
          </div>
        );

      case 'scada':
        return (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">SCADA Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scada-polling-interval">Polling Interval (ms)</Label>
                <Input
                  id="scada-polling-interval"
                  type="number"
                  value={formData.scada?.pollingInterval || 1000}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    scada: { ...formData.scada!, pollingInterval: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scada-timeout">Command Timeout (ms)</Label>
                <Input
                  id="scada-timeout"
                  type="number"
                  value={formData.scada?.timeout || 5000}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    scada: { ...formData.scada!, timeout: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scada-retries">Command Retries</Label>
                <Input
                  id="scada-retries"
                  type="number"
                  value={formData.scada?.retries || 3}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    scada: { ...formData.scada!, retries: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scada-buffer-size">Buffer Size</Label>
                <Input
                  id="scada-buffer-size"
                  type="number"
                  value={formData.scada?.bufferSize || 1024}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    scada: { ...formData.scada!, bufferSize: parseInt(e.target.value) } 
                  })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="scada-real-time"
                checked={formData.scada?.realTime ?? true}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  scada: { ...formData.scada!, realTime: checked } 
                })}
              />
              <Label htmlFor="scada-real-time">Real-time Mode</Label>
            </div>
          </div>
        );

      case 'bacnet':
        return (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">BACnet Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bacnet-device-id">Device ID</Label>
                <Input
                  id="bacnet-device-id"
                  type="number"
                  value={formData.bacnet?.deviceId || 1}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    bacnet: { ...formData.bacnet!, deviceId: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bacnet-vendor-id">Vendor ID</Label>
                <Input
                  id="bacnet-vendor-id"
                  type="number"
                  value={formData.bacnet?.vendorId || 0}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    bacnet: { ...formData.bacnet!, vendorId: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bacnet-timeout">Request Timeout (ms)</Label>
                <Input
                  id="bacnet-timeout"
                  type="number"
                  value={formData.bacnet?.timeout || 3000}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    bacnet: { ...formData.bacnet!, timeout: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bacnet-retries">Max Retries</Label>
                <Input
                  id="bacnet-retries"
                  type="number"
                  value={formData.bacnet?.retries || 2}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    bacnet: { ...formData.bacnet!, retries: parseInt(e.target.value) } 
                  })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="bacnet-bbmd"
                checked={formData.bacnet?.bbmd ?? false}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  bacnet: { ...formData.bacnet!, bbmd: checked } 
                })}
              />
              <Label htmlFor="bacnet-bbmd">BBMD (Broadcast Management Device)</Label>
            </div>
          </div>
        );

      case 'dnp3':
        return (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">DNP3 Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dnp3-outstation-address">Outstation Address</Label>
                <Input
                  id="dnp3-outstation-address"
                  type="number"
                  value={formData.dnp3?.outstationAddress || 1}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    dnp3: { ...formData.dnp3!, outstationAddress: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dnp3-master-address">Master Address</Label>
                <Input
                  id="dnp3-master-address"
                  type="number"
                  value={formData.dnp3?.masterAddress || 1}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    dnp3: { ...formData.dnp3!, masterAddress: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dnp3-timeout">Request Timeout (ms)</Label>
                <Input
                  id="dnp3-timeout"
                  type="number"
                  value={formData.dnp3?.timeout || 5000}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    dnp3: { ...formData.dnp3!, timeout: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dnp3-retries">Max Retries</Label>
                <Input
                  id="dnp3-retries"
                  type="number"
                  value={formData.dnp3?.retries || 3}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    dnp3: { ...formData.dnp3!, retries: parseInt(e.target.value) } 
                  })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="dnp3-secure-authentication"
                checked={formData.dnp3?.secureAuthentication ?? false}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  dnp3: { ...formData.dnp3!, secureAuthentication: checked } 
                })}
              />
              <Label htmlFor="dnp3-secure-authentication">Secure Authentication</Label>
            </div>
          </div>
        );

      case 'ethernetip':
        return (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">EtherNet/IP Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ethernetip-slot">Slot Number</Label>
                <Input
                  id="ethernetip-slot"
                  type="number"
                  value={formData.ethernetip?.slot || 0}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    ethernetip: { ...formData.ethernetip!, slot: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ethernetip-timeout">Request Timeout (ms)</Label>
                <Input
                  id="ethernetip-timeout"
                  type="number"
                  value={formData.ethernetip?.timeout || 5000}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    ethernetip: { ...formData.ethernetip!, timeout: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ethernetip-retries">Max Retries</Label>
                <Input
                  id="ethernetip-retries"
                  type="number"
                  value={formData.ethernetip?.retries || 3}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    ethernetip: { ...formData.ethernetip!, retries: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ethernetip-scan-rate">Scan Rate (ms)</Label>
                <Input
                  id="ethernetip-scan-rate"
                  type="number"
                  value={formData.ethernetip?.scanRate || 100}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    ethernetip: { ...formData.ethernetip!, scanRate: parseInt(e.target.value) } 
                  })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="ethernetip-cip-security"
                checked={formData.ethernetip?.cipSecurity ?? false}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  ethernetip: { ...formData.ethernetip!, cipSecurity: checked } 
                })}
              />
              <Label htmlFor="ethernetip-cip-security">CIP Security</Label>
            </div>
          </div>
        );

      case 'profinet':
        return (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">Profinet Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="profinet-device-name">Device Name</Label>
                <Input
                  id="profinet-device-name"
                  value={formData.profinet?.deviceName || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    profinet: { ...formData.profinet!, deviceName: e.target.value } 
                  })}
                  placeholder="device-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profinet-timeout">Request Timeout (ms)</Label>
                <Input
                  id="profinet-timeout"
                  type="number"
                  value={formData.profinet?.timeout || 5000}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    profinet: { ...formData.profinet!, timeout: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profinet-retries">Max Retries</Label>
                <Input
                  id="profinet-retries"
                  type="number"
                  value={formData.profinet?.retries || 3}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    profinet: { ...formData.profinet!, retries: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profinet-scan-rate">Scan Rate (ms)</Label>
                <Input
                  id="profinet-scan-rate"
                  type="number"
                  value={formData.profinet?.scanRate || 100}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    profinet: { ...formData.profinet!, scanRate: parseInt(e.target.value) } 
                  })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="profinet-real-time"
                checked={formData.profinet?.realTime ?? true}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  profinet: { ...formData.profinet!, realTime: checked } 
                })}
              />
              <Label htmlFor="profinet-real-time">Real-time Communication</Label>
            </div>
          </div>
        );

      case 'restapi':
        return (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">REST API Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="restapi-base-path">Base Path</Label>
                <Input
                  id="restapi-base-path"
                  value={formData.restapi?.basePath || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    restapi: { ...formData.restapi!, basePath: e.target.value } 
                  })}
                  placeholder="/api/v1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restapi-timeout">Request Timeout (ms)</Label>
                <Input
                  id="restapi-timeout"
                  type="number"
                  value={formData.restapi?.timeout || 30000}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    restapi: { ...formData.restapi!, timeout: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restapi-retries">Max Retries</Label>
                <Input
                  id="restapi-retries"
                  type="number"
                  value={formData.restapi?.retries || 3}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    restapi: { ...formData.restapi!, retries: parseInt(e.target.value) } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restapi-rate-limit">Rate Limit (req/min)</Label>
                <Input
                  id="restapi-rate-limit"
                  type="number"
                  value={formData.restapi?.rateLimit || 1000}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    restapi: { ...formData.restapi!, rateLimit: parseInt(e.target.value) } 
                  })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="restapi-ssl-verify"
                checked={formData.restapi?.sslVerify ?? true}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  restapi: { ...formData.restapi!, sslVerify: checked } 
                })}
              />
              <Label htmlFor="restapi-ssl-verify">Verify SSL Certificate</Label>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Data Source Manager</h2>
          <p className="text-muted-foreground">
            Configure and manage connections to external data sources and industrial systems
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Data Source
        </Button>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="transforms">Data Pipeline</TabsTrigger>
          <TabsTrigger value="monitoring">Real-time Monitoring</TabsTrigger>
        </TabsList>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-4">
          {/* Header with refresh button */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Data Source Connections</h3>
            <div className="flex gap-2">
              <Button variant="outline" onClick={async () => {
                try {
                  setIsRestoring(true);
                  console.log('🔄 DataSourceManager: Force restoring connections...');
                  await globalProtocolManager.forceRestoreConnections();
                  console.log('✅ DataSourceManager: Force restore completed, refreshing...');
                  loadConnections();
                } catch (error) {
                  console.error('❌ DataSourceManager: Force restore failed:', error);
                } finally {
                  setIsRestoring(false);
                }
              }} disabled={isRestoring}>
                <RotateCcw className={`w-4 h-4 mr-2 ${isRestoring ? 'animate-spin' : ''}`} />
                {isRestoring ? 'Restoring...' : 'Force Restore'}
              </Button>
              <Button variant="outline" onClick={loadConnections}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
          
          {/* Status indicator */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Total Connections: {connections.size}</span>
            {isRestoring && (
              <span className="flex items-center gap-2 text-blue-600">
                <RotateCcw className="w-4 h-4 animate-spin" />
                Restoring connections...
              </span>
            )}
          </div>
          
          {/* Connection List */}
          <div className="grid gap-4">
            {Array.from(connections.values()).map((connection) => (
              <Card key={connection.id} className="border rounded-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        {getProtocolIcon(connection.type)}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{connection.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Badge variant="outline">{connection.type.toUpperCase()}</Badge>
                          {getStatusBadge(connection.status)}
                          {connection.lastActivity && (
                            <span className="text-xs text-muted-foreground">
                              Last: {connection.lastActivity.toLocaleTimeString()}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {connection.status?.connected ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnect(connection.id)}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConnect(connection.id)}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Connect
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReconnect(connection.id)}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(connection.id)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedConnection(connection.id);
                          setActiveTab('transforms');
                        }}
                      >
                        <Transform className="w-4 h-4 mr-1" />
                        Pipeline
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(connection.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Endpoint:</span> {connection.config.endpoint}
                    </div>
                    <div>
                      <span className="font-medium">Description:</span> {connection.config.options?.description || 'No description'}
                    </div>
                    <div>
                      <span className="font-medium">Created:</span> {connection.createdAt.toLocaleDateString()}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span> {getStatusIcon(connection.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {connections.size === 0 && (
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Database className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No data sources configured</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Get started by adding your first data source connection
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={loadConnections}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh Connections
                    </Button>
                    <Button onClick={() => setIsFormOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Data Source
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Data Pipeline Tab */}
        <TabsContent value="transforms" className="space-y-4">
          {selectedConnection ? (
            <DataTransformationPanel
              connectionId={selectedConnection}
              transforms={getConnectionTransforms(selectedConnection)}
              filters={getConnectionFilters(selectedConnection)}
              onAddTransform={(transform) => handleAddTransform(selectedConnection, transform)}
              onRemoveTransform={(transformId) => handleRemoveTransform(selectedConnection, transformId)}
              onAddFilter={(filter) => handleAddFilter(selectedConnection, filter)}
              onRemoveFilter={(filterId) => handleRemoveFilter(selectedConnection, filterId)}
              onToggleTransform={(transformId, enabled) => handleToggleTransform(selectedConnection, transformId, enabled)}
              onToggleFilter={(filterId, enabled) => handleToggleFilter(selectedConnection, filterId, enabled)}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Transform className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Connection</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Choose a connection from the Connections tab to configure its data pipeline
                </p>
                <Button onClick={() => setActiveTab('connections')}>
                  View Connections
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Real-time Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4">
          <RealTimePipelineMonitoring connections={connections} />
          <DataFlowVisualization connections={connections} selectedConnection={selectedConnection} />
        </TabsContent>
      </Tabs>

      {/* Add/Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingConnection ? 'Edit Data Source' : 'Add New Data Source'}
              </CardTitle>
              <CardDescription>
                Configure connection parameters for your data source
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="My Data Source"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Protocol Type *</Label>
                                         <Select
                       value={formData.type}
                       onValueChange={(value: ProtocolType) => {
                         let newPort = defaultPorts[value];
                         // For REST API, set port based on whether it's likely HTTPS
                         if (value === 'restapi') {
                           newPort = formData.endpoint.includes('https') || formData.endpoint.includes('secure') ? 443 : 80;
                         }
                         
                         // Reset protocol-specific options when changing protocol type
                         const resetOptions = {
                           opcua: {
                             securityMode: 'None' as const,
                             securityPolicy: 'None' as const,
                             authentication: 'Anonymous' as const,
                             requestTimeout: 30000,
                             keepAliveInterval: 10000,
                             reconnectInterval: 5000,
                             maxReconnectAttempts: 5
                           },
                           mqtt: {
                             clientId: `mqtt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                             keepalive: 60,
                             reconnectPeriod: 1000,
                             connectTimeout: 30000,
                             clean: true,
                             qos: 1 as const,
                             retain: false
                           },
                           database: {
                             databaseName: '',
                             connectionTimeout: 30000,
                             queryTimeout: 60000,
                             maxConnections: 10,
                             ssl: false
                           },
                           modbus: {
                             unitId: 1,
                             timeout: 5000,
                             retries: 3,
                             scanRate: 1000
                           },
                           websocket: {
                             protocols: [],
                             headers: {},
                             heartbeat: 30000
                           },
                           scada: {
                             pollingInterval: 1000,
                             timeout: 5000,
                             retries: 3,
                             bufferSize: 1024,
                             realTime: true
                           },
                           bacnet: {
                             deviceId: 1,
                             vendorId: 0,
                             timeout: 3000,
                             retries: 2,
                             bbmd: false
                           },
                           dnp3: {
                             outstationAddress: 1,
                             masterAddress: 1,
                             timeout: 5000,
                             retries: 3,
                             secureAuthentication: false
                           },
                           ethernetip: {
                             slot: 0,
                             timeout: 5000,
                             retries: 3,
                             scanRate: 100,
                             cipSecurity: false
                           },
                           profinet: {
                             deviceName: '',
                             timeout: 5000,
                             retries: 3,
                             scanRate: 100,
                             realTime: true
                           },
                           restapi: {
                             basePath: '',
                             timeout: 30000,
                             retries: 3,
                             rateLimit: 1000,
                             sslVerify: true
                           }
                         };
                         
                         setFormData({ 
                           ...formData, 
                           type: value, 
                           port: newPort,
                           ...resetOptions
                         });
                       }}
                     >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {globalProtocolManager.getSupportedProtocols().map((protocol) => (
                          <SelectItem key={protocol} value={protocol}>
                            {protocol.toUpperCase()} - {protocolDescriptions[protocol]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label htmlFor="endpoint">
                       {formData.type === 'restapi' ? 'URL/Endpoint *' : 'Host/Endpoint *'}
                     </Label>
                     <Input
                       id="endpoint"
                       value={formData.endpoint}
                       onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                       placeholder={formData.type === 'restapi' ? 'api.example.com' : 'localhost'}
                       required
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="port">Port *</Label>
                     <Input
                       id="port"
                       type="number"
                       value={formData.port}
                       onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                       required
                       disabled={formData.type === 'restapi'}
                       className={formData.type === 'restapi' ? 'bg-gray-100' : ''}
                     />
                     {formData.type === 'restapi' && (
                       <p className="text-xs text-muted-foreground">
                         Port will be automatically set based on protocol (80 for HTTP, 443 for HTTPS)
                       </p>
                     )}
                   </div>
                 </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the purpose of this data source"
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                  <Label htmlFor="enabled">Enable this connection</Label>
                </div>

                {/* Protocol-specific fields */}
                {renderProtocolSpecificFields()}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingConnection(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingConnection ? 'Update' : 'Create'} Data Source
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
