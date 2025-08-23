import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
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
  Save
} from 'lucide-react';
import { PIClient } from '@/services/pi/PIClient';
import { piStore, HistorianTagConfig } from '@/services/pi/PIStore';

interface PIElement {
  WebId: string;
  Name: string;
  Path: string;
  Template?: string;
  CategoryNames?: string[];
  HasChildren?: boolean;
  HasAttributes?: boolean;
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



interface HistorianTagConfiguratorProps {
  piClient: PIClient;
  tenantId: string;
  onTagsConfigured: (tags: HistorianTagConfig[]) => void;
}

export default function HistorianTagConfigurator({ 
  piClient, 
  tenantId, 
  onTagsConfigured 
}: HistorianTagConfiguratorProps) {
  const { toast } = useToast();
  
  // Debug: Log the tenant ID being received
  console.log('[HistorianTagConfigurator] Component initialized with tenantId:', tenantId);
  const [assetServers, setAssetServers] = useState<any[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [databases, setDatabases] = useState<any[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [elements, setElements] = useState<PIElement[]>([]);
  const [expandedElements, setExpandedElements] = useState<Record<string, boolean>>({});
  const [selectedElement, setSelectedElement] = useState<string>('');
  const [attributes, setAttributes] = useState<PIAttribute[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<Set<string>>(new Set());
  const [configuredTags, setConfiguredTags] = useState<HistorianTagConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [databasesLoading, setDatabasesLoading] = useState(false);
  const [elementsLoading, setElementsLoading] = useState(false);

  useEffect(() => {
    loadAssetServers();
  }, []);

  useEffect(() => {
    if (tenantId) {
      // Add a small delay to ensure database is initialized
      const timer = setTimeout(() => {
        loadConfiguredTags();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [tenantId]);

  useEffect(() => {
    if (selectedServer) {
      loadDatabases(selectedServer);
      // Clear related selections when server changes
      setSelectedDb('');
      setElements([]);
      setSelectedElement('');
      setAttributes([]);
      setSelectedAttributes(new Set());
    } else {
      setDatabases([]);
      setSelectedDb('');
      setElements([]);
      setSelectedElement('');
      setAttributes([]);
      setSelectedAttributes(new Set());
    }
  }, [selectedServer]);

  useEffect(() => {
    if (selectedDb) {
      loadElements(selectedDb);
      // Clear related selections when database changes
      setElements([]);
      setSelectedElement('');
      setAttributes([]);
      setSelectedAttributes(new Set());
    } else {
      setElements([]);
      setSelectedElement('');
      setAttributes([]);
      setSelectedAttributes(new Set());
    }
  }, [selectedDb]);

  const loadAssetServers = async () => {
    try {
      setLoading(true);
      const servers = await piClient.getAssetServers();
      setAssetServers(servers?.Items || []);
    } catch (error) {
      console.error('Failed to load asset servers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load PI asset servers. Please check your connection.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDatabases = async (serverWebId: string) => {
    try {
      setDatabasesLoading(true);
      const dbs = await piClient.getAFDatabases(serverWebId);
      setDatabases(dbs?.Items || []);
    } catch (error) {
      console.error('Failed to load databases:', error);
      toast({
        title: 'Error',
        description: 'Failed to load AF databases.',
        variant: 'destructive',
      });
      setDatabases([]);
    } finally {
      setDatabasesLoading(false);
    }
  };

  const loadElements = async (databaseWebId: string) => {
    try {
      setElementsLoading(true);
      const elements = await piClient.getDatabaseElements(databaseWebId);
      setElements(elements?.Items || []);
    } catch (error) {
      console.error('Failed to load elements:', error);
      toast({
        title: 'Error',
        description: 'Failed to load AF elements.',
        variant: 'destructive',
      });
      setElements([]);
    } finally {
      setElementsLoading(false);
    }
  };

  const loadElementChildren = async (elementWebId: string) => {
    try {
      const children = await piClient.getElementChildren(elementWebId);
      return children?.Items || [];
    } catch (error) {
      console.error('Failed to load element children:', error);
      return [];
    }
  };

  const loadAttributes = async (elementWebId: string) => {
    try {
      setLoading(true);
      const attrs = await piClient.getElementAttributes(elementWebId);
      setAttributes(attrs?.Items || []);
    } catch (error) {
      console.error('Failed to load attributes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load element attributes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleElementExpansion = async (element: PIElement) => {
    if (!expandedElements[element.WebId]) {
      const children = await loadElementChildren(element.WebId);
      setElements(prev => {
        const index = prev.findIndex(e => e.WebId === element.WebId);
        if (index !== -1) {
          const newElements = [...prev];
          newElements.splice(index + 1, 0, ...children);
          return newElements;
        }
        return prev;
      });
    }
    setExpandedElements(prev => ({ ...prev, [element.WebId]: !prev[element.WebId] }));
  };

  const getCategoryIcon = (category: string) => {
    if (category?.toLowerCase().includes('temp')) return Thermometer;
    if (category?.toLowerCase().includes('press')) return Gauge;
    if (category?.toLowerCase().includes('flow')) return Droplets;
    if (category?.toLowerCase().includes('level')) return Activity;
    if (category?.toLowerCase().includes('power')) return Zap;
    return Settings;
  };

  const getCategoryFromAttribute = (attribute: PIAttribute): HistorianTagConfig['category'] => {
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

  const addSelectedAttributes = () => {
    const newTags: Omit<HistorianTagConfig, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>[] = Array.from(selectedAttributes).map(attrWebId => {
      const attr = attributes.find(a => a.WebId === attrWebId);
      if (!attr) return null;
      
      return {
        name: attr.Name,
        path: attr.Path,
        webId: attr.WebId,
        units: attr.DefaultUnitsName || '',
        category: getCategoryFromAttribute(attr),
        updateInterval: 60,
        thresholds: undefined,
        enabled: true
      };
    }).filter(Boolean) as Omit<HistorianTagConfig, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>[];

    // Create temporary tags for local state (these will be replaced when saved)
    const tempTags: HistorianTagConfig[] = newTags.map((tag, index) => ({
      ...tag,
      id: `temp_${Date.now()}_${index}`,
      tenantId: tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    setConfiguredTags(prev => [...prev, ...tempTags]);
    setSelectedAttributes(new Set());
    setAttributes([]);
    setSelectedElement('');
    
    toast({
      title: 'Tags Added',
      description: `Added ${newTags.length} historian tags to configuration.`,
      variant: 'default',
    });
  };

  const removeTag = (tagId: string) => {
    setConfiguredTags(prev => prev.filter(tag => tag.id !== tagId));
  };

  const updateTag = (tagId: string, updates: Partial<HistorianTagConfig>) => {
    setConfiguredTags(prev => prev.map(tag => 
      tag.id === tagId ? { ...tag, ...updates } : tag
    ));
  };

  const saveConfiguration = async () => {
    if (!tenantId) {
      toast({
        title: 'Error',
        description: 'Tenant ID is required to save configuration.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      console.log('[HistorianTagConfigurator] Saving tags for tenantId:', tenantId);
      console.log('[HistorianTagConfigurator] Tags to save:', configuredTags);
      
      // Prepare tags for saving (remove temporary IDs and metadata)
      const tagsToSave: Omit<HistorianTagConfig, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>[] = configuredTags.map(tag => ({
        name: tag.name,
        path: tag.path,
        webId: tag.webId,
        units: tag.units,
        category: tag.category,
        updateInterval: tag.updateInterval,
        thresholds: tag.thresholds,
        enabled: tag.enabled
      }));
      
      await piStore.upsertHistorianTags(tenantId, tagsToSave);
      console.log('[HistorianTagConfigurator] Tags saved successfully');
      
      // Reload the saved tags to get the proper IDs
      const savedTags = await piStore.getHistorianTags(tenantId);
      setConfiguredTags(savedTags);
      
      onTagsConfigured(savedTags);
      
      toast({
        title: 'Configuration Saved',
        description: 'Historian tag configuration has been saved successfully.',
        variant: 'default',
      });
    } catch (error) {
      console.error('Failed to save configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to save historian tag configuration.',
        variant: 'destructive',
      });
    }
  };

  const loadConfiguredTags = async () => {
    if (!tenantId) return;
    
    try {
      setTagsLoading(true);
      console.log('[HistorianTagConfigurator] Loading tags for tenantId:', tenantId);
      
      // Debug: Check if the database is accessible
      try {
        const savedTags = await piStore.getHistorianTags(tenantId);
        console.log('[HistorianTagConfigurator] Loaded tags:', savedTags);
        if (savedTags && savedTags.length > 0) {
          setConfiguredTags(savedTags);
        } else {
          console.log('[HistorianTagConfigurator] No tags found for tenant:', tenantId);
        }
      } catch (dbError) {
        console.error('[HistorianTagConfigurator] Database error:', dbError);
        // Try to check if the store exists
        if (dbError.message.includes('object stores was not found')) {
          console.error('[HistorianTagConfigurator] The historianTags store does not exist in the database');
          // This suggests the database upgrade didn't run - let's try to force it
          console.log('[HistorianTagConfigurator] Attempting to force database upgrade...');
          try {
            // Force a database refresh by clearing and reinitializing
            await piStore.forceDatabaseUpgrade();
            console.log('[HistorianTagConfigurator] Database upgrade completed, retrying...');
            const retryTags = await piStore.getHistorianTags(tenantId);
            if (retryTags && retryTags.length > 0) {
              setConfiguredTags(retryTags);
            }
          } catch (upgradeError) {
            console.error('[HistorianTagConfigurator] Database upgrade failed:', upgradeError);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load configured tags:', error);
      // Don't show error toast for initial load failures - this might be expected
      // if the database hasn't been initialized yet or if there are no tags
    } finally {
      setTagsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Folder className="w-5 h-5 mr-2" />
            Browse PI AF Hierarchy
          </CardTitle>
          <CardDescription>
            Navigate through PI elements and select attributes to monitor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Asset Server</Label>
              <Select value={selectedServer} onValueChange={setSelectedServer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select asset server" />
                </SelectTrigger>
                <SelectContent>
                  {assetServers.map(server => (
                    <SelectItem key={server.WebId} value={server.WebId}>
                      {server.Name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>AF Database</Label>
              <Select 
                value={selectedDb} 
                onValueChange={setSelectedDb}
                disabled={!selectedServer || databasesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={databasesLoading ? "Loading databases..." : "Select database"} />
                </SelectTrigger>
                <SelectContent>
                  {databasesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="text-sm text-gray-500">Loading databases...</div>
                    </div>
                  ) : databases.length === 0 ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="text-sm text-gray-500">No databases found</div>
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

          {elements.length > 0 && (
            <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
              <h4 className="font-medium mb-3">Elements</h4>
              <div className="space-y-1">
                {elements.map((element) => (
                  <div key={element.WebId} className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleElementExpansion(element)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {expandedElements[element.WebId] ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
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
                      {element.Name}
                      {element.Template && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {element.Template}
                        </Badge>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {elementsLoading && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-gray-500">Loading elements...</div>
              </div>
            </div>
          )}

          {attributes.length > 0 && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Attributes</h4>
                <Button 
                  size="sm" 
                  onClick={addSelectedAttributes}
                  disabled={selectedAttributes.size === 0}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Selected ({selectedAttributes.size})
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {attributes.map(attr => (
                  <div key={attr.WebId} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
                    <Checkbox
                      checked={selectedAttributes.has(attr.WebId)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedAttributes(prev => new Set([...prev, attr.WebId]));
                        } else {
                          setSelectedAttributes(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(attr.WebId);
                            return newSet;
                          });
                        }
                      }}
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
        </CardContent>
      </Card>

      {(configuredTags.length > 0 || tagsLoading) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Gauge className="w-5 h-5 mr-2" />
                Configured Historian Tags ({configuredTags.length})
              </span>
              <div className="flex space-x-2">
                <Button onClick={loadConfiguredTags} disabled={tagsLoading} variant="outline">
                  <Activity className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button onClick={saveConfiguration} disabled={tagsLoading}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Configuration
                </Button>
                {process.env.NODE_ENV === 'development' && (
                  <Button 
                    onClick={async () => {
                      try {
                        await piStore.forceDatabaseUpgrade();
                        toast({
                          title: 'Database Upgrade',
                          description: 'Database upgrade initiated. Please refresh the page.',
                          variant: 'default',
                        });
                      } catch (error) {
                        toast({
                          title: 'Error',
                          description: 'Database upgrade failed.',
                          variant: 'destructive',
                        });
                      }
                    }} 
                    variant="outline" 
                    size="sm"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Force DB Upgrade
                  </Button>
                )}
              </div>
            </CardTitle>
                    <CardDescription>
                      Configure monitoring parameters for selected tags
                    </CardDescription>
                    {process.env.NODE_ENV === 'development' && (
                      <div className="mt-2 text-xs text-gray-500">
                        Debug: Tenant ID: {tenantId} | Tags Count: {configuredTags.length}
                      </div>
                    )}
          </CardHeader>
          <CardContent>
            {tagsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-gray-500">Loading configured tags...</div>
              </div>
            ) : (
              <div className="space-y-4">
                {configuredTags.map(tag => (
                  <div key={tag.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {React.createElement(getCategoryIcon(tag.category))}
                        <span className="font-medium">{tag.name}</span>
                        <Badge variant="outline">{tag.category}</Badge>
                        {tag.enabled ? (
                          <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                        ) : (
                          <Badge variant="outline">Disabled</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">{tag.path}</div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div>
                        <Label className="text-xs">Update (sec)</Label>
                        <Input
                          type="number"
                          value={tag.updateInterval}
                          onChange={(e) => updateTag(tag.id, { updateInterval: parseInt(e.target.value) || 60 })}
                          className="w-20"
                          min="10"
                          max="3600"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs">Units</Label>
                        <Input
                          value={tag.units}
                          onChange={(e) => updateTag(tag.id, { units: e.target.value })}
                          className="w-20"
                          placeholder="°C"
                        />
                      </div>
                      
                      <Checkbox
                        checked={tag.enabled}
                        onCheckedChange={(checked) => updateTag(tag.id, { enabled: !!checked })}
                      />
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeTag(tag.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
