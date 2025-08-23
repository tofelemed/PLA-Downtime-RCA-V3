import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  Gauge, 
  Thermometer, 
  Droplets, 
  Zap, 
  Settings,
  Plus,
  Trash2,
  Search,
  Filter,
  Database,
  AlertCircle
} from 'lucide-react';
import { PIClient } from '@/services/pi/PIClient';

interface PIElement {
  WebId: string;
  Name: string;
  Path: string;
  Template?: string;
  CategoryNames?: string[];
  HasChildren?: boolean;
  HasAttributes?: boolean;
  Level?: number;
  ParentId?: string;
}

interface PIAttribute {
  WebId: string;
  Name: string;
  Path: string;
  DefaultUnitsName?: string;
  DataType?: string;
  HasChildren?: boolean;
  CategoryNames?: string[];
}

interface MultiAttributeSelectorProps {
  piClient: PIClient;
  onAttributesSelected: (attributes: PIAttribute[]) => void;
  selectedAttributes: PIAttribute[];
  maxAttributes?: number;
  tenantId: string;
}

export default function MultiAttributeSelector({ 
  piClient, 
  onAttributesSelected, 
  selectedAttributes,
  maxAttributes = 10,
  tenantId
}: MultiAttributeSelectorProps) {
  // Validate PI client
  if (!piClient) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-muted-foreground">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>PI Web API connection not available</p>
            <p className="text-sm">Please configure your PI connection first</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Validate props
  if (typeof onAttributesSelected !== 'function') {
    console.error('MultiAttributeSelector: onAttributesSelected must be a function');
    return null;
  }

  if (!Array.isArray(selectedAttributes)) {
    console.error('MultiAttributeSelector: selectedAttributes must be an array');
    return null;
  }

  const [assetServers, setAssetServers] = useState<any[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [databases, setDatabases] = useState<any[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [elements, setElements] = useState<PIElement[]>([]);
  const [expandedElements, setExpandedElements] = useState<Record<string, boolean>>({});
  const [selectedElement, setSelectedElement] = useState<string>('');
  const [attributes, setAttributes] = useState<PIAttribute[]>([]);
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [elementChildren, setElementChildren] = useState<Record<string, PIElement[]>>({});
  const [error, setError] = useState<string | null>(null);
  
  // Separate loading states for different operations
  const [loadingServers, setLoadingServers] = useState(false);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [loadingElements, setLoadingElements] = useState(false);
  const [loadingAttributes, setLoadingAttributes] = useState(false);

  // Persistence functions for selected server and database
  const saveSelectionState = async (server: string, database: string) => {
    try {
      const state = { server, database, timestamp: new Date().toISOString() };
      localStorage.setItem(`historian_selection_${tenantId}`, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save selection state:', error);
    }
  };

  const loadSelectionState = async () => {
    try {
      const saved = localStorage.getItem(`historian_selection_${tenantId}`);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.server && state.database) {
          setSelectedServer(state.server);
          setSelectedDb(state.database);
          return { server: state.server, database: state.database };
        }
      }
    } catch (error) {
      console.warn('Failed to load selection state:', error);
    }
    return null;
  };

  useEffect(() => {
    const initializeComponent = async () => {
      try {
        // Load saved selection state
        const savedState = await loadSelectionState();
        
        // Load asset servers
        await loadAssetServers();
        
        // If we have saved state, load the corresponding data
        if (savedState) {
          await loadDatabases(savedState.server);
          await loadElements(savedState.database);
        }
      } catch (error) {
        console.error('Failed to initialize component:', error);
        setError('Failed to initialize component');
      }
    };
    
    initializeComponent();
  }, []);

  // Test PI client connection
  const testConnection = async () => {
    try {
      setLoadingServers(true);
      setError(null);
      console.log('Testing PI client connection...');
      
      if (!piClient || typeof piClient.getAssetServers !== 'function') {
        throw new Error('PI client is not properly initialized');
      }
      
      // Test basic connectivity
      const servers = await piClient.getAssetServers();
      console.log('Connection test successful:', servers);
      
      if (!servers || !Array.isArray(servers.Items)) {
        throw new Error('Invalid response format from PI client');
      }
      
      if (servers.Items.length > 0) {
        setAssetServers(servers.Items);
        setError(null);
      } else {
        setError('No asset servers found. Please check your PI connection configuration.');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setError(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setAssetServers([]);
    } finally {
      setLoadingServers(false);
    }
  };

  useEffect(() => {
    if (selectedServer) {
      loadDatabases(selectedServer);
      setSelectedDb('');
      setElements([]);
      setSelectedElement('');
      setAttributes([]);
      setSelectedAttributeIds(new Set());
      setElementChildren({});
      setExpandedElements({});
    }
  }, [selectedServer]);

  useEffect(() => {
    if (selectedDb) {
      loadElements(selectedDb);
      setElements([]);
      setSelectedElement('');
      setAttributes([]);
      setSelectedAttributeIds(new Set());
      setElementChildren({});
      setExpandedElements({});
    }
  }, [selectedDb]);

  // Initialize selectedAttributeIds from selectedAttributes prop
  useEffect(() => {
    const ids = new Set(selectedAttributes.map(attr => attr.WebId));
    setSelectedAttributeIds(ids);
  }, [selectedAttributes]);

  const loadAssetServers = async () => {
    try {
      setLoadingServers(true);
      setError(null);
      console.log('Loading asset servers...'); // Debug log
      
      if (!piClient || typeof piClient.getAssetServers !== 'function') {
        throw new Error('PI client is not properly initialized');
      }
      
      const servers = await piClient.getAssetServers();
      console.log('Asset servers loaded:', servers); // Debug log
      
      if (!servers || !Array.isArray(servers.Items)) {
        throw new Error('Invalid response format from PI client');
      }
      
      setAssetServers(servers.Items);
    } catch (error) {
      console.error('Failed to load asset servers:', error);
      setError(`Failed to load asset servers: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setAssetServers([]);
    } finally {
      setLoadingServers(false);
    }
  };

  const loadDatabases = async (serverWebId: string) => {
    try {
      if (!serverWebId) {
        throw new Error('Server WebId is required');
      }
      
      setLoadingDatabases(true);
      setError(null);
      console.log('Loading databases for server:', serverWebId); // Debug log
      
      if (!piClient || typeof piClient.getAFDatabases !== 'function') {
        throw new Error('PI client is not properly initialized');
      }
      
      const dbs = await piClient.getAFDatabases(serverWebId);
      console.log('Databases loaded:', dbs); // Debug log
      
      if (!dbs || !Array.isArray(dbs.Items)) {
        throw new Error('Invalid response format from PI client');
      }
      
      setDatabases(dbs.Items);
    } catch (error) {
      console.error('Failed to load databases:', error);
      setError(`Failed to load databases: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setDatabases([]);
    } finally {
      setLoadingDatabases(false);
    }
  };

  const loadElements = async (databaseWebId: string) => {
    try {
      if (!databaseWebId) {
        throw new Error('Database WebId is required');
      }
      
      setLoadingElements(true);
      setError(null);
      console.log('Loading elements for database:', databaseWebId); // Debug log
      
      if (!piClient || typeof piClient.getDatabaseElements !== 'function') {
        throw new Error('PI client is not properly initialized');
      }
      
      const elements = await piClient.getDatabaseElements(databaseWebId);
      console.log('Elements loaded:', elements); // Debug log
      
      if (!elements || !Array.isArray(elements.Items)) {
        throw new Error('Invalid response format from PI client');
      }
      
      const rootElements = elements.Items;
      // Set level 0 for root elements
      const elementsWithLevel = rootElements.map(el => ({ ...el, Level: 0 }));
      setElements(elementsWithLevel);
    } catch (error) {
      console.error('Failed to load elements:', error);
      setError(`Failed to load elements: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setElements([]);
    } finally {
      setLoadingElements(false);
    }
  };

  const loadElementChildren = async (elementWebId: string) => {
    try {
      if (!elementWebId) {
        throw new Error('Element WebId is required');
      }
      
      console.log('Loading children for element:', elementWebId); // Debug log
      
      if (!piClient || typeof piClient.getElementChildren !== 'function') {
        throw new Error('PI client is not properly initialized');
      }
      
      const children = await piClient.getElementChildren(elementWebId);
      console.log('Element children loaded:', children); // Debug log
      
      if (!children || !Array.isArray(children.Items)) {
        return [];
      }
      
      return children.Items;
    } catch (error) {
      console.error('Failed to load element children:', error);
      return [];
    }
  };

  const loadAttributes = async (elementWebId: string) => {
    try {
      if (!elementWebId) {
        throw new Error('Element WebId is required');
      }
      
      setLoadingAttributes(true);
      setError(null);
      console.log('Loading attributes for element:', elementWebId); // Debug log
      
      if (!piClient || typeof piClient.getElementAttributes !== 'function') {
        throw new Error('PI client is not properly initialized');
      }
      
      const attrs = await piClient.getElementAttributes(elementWebId);
      console.log('Attributes loaded:', attrs); // Debug log
      
      if (!attrs || !Array.isArray(attrs.Items)) {
        throw new Error('Invalid response format from PI client');
      }
      
      setAttributes(attrs.Items);
    } catch (error) {
      console.error('Failed to load attributes:', error);
      setError(`Failed to load attributes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setAttributes([]);
    } finally {
      setLoadingAttributes(false);
    }
  };

  const toggleElementExpansion = async (element: PIElement) => {
    if (!expandedElements[element.WebId]) {
      // Load children if not already loaded
      if (!elementChildren[element.WebId]) {
        const children = await loadElementChildren(element.WebId);
        const childrenWithLevel = children.map(child => ({ 
          ...child, 
          Level: (element.Level || 0) + 1,
          ParentId: element.WebId
        }));
        setElementChildren(prev => ({ ...prev, [element.WebId]: childrenWithLevel }));
      }
    }
    setExpandedElements(prev => ({ ...prev, [element.WebId]: !prev[element.WebId] }));
  };

  // Helper function to render elements recursively
  const renderElement = (element: PIElement, level: number = 0) => {
    if (!element || !element.WebId) {
      console.warn('MultiAttributeSelector: Invalid element data:', element);
      return null;
    }

    const isExpanded = expandedElements[element.WebId];
    const children = elementChildren[element.WebId] || [];
    
    return (
      <div key={element.WebId} className="space-y-1">
        <div className="flex items-center space-x-2" style={{ paddingLeft: `${level * 20}px` }}>
          <button
            onClick={() => toggleElementExpansion(element)}
            className="p-1 hover:bg-gray-100 rounded"
            disabled={!element.HasChildren}
          >
            {element.HasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )
            ) : (
              <div className="w-4 h-4" />
            )}
          </button>
          
          {element.HasChildren ? (
            <Folder className="w-4 h-4 text-blue-500" />
          ) : (
            <Activity className="w-4 h-4 text-gray-500" />
          )}
          
          <button
            onClick={() => {
              setSelectedElement(element.WebId);
              loadAttributes(element.WebId);
            }}
            className={`text-left flex-1 p-2 rounded hover:bg-gray-100 ${
              selectedElement === element.WebId ? 'bg-blue-50 border border-blue-200' : ''
            }`}
          >
            {element.Name || 'Unnamed Element'}
            {element.Template && (
              <Badge variant="outline" className="ml-2 text-xs">
                {element.Template}
              </Badge>
            )}
          </button>
        </div>
        
        {/* Render children if expanded */}
        {isExpanded && children.length > 0 && (
          <div className="space-y-1">
            {children.map(child => renderElement(child, level + 1)).filter(Boolean)}
          </div>
        )}
      </div>
    );
  };

  const getCategoryIcon = (category: string) => {
    if (category?.toLowerCase().includes('temp')) return Thermometer;
    if (category?.toLowerCase().includes('press')) return Gauge;
    if (category?.toLowerCase().includes('flow')) return Droplets;
    if (category?.toLowerCase().includes('level')) return Activity;
    if (category?.toLowerCase().includes('power')) return Zap;
    return Settings;
  };

  const getCategoryFromAttribute = (attribute: PIAttribute): string => {
    const name = attribute.Name.toLowerCase();
    const path = attribute.Path.toLowerCase();
    
    if (name.includes('temp') || path.includes('temp')) return 'temperature';
    if (name.includes('press') || path.includes('press')) return 'pressure';
    if (name.includes('flow') || path.includes('flow')) return 'flow';
    if (name.includes('level') || path.includes('level')) return 'level';
    if (name.includes('power') || path.includes('power')) return 'power';
    if (name.includes('quality') || path.includes('quality')) return 'quality';
    return 'other';
  };

  const handleAttributeToggle = (attribute: PIAttribute, checked: boolean) => {
    if (checked && selectedAttributeIds.size >= maxAttributes) {
      return; // Don't allow more than maxAttributes
    }

    const newSelectedIds = new Set(selectedAttributeIds);
    if (checked) {
      newSelectedIds.add(attribute.WebId);
    } else {
      newSelectedIds.delete(attribute.WebId);
    }
    
    setSelectedAttributeIds(newSelectedIds);
    
    // Update parent component
    const selectedAttrs = attributes.filter(attr => newSelectedIds.has(attr.WebId));
    onAttributesSelected(selectedAttrs);
  };

  const removeSelectedAttribute = (attributeId: string) => {
    const newSelectedIds = new Set(selectedAttributeIds);
    newSelectedIds.delete(attributeId);
    setSelectedAttributeIds(newSelectedIds);
    
    const selectedAttrs = attributes.filter(attr => newSelectedIds.has(attr.WebId));
    onAttributesSelected(selectedAttrs);
  };

  const clearAllSelections = () => {
    setSelectedAttributeIds(new Set());
    onAttributesSelected([]);
  };

  const filteredAttributes = attributes.filter(attr => {
    if (!attr || !attr.Name || !attr.Path) {
      return false;
    }
    
    const matchesSearch = attr.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         attr.Path.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || getCategoryFromAttribute(attr) === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', 'temperature', 'pressure', 'flow', 'level', 'power', 'quality', 'other'];

  // Safety check for rendering
  if (!Array.isArray(assetServers) || !Array.isArray(databases) || !Array.isArray(elements) || !Array.isArray(attributes)) {
    console.error('MultiAttributeSelector: Invalid state data detected');
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Component Error</p>
            <p className="text-sm">Invalid state data detected. Please refresh the page.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleServerChange = (serverWebId: string) => {
    setSelectedServer(serverWebId);
    setSelectedDb('');
    setElements([]);
    setAttributes([]);
    setSelectedAttributeIds(new Set());
    
    if (serverWebId) {
      loadDatabases(serverWebId);
      // Save selection state
      saveSelectionState(serverWebId, '');
    }
  };

  const handleDatabaseChange = (databaseWebId: string) => {
    setSelectedDb(databaseWebId);
    setElements([]);
    setAttributes([]);
    setSelectedAttributeIds(new Set());
    
    if (databaseWebId) {
      loadElements(databaseWebId);
      // Save selection state
      saveSelectionState(selectedServer, databaseWebId);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Folder className="w-5 h-5 mr-2" />
              Multi-Attribute Selector
            </span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testConnection}
                disabled={loadingServers}
              >
                {loadingServers ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin mr-2" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              <Badge variant="outline">
                {selectedAttributeIds.size}/{maxAttributes} Selected
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            Browse PI AF hierarchy and select multiple attributes for historian queries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Server and Database Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Asset Server</Label>
              <Select value={selectedServer} onValueChange={handleServerChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select asset server" />
                </SelectTrigger>
                <SelectContent>
                  {loadingServers ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Loading servers...
                    </div>
                  ) : assetServers.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No servers available
                    </div>
                  ) : (
                    assetServers.map(server => (
                      <SelectItem key={server.WebId} value={server.WebId}>
                        {server.Name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>AF Database</Label>
              <Select 
                value={selectedDb} 
                onValueChange={handleDatabaseChange}
                disabled={!selectedServer}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select database" />
                </SelectTrigger>
                <SelectContent>
                  {!selectedServer ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Select a server first
                    </div>
                  ) : loadingDatabases ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground flex items-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                      Loading databases...
                    </div>
                  ) : databases.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No databases available
                    </div>
                  ) : (
                    databases.map(db => (
                      <SelectItem key={db.WebId} value={db.WebId}>
                        {db.Name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Loading State */}
          {(loadingServers || loadingDatabases || loadingElements || loadingAttributes) && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">
                  {loadingServers && 'Loading servers...'}
                  {loadingDatabases && 'Loading databases...'}
                  {loadingElements && 'Loading elements...'}
                  {loadingAttributes && 'Loading attributes...'}
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <div className="flex items-center space-x-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <h4 className="font-medium">Error</h4>
              </div>
              <p className="text-sm text-red-700 mt-2">{error}</p>
              <div className="flex space-x-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    if (selectedServer && selectedDb) {
                      loadElements(selectedDb);
                    } else if (selectedServer) {
                      loadDatabases(selectedServer);
                    } else {
                      loadAssetServers();
                    }
                  }}
                >
                  Retry
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Elements Tree */}
          {!loadingElements && elements.length > 0 && (
            <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
              <h4 className="font-medium mb-3">Elements ({elements.length})</h4>
              <div className="space-y-1">
                {elements.map((element) => renderElement(element))}
              </div>
            </div>
          )}

          {/* Loading Elements State */}
          {loadingElements && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Loading elements...</p>
                </div>
              </div>
            </div>
          )}

          {/* No Elements State */}
          {!loadingElements && selectedDb && elements.length === 0 && (
            <div className="border rounded-lg p-4 text-center text-gray-500">
              <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No elements found in this database</p>
              <p className="text-sm">Try selecting a different database or check your PI connection</p>
            </div>
          )}

          {/* Attributes Selection */}
          {!loadingAttributes && attributes.length > 0 && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Attributes ({attributes.length})</h4>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearAllSelections}
                    disabled={selectedAttributeIds.size === 0}
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              {/* Search and Filter */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search attributes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>
                          <span className="capitalize">{category}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {filteredAttributes.map(attr => (
                  <div key={attr.WebId} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
                    <Checkbox
                      checked={selectedAttributeIds.has(attr.WebId)}
                      onCheckedChange={(checked) => handleAttributeToggle(attr, !!checked)}
                      disabled={!selectedAttributeIds.has(attr.WebId) && selectedAttributeIds.size >= maxAttributes}
                    />
                    
                    {React.createElement(getCategoryIcon(attr.Name))}
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{attr.Name}</div>
                      <div className="text-xs text-gray-500 truncate">{attr.Path}</div>
                      {attr.DefaultUnitsName && (
                        <div className="text-xs text-gray-400">{attr.DefaultUnitsName}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading Attributes State */}
          {loadingAttributes && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Loading attributes...</p>
                </div>
              </div>
            </div>
          )}

          {/* No Attributes State */}
          {!loadingAttributes && selectedElement && attributes.length === 0 && (
            <div className="border rounded-lg p-4 text-center text-gray-500">
              <Gauge className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No attributes found for this element</p>
              <p className="text-sm">Try selecting a different element or check your PI connection</p>
            </div>
          )}

          {/* Debug Info */}
          {selectedElement && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              <strong>Debug Info:</strong><br/>
              Selected Element: {selectedElement}<br/>
              Attributes Loaded: {attributes.length}<br/>
              Loading States: {[
                loadingServers && 'Servers',
                loadingDatabases && 'Databases', 
                loadingElements && 'Elements',
                loadingAttributes && 'Attributes'
              ].filter(Boolean).join(', ') || 'None'}<br/>
              PI Client Available: {piClient ? 'Yes' : 'No'}
            </div>
          )}

          {/* Selected Attributes Summary */}
          {selectedAttributeIds.size > 0 && (
            <div className="border rounded-lg p-4 bg-blue-50">
              <h4 className="font-medium mb-3 text-blue-900">Selected Attributes ({selectedAttributeIds.size})</h4>
              <div className="space-y-2">
                {attributes
                  .filter(attr => selectedAttributeIds.has(attr.WebId))
                  .map(attr => (
                    <div key={attr.WebId} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div className="flex items-center space-x-2">
                        {React.createElement(getCategoryIcon(attr.Name))}
                        <div>
                          <div className="font-medium text-sm">{attr.Name}</div>
                          <div className="text-xs text-gray-500">{attr.Path}</div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeSelectedAttribute(attr.WebId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
