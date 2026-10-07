import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  RefreshCw, 
  Eye, 
  Database, 
  Settings, 
  Activity,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { globalProtocolManager } from '@/services/integrations/ProtocolManager';

interface OPCUANode {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: 'Variable' | 'Object' | 'Method' | 'ObjectType' | 'VariableType' | 'ReferenceType' | 'DataType';
  dataType?: string;
  value?: any;
  timestamp?: Date;
  quality?: 'Good' | 'Uncertain' | 'Bad';
  children?: OPCUANode[];
}

interface OPCUABrowserProps {
  connectionId?: string;
}

export const OPCUABrowser: React.FC<OPCUABrowserProps> = ({ connectionId }) => {
  const [nodes, setNodes] = useState<OPCUANode[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<OPCUANode[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeValues, setIncludeValues] = useState(false);
  const [maxNodes, setMaxNodes] = useState(100);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<OPCUANode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [browseOptions, setBrowseOptions] = useState({
    startingNode: 'i=84',
    maxNodes: 100,
    includeValues: false,
    recursive: false,
    filter: ''
  });

  const [restorationStatus, setRestorationStatus] = useState<{
    totalStored: number;
    totalRestored: number;
    connections: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      restored: boolean;
    }>;
  } | null>(null);

  // Check restoration status
  const checkRestorationStatus = async () => {
    try {
      const status = await globalProtocolManager.getRestorationStatus();
      setRestorationStatus(status);
    } catch (error) {
      console.error('Error checking restoration status:', error);
    }
  };

  // Check restoration status on mount
  useEffect(() => {
    checkRestorationStatus();
  }, []);

  // Get the first available OPC UA connection if none specified
  useEffect(() => {
    if (!connectionId) {
      const connections = globalProtocolManager.getAllConnections();
      const opcuaConnection = Array.from(connections.values()).find(conn => conn.type === 'opcua');
      if (opcuaConnection) {
        // Use the first OPC UA connection
        browseAddressSpace();
      }
    } else {
      browseAddressSpace();
    }
  }, [connectionId]);

  const browseAddressSpace = async () => {
    try {
      setLoading(true);
      
      let connector;
      if (connectionId) {
        const connection = globalProtocolManager.getConnection(connectionId);
        connector = connection?.connector;
      } else {
        // Get first OPC UA connection
        const connections = globalProtocolManager.getAllConnections();
        const opcuaConnection = Array.from(connections.values()).find(conn => conn.type === 'opcua');
        connector = opcuaConnection?.connector;
      }

      if (!connector) {
        console.error('No OPC UA connector available');
        return;
      }

      const browsedNodes = await connector.browseAddressSpace({
        maxNodes,
        includeValues,
        filter: searchTerm
      });

      setNodes(browsedNodes);
      setFilteredNodes(browsedNodes);
      console.log('Browsed nodes:', browsedNodes);
      
    } catch (error) {
      console.error('Error browsing address space:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredNodes(nodes);
    } else {
      const filtered = nodes.filter(node => 
        node.browseName.toLowerCase().includes(term.toLowerCase()) ||
        node.displayName.toLowerCase().includes(term.toLowerCase()) ||
        node.nodeId.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredNodes(filtered);
    }
  };

  const handleNodeClick = (node: OPCUANode) => {
    setSelectedNode(node);
  };

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderNodeValue = (node: OPCUANode) => {
    if (!node.value && node.value !== 0) return null;
    
    return (
      <div className="ml-4 text-sm text-gray-600">
        <span className="font-medium">Value:</span> {String(node.value)}
        {node.timestamp && (
          <span className="ml-2 text-gray-500">
            at {node.timestamp.toLocaleTimeString()}
          </span>
        )}
        {node.quality && (
          <Badge 
            variant={node.quality === 'Good' ? 'default' : 'destructive'}
            className="ml-2"
          >
            {node.quality}
          </Badge>
        )}
      </div>
    );
  };

  const renderNode = (node: OPCUANode, level: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.nodeId);
    
    return (
      <div key={node.nodeId} className="mb-1">
        <div 
          className={`
            flex items-center p-2 rounded hover:bg-gray-50 cursor-pointer
            ${selectedNode?.nodeId === node.nodeId ? 'bg-blue-50 border border-blue-200' : ''}
          `}
          style={{ paddingLeft: `${level * 20 + 12}px` }}
          onClick={() => handleNodeClick(node)}
        >
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 mr-2"
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeExpansion(node.nodeId);
              }}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          )}
          
          <div className="flex items-center flex-1">
            <Badge variant="outline" className="mr-2 text-xs">
              {node.nodeClass}
            </Badge>
            <span className="font-medium">{node.browseName}</span>
            {node.dataType && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {node.dataType}
              </Badge>
            )}
          </div>
          
          <div className="text-xs text-gray-500">
            {node.nodeId}
          </div>
        </div>
        
        {renderNodeValue(node)}
        
        {hasChildren && isExpanded && (
          <div className="ml-4">
            {node.children!.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">OPC UA Browser</h2>
          <p className="text-muted-foreground">
            Browse and explore OPC UA server address space and real-time data
          </p>
        </div>
      </div>

      {/* Connection Status Section */}
      <Card className="border-l-4 border-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            OPC UA Connection Status
          </CardTitle>
          <CardDescription>
            Current connection information and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(() => {
              const connections = globalProtocolManager.getAllConnections();
              const opcuaConnections = Array.from(connections.values()).filter(conn => conn.type === 'opcua');
              
              if (opcuaConnections.length === 0) {
                return (
                  <div className="col-span-full text-center py-4">
                    <Database className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No OPC UA connections found</p>
                    <p className="text-sm text-gray-400">Create an OPC UA connection first</p>
                  </div>
                );
              }

              return opcuaConnections.map((conn, index) => (
                <div key={conn.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      conn.connector?.isConnected?.() ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="font-medium text-sm">{conn.name}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    <div>Status: {conn.connector?.isConnected?.() ? 'Connected' : 'Disconnected'}</div>
                    <div>Endpoint: {conn.config.endpoint}</div>
                    <div>Type: {conn.type.toUpperCase()}</div>
                    {conn.lastActivity && (
                      <div>Last: {conn.lastActivity.toLocaleTimeString()}</div>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Restoration Status */}
      <Card className="border-l-4 border-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-green-600" />
            Connection Persistence Status
          </CardTitle>
          <CardDescription>
            Check if OPC UA connections are properly persisted and restored
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Stored in IndexedDB:</span>
                <Badge variant="outline" className="bg-blue-100 text-blue-800">
                  {restorationStatus?.totalStored || 0}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Restored in Memory:</span>
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  {restorationStatus?.totalRestored || 0}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={checkRestorationStatus}
                className="text-blue-700 border-blue-300 hover:bg-blue-100"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Status
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                  try {
                    await globalProtocolManager.forceRestoreConnections();
                    await checkRestorationStatus();
                  } catch (error) {
                    console.error('Error forcing restoration:', error);
                  }
                }}
                className="text-green-700 border-green-300 hover:bg-green-100"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Force Restore
              </Button>
            </div>
          </div>
          
          {restorationStatus?.connections && restorationStatus.connections.length > 0 && (
            <div className="space-y-2">
              <span className="text-green-700 font-medium">Active Connections:</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {restorationStatus.connections.map(conn => (
                  <div key={conn.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm">{conn.name}</span>
                    <Badge 
                      variant={conn.status === 'connected' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {conn.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Address Space Browser</CardTitle>
              <CardDescription>
                Browse OPC UA server nodes and view real-time data
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={browseAddressSpace}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Browsing...' : 'Refresh'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIncludeValues(!includeValues)}
              >
                <Eye className="w-4 h-4 mr-2" />
                {includeValues ? 'Hide Values' : 'Show Values'}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {/* Status and Controls */}
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="maxNodes">Max Nodes:</Label>
              <Input
                id="maxNodes"
                type="number"
                value={maxNodes}
                onChange={(e) => setMaxNodes(parseInt(e.target.value) || 100)}
                className="w-20"
                min="10"
                max="1000"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="search">Search:</Label>
              <Input
                id="search"
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
          
          {/* Status Indicator */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">Status:</span>
              {loading ? (
                <span className="flex items-center gap-2 text-blue-600">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Browsing address space...
                </span>
              ) : nodes.length > 0 ? (
                <span className="text-green-600">
                  ✅ Found {nodes.length} nodes
                </span>
              ) : (
                <span className="text-gray-500">
                  No nodes browsed yet
                </span>
              )}
            </div>
            {nodes.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Filtered:</span>
                <span className="text-blue-600">{filteredNodes.length} nodes</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Nodes Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Address Space Nodes
          </CardTitle>
          <CardDescription>
            Browse and explore the OPC UA server address space
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mr-3" />
              <span className="text-lg text-gray-600">Browsing address space...</span>
            </div>
          ) : filteredNodes.length === 0 ? (
            <div className="text-center py-8">
              <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No nodes found</p>
              <p className="text-sm text-gray-400">
                {nodes.length === 0 
                  ? 'Click "Refresh" to browse the address space' 
                  : 'No nodes match your search criteria'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-gray-600 mb-4">
                Showing {filteredNodes.length} of {nodes.length} nodes
                {searchTerm && ` matching "${searchTerm}"`}
              </div>
              <div className="border rounded-lg divide-y">
                {filteredNodes.map((node) => (
                  <div key={node.nodeId} className="p-3 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{node.browseName}</span>
                          <Badge variant="outline" className="text-xs">
                            {node.nodeClass}
                          </Badge>
                          {node.dataType && (
                            <Badge variant="secondary" className="text-xs">
                              {node.dataType}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 mb-2">
                          Node ID: {node.nodeId}
                        </div>
                        {node.displayName !== node.browseName && (
                          <div className="text-xs text-gray-600 mb-2">
                            Display: {node.displayName}
                          </div>
                        )}
                        {includeValues && node.value !== undefined && (
                          <div className="text-sm">
                            <span className="font-medium text-green-700">Value:</span>
                            <span className="ml-2 font-mono bg-gray-100 px-2 py-1 rounded">
                              {String(node.value)}
                            </span>
                            {node.timestamp && (
                              <span className="ml-3 text-xs text-gray-500">
                                at {node.timestamp.toLocaleTimeString()}
                              </span>
                            )}
                            {node.quality && (
                              <Badge 
                                variant={node.quality === 'Good' ? 'default' : 'destructive'}
                                className="ml-2 text-xs"
                              >
                                {node.quality}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      {node.children && node.children.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => toggleNodeExpansion(node.nodeId)}
                        >
                          {expandedNodes.has(node.nodeId) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                    
                    {/* Children nodes */}
                    {node.children && node.children.length > 0 && expandedNodes.has(node.nodeId) && (
                      <div className="mt-3 ml-6 border-l-2 border-gray-200 pl-4">
                        {node.children.map((child) => renderNode(child))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Node Details */}
      {selectedNode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Node Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="font-medium">Node ID</Label>
                <p className="text-gray-600 font-mono">{selectedNode.nodeId}</p>
              </div>
              <div>
                <Label className="font-medium">Browse Name</Label>
                <p className="text-gray-600">{selectedNode.browseName}</p>
              </div>
              <div>
                <Label className="font-medium">Display Name</Label>
                <p className="text-gray-600">{selectedNode.displayName}</p>
              </div>
              <div>
                <Label className="font-medium">Node Class</Label>
                <Badge variant="outline">{selectedNode.nodeClass}</Badge>
              </div>
              {selectedNode.dataType && (
                <div>
                  <Label className="font-medium">Data Type</Label>
                  <Badge variant="secondary">{selectedNode.dataType}</Badge>
                </div>
              )}
              {selectedNode.value !== undefined && (
                <div>
                  <Label className="font-medium">Current Value</Label>
                  <p className="text-gray-600">{String(selectedNode.value)}</p>
                </div>
              )}
              {selectedNode.timestamp && (
                <div>
                  <Label className="font-medium">Timestamp</Label>
                  <p className="text-gray-600">{selectedNode.timestamp.toLocaleString()}</p>
                </div>
              )}
              {selectedNode.quality && (
                <div>
                  <Label className="font-medium">Quality</Label>
                  <Badge 
                    variant={selectedNode.quality === 'Good' ? 'default' : 'destructive'}
                  >
                    {selectedNode.quality}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
