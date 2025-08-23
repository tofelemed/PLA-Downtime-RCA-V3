import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Activity, 
  BarChart3, 
  Database, 
  Download, 
  FileText, 
  LineChart, 
  PieChart, 
  Settings,
  TrendingUp,
  Clock,
  Filter
} from 'lucide-react';
import { PIClient } from '@/services/pi/PIClient';
import { HistorianClient } from '@/services/historian/HistorianClient';
import { PIHistorianProvider } from '@/services/historian/providers/pi/PIHistorianProvider';
import { TimeSeriesResult } from '@/services/historian/types';
import { HistorianHistoryDB } from '@/services/StorageService';
import MultiAttributeSelector from './MultiAttributeSelector';
import { HistorianQueryForm } from './HistorianQueryForm';
import { TimeSeriesChart } from './TimeSeriesChart';
import { TimeSeriesTable } from './TimeSeriesTable';
import PIConnectionDiagnostic from './PIConnectionDiagnostic';

interface PIAttribute {
  WebId: string;
  Name: string;
  Path: string;
  DefaultUnitsName?: string;
  DataType?: string;
  HasChildren?: boolean;
  CategoryNames?: string[];
}

interface EnhancedHistorianPageProps {
  piClient: PIClient;
  tenantId: string;
}

export default function EnhancedHistorianPage({ 
  piClient, 
  tenantId 
}: EnhancedHistorianPageProps) {
  const { toast } = useToast();
  const [selectedAttributes, setSelectedAttributes] = useState<PIAttribute[]>([]);
  const [queryResults, setQueryResults] = useState<TimeSeriesResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('query');
  const [queryHistory, setQueryHistory] = useState<Array<{
    id: string;
    timestamp: string;
    attributes: PIAttribute[];
    queryParams: any;
    resultCount: number;
    tenantId: string;
  }>>([]);

  // Track modified queries
  const [modifiedQueries, setModifiedQueries] = useState<Set<string>>(new Set());

  // IndexedDB instance for persistent storage
  const historianDB = useMemo(() => new HistorianHistoryDB(), []);
  
  const saveQueryHistoryToStorage = async (history: Array<{
    id: string;
    timestamp: string;
    attributes: PIAttribute[];
    queryParams: any;
    resultCount: number;
    tenantId: string;
  }>) => {
    try {
      await historianDB.saveQueryHistory(tenantId, history);
    } catch (error) {
      console.warn('Failed to save query history to IndexedDB:', error);
      toast({
        title: 'Storage Warning',
        description: 'Failed to save query history to local storage',
        variant: 'destructive',
      });
    }
  };
  
  const loadQueryHistoryFromStorage = async (): Promise<Array<{
    id: string;
    timestamp: string;
    attributes: PIAttribute[];
    queryParams: any;
    resultCount: number;
    tenantId: string;
  }>> => {
    try {
      return await historianDB.loadQueryHistory(tenantId);
    } catch (error) {
      console.warn('Failed to load query history from IndexedDB:', error);
      toast({
        title: 'Storage Warning',
        description: 'Failed to load query history from local storage',
        variant: 'destructive',
      });
      return [];
    }
  };

  const historian = useMemo(() => {
    if (!piClient) return null;
    const hc = new HistorianClient();
    hc.register(new PIHistorianProvider(piClient));
    return hc;
  }, [piClient]);

  const defaultStart = useMemo(() => {
    if (!piClient) return '';
    return new Date(Date.now() - 3600 * 1000).toISOString();
  }, [piClient]);
  
  const defaultEnd = useMemo(() => {
    if (!piClient) return '';
    return new Date().toISOString();
  }, [piClient]);

  // Load query history from IndexedDB on component mount
  React.useEffect(() => {
    const loadHistory = async () => {
      const savedHistory = await loadQueryHistoryFromStorage();
      setQueryHistory(savedHistory);
    };
    loadHistory();
  }, [tenantId]); // Reload when tenant changes

  const handleAttributesSelected = (attributes: PIAttribute[]) => {
    if (!piClient) {
      toast({
        title: 'PI Connection Error',
        description: 'PI Web API connection is not properly configured. Please check your connection settings.',
        variant: 'destructive',
      });
      return;
    }
    
    setSelectedAttributes(attributes);
    if (attributes.length > 0) {
      toast({
        title: 'Attributes Selected',
        description: `Selected ${attributes.length} attributes for historian queries`,
        variant: 'default',
      });
    }
  };

  const handleQuerySubmit = async (queryParams: any) => {
    if (!selectedAttributes || selectedAttributes.length === 0) {
      toast({
        title: 'No Attributes Selected',
        description: 'Please select at least one attribute before running a query',
        variant: 'destructive',
      });
      return;
    }

    // Check if PI client is properly configured
    if (!piClient) {
      toast({
        title: 'PI Connection Error',
        description: 'PI Web API connection is not properly configured. Please check your connection settings.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      
      // Resolve streams for selected attributes
      const provider = new PIHistorianProvider(piClient);
      const streams = await provider.resolveStreamsByAttributes(selectedAttributes);
      
      if (streams.length === 0) {
        throw new Error('No stream WebIds resolved for the selected attributes.');
      }

      // Check if historian is available
      if (!historian) {
        throw new Error('Historian client is not properly initialized. Please check your PI connection.');
      }

      // Execute query
      const results = await historian.query({
        provider: 'pi',
        streams,
        mode: queryParams.mode,
        startTimeUtc: queryParams.start,
        endTimeUtc: queryParams.end,
        interval: queryParams.interval,
        intervals: queryParams.intervals,
        includeBad: queryParams.includeBad,
        boundaryType: queryParams.boundaryType,
        summaryTypes: queryParams.summaryTypes,
      } as any);

      setQueryResults(results);

      // Add to query history
      if (piClient) {
        const historyEntry = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          attributes: selectedAttributes,
          queryParams,
          resultCount: results.reduce((sum, r) => sum + (r.points?.length || 0), 0),
          tenantId
        };
        
        setQueryHistory(prev => {
          const newHistory = [historyEntry, ...prev.slice(0, 9)]; // Keep last 10 queries
          saveQueryHistoryToStorage(newHistory); // Save to IndexedDB
          return newHistory;
        });
      }

      if (piClient) {
        toast({
          title: 'Query Successful',
          description: `Fetched ${results.reduce((sum, r) => sum + (r.points?.length || 0), 0)} data points from ${streams.length} stream(s)`,
          variant: 'default',
        });
      }

      // Switch to results tab
      if (piClient) {
        setActiveTab('results');
      }

    } catch (error: any) {
      console.error('Historian query failed:', error);
      
      // Handle specific error types
      let errorMessage = 'Failed to execute historian query';
      let errorTitle = 'Query Failed';
      
      if (error.status === 500) {
        errorTitle = 'PI Server Error';
        errorMessage = 'PI Web API server returned an internal error. This usually indicates a server-side issue. Please check your PI server status and try again later.';
      } else if (error.status === 401 || error.status === 403) {
        errorTitle = 'Authentication Error';
        errorMessage = 'Access denied. Please check your PI Web API credentials and permissions.';
      } else if (error.status === 404) {
        errorTitle = 'Resource Not Found';
        errorMessage = 'The requested PI resources were not found. Please verify your PI connection and resource paths.';
      } else if (error.status >= 500) {
        errorTitle = 'PI Server Error';
        errorMessage = `PI Web API server error (${error.status}). Please check your PI server status and try again later.`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      if (piClient) {
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const exportAllData = () => {
    if (!queryResults || queryResults.length === 0 || !piClient) return;

    try {
      const headers = ['Stream', 'Timestamp', 'Value', 'Units', 'Good', 'Questionable', 'Substituted'];
      const csvData = [headers.join(',')];
      
      queryResults.forEach(r => {
        const streamName = r.stream?.name || r.stream?.path || r.stream?.id;
        r.points.forEach(p => {
          csvData.push([
            `"${streamName}"`,
            `"${p.timestamp}"`,
            `"${p.value ?? ''}"`,
            `"${p.units || r.stream?.units || ''}"`,
            `"${p.quality?.good ?? ''}"`,
            `"${p.quality?.questionable ?? ''}"`,
            `"${p.quality?.substituted ?? ''}"`
          ].join(','));
        });
      });
      
      const blob = new Blob([csvData.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historian_export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      if (piClient) {
        toast({
          title: 'Export Successful',
          description: 'Data exported to CSV file',
          variant: 'default',
        });
      }
    } catch (error) {
      if (piClient) {
        toast({
          title: 'Export Failed',
          description: 'Failed to export data',
          variant: 'destructive',
        });
      }
    }
  };

  const clearResults = () => {
    if (!queryResults || queryResults.length === 0 || !piClient) return;
    setQueryResults([]);
    setActiveTab('query');
  };

  const clearQueryHistory = async () => {
    try {
      await historianDB.clearQueryHistory(tenantId);
      setQueryHistory([]);
      toast({
        title: 'History Cleared',
        description: 'Query history has been cleared',
      });
    } catch (error) {
      console.error('Failed to clear query history:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear query history',
        variant: 'destructive',
      });
    }
  };

  const removeHistoryEntry = async (id: string) => {
    try {
      await historianDB.removeQueryHistoryEntry(id);
      setQueryHistory(prev => prev.filter(entry => entry.id !== id));
      toast({
        title: 'Entry Removed',
        description: 'Query history entry has been removed',
      });
    } catch (error) {
      console.error('Failed to remove history entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove history entry',
        variant: 'destructive',
      });
    }
  };

  const updateHistoryEntry = async (id: string, updatedAttributes: PIAttribute[]) => {
    try {
      const entry = queryHistory.find(e => e.id === id);
      if (!entry) return;

      const updatedEntry = {
        ...entry,
        attributes: updatedAttributes,
        timestamp: new Date().toISOString(), // Update timestamp to show it was modified
      };

      // Update in IndexedDB
      const updatedHistory = queryHistory.map(e => e.id === id ? updatedEntry : e);
      await historianDB.saveQueryHistory(tenantId, updatedHistory);
      
      // Update local state
      setQueryHistory(updatedHistory);
      
      // Remove from modified queries
      setModifiedQueries(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      
      toast({
        title: 'Query Updated',
        description: `Query updated with ${updatedAttributes.length} attributes`,
      });
    } catch (error) {
      console.error('Failed to update history entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to update query history',
        variant: 'destructive',
      });
    }
  };

  const markQueryAsModified = (id: string) => {
    setModifiedQueries(prev => new Set(prev).add(id));
  };

  const clearAllSelections = () => {
    setSelectedAttributes([]);
    setQueryResults([]);
    setActiveTab('query');
    
    // Clear saved selection state from localStorage
    try {
      localStorage.removeItem(`historian_selection_${tenantId}`);
    } catch (error) {
      console.warn('Failed to clear saved selection state:', error);
    }
    
    toast({
      title: 'Selections Cleared',
      description: 'All attributes, results, and saved selections have been cleared. Ready for a new query.',
      variant: 'default',
    });
  };

  const saveAllModifiedQueries = async () => {
    if (modifiedQueries.size === 0) return;
    
    try {
      for (const id of modifiedQueries) {
        const entry = queryHistory.find(e => e.id === id);
        if (entry) {
          await updateHistoryEntry(id, entry.attributes);
        }
      }
      
      toast({
        title: 'All Changes Saved',
        description: `Saved ${modifiedQueries.size} modified queries`,
      });
    } catch (error) {
      console.error('Failed to save modified queries:', error);
      toast({
        title: 'Error',
        description: 'Failed to save some modified queries',
        variant: 'destructive',
      });
    }
  };

  const importQueryHistory = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importedHistory = JSON.parse(content);
        
        if (Array.isArray(importedHistory)) {
          // Use IndexedDB service to import history
          await historianDB.importQueryHistory(tenantId, importedHistory);
          
          // Reload history from IndexedDB
          const updatedHistory = await loadQueryHistoryFromStorage();
          setQueryHistory(updatedHistory);
          
          toast({
            title: 'History Imported',
            description: `Successfully imported ${importedHistory.length} query history entries`,
          });
        } else {
          toast({
            title: 'Import Failed',
            description: 'Invalid file format. Expected an array of query history entries.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Failed to import query history:', error);
        toast({
          title: 'Import Failed',
          description: 'Failed to import query history',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    
    // Reset the input
    event.target.value = '';
  };

  const getAttributeSummary = () => {
    if (selectedAttributes.length === 0 || !piClient) return null;

    const categories = selectedAttributes.reduce((acc, attr) => {
      const category = getCategoryFromAttribute(attr);
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (
      <div className="flex flex-wrap gap-2">
        {Object.entries(categories).map(([category, count]) => (
          <Badge key={category} variant="secondary" className="capitalize">
            {category}: {count}
          </Badge>
        ))}
      </div>
    );
  };

  const getCategoryFromAttribute = (attribute: PIAttribute): string => {
    if (!attribute || !attribute.Name || !attribute.Path) return 'other';
    
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

  const renderQueryParameter = (label: string, value: any, formatter?: (val: any) => string) => {
    if (value === undefined || value === null || value === '') return null;
    
    try {
      const displayValue = formatter ? formatter(value) : String(value);
      return <span key={label}><strong>{label}:</strong> {displayValue}</span>;
    } catch (error) {
      console.warn(`Failed to render query parameter ${label}:`, error);
      return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Database className="w-8 h-8 text-blue-600" />
            Enhanced Historian
          </h2>
          <p className="text-muted-foreground">
            Multi-attribute time series data analysis and visualization
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              Storage: {historianDB.getStorageType() === 'indexeddb' ? 'IndexedDB' : 'Fallback'}
            </Badge>
            {historianDB.getStorageType() === 'fallback' && (
              <Badge variant="secondary" className="text-xs">
                Limited Storage
              </Badge>
            )}
          </div>
        </div>
        
        {queryResults.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={clearResults}>
              Clear Results
            </Button>
            {piClient && (
              <Button onClick={exportAllData}>
                <Download className="w-4 h-4 mr-2" />
                Export All Data
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="query" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Query Setup
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2" disabled={queryResults.length === 0 || !piClient}>
            <BarChart3 className="w-4 h-4" />
            Results
          </TabsTrigger>
          <TabsTrigger value="charts" className="flex items-center gap-2" disabled={queryResults.length === 0 || !piClient}>
            <TrendingUp className="w-4 h-4" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Diagnostics
          </TabsTrigger>
        </TabsList>

        {/* Query Setup Tab */}
        <TabsContent value="query" className="space-y-6">
          {/* Selected Attributes Summary */}
          {selectedAttributes.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Selected Attributes ({selectedAttributes.length})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllSelections}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    New Query
                  </Button>
                </div>
                <CardDescription>
                  {selectedAttributes.length === 1 
                    ? '1 attribute selected for historian query'
                    : `${selectedAttributes.length} attributes selected for historian query`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedAttributes.map((attr) => (
                    <div key={attr.WebId} className="p-3 border rounded-lg bg-muted/30">
                      <div className="font-medium text-sm">{attr.Name}</div>
                      <div className="text-xs text-muted-foreground truncate">{attr.Path}</div>
                      {attr.DefaultUnitsName && (
                        <div className="text-xs text-muted-foreground">{attr.DefaultUnitsName}</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attribute Selection */}
          {piClient ? (
            <MultiAttributeSelector
              key={tenantId} // Force re-render when tenant changes
              piClient={piClient}
              onAttributesSelected={handleAttributesSelected}
              selectedAttributes={selectedAttributes}
              maxAttributes={15}
              tenantId={tenantId}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>PI Web API connection not available</p>
                  <p className="text-sm">Please configure your PI connection in the Connection tab</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Query Form */}
          {selectedAttributes.length > 0 && piClient ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Query Parameters
                </CardTitle>
                <CardDescription>
                  Configure time range and data retrieval options for {selectedAttributes.length} selected attributes
                </CardDescription>
                {piClient && selectedAttributes.length > 0 && getAttributeSummary()}
              </CardHeader>
              <CardContent>
                <HistorianQueryForm
                  defaultStart={defaultStart || new Date(Date.now() - 3600 * 1000).toISOString()}
                  defaultEnd={defaultEnd || new Date().toISOString()}
                  onSubmit={handleQuerySubmit}
                />
              </CardContent>
            </Card>
          ) : selectedAttributes.length > 0 && !piClient ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center text-muted-foreground">
                  <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>PI Web API connection not available</p>
                  <p className="text-sm">Please configure your PI connection in the Connection tab</p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          {!piClient ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>PI Web API connection not available</p>
                  <p className="text-sm">Please configure your PI connection in the Connection tab</p>
                </div>
              </CardContent>
            </Card>
          ) : loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Activity className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-muted-foreground">Executing query...</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Results Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Query Results
                  </CardTitle>
                  <CardDescription>
                    Data retrieved from {queryResults.length} streams
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {queryResults.length}
                      </div>
                      <div className="text-sm text-blue-600">Streams</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {queryResults.reduce((sum, r) => sum + (r.points?.length || 0), 0)}
                      </div>
                      <div className="text-sm text-green-600">Data Points</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedAttributes.length}
                      </div>
                      <div className="text-sm text-purple-600">Attributes</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Data Table */}
              <TimeSeriesTable results={queryResults} pageSize={50} />
            </>
          )}
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-6">
          {!piClient ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>PI Web API connection not available</p>
                  <p className="text-sm">Please configure your PI connection in the Connection tab</p>
                </div>
              </CardContent>
            </Card>
          ) : queryResults.length > 0 ? (
            <TimeSeriesChart results={queryResults} height={500} />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No data available for visualization</p>
                  <p className="text-sm">Run a query first to see charts</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Query History
                  </CardTitle>
                  <CardDescription>
                    Recent historian queries and their results. Click on any query to view details and modify attributes.
                  </CardDescription>
                </div>
                {queryHistory.length > 0 && (
                  <div className="flex items-center gap-2">
                    {modifiedQueries.size > 0 && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={saveAllModifiedQueries}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Save Changes ({modifiedQueries.size})
                      </Button>
                    )}
                    <input
                      type="file"
                      accept=".json"
                      onChange={importQueryHistory}
                      className="hidden"
                      id="import-history-file"
                    />
                    <label htmlFor="import-history-file">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        Import History
                      </Button>
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const historyData = await historianDB.exportQueryHistory(tenantId);
                          
                          const blob = new Blob([JSON.stringify(historyData, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `historian_query_history_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                          
                          toast({
                            title: 'History Exported',
                            description: 'Query history has been exported to JSON file',
                          });
                        } catch (error) {
                          console.error('Failed to export query history:', error);
                          toast({
                            title: 'Export Failed',
                            description: 'Failed to export query history',
                            variant: 'destructive',
                          });
                        }
                      }}
                    >
                      Export History
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearQueryHistory}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Clear History
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!piClient ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>PI Web API connection not available</p>
                  <p className="text-sm">Please configure your PI connection in the Connection tab</p>
                </div>
              ) : queryHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No query history yet</p>
                  <p className="text-sm">Run your first query to see it here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {queryHistory.map((entry) => (
                    <div key={entry.id} className={`border rounded-lg p-4 hover:bg-muted/50 transition-colors ${
                      modifiedQueries.has(entry.id) ? 'border-orange-300 bg-orange-50/30' : ''
                    }`}>
                      {/* Query Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {modifiedQueries.has(entry.id) && (
                              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                                Modified
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-sm">
                              {entry.attributes.length} attributes
                            </Badge>
                            <Badge variant="secondary" className="text-sm">
                              {entry.resultCount.toLocaleString()} points
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {entry.queryParams.mode || 'interpolated'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                          
                          {/* Query Parameters */}
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center gap-4">
                              {(() => {
                                try {
                                  if (entry.queryParams.start && entry.queryParams.end) {
                                    const startDate = new Date(entry.queryParams.start);
                                    const endDate = new Date(entry.queryParams.end);
                                    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                                      return renderQueryParameter('Time Range', `${startDate.toLocaleString()} - ${endDate.toLocaleString()}`);
                                    }
                                  }
                                  return renderQueryParameter('Time Range', 'Invalid dates');
                                } catch (error) {
                                  console.warn('Failed to format time range:', error);
                                  return renderQueryParameter('Time Range', 'Error');
                                }
                              })()}
                              {renderQueryParameter('Interval', entry.queryParams.interval)}
                              {renderQueryParameter('Intervals', entry.queryParams.intervals)}
                            </div>
                            <div className="flex items-center gap-4">
                              {renderQueryParameter('Include Bad', entry.queryParams.includeBad, (val) => val ? 'Yes' : 'No')}
                              {renderQueryParameter('Boundary', entry.queryParams.boundaryType)}
                              {renderQueryParameter('Summary', entry.queryParams.summaryTypes, (val) => 
                                Array.isArray(val) ? val.join(', ') : String(val)
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAttributes(entry.attributes);
                              setActiveTab('query');
                            }}
                            disabled={!piClient}
                          >
                            Reuse Query
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeHistoryEntry(entry.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            ×
                          </Button>
                        </div>
                      </div>

                      {/* Attributes List */}
                      <div className="border-t pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-sm">Attributes ({entry.attributes.length})</h5>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedAttributes(entry.attributes);
                                setActiveTab('query');
                              }}
                              disabled={!piClient}
                              className="text-xs h-7 px-2"
                            >
                              Edit Attributes
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Add current selected attributes to this query's attributes
                                const combinedAttributes = [...entry.attributes, ...selectedAttributes.filter(
                                  attr => !entry.attributes.find(existing => existing.WebId === attr.WebId)
                                )];
                                
                                if (combinedAttributes.length > entry.attributes.length) {
                                  // Update the entry locally and mark as modified
                                  const updatedHistory = queryHistory.map(e => 
                                    e.id === entry.id 
                                      ? { ...e, attributes: combinedAttributes }
                                      : e
                                  );
                                  setQueryHistory(updatedHistory);
                                  markQueryAsModified(entry.id);
                                  
                                  toast({
                                    title: 'Attributes Added',
                                    description: `Added ${combinedAttributes.length - entry.attributes.length} new attributes`,
                                  });
                                } else {
                                  toast({
                                    title: 'No New Attributes',
                                    description: 'All selected attributes are already in this query',
                                    variant: 'default',
                                  });
                                }
                              }}
                              disabled={!piClient || selectedAttributes.length === 0}
                              className="text-xs h-7 px-2"
                            >
                              Add Current
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                          {entry.attributes.map((attr) => (
                            <div key={attr.WebId} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{attr.Name}</div>
                                <div className="text-muted-foreground truncate">{attr.Path}</div>
                                {attr.DefaultUnitsName && (
                                  <div className="text-muted-foreground">{attr.DefaultUnitsName}</div>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Remove this attribute from the query
                                  const updatedAttributes = entry.attributes.filter(a => a.WebId !== attr.WebId);
                                  if (updatedAttributes.length > 0) {
                                    // Update the entry locally and mark as modified
                                    const updatedHistory = queryHistory.map(e => 
                                      e.id === entry.id 
                                        ? { ...e, attributes: updatedAttributes }
                                        : e
                                    );
                                    setQueryHistory(updatedHistory);
                                    markQueryAsModified(entry.id);
                                    
                                    toast({
                                      title: 'Attribute Removed',
                                      description: `Removed ${attr.Name} from query`,
                                    });
                                  } else {
                                    toast({
                                      title: 'Cannot Remove All Attributes',
                                      description: 'A query must have at least one attribute',
                                      variant: 'destructive',
                                    });
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0"
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Query Statistics */}
                      <div className="border-t pt-3 mt-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div className="text-center">
                            <div className="font-medium text-blue-600">{entry.attributes.length}</div>
                            <div className="text-muted-foreground">Attributes</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-green-600">{entry.resultCount.toLocaleString()}</div>
                            <div className="text-muted-foreground">Data Points</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-purple-600">
                              {(() => {
                                try {
                                  if (entry.queryParams.start && entry.queryParams.end) {
                                    const startTime = new Date(entry.queryParams.start).getTime();
                                    const endTime = new Date(entry.queryParams.end).getTime();
                                    if (!isNaN(startTime) && !isNaN(endTime)) {
                                      return Math.round((endTime - startTime) / (1000 * 60 * 60));
                                    }
                                  }
                                  return 'N/A';
                                } catch (error) {
                                  console.warn('Failed to calculate time range:', error);
                                  return 'N/A';
                                }
                              })()}
                            </div>
                            <div className="text-muted-foreground">Hours</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-orange-600">
                              {(() => {
                                try {
                                  if (entry.queryParams.start) {
                                    const startDate = new Date(entry.queryParams.start);
                                    if (!isNaN(startDate.getTime())) {
                                      return startDate.toLocaleDateString();
                                    }
                                  }
                                  return 'N/A';
                                } catch (error) {
                                  console.warn('Failed to format start date:', error);
                                  return 'N/A';
                                }
                              })()}
                            </div>
                            <div className="text-muted-foreground">Date</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diagnostics Tab */}
        <TabsContent value="diagnostics" className="space-y-6">
          <PIConnectionDiagnostic piClient={piClient} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
