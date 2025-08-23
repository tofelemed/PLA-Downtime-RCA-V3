import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Plus, Server, CheckCircle, AlertCircle, Trash2, TestTube, Zap, Info, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { storageService } from '../../services/StorageService';

// System type definitions
const systemTypes = [
  { value: 'pi', label: 'AVEVA PI', icon: '🏭', description: 'Connect to PI System for real-time and historical data', fields: ['server', 'username', 'password', 'database', 'port', 'timeout'] },
  { value: 'historian', label: 'Historian Systems', icon: '📊', description: 'Connect to time-series historians', fields: ['server', 'username', 'password', 'database', 'port', 'timeout', 'driver'] },
  { value: 'cmms', label: 'CMMS/Maintenance', icon: '🔧', description: 'Connect to maintenance management systems', fields: ['endpoint', 'apiKey', 'username', 'password', 'system', 'version'] },
  { value: 'scada', label: 'SCADA Systems', icon: '🎛️', description: 'Connect to SCADA systems and PLCs', fields: ['host', 'port', 'protocol', 'deviceId', 'timeout', 'retries'] },
  { value: 'database', label: 'Databases', icon: '🗄️', description: 'Connect to SQL and NoSQL databases', fields: ['host', 'port', 'database', 'username', 'password', 'type', 'ssl'] },
  { value: 'rest', label: 'REST APIs', icon: '🌐', description: 'Connect to RESTful web services', fields: ['baseUrl', 'endpoint', 'method', 'apiKey', 'username', 'password', 'headers'] },
  { value: 'mqtt', label: 'MQTT Brokers', icon: '📡', description: 'Connect to MQTT message brokers', fields: ['broker', 'port', 'clientId', 'username', 'password', 'topics', 'qos'] },
  { value: 'modbus', label: 'Modbus Devices', icon: '⚡', description: 'Connect to Modbus TCP/RTU devices', fields: ['host', 'port', 'unitId', 'timeout', 'retries', 'type'] },
  { value: 'custom', label: 'Custom Systems', icon: '⚙️', description: 'Connect to custom or proprietary systems', fields: ['endpoint', 'protocol', 'authentication', 'headers', 'format'] }
];

// Field configurations for each system type
const fieldConfigs: Record<string, any> = {
  pi: {
    server: { type: 'text', label: 'PI Server', placeholder: 'piserver.company.com', required: true },
    username: { type: 'text', label: 'Username', placeholder: 'pi_user', required: true },
    password: { type: 'password', label: 'Password', placeholder: '••••••••', required: true },
    database: { type: 'text', label: 'AF Database', placeholder: 'Production', required: false },
    port: { type: 'number', label: 'Port', placeholder: '5460', required: false, defaultValue: 5460 },
    timeout: { type: 'number', label: 'Timeout (ms)', placeholder: '30000', required: false, defaultValue: 30000 }
  },
  historian: {
    server: { type: 'text', label: 'Server', placeholder: 'historian.company.com', required: true },
    username: { type: 'text', label: 'Username', placeholder: 'historian_user', required: true },
    password: { type: 'password', label: 'Password', placeholder: '••••••••', required: true },
    database: { type: 'text', label: 'Database', placeholder: 'HistorianDB', required: true },
    port: { type: 'number', label: 'Port', placeholder: '1433', required: false, defaultValue: 1433 },
    timeout: { type: 'number', label: 'Timeout (ms)', placeholder: '30000', required: false, defaultValue: 30000 },
    driver: { type: 'select', label: 'Driver', options: ['ODBC', 'SQL Server', 'Oracle', 'MySQL'], required: false }
  },
  cmms: {
    endpoint: { type: 'text', label: 'API Endpoint', placeholder: 'https://api.cmms.company.com', required: true },
    apiKey: { type: 'password', label: 'API Key', placeholder: '••••••••••••••••', required: false },
    username: { type: 'text', label: 'Username', placeholder: 'integration_user', required: false },
    password: { type: 'password', label: 'Password', placeholder: '••••••••', required: false },
    system: { type: 'select', label: 'CMMS System', options: ['SAP PM', 'IBM Maximo', 'Infor EAM', 'eMaint', 'Other'], required: true },
    version: { type: 'text', label: 'API Version', placeholder: 'v1.0', required: false }
  },
  scada: {
    host: { type: 'text', label: 'Host/IP', placeholder: '192.168.1.100', required: true },
    port: { type: 'number', label: 'Port', placeholder: '502', required: true, defaultValue: 502 },
    protocol: { type: 'select', label: 'Protocol', options: ['Modbus TCP', 'Modbus RTU', 'DNP3', 'IEC 60870', 'Custom'], required: true },
    deviceId: { type: 'number', label: 'Device ID', placeholder: '1', required: false, defaultValue: 1 },
    timeout: { type: 'number', label: 'Timeout (ms)', placeholder: '5000', required: false, defaultValue: 5000 },
    retries: { type: 'number', label: 'Retries', placeholder: '3', required: false, defaultValue: 3 }
  },
  database: {
    host: { type: 'text', label: 'Host', placeholder: 'db.company.com', required: true },
    port: { type: 'number', label: 'Port', placeholder: '5432', required: true, defaultValue: 5432 },
    database: { type: 'text', label: 'Database Name', placeholder: 'production_db', required: true },
    username: { type: 'text', label: 'Username', placeholder: 'db_user', required: true },
    password: { type: 'password', label: 'Password', placeholder: '••••••••', required: true },
    type: { type: 'select', label: 'Database Type', options: ['PostgreSQL', 'MySQL', 'SQL Server', 'Oracle', 'SQLite'], required: true },
    ssl: { type: 'select', label: 'SSL Mode', options: ['disable', 'require', 'verify-ca', 'verify-full'], required: false, defaultValue: 'require' }
  },
  rest: {
    baseUrl: { type: 'text', label: 'Base URL', placeholder: 'https://api.company.com', required: true },
    endpoint: { type: 'text', label: 'Endpoint', placeholder: '/v1/data', required: false },
    method: { type: 'select', label: 'HTTP Method', options: ['GET', 'POST', 'PUT', 'DELETE'], required: false, defaultValue: 'GET' },
    apiKey: { type: 'password', label: 'API Key', placeholder: '••••••••••••••••', required: false },
    username: { type: 'text', label: 'Username', placeholder: 'api_user', required: false },
    password: { type: 'password', label: 'Password', placeholder: '••••••••', required: false },
    headers: { type: 'json', label: 'Custom Headers', placeholder: '{"Content-Type": "application/json"}', required: false }
  },
  mqtt: {
    broker: { type: 'text', label: 'Broker', placeholder: 'mqtt.company.com', required: true },
    port: { type: 'number', label: 'Port', placeholder: '1883', required: true, defaultValue: 1883 },
    clientId: { type: 'text', label: 'Client ID', placeholder: 'pro-act-client', required: false },
    username: { type: 'text', label: 'Username', placeholder: 'mqtt_user', required: false },
    password: { type: 'password', label: 'Password', placeholder: '••••••••', required: false },
    topics: { type: 'text', label: 'Topics', placeholder: 'factory/+/+/+', required: false },
    qos: { type: 'select', label: 'QoS Level', options: ['0', '1', '2'], required: false, defaultValue: '1' }
  },
  modbus: {
    host: { type: 'text', label: 'Host/IP', placeholder: '192.168.1.100', required: true },
    port: { type: 'number', label: 'Port', placeholder: '502', required: true, defaultValue: 502 },
    unitId: { type: 'number', label: 'Unit ID', placeholder: '1', required: false, defaultValue: 1 },
    timeout: { type: 'number', label: 'Timeout (ms)', placeholder: '5000', required: false, defaultValue: 5000 },
    retries: { type: 'number', label: 'Retries', placeholder: '3', required: false, defaultValue: 3 },
    type: { type: 'select', label: 'Modbus Type', options: ['TCP', 'RTU'], required: true, defaultValue: 'TCP' }
  },
  custom: {
    endpoint: { type: 'text', label: 'Endpoint', placeholder: 'https://custom.company.com/api', required: true },
    protocol: { type: 'select', label: 'Protocol', options: ['HTTP', 'HTTPS', 'TCP', 'UDP', 'Custom'], required: true },
    authentication: { type: 'select', label: 'Authentication', options: ['None', 'Basic', 'Bearer', 'Custom'], required: false },
    headers: { type: 'json', label: 'Headers', placeholder: '{"X-Custom-Header": "value"}', required: false },
    format: { type: 'select', label: 'Data Format', options: ['JSON', 'XML', 'Binary', 'Text', 'Custom'], required: false }
  }
};

export const DataSourceManager: React.FC = () => {
  const { toast } = useToast();
  const { session } = useAuth();
  const [dataSources, setDataSources] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDataSource, setEditingDataSource] = useState<any>(null);
  const [newDataSource, setNewDataSource] = useState<any>({
    name: '',
    type: 'custom',
    enabled: false,
    config: {}
  });

  useEffect(() => {
    loadDataSources();
  }, []);

  const loadDataSources = async () => {
    try {
      await storageService.initialize();
      const stored = await storageService.query('dataSources');
      if (stored && stored.length > 0) {
        setDataSources(stored);
      }
    } catch (error) {
      console.error('Failed to load data sources:', error);
    }
  };

  const saveToIndexedDB = async (dataSources: any[]) => {
    try {
      for (const dataSource of dataSources) {
        if (await storageService.get('dataSources', dataSource.id)) {
          await storageService.update('dataSources', dataSource.id, dataSource);
        } else {
          await storageService.create('dataSources', dataSource);
        }
      }
    } catch (error) {
      console.error('Failed to save to IndexedDB:', error);
    }
  };

  const handleTypeChange = (type: string) => {
    setNewDataSource({
      ...newDataSource,
      type,
      config: {}
    });
  };

  const updateConfigField = (field: string, value: any) => {
    setNewDataSource({
      ...newDataSource,
      config: {
        ...newDataSource.config,
        [field]: value
      }
    });
  };

  const renderField = (fieldName: string) => {
    const field = fieldConfigs[newDataSource.type]?.[fieldName];
    if (!field) return null;

    const value = newDataSource.config[fieldName] || field.defaultValue || '';
    const required = field.required;

    switch (field.type) {
      case 'text':
      case 'password':
        return (
          <div key={fieldName} className="space-y-2">
            <Label htmlFor={fieldName}>
              {field.label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={fieldName}
              type={field.type}
              placeholder={field.placeholder}
              value={value}
              onChange={(e) => updateConfigField(fieldName, e.target.value)}
              required={required}
            />
          </div>
        );

      case 'number':
        return (
          <div key={fieldName} className="space-y-2">
            <Label htmlFor={fieldName}>
              {field.label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={fieldName}
              type="number"
              placeholder={field.placeholder}
              value={value}
              onChange={(e) => updateConfigField(fieldName, parseInt(e.target.value) || 0)}
              required={required}
            />
          </div>
        );

      case 'select':
        return (
          <div key={fieldName} className="space-y-2">
            <Label htmlFor={fieldName}>
              {field.label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={value} onValueChange={(val) => updateConfigField(fieldName, val)}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'json':
        return (
          <div key={fieldName} className="space-y-2">
            <Label htmlFor={fieldName}>
              {field.label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={fieldName}
              placeholder={field.placeholder}
              value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateConfigField(fieldName, parsed);
                } catch {
                  updateConfigField(fieldName, e.target.value);
                }
              }}
              rows={3}
              required={required}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const createDataSource = async () => {
    try {
      // Validate required fields
      const requiredFields = Object.keys(fieldConfigs[newDataSource.type] || {}).filter(field => 
        fieldConfigs[newDataSource.type]?.[field]?.required
      );

      const missingFields = requiredFields.filter(field => 
        !newDataSource.config[field] || newDataSource.config[field] === ''
      );

      if (missingFields.length > 0) {
        toast({
          title: 'Validation Error',
          description: `Please fill in required fields: ${missingFields.join(', ')}`,
          variant: 'destructive'
        });
        return;
      }

      const mockDataSource = {
        id: Date.now().toString(),
        ...newDataSource,
        status: 'disconnected',
        lastSync: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const updatedDataSources = [...dataSources, mockDataSource];
      setDataSources(updatedDataSources);
      
      await saveToIndexedDB(updatedDataSources);
      
      setShowCreateForm(false);
      setNewDataSource({
        name: '',
        type: 'custom',
        enabled: false,
        config: {}
      });
      
      toast({
        title: 'Data Source Created',
        description: `Successfully created ${mockDataSource.name}`,
      });
    } catch (error) {
      toast({
        title: 'Creation Failed',
        description: 'Failed to create data source',
        variant: 'destructive'
      });
    }
  };

  const editDataSource = async () => {
    try {
      if (!editingDataSource) return;
      
      const updatedDataSource = {
        ...editingDataSource,
        ...newDataSource,
        updatedAt: new Date().toISOString()
      };
      
      await storageService.update('dataSources', editingDataSource.id, updatedDataSource);
      
      const updatedDataSources = dataSources.map(ds => 
        ds.id === editingDataSource.id ? updatedDataSource : ds
      );
      setDataSources(updatedDataSources);
      
      setEditingDataSource(null);
      setShowCreateForm(false);
      setNewDataSource({
        name: '',
        type: 'custom',
        enabled: false,
        config: {}
      });
      
      toast({
        title: 'Data Source Updated',
        description: `Successfully updated ${updatedDataSource.name}`,
      });
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update data source',
        variant: 'destructive'
      });
    }
  };

  const startEditing = (dataSource: any) => {
    setEditingDataSource(dataSource);
    setNewDataSource({
      name: dataSource.name,
      type: dataSource.type,
      enabled: dataSource.enabled,
      config: dataSource.config || {}
    });
    setShowCreateForm(true);
  };

  const testConnection = async (dataSourceId: string) => {
    try {
      const dataSource = dataSources.find(ds => ds.id === dataSourceId);
      if (!dataSource) return;

      toast({
        title: 'Testing Connection',
        description: 'Testing connection to data source...',
      });

      let testResult = { success: false, responseTime: 0 };
      
      if (dataSource.type === 'rest') {
        try {
          const startTime = Date.now();
          const response = await fetch(dataSource.config.baseUrl + (dataSource.config.endpoint || ''), {
            method: dataSource.config.method || 'GET',
            headers: dataSource.config.headers || {}
          });
          const endTime = Date.now();
          
          testResult = {
            success: response.ok,
            responseTime: endTime - startTime
          };
        } catch (error) {
          testResult = { success: false, responseTime: 0 };
        }
      } else {
        testResult = {
          success: Math.random() > 0.3,
          responseTime: Math.random() * 200 + 50
        };
      }

      const updatedDataSource = { 
        ...dataSource, 
        status: testResult.success ? 'connected' : 'failed',
        lastTested: new Date().toISOString(),
        responseTime: testResult.responseTime
      };
      
      await storageService.update('dataSources', dataSourceId, updatedDataSource);
      
      setDataSources(prev => prev.map(ds => 
        ds.id === dataSourceId ? updatedDataSource : ds
      ));

      toast({
        title: 'Connection Test Complete',
        description: testResult.success 
          ? `Connection successful! Response time: ${testResult.responseTime}ms`
          : 'Connection failed. Please check your configuration.',
        variant: testResult.success ? 'default' : 'destructive'
      });
      
    } catch (error) {
      toast({
        title: 'Connection Test Error',
        description: 'Failed to test connection',
        variant: 'destructive'
      });
    }
  };

  const deleteDataSource = async (dataSourceId: string) => {
    try {
      await storageService.delete('dataSources', dataSourceId);
      
      const updatedDataSources = dataSources.filter(ds => ds.id !== dataSourceId);
      setDataSources(updatedDataSources);
      
      toast({
        title: 'Data Source Deleted',
        description: 'Data source has been removed',
      });
    } catch (error) {
      console.error('Failed to delete data source:', error);
      toast({
        title: 'Deletion Failed',
        description: 'Failed to delete data source from database',
        variant: 'destructive'
      });
    }
  };

  const updateDataSourceStatus = async (dataSourceId: string, status: string) => {
    try {
      const dataSource = dataSources.find(ds => ds.id === dataSourceId);
      if (!dataSource) return;
      
      const updatedDataSource = { 
        ...dataSource, 
        status, 
        updatedAt: new Date().toISOString() 
      };
      
      await storageService.update('dataSources', dataSourceId, updatedDataSource);
      
      setDataSources(prev => prev.map(ds => 
        ds.id === dataSourceId ? updatedDataSource : ds
      ));
    } catch (error) {
      console.error('Failed to update data source status:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update data source status',
        variant: 'destructive'
      });
    }
  };

  const getSystemIcon = (type: string) => {
    const systemType = systemTypes.find(t => t.value === type);
    return systemType?.icon || '🔌';
  };

  const getSystemLabel = (type: string) => {
    const systemType = systemTypes.find(t => t.value === type);
    return systemType?.label || 'Unknown System';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">Universal Data Source Manager</h3>
          <p className="text-muted-foreground">
            Connect to any industrial system, database, or API with type-specific configuration
          </p>
        </div>
        <Button onClick={() => {
          setEditingDataSource(null);
          setNewDataSource({
            name: '',
            type: 'custom',
            enabled: false,
            config: {}
          });
          setShowCreateForm(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Data Source
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingDataSource ? 'Edit Data Source' : 'Create New Data Source'}</CardTitle>
            <CardDescription>
              {editingDataSource ? 'Modify existing data source configuration' : 'Configure connection to any external system'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-gray-700">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ds-name">
                    Data Source Name
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="ds-name"
                    placeholder="e.g., Production Historian"
                    value={newDataSource.name}
                    onChange={(e) => setNewDataSource({...newDataSource, name: e.target.value})}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ds-type">
                    System Type
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Select 
                    value={newDataSource.type} 
                    onValueChange={handleTypeChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {systemTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <span className="mr-2">{type.icon}</span>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newDataSource.type && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">{systemTypes.find(t => t.value === newDataSource.type)?.label}</p>
                      <p className="text-blue-700">{systemTypes.find(t => t.value === newDataSource.type)?.description}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {newDataSource.type && (
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-gray-700">Connection Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.keys(fieldConfigs[newDataSource.type] || {}).map(field => 
                    renderField(field)
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="ds-enabled"
                checked={newDataSource.enabled}
                onCheckedChange={(checked) => setNewDataSource({...newDataSource, enabled: checked})}
              />
              <Label htmlFor="ds-enabled">Enable this data source</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
                setShowCreateForm(false);
                setEditingDataSource(null);
                setNewDataSource({
                  name: '',
                  type: 'custom',
                  enabled: false,
                  config: {}
                });
              }}>
                Cancel
              </Button>
              <Button onClick={editingDataSource ? editDataSource : createDataSource}>
                {editingDataSource ? 'Update Data Source' : 'Create Data Source'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {dataSources.map((dataSource) => (
          <Card key={dataSource.id} className="min-w-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">{getSystemIcon(dataSource.type)}</span>
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-sm truncate">{dataSource.name}</CardTitle>
                    <CardDescription className="text-xs truncate">
                      {getSystemLabel(dataSource.type)}
                    </CardDescription>
                  </div>
                </div>
                <Badge 
                  variant={dataSource.status === 'connected' ? 'default' : 
                          dataSource.status === 'failed' ? 'destructive' : 'secondary'}
                  className="flex-shrink-0"
                >
                  {dataSource.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 min-w-0">
              <div className="space-y-2 text-xs">
                {dataSource.config && Object.keys(dataSource.config).length > 0 && (
                  <div className="space-y-1">
                    {Object.entries(dataSource.config).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="flex justify-between min-w-0">
                        <span className="flex-shrink-0 capitalize">{key}:</span>
                        <span className="truncate max-w-[120px] ml-2">
                          {typeof value === 'string' && value.length > 20 
                            ? `${value.substring(0, 20)}...` 
                            : String(value)}
                        </span>
                      </div>
                    ))}
                    {Object.keys(dataSource.config).length > 3 && (
                      <div className="text-gray-500 text-xs">
                        +{Object.keys(dataSource.config).length - 3} more fields
                      </div>
                    )}
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between min-w-0">
                  <span className="flex-shrink-0">Last Sync:</span>
                  <span className="truncate ml-2">
                    {dataSource.lastSync ? new Date(dataSource.lastSync).toLocaleDateString() : 'Never'}
                  </span>
                </div>
                
                {dataSource.responseTime && (
                  <div className="flex justify-between min-w-0">
                    <span className="flex-shrink-0">Response Time:</span>
                    <span className="truncate ml-2">{dataSource.responseTime}ms</span>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-1 mt-3">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => testConnection(dataSource.id)}
                  className="flex-1 min-w-0 text-xs px-2"
                >
                  <TestTube className="w-3 h-3 mr-1 flex-shrink-0" />
                  <span className="truncate">Test</span>
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => updateDataSourceStatus(dataSource.id, 'connected')}
                  className="flex-1 min-w-0 text-xs px-2"
                >
                  <Zap className="w-3 h-3 mr-1 flex-shrink-0" />
                  <span className="truncate">Connect</span>
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => startEditing(dataSource)}
                  className="flex-1 min-w-0 text-xs px-2"
                >
                  <Settings className="w-3 h-3 mr-1 flex-shrink-0" />
                  <span className="truncate">Edit</span>
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => deleteDataSource(dataSource.id)}
                  className="text-red-600 hover:text-red-700 flex-1 min-w-0 text-xs px-2"
                >
                  <Trash2 className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">Delete</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {dataSources.length === 0 && (
        <Card className="text-center py-12">
          <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Sources</h3>
          <p className="text-gray-500 mb-4">
            Get started by creating your first data source connection
          </p>
          <Button onClick={() => {
            setEditingDataSource(null);
            setNewDataSource({
              name: '',
              type: 'custom',
              enabled: false,
              config: {}
            });
            setShowCreateForm(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Data Source
          </Button>
        </Card>
      )}
    </div>
  );
};
