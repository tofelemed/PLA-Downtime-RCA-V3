import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Building2, Factory, Settings, Package, Plus, Edit, Trash2, Database, Folder, FolderOpen, Hash, FileText, Info, Copy } from 'lucide-react';
import { useSpring, animated } from '@react-spring/web';
import CustomAttributeDisplay from '../CustomAttributeDisplay';
import { masterDataService, Organization, Tenant, Unit, Asset } from '../../services/MasterDataService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PlantHierarchyManagerProps {
  onEdit?: (type: 'org' | 'tenant' | 'unit' | 'asset', item: any, parent?: any) => void;
  onDelete?: (type: 'org' | 'tenant' | 'unit' | 'asset', item: any) => void;
  onAdd?: (type: 'org' | 'tenant' | 'unit' | 'asset', parent?: any) => void;
}

export const PlantHierarchyManager: React.FC<PlantHierarchyManagerProps> = ({
  onEdit,
  onDelete,
  onAdd
}) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [expandedOrgs, setExpandedOrgs] = useState<string[]>([]);
  const [expandedTenants, setExpandedTenants] = useState<string[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<string[]>([]);
  const [selectedElement, setSelectedElement] = useState<{
    type: 'Organization' | 'Tenant' | 'Unit' | 'Asset';
    id: string;
    data: any;
    parent?: any;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [orgs, tnts, unts, asts] = await Promise.all([
        masterDataService.getOrganizations(),
        masterDataService.getTenants(),
        masterDataService.getUnits(),
        masterDataService.getAssets()
      ]);
      setOrganizations(orgs);
      setTenants(tnts);
      setUnits(unts);
      setAssets(asts);
    } catch (error) {
      console.error('Failed to load plant hierarchy data:', error);
    }
  };

  const toggleExpand = (id: string, type: 'org' | 'tenant' | 'unit') => {
    switch (type) {
      case 'org':
        setExpandedOrgs(prev => 
          prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
        break;
      case 'tenant':
        setExpandedTenants(prev => 
          prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
        break;
      case 'unit':
        setExpandedUnits(prev => 
          prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
        break;
    }
  };

  const handleElementClick = (type: 'Organization' | 'Tenant' | 'Unit' | 'Asset', data: any, parent?: any) => {
    setSelectedElement({ type, id: data.id, data, parent });
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'Active': 'bg-green-100 text-green-800',
      'Inactive': 'bg-gray-100 text-gray-800',
      'Maintenance': 'bg-yellow-100 text-yellow-800',
      'Offline': 'bg-red-100 text-red-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const filteredOrganizations = organizations.filter(org => 
    !searchQuery || 
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTenants = tenants.filter(tenant => 
    !searchQuery || 
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUnits = units.filter(unit => 
    !searchQuery || 
    unit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    unit.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAssets = assets.filter(asset => 
    !searchQuery || 
    asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2" />
            Plant Hierarchy Management
          </CardTitle>
          <CardDescription>
            Visualize and manage your organizational structure from organizations down to individual assets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="mb-4 flex items-center gap-2">
            <Input
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-80"
            />
          </div>

          {filteredOrganizations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No plant hierarchy defined. Start by adding organizations.
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-4">
              {/* Left Side - Hierarchy Tree (3 columns) */}
              <div className="col-span-3 border rounded max-h-[520px] overflow-auto bg-white/70">
                <div className="space-y-3 p-3">
                  {filteredOrganizations.map(org => (
                    <animated.div key={org.id} style={{ overflow: 'hidden' }}>
                      <Card className="border shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center gap-2 pb-2">
                          <button 
                            onClick={() => toggleExpand(org.id, 'org')} 
                            className="focus:outline-none hover:bg-gray-100 rounded p-1"
                          >
                            {expandedOrgs.includes(org.id) ? 
                              <ChevronDown className="h-4 w-4" /> : 
                              <ChevronRight className="h-4 w-4" />
                            }
                          </button>
                          <Building2 className="h-5 w-5 text-blue-600" />
                          <button
                            onClick={() => handleElementClick('Organization', org)}
                            className={`flex-1 text-left hover:bg-gray-50 rounded p-2 transition-colors ${
                              selectedElement?.id === org.id ? 'bg-blue-50 border border-blue-200' : ''
                            }`}
                          >
                            <span className="font-medium">{org.name}</span>
                            {org.code && <span className="text-sm text-gray-500 ml-2">({org.code})</span>}
                          </button>
                          <Badge className="bg-blue-100 text-blue-800">Organization</Badge>
                          <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(org.status ?? 'Active')}`}>
                            {org.status ?? 'Active'}
                          </span>
                          <div className="flex gap-1">
                            {onEdit && (
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                title="Edit" 
                                onClick={() => onEdit('org', org)}
                                className="h-8 w-8"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            {onAdd && (
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                title="Add Plant" 
                                onClick={() => onAdd('tenant', org)}
                                className="h-8 w-8 text-green-600"
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        
                        {expandedOrgs.includes(org.id) && (
                          <CardContent className="pt-0">
                            {filteredTenants.filter(t => t.organizationId === org.id).length === 0 ? (
                              <div className="text-gray-400 italic ml-8">No plants/tenants under this organization.</div>
                            ) : (
                              filteredTenants.filter(t => t.organizationId === org.id).map(tenant => (
                                <animated.div key={tenant.id} style={{ overflow: 'hidden' }}>
                                  <div className="ml-6 mb-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <button 
                                        onClick={() => toggleExpand(tenant.id, 'tenant')} 
                                        className="focus:outline-none hover:bg-gray-100 rounded p-1"
                                      >
                                        {expandedTenants.includes(tenant.id) ? 
                                          <ChevronDown className="h-4 w-4" /> : 
                                          <ChevronRight className="h-4 w-4" />
                                        }
                                      </button>
                                      <Factory className="h-4 w-4 text-green-600" />
                                      <button
                                        onClick={() => handleElementClick('Tenant', tenant, org)}
                                        className={`flex-1 text-left hover:bg-gray-50 rounded p-2 transition-colors ${
                                          selectedElement?.id === tenant.id ? 'bg-green-50 border border-green-200' : ''
                                        }`}
                                      >
                                        <span className="font-medium">{tenant.name}</span>
                                        {tenant.code && <span className="text-sm text-gray-500 ml-2">({tenant.code})</span>}
                                      </button>
                                      <Badge className="bg-green-100 text-green-800">Plant</Badge>
                                      <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(tenant.status ?? 'Active')}`}>
                                        {tenant.status ?? 'Active'}
                                      </span>
                                      <div className="flex gap-1">
                                        {onEdit && (
                                          <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            title="Edit" 
                                            onClick={() => onEdit('tenant', tenant, org)}
                                            className="h-6 w-6"
                                          >
                                            <Edit className="w-3 h-3" />
                                          </Button>
                                        )}
                                        {onAdd && (
                                          <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            title="Add Unit" 
                                            onClick={() => onAdd('unit', tenant)}
                                            className="h-6 w-6 text-orange-600"
                                          >
                                            <Plus className="w-3 h-3" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {expandedTenants.includes(tenant.id) && (
                                      <>
                                        {filteredUnits.filter(u => u.tenantId === tenant.id).length === 0 ? (
                                          <div className="ml-6 text-gray-400 italic">No units under this plant.</div>
                                        ) : (
                                          filteredUnits.filter(u => u.tenantId === tenant.id).map(unit => (
                                            <animated.div key={unit.id} style={{ overflow: 'hidden' }}>
                                              <div className="ml-6 mb-2">
                                                <div className="flex items-center gap-2 mb-2">
                                                  <button 
                                                    onClick={() => toggleExpand(unit.id, 'unit')} 
                                                    className="focus:outline-none hover:bg-gray-100 rounded p-1"
                                                  >
                                                    {expandedUnits.includes(unit.id) ? 
                                                      <ChevronDown className="h-4 w-4" /> : 
                                                      <ChevronRight className="h-4 w-4" />
                                                    }
                                                  </button>
                                                  <Settings className="h-4 w-4 text-orange-600" />
                                                  <button
                                                    onClick={() => handleElementClick('Unit', unit, tenant)}
                                                    className={`flex-1 text-left hover:bg-gray-50 rounded p-2 transition-colors ${
                                                      selectedElement?.id === unit.id ? 'bg-orange-50 border border-orange-200' : ''
                                                    }`}
                                                  >
                                                    <span className="font-medium">{unit.name}</span>
                                                    {unit.code && <span className="text-sm text-gray-500 ml-2">({unit.code})</span>}
                                                  </button>
                                                  <Badge className="bg-orange-100 text-orange-800">Unit</Badge>
                                                  <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(unit.status ?? 'Active')}`}>
                                                    {unit.status ?? 'Active'}
                                                  </span>
                                                  <div className="flex gap-1">
                                                    {onEdit && (
                                                      <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        title="Edit" 
                                                        onClick={() => onEdit('unit', unit, tenant)}
                                                        className="h-6 w-6"
                                                      >
                                                        <Edit className="w-3 h-3" />
                                                      </Button>
                                                    )}
                                                    {onAdd && (
                                                      <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        title="Add Asset" 
                                                        onClick={() => onAdd('asset', unit)}
                                                        className="h-6 w-6 text-purple-600"
                                                      >
                                                        <Plus className="w-3 h-3" />
                                                      </Button>
                                                    )}
                                                  </div>
                                                </div>
                                                
                                                {expandedUnits.includes(unit.id) && (
                                                  <>
                                                    {filteredAssets.filter(a => a.unitId === unit.id).length === 0 ? (
                                                      <div className="ml-6 text-gray-400 italic">No assets under this unit.</div>
                                                    ) : (
                                                      <div className="ml-6">
                                                        {filteredAssets.filter(a => a.unitId === unit.id).map(asset => (
                                                          <div key={asset.id} className="mb-2">
                                                            <div className="flex items-center gap-2">
                                                              <Package className="h-4 w-4 text-purple-600" />
                                                              <button
                                                                onClick={() => handleElementClick('Asset', asset, unit)}
                                                                className={`flex-1 text-left hover:bg-gray-50 rounded p-2 transition-colors ${
                                                                  selectedElement?.id === asset.id ? 'bg-purple-50 border border-purple-200' : ''
                                                                }`}
                                                              >
                                                                <span className="font-medium">{asset.name}</span>
                                                                {asset.code && <span className="text-sm text-gray-500 ml-2">({asset.code})</span>}
                                                              </button>
                                                              <Badge className="bg-purple-100 text-purple-800">Asset</Badge>
                                                              <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(asset.status ?? 'Active')}`}>
                                                                {asset.status ?? 'Active'}
                                                              </span>
                                                              <div className="flex gap-1">
                                                                {onEdit && (
                                                                  <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    title="Edit" 
                                                                    onClick={() => onEdit('asset', asset, unit)}
                                                                    className="h-6 w-6"
                                                                  >
                                                                    <Edit className="w-3 h-3" />
                                                                  </Button>
                                                                )}
                                                              </div>
                                                            </div>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    )}
                                                  </>
                                                )}
                                              </div>
                                            </animated.div>
                                          ))
                                        )}
                                      </>
                                    )}
                                  </div>
                                </animated.div>
                              ))
                            )}
                          </CardContent>
                        )}
                      </Card>
                    </animated.div>
                  ))}
                </div>
              </div>

              {/* Right Side - Element Details & Attributes (2 columns) */}
              <div className="col-span-2 border rounded bg-white/70 p-3 max-h-[520px] overflow-auto">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold">Element Details & Attributes</div>
                    <div className="text-xs text-muted-foreground break-all">
                      {selectedElement ? selectedElement.data.name : 'Select an element'}
                    </div>
                    {selectedElement && (
                      <div className="mt-1 text-[11px] text-slate-600 flex items-center gap-2">
                        <span className="font-medium">Type:</span>
                        <span className="text-blue-600">{selectedElement.type}</span>
                        {selectedElement.data.code && (
                          <>
                            <span className="font-medium">Code:</span>
                            <span className="font-mono bg-gray-100 px-1 rounded">
                              {selectedElement.data.code}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {selectedElement ? (
                  <div className="space-y-4">
                    {/* Basic Information */}
                    <div>
                      <h4 className="font-medium mb-3 text-sm">Basic Information</h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-gray-600">Name:</span>
                          <div className="font-medium">{selectedElement.data.name}</div>
                        </div>
                        {selectedElement.data.code && (
                          <div>
                            <span className="text-gray-600">Code:</span>
                            <div className="font-medium">{selectedElement.data.code}</div>
                          </div>
                        )}
                        {selectedElement.data.description && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Description:</span>
                            <div className="font-medium">{selectedElement.data.description}</div>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Status:</span>
                          <Badge className={`text-xs ${getStatusBadge(selectedElement.data.status ?? 'Active')}`}>
                            {selectedElement.data.status ?? 'Active'}
                          </Badge>
                        </div>
                        {selectedElement.type === 'Unit' && (
                          <>
                            {selectedElement.data.capacity && (
                              <div>
                                <span className="text-gray-600">Capacity:</span>
                                <div className="font-medium">{selectedElement.data.capacity}</div>
                              </div>
                            )}
                            {selectedElement.data.unitOfMeasure && (
                              <div>
                                <span className="text-gray-600">Unit of Measure:</span>
                                <div className="font-medium">{selectedElement.data.unitOfMeasure}</div>
                              </div>
                            )}
                            {selectedElement.data.idealCycleTime && (
                              <div>
                                <span className="text-gray-600">Ideal Cycle Time:</span>
                                <div className="font-medium">{selectedElement.data.idealCycleTime} s/unit</div>
                              </div>
                            )}
                          </>
                        )}
                        {selectedElement.type === 'Asset' && (
                          <>
                            {selectedElement.data.assetType && (
                              <div>
                                <span className="text-gray-600">Asset Type:</span>
                                <div className="font-medium">{selectedElement.data.assetType}</div>
                              </div>
                            )}
                            {selectedElement.data.criticality && (
                              <div>
                                <span className="text-gray-600">Criticality:</span>
                                <div className="font-medium">{selectedElement.data.criticality}</div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Custom Attributes */}
                    <div>
                      <h4 className="font-medium mb-3 text-sm">Custom Attributes</h4>
                      <CustomAttributeDisplay
                        entityId={selectedElement.id}
                        entityType={selectedElement.type}
                        tenantId={selectedElement.type === 'Organization' ? undefined : 
                                 selectedElement.type === 'Tenant' ? selectedElement.id : 
                                 selectedElement.type === 'Unit' ? 
                                   units.find(u => u.id === selectedElement.id)?.tenantId : 
                                   assets.find(a => a.id === selectedElement.id)?.tenantId}
                        organizationId={selectedElement.type === 'Organization' ? selectedElement.id : 
                                      selectedElement.type === 'Tenant' ? selectedElement.id : 
                                      selectedElement.type === 'Unit' ? 
                                        units.find(u => u.id === selectedElement.id)?.tenantId : 
                                        assets.find(a => a.id === selectedElement.id)?.tenantId}
                        showHeader={false}
                        maxDisplay={8}
                        collapsible={false}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Database className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Element</h3>
                    <p className="text-sm text-gray-500">
                      Click on any element in the hierarchy to view its details and attributes
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PlantHierarchyManager; 