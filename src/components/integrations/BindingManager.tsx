// Hierarchy Binding Manager - Map external systems to Pro-Act hierarchy
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  Plus, 
  Link, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  Trash2,
  ArrowRight,
  Database,
  Building,
  Users,
  Package,
  ChevronDown,
  ChevronRight,
  Folder,
  Box
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../../contexts/AuthContext';


export const BindingManager: React.FC = () => {
  const { toast } = useToast();
  const { session } = useAuth();
  const [bindings, setBindings] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBinding, setNewBinding] = useState({
    name: '',
    sourceId: '',
    sourcePath: '',
    targetType: 'asset',
    targetId: '',
    mappingRules: [],
    enabled: true
  });

  // Load hierarchy and data sources from IndexedDB
  const [hierarchyNodes, setHierarchyNodes] = useState<any[]>([]);
  const [dataSources, setDataSources] = useState<Array<{ id: string; name: string; type: string; connectionString: string; customHeaders?: Array<{ key: string; value: string }> }>>([]);
  const [dataSourceFields, setDataSourceFields] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [fieldExplorerModal, setFieldExplorerModal] = useState<{
    isOpen: boolean;
    field: any;
    dataSource: any;
  }>({ isOpen: false, field: null, dataSource: null });
  
  // Type definitions for connection test results
  type ConnectionTestResult = 
    | { success: true; status: number; statusText: string; headers: Record<string, string> }
    | { success: false; error: string };

  // Helper function to try CORS proxies
  const tryCorsProxies = async (url: string, originalHeaders: Record<string, string>): Promise<Response | null> => {
    const proxies = [
      'https://api.allorigins.win/raw?url=',
      'https://cors-anywhere.herokuapp.com/',
      'https://cors.bridged.cc/'
    ];

    for (const proxy of proxies) {
      try {
        const proxyUrl = proxy + encodeURIComponent(url);
        console.log(`Trying proxy: ${proxy}`);
        
        // For CORS proxies, we need to strip out custom headers that might cause issues
        // Only send basic headers that proxies can handle
        const proxyHeaders: Record<string, string> = {
          'Origin': window.location.origin,
          'Accept': 'application/json'
        };
        
        // Special handling for RapidAPI - some proxies work better with minimal headers
        if (url.includes('rapidapi.com')) {
          console.log('RapidAPI detected, using minimal headers for proxy');
          const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            console.log(`✅ Proxy ${proxy} succeeded for RapidAPI`);
            return response;
          }
        } else {
          const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: proxyHeaders
          });

          if (response.ok) {
            console.log(`✅ Proxy ${proxy} succeeded`);
            return response;
          }
        }
      } catch (proxyError) {
        console.log(`❌ Proxy ${proxy} failed:`, proxyError);
        continue;
      }
    }
    return null;
  };

  const [connectionStatus, setConnectionStatus] = useState<Record<string, {
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
    details?: ConnectionTestResult;
  }>>({});

  // Load data from IndexedDB
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const { storageService } = await import('../../services/StorageService');
        await storageService.initialize();
        
        // Load data sources
        const stored = await storageService.query('dataSources');
        if (stored && stored.length > 0) {
          setDataSources(stored as unknown as Array<{ id: string; name: string; type: string; connectionString: string; customHeaders?: Array<{ key: string; value: string }> }>);
          
          // Generate sample fields for each data source type with nested structure
          const fields: Record<string, any[]> = {};
          stored.forEach((ds: any) => {
            if (ds.type === 'rest' || ds.type === 'custom') {
              fields[ds.id] = [
                { 
                  name: 'response', 
                  path: 'response', 
                  type: 'object',
                  children: [
                    { name: 'data', path: 'response.data', type: 'array', description: 'Array of data points - actual fields will be discovered from API response' },
                { name: 'metadata', path: 'response.metadata', type: 'object', description: 'Metadata object - actual fields will be discovered from API response' }
                  ]
                },
                { name: 'status', path: 'status', type: 'string', description: 'HTTP status code' },
                { name: 'timestamp', path: 'timestamp', type: 'string', description: 'Request timestamp' }
              ];
            } else if (ds.type === 'historian') {
              fields[ds.id] = [
                { name: 'tag_value', path: 'tag_value', type: 'number', description: 'Tag value' },
                { name: 'timestamp', path: 'timestamp', type: 'string', description: 'Data timestamp' },
                { name: 'quality', path: 'quality', type: 'string', description: 'Data quality' },
                { name: 'units', path: 'units', type: 'string', description: 'Measurement units' }
              ];
            } else if (ds.type === 'database') {
              fields[ds.id] = [
                { name: 'column_value', path: 'column_value', type: 'any', description: 'Column data' },
                { name: 'row_id', path: 'row_id', type: 'string', description: 'Row identifier' },
                { name: 'table_name', path: 'table_name', type: 'string', description: 'Table name' }
              ];
            } else {
              fields[ds.id] = [
                { name: 'value', path: 'value', type: 'any', description: 'Data value' },
                { name: 'timestamp', path: 'timestamp', type: 'string', description: 'Data timestamp' }
              ];
            }
          });
          setDataSourceFields(fields);
        }

        // Load or create sample hierarchy data
        let orgs = await storageService.query('organizations');
        let tnts = await storageService.query('tenants');
        let unts = await storageService.query('units');
        let asts = await storageService.query('assets');

        // Only create sample organization and tenant if none exist
        if (!orgs || orgs.length === 0) {
          const sampleOrg = {
            id: 'org-1',
            name: 'Pro-Act Manufacturing',
            code: 'PAM',
            description: 'Main manufacturing organization',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await storageService.create('organizations', sampleOrg as any);
          orgs = [sampleOrg];
        }

        if (!tnts || tnts.length === 0) {
          const sampleTenant = {
            id: 'tenant-1',
            name: 'Production Plant A',
            code: 'PPA',
            description: 'Main production facility',
            organizationId: orgs[0].id,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await storageService.create('tenants', sampleTenant as any);
          tnts = [sampleTenant];
        }

        // Don't create sample units or assets - only show what exists
        // Units and assets will be loaded from your actual IndexedDB data

        // Build hierarchy from the data
        const realHierarchy = orgs.map((org: any) => ({
          id: org.id,
          name: org.name,
          type: 'organization',
          children: tnts
            .filter((tenant: any) => tenant.organizationId === org.id)
            .map((tenant: any) => ({
              id: tenant.id,
              name: tenant.name,
              type: 'tenant',
              children: unts
                .filter((unit: any) => unit.tenantId === tenant.id)
                .map((unit: any) => ({
                  id: unit.id,
                  name: unit.name,
                  type: 'unit',
                  children: asts
                    .filter((asset: any) => asset.unitId === unit.id)
                    .map((asset: any) => ({
                      id: asset.id,
                      name: asset.name,
                      type: 'asset'
                    }))
                }))
            }))
        }));
        
        setHierarchyNodes(realHierarchy);
        
        // Expand all nodes by default for better visibility
        const allNodeIds = new Set<string>();
        const collectNodeIds = (nodes: any[]) => {
          nodes.forEach(node => {
            allNodeIds.add(node.id);
            if (node.children) collectNodeIds(node.children);
          });
        };
        collectNodeIds(realHierarchy);
        setExpandedNodes(allNodeIds);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  const createBinding = async () => {
    try {
      const mockBinding = {
        id: Date.now().toString(),
        ...newBinding,
        status: 'active',
        lastSync: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      
      setBindings([...bindings, mockBinding]);
      setShowCreateForm(false);
      setNewBinding({
        name: '',
        sourceId: '',
        sourcePath: '',
        targetType: 'asset',
        targetId: '',
        mappingRules: [],
        enabled: true
      });
      
      toast({
        title: 'Binding Created',
        description: `Successfully created binding: ${mockBinding.name}`,
      });
    } catch (error) {
      toast({
        title: 'Creation Failed',
        description: 'Failed to create binding',
        variant: 'destructive'
      });
    }
  };

  const testBinding = async (bindingId: string) => {
    try {
      const binding = bindings.find(b => b.id === bindingId);
      if (!binding) return;

      toast({
        title: 'Testing Binding',
        description: 'Testing data source connection...',
      });

      // Find the data source
      const dataSource = dataSources.find(ds => ds.id === binding.sourceId);
      if (!dataSource) {
        toast({
          title: 'Test Failed',
          description: 'Data source not found',
          variant: 'destructive'
        });
        return;
      }

      // Test the connection using the data source
      if (dataSource.type === 'rest' || dataSource.type === 'custom') {
        try {
          const connectionTest = await testConnection(dataSource);
          if (connectionTest.success) {
            toast({
              title: 'Binding Test Successful',
              description: `Successfully connected to ${dataSource.name}`,
            });
          } else {
            toast({
              title: 'Binding Test Failed',
              description: (connectionTest as { success: false; error: string }).error,
              variant: 'destructive'
            });
          }
        } catch (error) {
          toast({
            title: 'Binding Test Failed',
            description: 'Connection error: ' + (error as Error).message,
            variant: 'destructive'
          });
        }
      } else {
        // Simulate test for other data source types
        toast({
          title: 'Binding Test Successful',
          description: `Simulated connection to ${dataSource.name}`,
        });
      }
    } catch (error) {
      toast({
        title: 'Test Error',
        description: 'Failed to test binding',
        variant: 'destructive'
      });
    }
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  // Helper function to flatten nested fields
  const flattenFields = (fields: any[]): any[] => {
    const result: any[] = [];
    fields.forEach(field => {
      if (field.type === 'object' && field.children) {
        result.push(...flattenFields(field.children));
      } else if (field.type === 'array' && field.children) {
        result.push(...flattenFields(field.children));
      } else {
        result.push(field);
      }
    });
    return result;
  };

  // Helper function to flatten a single field
  const flattenField = (field: any, fieldName: string): any => {
    return {
      name: fieldName,
      path: field.path,
      type: field.type,
      description: field.description
    };
  };

    // Function to test connection before discovering fields
  const testConnection = async (dataSource: any): Promise<ConnectionTestResult> => {
    try {
      if (!dataSource.connectionString) {
        throw new Error('No connection string provided');
      }

      // Update status to testing
      setConnectionStatus(prev => ({
        ...prev,
        [dataSource.id]: { status: 'testing', message: 'Testing connection...' }
      }));

      const headers: Record<string, string> = {};
      
      // Add custom headers if they exist
      if (dataSource.customHeaders) {
        dataSource.customHeaders.forEach((header: any) => {
          const key = header.key?.trim();
          const value = header.value?.trim();
          if (key && value && key !== '' && value !== '') {
            headers[key] = value;
          }
        });
      }

      console.log(`Testing connection to: ${dataSource.connectionString}`);
      let response = await fetch(dataSource.connectionString, {
        method: 'GET',
        headers
      });

      // If direct connection fails with CORS or auth issues, try CORS proxy
      if (!response.ok && (response.status === 403 || response.status === 401 || response.status === 0)) {
        console.log('Direct connection failed, trying CORS proxy...');
        
        const proxyResponse = await tryCorsProxies(dataSource.connectionString, headers);
        if (proxyResponse) {
          response = proxyResponse;
        }
      }

      if (response.ok) {
        const result: ConnectionTestResult = {
          success: true,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        };

        // Update status based on result
        setConnectionStatus(prev => ({
          ...prev,
          [dataSource.id]: { 
            status: 'success', 
            message: 'Connection successful',
            details: result
          }
        }));

        return result;
      } else {
        const result: ConnectionTestResult = {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };

        // Update status based on result
        setConnectionStatus(prev => ({
          ...prev,
          [dataSource.id]: { 
            status: 'error', 
            message: result.error,
            details: result
          }
        }));

        return result;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update status to error
      setConnectionStatus(prev => ({
        ...prev,
        [dataSource.id]: { 
          status: 'error', 
          message: errorMessage,
          details: { error: errorMessage }
        }
      }));

      return {
        success: false,
        error: errorMessage
      };
    }
  };

  // Function to discover actual fields from REST API
  const discoverRESTFields = async (dataSource: any) => {
    try {
      // Validate data source
      if (!dataSource.connectionString) {
        throw new Error('No connection string provided');
      }

      // Test connection first and get the response
      const connectionTest = await testConnection(dataSource);
      if (!connectionTest.success) {
        throw new Error((connectionTest as { success: false; error: string }).error);
      }

      // Since testConnection already succeeded, we can use the same approach
      // to get the actual data for field discovery
      const headers: Record<string, string> = {};
      
      // Add custom headers if they exist
      if (dataSource.customHeaders) {
        dataSource.customHeaders.forEach((header: any) => {
          const key = header.key?.trim();
          const value = header.value?.trim();
          if (key && value && key !== '' && value !== '') {
            headers[key] = value;
          }
        });
      }

      // Use the same proxy logic that worked in testConnection
      console.log(`Getting data for field discovery from: ${dataSource.connectionString}`);
      let response = await fetch(dataSource.connectionString, {
        method: 'GET',
        headers
      });

      // If direct connection fails, use the same proxy logic
      if (!response.ok && (response.status === 403 || response.status === 401 || response.status === 0)) {
        console.log('Direct connection failed for field discovery, trying CORS proxy...');
        
        const proxyResponse = await tryCorsProxies(dataSource.connectionString, headers);
        if (proxyResponse) {
          response = proxyResponse;
        }
      }

      if (response.ok) {
        const data = await response.json();
        return analyzeResponseStructure(data);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to discover REST fields:', error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('403')) {
        toast({
          title: 'Authentication Required',
          description: 'This API requires proper authentication. Please check your API key and headers in the Data Source Manager.',
          variant: 'destructive'
        });
      } else if (errorMessage.includes('401')) {
        toast({
          title: 'Unauthorized',
          description: 'Invalid API credentials. Please verify your API key and authentication settings.',
          variant: 'destructive'
        });
      } else if (errorMessage.includes('404')) {
        toast({
          title: 'API Endpoint Not Found',
          description: 'The API endpoint URL appears to be incorrect. Please verify the connection string.',
          variant: 'destructive'
        });
      } else if (errorMessage.includes('Failed to fetch')) {
        toast({
          title: 'Connection Failed',
          description: 'Unable to reach the API endpoint. Check your connection string and network connectivity.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: `Failed to connect to API: ${errorMessage}`,
          variant: 'destructive'
        });
      }
      
      // Return basic structure if discovery fails
      return [
        { name: 'response', path: 'response', type: 'object', description: 'API response - authentication required to see actual structure' },
        { name: 'status', path: 'status', type: 'string', description: 'HTTP status code' },
        { name: 'timestamp', path: 'timestamp', type: 'string', description: 'Request timestamp' }
      ];
    }
  };

  // Function to analyze response structure and create field tree
  const analyzeResponseStructure = (data: any, path = '', maxDepth = 3, currentDepth = 0): any[] => {
    if (currentDepth >= maxDepth || data === null || data === undefined) {
      return [];
    }

    const fields: any[] = [];
    
    if (Array.isArray(data)) {
      if (data.length > 0) {
        // Analyze first item in array to understand structure
        const sampleItem = data[0];
        const arrayFields = analyzeResponseStructure(sampleItem, `${path}[0]`, maxDepth, currentDepth + 1);
        fields.push({
          name: 'array_item',
          path: path || 'data',
          type: 'array',
          description: `Array with ${data.length} items`,
          children: arrayFields
        });
      } else {
        fields.push({
          name: 'array_item',
          path: path || 'data',
          type: 'array',
          description: 'Empty array'
        });
      }
    } else if (typeof data === 'object') {
      Object.keys(data).forEach(key => {
        const value = data[key];
        const fieldPath = path ? `${path}.${key}` : key;
        const fieldType = Array.isArray(value) ? 'array' : typeof value;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const children = analyzeResponseStructure(value, fieldPath, maxDepth, currentDepth + 1);
          fields.push({
            name: key,
            path: fieldPath,
            type: fieldType,
            description: `Object with ${Object.keys(value).length} properties`,
            children: children.length > 0 ? children : undefined,
            rawData: value // Store raw data for exploration
          });
        } else {
          fields.push({
            name: key,
            path: fieldPath,
            type: fieldType,
            description: `${fieldType} value`,
            rawData: value
          });
        }
      });
    }

    return fields;
  };

  // Function to explore object fields in detail
  const exploreObjectField = async (field: any, dataSource: any) => {
    if (field.type === 'object' && field.rawData) {
      // If we have raw data, use it directly
      setFieldExplorerModal({
        isOpen: true,
        field: field,
        dataSource: dataSource
      });
    } else if (field.type === 'object' && !field.rawData) {
      // If no raw data, try to fetch it from the API
      try {
        const response = await fetch(dataSource.connectionString, {
          method: 'GET',
          headers: getHeaders(dataSource)
        });
        
        if (response.ok) {
          const data = await response.json();
          const fieldData = getNestedValue(data, field.path);
          
          if (fieldData) {
            setFieldExplorerModal({
              isOpen: true,
              field: { ...field, rawData: fieldData },
              dataSource: dataSource
            });
          }
        }
      } catch (error) {
        console.error('Failed to explore object field:', error);
        toast({
          title: 'Exploration Failed',
          description: 'Could not fetch object data for exploration',
          variant: 'destructive'
        });
      }
    }
  };

  // Helper function to get nested value from path
  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  };

  // Helper function to get headers for API calls
  const getHeaders = (dataSource: any): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (dataSource.customHeaders) {
      dataSource.customHeaders.forEach((header: any) => {
        const key = header.key?.trim();
        const value = header.value?.trim();
        if (key && value && key !== '' && value !== '') {
          headers[key] = value;
        }
      });
    }
    return headers;
  };

  // ObjectStructureViewer component for exploring object fields
  const ObjectStructureViewer: React.FC<{
    data: any;
    path: string;
    onFieldSelect: (fieldPath: string, fieldData: any) => void;
  }> = ({ data, path, onFieldSelect }) => {
    const renderValue = (value: any, fieldPath: string) => {
      if (value === null || value === undefined) {
        return <span className="text-gray-400 italic">null</span>;
      }
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        return (
          <div className="ml-4 border-l-2 border-gray-200 pl-3">
            {Object.keys(value).map(key => (
              <div key={key} className="mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">{key}:</span>
                  <span className="text-xs text-gray-500">({typeof value[key]})</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onFieldSelect(`${fieldPath}.${key}`, value[key])}
                    className="h-5 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    + Add to Mapping
                  </Button>
                </div>
                {typeof value[key] === 'object' && value[key] !== null && !Array.isArray(value[key]) && (
                  <div className="ml-4">
                    {renderValue(value[key], `${fieldPath}.${key}`)}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      }
      
      if (Array.isArray(value)) {
        return (
          <div className="ml-4">
            <span className="text-sm text-gray-600">Array with {value.length} items</span>
            {value.length > 0 && (
              <div className="ml-4 border-l-2 border-gray-200 pl-3 mt-1">
                <div className="text-xs text-gray-500 mb-1">First item structure:</div>
                {renderValue(value[0], `${fieldPath}[0]`)}
              </div>
            )}
          </div>
        );
      }
      
      return (
        <span className="text-sm text-gray-800">
          {typeof value === 'string' ? `"${value}"` : String(value)}
        </span>
      );
    };

    return (
      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-700">Object Structure:</div>
        {renderValue(data, path)}
      </div>
    );
  };

  // FieldTree component for nested field display
  const FieldTree: React.FC<{
    field: any;
    isSelected: (fieldName: string) => boolean;
    onFieldToggle: (fieldName: string, isChecked: boolean) => void;
  }> = ({ field, isSelected, onFieldToggle }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasChildren = field.children && field.children.length > 0;
    
    return (
      <div className="mb-2">
        <div className="flex items-center gap-2 p-1 hover:bg-white rounded">
          {hasChildren ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-4 h-4 flex items-center justify-center hover:bg-blue-100 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-blue-600" />
              ) : (
                <ChevronRight className="w-3 h-3 text-blue-600" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}
          
          <input
            type="checkbox"
            id={`field-${field.name}`}
            checked={isSelected(field.name)}
            onChange={(e) => onFieldToggle(field.name, e.target.checked)}
            className="w-3 h-3"
          />
          
          <label htmlFor={`field-${field.name}`} className="cursor-pointer flex-1">
            <span className="font-medium text-sm">{field.name}</span>
            <span className="text-muted-foreground ml-2 text-xs">({field.type})</span>
            {field.description && (
              <span className="text-muted-foreground ml-2 text-xs">- {field.description}</span>
            )}
          </label>
          
          {/* Explore button for objects */}
          {field.type === 'object' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                const dataSource = dataSources.find(ds => ds.id === newBinding.sourceId);
                if (dataSource) {
                  exploreObjectField(field, dataSource);
                }
              }}
              className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              title="Explore object structure"
            >
              🔍 Explore
            </Button>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div className="ml-6 border-l-2 border-gray-200 pl-3">
            {field.children.map((child: any, index: number) => (
              <FieldTree
                key={index}
                field={child}
                isSelected={isSelected}
                onFieldToggle={onFieldToggle}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderHierarchyTree = (nodes: any[], level = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);
      
      return (
        <div key={node.id}>
          <div
            className="group flex items-center gap-2 py-1 px-2 rounded-md transition-colors hover:bg-blue-50"
            style={{ paddingLeft: level * 16 }}
          >
            {hasChildren ? (
              <button
                className="p-1 rounded hover:bg-blue-100 text-blue-700"
                onClick={() => toggleNode(node.id)}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-4 h-4" />
            )}
            {hasChildren ? (
              isExpanded ? <Folder className="w-4 h-4 text-amber-600" /> : <Folder className="w-4 h-4 text-amber-600" />
            ) : (
              <Box className="w-4 h-4 text-slate-500" />
            )}
            <span className="text-sm font-medium text-slate-800 truncate">{node.name}</span>
            <Badge variant="outline" className="text-xs ml-2">{node.type}</Badge>
          </div>
          {hasChildren && isExpanded && renderHierarchyTree(node.children, level + 1)}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">Hierarchy Binding Manager</h3>
          <p className="text-muted-foreground">
            Map external system data to your Pro-Act organizational hierarchy
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Binding
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Create Binding Form */}
        <div className="space-y-4">
          {showCreateForm && (
            <Card>
              <CardHeader>
                <CardTitle>Create New Binding</CardTitle>
                <CardDescription>
                  Connect external data to Pro-Act hierarchy
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="binding-name">Binding Name</Label>
                  <Input
                    id="binding-name"
                    placeholder="e.g., Temperature to Reactor R-101"
                    value={newBinding.name}
                    onChange={(e) => setNewBinding({...newBinding, name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="binding-source">Data Source</Label>
                  <Select 
                    value={newBinding.sourceId} 
                    onValueChange={(value) => setNewBinding({...newBinding, sourceId: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select data source" />
                    </SelectTrigger>
                    <SelectContent>
                      {dataSources.map((ds) => (
                        <SelectItem key={ds.id} value={ds.id}>
                          <div className="flex items-center gap-2">
                            <span>{ds.name} ({ds.type})</span>
                            {ds.connectionString && (
                              <span className="text-xs text-muted-foreground">
                                {ds.connectionString.length > 30 
                                  ? `${ds.connectionString.substring(0, 30)}...` 
                                  : ds.connectionString
                                }
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newBinding.sourceId && (
                    <div className="text-xs text-muted-foreground">
                      Selected: {dataSources.find(ds => ds.id === newBinding.sourceId)?.connectionString || 'No connection string'}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="binding-path">Source Path/Tag</Label>
                  <Input
                    id="binding-path"
                    placeholder="e.g., TEMP_101 or /api/temperature"
                    value={newBinding.sourcePath}
                    onChange={(e) => setNewBinding({...newBinding, sourcePath: e.target.value})}
                  />
                </div>

                {newBinding.sourceId && dataSourceFields[newBinding.sourceId] && (
                  <div className="space-y-2">
                    <Label>Available Fields</Label>
                    <div className="text-xs text-muted-foreground mb-2">
                      Select fields to bind from the data source
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="flex gap-2 mb-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const dataSource = dataSources.find(ds => ds.id === newBinding.sourceId);
                          if (dataSource && (dataSource.type === 'rest' || dataSource.type === 'custom')) {
                            // Test connection first
                            toast({
                              title: 'Testing Connection',
                              description: 'Testing connection to data source...',
                            });
                            
                            const connectionTest = await testConnection(dataSource);
                            if (!connectionTest.success) {
                              toast({
                                title: 'Connection Failed',
                                description: (connectionTest as { success: false; error: string }).error,
                                variant: 'destructive'
                              });
                              return;
                            }
                            
                            toast({
                              title: 'Connection Successful',
                              description: 'Connection test passed, discovering fields...',
                            });
                            
                            const discoveredFields = await discoverRESTFields(dataSource);
                            const updatedFields = { ...dataSourceFields };
                            updatedFields[newBinding.sourceId] = discoveredFields;
                            setDataSourceFields(updatedFields);
                            toast({
                              title: 'Fields Discovered',
                              description: `Found ${discoveredFields.length} fields from ${dataSource.name}`,
                            });
                          }
                        }}
                        className="text-xs h-7"
                      >
                        🔍 Discover Fields
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const dataSource = dataSources.find(ds => ds.id === newBinding.sourceId);
                          if (dataSource && (dataSource.type === 'rest' || dataSource.type === 'custom')) {
                            toast({
                              title: 'Testing Connection',
                              description: 'Testing connection to data source...',
                            });
                            
                            const connectionTest = await testConnection(dataSource);
                            if (connectionTest.success) {
                              toast({
                                title: 'Connection Successful',
                                description: `Successfully connected to ${dataSource.name}`,
                              });
                            } else {
                              toast({
                                title: 'Connection Failed',
                                description: (connectionTest as { success: false; error: string }).error,
                                variant: 'destructive'
                              });
                            }
                          }
                        }}
                        className="text-xs h-7"
                      >
                        🧪 Test Connection
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allFields = flattenFields(dataSourceFields[newBinding.sourceId]);
                          setNewBinding({
                            ...newBinding,
                            mappingRules: allFields
                          });
                        }}
                        className="text-xs h-7"
                      >
                        Select All Fields
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewBinding({
                            ...newBinding,
                            mappingRules: []
                          });
                        }}
                        className="text-xs h-7"
                      >
                        Clear All
                      </Button>
                    </div>

                    {/* Field Tree Structure */}
                    <div className="border rounded p-3 bg-gray-50 max-h-60 overflow-auto">
                      {dataSourceFields[newBinding.sourceId].map((field, index) => (
                        <FieldTree
                          key={index}
                          field={field}
                          isSelected={(fieldName) => 
                            (newBinding.mappingRules || []).some(f => f.name === fieldName)
                          }
                          onFieldToggle={(fieldName, isChecked) => {
                            if (isChecked) {
                              const flatField = flattenField(field, fieldName);
                              setNewBinding({
                                ...newBinding,
                                mappingRules: [...(newBinding.mappingRules || []), flatField]
                              });
                            } else {
                              setNewBinding({
                                ...newBinding,
                                mappingRules: (newBinding.mappingRules || []).filter(f => f.name !== fieldName)
                              });
                            }
                          }}
                        />
                      ))}
                    </div>
                    
                    {/* Help Section */}
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                      <div className="font-medium mb-2">💡 API Connection Tips:</div>
                      <ul className="space-y-1 text-xs">
                        <li>• <strong>403 Forbidden:</strong> Check your API key and authentication headers</li>
                        <li>• <strong>401 Unauthorized:</strong> Verify API credentials and permissions</li>
                        <li>• <strong>CORS Issues:</strong> Ensure your API supports cross-origin requests</li>
                        <li>• <strong>Connection String:</strong> Use the full URL including protocol (https://)</li>
                        <li>• <strong>Custom Headers:</strong> Add required headers like 'x-api-key' or 'Authorization'</li>
                      </ul>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="binding-target-type">Target Type</Label>
                    <Select 
                      value={newBinding.targetType} 
                      onValueChange={(value) => setNewBinding({...newBinding, targetType: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="organization">Organization</SelectItem>
                        <SelectItem value="tenant">Tenant</SelectItem>
                        <SelectItem value="unit">Unit</SelectItem>
                        <SelectItem value="asset">Asset</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="binding-target">Target Node</Label>
                    <Select 
                      value={newBinding.targetId} 
                      onValueChange={(value) => setNewBinding({...newBinding, targetId: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        {hierarchyNodes.map(org => (
                          <div key={org.id}>
                            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                              {org.name} (Organization)
                            </div>
                            {org.children?.map(tenant => (
                              <div key={tenant.id}>
                                <div className="px-2 py-1 text-xs font-medium text-muted-foreground ml-2">
                                  {tenant.name} (Tenant)
                                </div>
                                {tenant.children?.map(unit => (
                                  <div key={unit.id}>
                                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground ml-4">
                                      {unit.name} (Unit)
                                    </div>
                                    {unit.children?.map(asset => (
                                      <SelectItem key={asset.id} value={asset.id}>
                                        {asset.name} (Asset)
                                      </SelectItem>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="binding-enabled"
                    checked={newBinding.enabled}
                    onCheckedChange={(checked) => setNewBinding({...newBinding, enabled: checked})}
                  />
                  <Label htmlFor="binding-enabled">Enable this binding</Label>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createBinding}>
                    Create Binding
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Real Pro-Act Hierarchy Tree */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Pro-Act Hierarchy
              </CardTitle>
              <CardDescription>
                Your organizational structure for binding external data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading hierarchy...
                </div>
              ) : hierarchyNodes.length > 0 ? (
                <div className="border rounded max-h-[520px] overflow-auto bg-white/70">
                  {renderHierarchyTree(hierarchyNodes)}
                  {hierarchyNodes.every(org => 
                    org.children?.every(tenant => 
                      tenant.children?.every(unit => !unit.children || unit.children.length === 0)
                    )
                  ) && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                      <strong>Note:</strong> No units or assets found. Add units and assets through the Plant Hierarchy Manager to create bindings.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hierarchy data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Source Preview */}
          {newBinding.sourceId && dataSourceFields[newBinding.sourceId] && (
            <Card>
              <CardHeader>
                <CardTitle>Data Source Preview</CardTitle>
                <CardDescription>
                  Available data structure from selected source
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded p-3 bg-gray-50 max-h-60 overflow-auto">
                  {dataSourceFields[newBinding.sourceId].map((field, index) => (
                    <FieldTree
                      key={index}
                      field={field}
                      isSelected={() => false}
                      onFieldToggle={() => {}}
                    />
                  ))}
                </div>
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                  <strong>Tip:</strong> Use the field selection above to create mapping rules for this binding.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Active Bindings */}
      <Card>
        <CardHeader>
          <CardTitle>Active Bindings</CardTitle>
          <CardDescription>
            Current data source to hierarchy mappings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bindings.map((binding) => (
              <div key={binding.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Link className="w-5 h-5 text-blue-500" />
                  <div>
                    <div className="font-medium">{binding.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {dataSources.find(ds => ds.id === binding.sourceId)?.name} 
                      <ArrowRight className="w-3 h-3 inline mx-1" />
                      {binding.targetType}: {hierarchyNodes.flatMap(org => 
                        org.children?.flatMap(tenant => 
                          tenant.children?.flatMap(unit => 
                            unit.children?.find(asset => asset.id === binding.targetId) || []
                          ) || []
                        ) || []
                      )[0]?.name || binding.targetId}
                    </div>
                    {binding.mappingRules && binding.mappingRules.length > 0 && (
                      <div className="text-xs text-blue-600 mt-1">
                        Fields: {binding.mappingRules.map(f => f.name).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={binding.status === 'active' ? 'default' : 'secondary'}>
                    {binding.status}
                  </Badge>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => testBinding(binding.id)}
                    title="Test binding connection"
                  >
                    <CheckCircle className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <Settings className="w-3 h-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setBindings(bindings.filter(b => b.id !== binding.id))}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            
            {bindings.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No active bindings. Create your first binding to start integrating external data.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Field Explorer Modal */}
      <Dialog open={fieldExplorerModal.isOpen} onOpenChange={(open) => setFieldExplorerModal(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🔍 Field Explorer
            </DialogTitle>
            <DialogDescription>
              Exploring structure of: <strong>{fieldExplorerModal.field?.name}</strong> from {fieldExplorerModal.dataSource?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col h-full">
            {/* Field Path */}
            <div className="mb-4 p-3 bg-gray-50 rounded border">
              <div className="text-sm font-medium text-gray-700">Field Path:</div>
              <div className="text-sm font-mono text-blue-600 break-all">
                {fieldExplorerModal.field?.path}
              </div>
            </div>

            {/* Object Structure */}
            <div className="flex-1 overflow-auto">
              <div className="space-y-2">
                {fieldExplorerModal.field?.rawData && (
                  <ObjectStructureViewer 
                    data={fieldExplorerModal.field.rawData} 
                    path={fieldExplorerModal.field.path}
                    onFieldSelect={(fieldPath, fieldData) => {
                      // Add selected field to mapping rules
                      const newField = {
                        name: fieldPath.split('.').pop() || fieldPath,
                        path: fieldPath,
                        type: typeof fieldData,
                        description: `${typeof fieldData} value from ${fieldExplorerModal.field?.name}`
                      };
                      
                      setNewBinding(prev => ({
                        ...prev,
                        mappingRules: [...(prev.mappingRules || []), newField]
                      }));
                      
                      toast({
                        title: 'Field Added',
                        description: `Added ${newField.name} to mapping rules`,
                      });
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};