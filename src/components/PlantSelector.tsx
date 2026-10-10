import { defaultTenantFor } from '@/contexts/plant-selection-store';
import React, { useState, useEffect } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Factory, Settings, Package, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { Organization, Tenant, Unit, Asset } from '../services/MasterDataService';
import { masterDataService } from '../services/MasterDataService';
import { usePlantSelection } from '../contexts/PlantSelectionContext';
import { useAuth } from '../contexts/AuthContext';

// Helper for unique node keys
const getNodeKey = (type: string, id: string) => `${type}:${id}`;

const PlantSelector: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  const { session, isLoading: authLoading } = useAuth();
  const { selection: currentSelection, setSelection: onSelectionChange, loading: selectionLoading } = usePlantSelection();

  // Wait for authentication before loading data
  useEffect(() => {
    if (!authLoading && session) {
      loadData();
    } else if (!authLoading && !session) {
      // Not authenticated, don't load data
      setLoading(false);
    }
  }, [session, authLoading]);

  // Auto-select the first tenant (plant) in the hierarchy if no selection is set
  useEffect(() => {
    // wait for the saved selection: choosing a default before it loads would write on every page load
    if (!selectionLoading && !initialized && organizations.length && tenants.length && !currentSelection?.tenant && !currentSelection?.unit && !currentSelection?.asset) {
      // The user's own plant; only global admins without one fall back to the first plant listed
      const tenant = session ? defaultTenantFor(session.user, tenants) : null;
      const org = tenant ? organizations.find(o => o.id === tenant.organizationId) : undefined;
      if (tenant) onSelectionChange({ organization: org, tenant });
      setInitialized(true);
    }
  }, [organizations, tenants, currentSelection, onSelectionChange, initialized, selectionLoading, session]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [orgsData, tenantsData, unitsData, assetsData] = await Promise.all([
        masterDataService.getOrganizations(),
        masterDataService.getTenants(),
        masterDataService.getUnits(),
        masterDataService.getAssets(),
      ]);
      setOrganizations(orgsData);
      setTenants(tenantsData);
      setUnits(unitsData);
      setAssets(assetsData);
    } catch (error) {
      console.error('Failed to load plant hierarchy:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get full path for a unit (org > tenant > unit)
  const getUnitPath = (unit: Unit | undefined) => {
    if (!unit) return null;
    const tenant = tenants.find(t => t.id === unit.tenantId);
    const org = tenant ? organizations.find(o => o.id === tenant.organizationId) : undefined;
    return { org, tenant, unit };
  };

  // Helper to get full path for an asset (org > tenant > unit > asset)
  const getAssetPath = (asset: Asset | undefined) => {
    if (!asset) return null;
    const unit = units.find(u => u.id === asset.unitId);
    const tenant = unit ? tenants.find(t => t.id === unit.tenantId) : undefined;
    const org = tenant ? organizations.find(o => o.id === tenant.organizationId) : undefined;
    return { org, tenant, unit, asset };
  };

  // When a unit or asset is selected, update selection and close popover
  const handleSelection = (selection: {
    organization?: Organization;
    tenant?: Tenant;
    unit?: Unit;
    asset?: Asset;
  }) => {
    onSelectionChange(selection);
    setPopoverOpen(false);
  };

  // Tree expand/collapse logic
  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  };

  // Check if a node is selected
  const isSelected = (type: string, id: string) => {
    if (type === 'asset') return currentSelection?.asset?.id === id;
    if (type === 'unit') return currentSelection?.unit?.id === id && !currentSelection?.asset;
    if (type === 'tenant') return currentSelection?.tenant?.id === id && !currentSelection?.unit && !currentSelection?.asset;
    if (type === 'org') return currentSelection?.organization?.id === id && !currentSelection?.tenant && !currentSelection?.unit && !currentSelection?.asset;
    return false;
  };

  // Render the custom tree view recursively (no repeated hierarchy)
  const renderTree = () => (
    <div className="w-full select-none text-sm">
      {organizations.map(org => {
        const orgKey = getNodeKey('org', org.id);
        const orgExpanded = expanded.has(orgKey);
        const orgTenants = tenants.filter(t => t.organizationId === org.id);
        return (
          <div key={org.id}>
            <div
              className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition hover:bg-gray-100 ${isSelected('org', org.id) ? 'bg-blue-100 font-semibold' : ''}`}
              onClick={() => {
                if (orgTenants.length === 0) {
                  // If no tenants, select the organization directly
                  handleSelection({ organization: org });
                } else {
                  // If has tenants, toggle expand
                  toggleExpand(orgKey);
                }
              }}
              style={{ paddingLeft: 8 }}
            >
              {orgTenants.length > 0 ? (
                orgExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
              ) : <span className="w-4 h-4" />}
              <Building2 className="w-4 h-4 text-blue-600" />
              <span 
                className="flex-1 cursor-pointer"
                onClick={e => { 
                  e.stopPropagation(); 
                  handleSelection({ organization: org });
                }}
              >
                {org.name}
              </span>
              {isSelected('org', org.id) && <Check className="w-4 h-4 text-blue-600 ml-auto" />}
            </div>
            {orgExpanded && orgTenants.length > 0 && (
              <div>
                {orgTenants.map(tenant => {
                  const tenantKey = getNodeKey('tenant', tenant.id);
                  const tenantExpanded = expanded.has(tenantKey);
                  const tenantUnits = units.filter(u => u.tenantId === tenant.id);
                  return (
                    <div key={tenant.id}>
                      <div
                        className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition hover:bg-gray-100 ${isSelected('tenant', tenant.id) ? 'bg-blue-100 font-semibold' : ''}`}
                        onClick={e => { 
                          e.stopPropagation(); 
                          if (tenantUnits.length === 0) {
                            // If no units, select the tenant directly
                            handleSelection({ organization: org, tenant });
                          } else {
                            // If has units, toggle expand
                            toggleExpand(tenantKey);
                          }
                        }}
                        style={{ paddingLeft: 28 }}
                      >
                        {tenantUnits.length > 0 ? (
                          tenantExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
                        ) : <span className="w-4 h-4" />}
                        <Factory className="w-4 h-4 text-green-600" />
                        <span 
                          className="flex-1 cursor-pointer"
                          onClick={e => { 
                            e.stopPropagation(); 
                            handleSelection({ organization: org, tenant });
                          }}
                        >
                          {tenant.name}
                        </span>
                        {isSelected('tenant', tenant.id) && <Check className="w-4 h-4 text-blue-600 ml-auto" />}
                      </div>
                      {tenantExpanded && tenantUnits.length > 0 && (
                        <div>
                          {tenantUnits.map(unit => {
                            const unitKey = getNodeKey('unit', unit.id);
                            const unitExpanded = expanded.has(unitKey);
                            const unitAssets = assets.filter(a => a.unitId === unit.id);
                            return (
                              <div key={unit.id}>
                                <div
                                  className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition hover:bg-gray-100 ${isSelected('unit', unit.id) ? 'bg-blue-100 font-semibold' : ''}`}
                                  onClick={e => { e.stopPropagation(); handleSelection({ organization: org, tenant, unit }); }}
                                  style={{ paddingLeft: 48 }}
                                >
                                  <Settings className="w-4 h-4 text-orange-600" />
                                  <span>{unit.name}</span>
                                  {isSelected('unit', unit.id) && <Check className="w-4 h-4 text-blue-600 ml-auto" />}
                                </div>
                                {unitExpanded && unitAssets.length > 0 && (
                                  <div>
                                    {unitAssets.map(asset => (
                                      <div
                                        key={asset.id}
                                        className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition hover:bg-gray-100 ${isSelected('asset', asset.id) ? 'bg-blue-100 font-semibold' : ''}`}
                                        onClick={e => { e.stopPropagation(); handleSelection({ organization: org, tenant, unit, asset }); }}
                                        style={{ paddingLeft: 68 }}
                                      >
                                        <Package className="w-4 h-4 text-purple-600" />
                                        <span>{asset.name}</span>
                                        {isSelected('asset', asset.id) && <Check className="w-4 h-4 text-blue-600 ml-auto" />}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Expand/collapse for unit */}
                                {unitAssets.length > 0 && (
                                  <div
                                    className="flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition hover:bg-gray-100"
                                    onClick={e => { e.stopPropagation(); toggleExpand(unitKey); }}
                                    style={{ paddingLeft: 48 }}
                                  >
                                    {unitExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                    <span className="text-xs text-gray-400">{unitAssets.length} assets</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Get the path for the dropdown display based on selection level
  const getSelectedPath = () => {
    if (currentSelection?.asset) {
      // If asset is selected, show its parent unit path
      const asset = currentSelection.asset;
      const unit = units.find(u => u.id === asset.unitId);
      const tenant = unit ? tenants.find(t => t.id === unit.tenantId) : undefined;
      const org = tenant ? organizations.find(o => o.id === tenant.organizationId) : undefined;
      if (org && tenant && unit) {
        return [
          { icon: <Building2 className="w-4 h-4 text-blue-600" />, name: org.name },
          { icon: <Factory className="w-4 h-4 text-green-600" />, name: tenant.name },
          { icon: <Settings className="w-4 h-4 text-orange-600" />, name: unit.name },
        ];
      }
    } else if (currentSelection?.unit) {
      // If unit is selected, show full path including unit
      const unit = currentSelection.unit;
      const tenant = tenants.find(t => t.id === unit.tenantId);
      const org = tenant ? organizations.find(o => o.id === tenant.organizationId) : undefined;
      if (org && tenant && unit) {
        return [
          { icon: <Building2 className="w-4 h-4 text-blue-600" />, name: org.name },
          { icon: <Factory className="w-4 h-4 text-green-600" />, name: tenant.name },
          { icon: <Settings className="w-4 h-4 text-orange-600" />, name: unit.name },
        ];
      }
    } else if (currentSelection?.tenant) {
      // If only tenant (plant) is selected, show only up to tenant level
      const tenant = currentSelection.tenant;
      const org = organizations.find(o => o.id === tenant.organizationId);
      if (org && tenant) {
        return [
          { icon: <Building2 className="w-4 h-4 text-blue-600" />, name: org.name },
          { icon: <Factory className="w-4 h-4 text-green-600" />, name: tenant.name },
        ];
      }
    } else if (currentSelection?.organization) {
      // If only organization is selected, show only organization
      const org = currentSelection.organization;
      return [
        { icon: <Building2 className="w-4 h-4 text-blue-600" />, name: org.name },
      ];
    }
    return null;
  };

  // Render the dropdown button content as a minimalist breadcrumb (no background, no border)
  const renderDropdownButtonContent = () => {
    const path = getSelectedPath();
    if (!path) {
      return (
        <>
          <Settings className="w-4 h-4 text-orange-600 mr-2" />
          <span className="text-gray-500">Select Plant & Unit</span>
        </>
      );
    }
    return (
      <div className="flex items-center space-x-2 overflow-x-auto">
        {path.map((item, idx) => (
          <span key={idx} className="flex items-center text-gray-800 font-medium text-sm">
            {item.icon}
            <span className="ml-1 max-w-[120px] truncate">{item.name}</span>
            {idx < path.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
            )}
          </span>
        ))}
      </div>
    );
  };

  if (loading || selectionLoading) {
    return (
      <Button variant="ghost" className="justify-start bg-transparent border-none shadow-none">
        <Skeleton className="h-4 w-40" />
      </Button>
    );
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="justify-between px-3 py-2 flex items-center bg-transparent border-none shadow-none">
          <span className="flex-1 flex items-center space-x-1">{renderDropdownButtonContent()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="min-w-[340px] max-h-[400px] overflow-y-auto bg-white border rounded-lg shadow-lg">
        {renderTree()}
      </PopoverContent>
    </Popover>
  );
};

export default PlantSelector;
