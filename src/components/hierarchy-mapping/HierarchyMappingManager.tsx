import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  CheckCircle,
  XCircle,
  MapPin,
  Layers,
  RefreshCw,
  Info,
  AlertCircle,
  Database,
  Code
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { hierarchyMappingService } from '@/services/HierarchyMappingService';
import { hierarchyMappingSeeder } from '@/services/HierarchyMappingSeeder';
import { masterDataService } from '@/services/MasterDataService';
import type { SourceHierarchyMappingDto, SourceType, TargetType } from '@/services/api/hierarchyMappingApi';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

const HierarchyMappingManager: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mappings, setMappings] = useState<SourceHierarchyMappingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<SourceHierarchyMappingDto | null>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  // For SuperAdmin: selected tenant for filtering
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    sourceType: 'PI' as SourceType,
    sourceConnectionId: '',
    sourceIdentifier: '',
    sourcePath: '',
    targetType: 'unit' as TargetType,
    targetId: '',
    isPattern: false,
    pattern: '',
    priority: 50,
    isActive: true,
    description: '',
  });

  useEffect(() => {
    console.log('🔍 HierarchyMappingManager useEffect:', { 
      hasSession: !!session, 
      tenantId: session?.tenant?.id,
      userId: session?.user?.id,
      sessionData: session ? { 
        user: session.user?.email, 
        tenant: session.tenant?.name,
        organization: session.organization?.name 
      } : null
    });
    
    // Safety timeout - always reset loading after 30 seconds
    let safetyTimeout: NodeJS.Timeout | null = null;
    let mounted = true;

    const setupSafetyTimeout = () => {
      safetyTimeout = setTimeout(() => {
        if (mounted) {
          console.error('⚠️ Loading timeout reached - resetting loading state');
          setLoading(false);
          setError('Loading took too long. Please check your connection and backend status.');
        }
      }, 30000);
    };

    // For SuperAdmin: Load tenants list first, then allow selection
    // For regular users: Load data with their tenant
    if (session?.user?.role === 'SuperAdmin') {
      // SuperAdmin doesn't need a tenant - load tenants list first
      setupSafetyTimeout();
      loadTenantsForSuperAdmin().finally(() => {
        if (safetyTimeout) {
          clearTimeout(safetyTimeout);
        }
      });
    } else if (session?.tenant?.id) {
      setupSafetyTimeout();
      loadData().finally(() => {
        if (safetyTimeout) {
          clearTimeout(safetyTimeout);
        }
      });
    } else {
      console.warn('⚠️ No tenant ID available yet');
      setLoading(false);
      // Only show error for non-SuperAdmin users
      if (session?.user?.role !== 'SuperAdmin') {
        setError('No tenant ID found. Please ensure you are logged in with a valid tenant.');
      }
    }

    return () => {
      mounted = false;
      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.tenant?.id, session?.user?.role, selectedTenantId]);

  // Load tenants list for SuperAdmin
  const loadTenantsForSuperAdmin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load tenants and organizations for SuperAdmin to select from
      const [tenantsData, orgsData] = await Promise.allSettled([
        masterDataService.getTenants(),
        masterDataService.getOrganizations(),
      ]).then(results => 
        results.map(result => result.status === 'fulfilled' ? result.value : [])
      );
      
      setTenants((tenantsData as any[]) || []);
      setOrganizations((orgsData as any[]) || []);
      
      // Auto-select first tenant if available
      if ((tenantsData as any[])?.length > 0 && !selectedTenantId) {
        setSelectedTenantId((tenantsData as any[])[0].id);
      }
    } catch (error: any) {
      console.error('Failed to load tenants for SuperAdmin:', error);
      setError('Failed to load tenants. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    // Determine which tenant ID to use
    const tenantId = session?.user?.role === 'SuperAdmin' 
      ? selectedTenantId 
      : session?.tenant?.id;
    
    if (!tenantId) {
      // For SuperAdmin without selection, just wait for tenant selection
      if (session?.user?.role === 'SuperAdmin') {
        setLoading(false);
        return;
      }
      console.warn('⚠️ No tenant ID available, skipping data load');
      setLoading(false);
      setError('No tenant ID found. Please ensure you are logged in.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Loading hierarchy mapping data...', { tenantId });
      
      // Load mappings - handle empty result gracefully
      let mappingsData: SourceHierarchyMappingDto[] = [];
      try {
        console.log('📡 Calling hierarchyMappingService.getMappings...');
        mappingsData = await hierarchyMappingService.getMappings(tenantId);
        console.log('✅ Loaded mappings:', mappingsData?.length || 0);
      } catch (mappingError: any) {
        console.error('❌ Failed to load mappings:', mappingError);
        
        // Check for ApiError status property
        const status = mappingError?.status || mappingError?.statusCode || mappingError?.response?.status;
        
        if (status === 404) {
          console.log('ℹ️ No mappings found (404) - this is normal for first-time setup');
          mappingsData = [];
        } else if (status === 401) {
          console.error('❌ Authentication error (401)');
          setError('Authentication failed. Please log out and log in again.');
          return;
        } else {
          console.warn('⚠️ Error loading mappings, continuing with empty array:', mappingError?.message);
          mappingsData = [];
        }
      }

      // Load other data with individual error handling
      const loadPromises: Promise<any>[] = [
        masterDataService.getUnits({ tenantId }),
        masterDataService.getAssets({ tenantId }),
      ];
      
      // For SuperAdmin, also load all tenants and orgs if not already loaded
      if (session?.user?.role === 'SuperAdmin') {
        if (tenants.length === 0) {
          loadPromises.push(masterDataService.getTenants());
        }
        if (organizations.length === 0) {
          loadPromises.push(masterDataService.getOrganizations());
        }
      } else {
        loadPromises.push(masterDataService.getTenants());
        loadPromises.push(masterDataService.getOrganizations());
      }
      
      const results = await Promise.allSettled(loadPromises);
      const unitsData = results[0].status === 'fulfilled' ? results[0].value : [];
      const assetsData = results[1].status === 'fulfilled' ? results[1].value : [];
      const tenantsData = results.length > 2 && results[2].status === 'fulfilled' ? results[2].value : tenants;
      const orgsData = results.length > 3 && results[3].status === 'fulfilled' ? results[3].value : organizations;
      
      setMappings(mappingsData || []);
      setUnits((unitsData as any[]) || []);
      setAssets((assetsData as any[]) || []);
      if (tenantsData.length > 0) setTenants((tenantsData as any[]) || []);
      if (orgsData.length > 0) setOrganizations((orgsData as any[]) || []);
      
      console.log('✅ Data loaded successfully:', {
        mappings: mappingsData?.length || 0,
        units: (unitsData as any[])?.length || 0,
        assets: (assetsData as any[])?.length || 0,
      });
    } catch (error: any) {
      console.error('❌ Critical error loading data:', error);
      
      const errorMessage = error?.message || error?.statusText || 'Failed to load hierarchy mappings';
      setError(errorMessage);
      
      toast({
        title: 'Error Loading Data',
        description: errorMessage + '. Please check the browser console for details.',
        variant: 'destructive',
      });
      
      // Set empty arrays so UI can still render
      setMappings([]);
      setUnits([]);
      setAssets([]);
      setTenants([]);
      setOrganizations([]);
    } finally {
      // Always reset loading state
      setLoading(false);
      console.log('🏁 Loading complete - loading state set to false');
    }
  };

  const handleOpenDialog = (mapping?: SourceHierarchyMappingDto) => {
    if (mapping) {
      setEditingMapping(mapping);
      setFormData({
        sourceType: mapping.sourceType,
        sourceConnectionId: mapping.sourceConnectionId || '',
        sourceIdentifier: mapping.sourceIdentifier,
        sourcePath: mapping.sourcePath || '',
        targetType: mapping.targetType,
        targetId: mapping.targetId,
        isPattern: mapping.isPattern,
        pattern: mapping.pattern || '',
        priority: mapping.priority,
        isActive: mapping.isActive,
        description: mapping.description || '',
      });
    } else {
      setEditingMapping(null);
      setFormData({
        sourceType: 'PI',
        sourceConnectionId: '',
        sourceIdentifier: '',
        sourcePath: '',
        targetType: 'unit',
        targetId: '',
        isPattern: false,
        pattern: '',
        priority: 50,
        isActive: true,
        description: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingMapping(null);
  };

  const handleSave = async () => {
    const tenantId = session?.user?.role === 'SuperAdmin' 
      ? selectedTenantId 
      : session?.tenant?.id;
    
    if (!tenantId) {
      toast({
        title: 'Error',
        description: 'Please select a tenant to create mappings for.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const payload = {
        ...formData,
        tenantId: tenantId,
        organizationId: session?.organization?.id || organizations.find(o => 
          tenants.find(t => t.id === tenantId && t.organizationId === o.id)
        )?.id,
        sourceIdentifier: formData.isPattern ? formData.pattern : formData.sourceIdentifier,
      };

      if (editingMapping) {
        await hierarchyMappingService.updateMapping(editingMapping.id, payload);
        toast({
          title: 'Success',
          description: 'Mapping updated successfully',
        });
      } else {
        await hierarchyMappingService.createMapping(payload);
        toast({
          title: 'Success',
          description: 'Mapping created successfully',
        });
      }

      handleCloseDialog();
      loadData();
    } catch (error: any) {
      console.error('Failed to save mapping:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save mapping',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;

    try {
      await hierarchyMappingService.deleteMapping(id);
      toast({
        title: 'Success',
        description: 'Mapping deleted successfully',
      });
      loadData();
    } catch (error: any) {
      console.error('Failed to delete mapping:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete mapping',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (mapping: SourceHierarchyMappingDto) => {
    try {
      await hierarchyMappingService.toggleMapping(mapping.id, !mapping.isActive);
      toast({
        title: 'Success',
        description: `Mapping ${!mapping.isActive ? 'activated' : 'deactivated'} successfully`,
      });
      loadData();
    } catch (error: any) {
      console.error('Failed to toggle mapping:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update mapping',
        variant: 'destructive',
      });
    }
  };

  const handleSeedTestData = async () => {
    const tenantId = session?.user?.role === 'SuperAdmin' 
      ? selectedTenantId 
      : session?.tenant?.id;
    
    if (!tenantId) {
      toast({
        title: 'Error',
        description: 'Please select a tenant to seed test data for.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      toast({
        title: 'Seeding Test Data',
        description: 'Creating sample hierarchy mappings...',
      });

      await hierarchyMappingSeeder.seedHierarchyMappings(
        tenantId,
        session?.organization?.id || organizations.find(o => 
          tenants.find(t => t.id === tenantId && t.organizationId === o.id)
        )?.id
      );

      toast({
        title: 'Success',
        description: 'Test hierarchy mappings created successfully!',
      });

      loadData();
    } catch (error: any) {
      console.error('Failed to seed test data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to seed test data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getFilteredMappings = () => {
    return mappings.filter(mapping => {
      const matchesSearch = 
        mapping.sourceIdentifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mapping.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mapping.pattern?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSourceType = sourceTypeFilter === 'all' || mapping.sourceType === sourceTypeFilter;
      const matchesActive = 
        activeFilter === 'all' || 
        (activeFilter === 'active' && mapping.isActive) ||
        (activeFilter === 'inactive' && !mapping.isActive);

      return matchesSearch && matchesSourceType && matchesActive;
    });
  };

  const getTargetName = (mapping: SourceHierarchyMappingDto) => {
    switch (mapping.targetType) {
      case 'unit':
        const unit = units.find(u => u.id === mapping.targetId);
        return unit ? `${unit.name} (${unit.code})` : mapping.targetId;
      case 'asset':
        const asset = assets.find(a => a.id === mapping.targetId);
        return asset ? asset.name : mapping.targetId;
      case 'tenant':
        const tenant = tenants.find(t => t.id === mapping.targetId);
        return tenant ? tenant.name : mapping.targetId;
      case 'organization':
        const org = organizations.find(o => o.id === mapping.targetId);
        return org ? org.name : mapping.targetId;
      default:
        return mapping.targetId;
    }
  };

  const filteredMappings = getFilteredMappings();

  // Show tenant selector for SuperAdmin users without tenant
  const isSuperAdmin = session?.user?.role === 'SuperAdmin';
  const currentTenantId = isSuperAdmin ? selectedTenantId : session?.tenant?.id;
  
  // Show tenant selector for SuperAdmin if no tenant selected
  if (isSuperAdmin && !selectedTenantId && !loading && tenants.length > 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Hierarchy Mappings</h2>
          <p className="text-muted-foreground">
            Map external source identifiers to internal ProAct hierarchy (Units, Assets, etc.)
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Select Tenant</CardTitle>
            <CardDescription>
              As a SuperAdmin, please select a tenant to manage hierarchy mappings for.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Select Tenant</Label>
              <Select
                value={selectedTenantId || ''}
                onValueChange={(value) => {
                  setSelectedTenantId(value);
                  setLoading(true);
                  setTimeout(() => loadData(), 100);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tenant..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="default" 
                onClick={() => navigate('/data-seeding')}
                className="flex items-center gap-2"
              >
                <Database className="w-4 h-4" />
                Go to Data Seeding
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/master-data')}
                className="flex items-center gap-2"
              >
                <Code className="w-4 h-4" />
                Go to Master Data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Show error if no tenant ID with helpful message (for non-SuperAdmin)
  if (error && error.includes('No tenant ID') && !loading && !isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Hierarchy Mappings</h2>
          <p className="text-muted-foreground">
            Map external source identifiers to internal ProAct hierarchy (Units, Assets, etc.)
          </p>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-4">
              <p className="font-medium">{error}</p>
              <p className="text-sm">
                Hierarchy mappings require a tenant to be associated with your account. 
                To fix this, you can:
              </p>
              <ul className="text-sm list-disc list-inside space-y-2 ml-2">
                <li>
                  <strong>Option 1:</strong> Go to <strong>Data Seeding</strong> page to create sample organizations, tenants, units, and assets
                </li>
                <li>
                  <strong>Option 2:</strong> Navigate to <strong>Master Data</strong> → <strong>Organizations & Tenants</strong> to create them manually
                </li>
                <li>
                  <strong>Option 3:</strong> Contact your administrator to assign a tenant to your account
                </li>
              </ul>
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="default" 
                  onClick={() => navigate('/data-seeding')}
                  className="flex items-center gap-2"
                >
                  <Database className="w-4 h-4" />
                  Go to Data Seeding
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/master-data')}
                  className="flex items-center gap-2"
                >
                  <Code className="w-4 h-4" />
                  Go to Master Data
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show error if present
  if (error && !loading) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <p className="text-destructive font-medium">{error}</p>
              <Button 
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  loadData();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Hierarchy Mappings</h2>
          <p className="text-muted-foreground">
            Map external source identifiers to internal ProAct hierarchy (Units, Assets, etc.)
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="text-muted-foreground">Loading mappings...</span>
              <p className="text-xs text-muted-foreground">
                Checking session: {session?.tenant?.id ? '✅ Tenant ID found' : '❌ No tenant ID'}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  console.log('🔄 Manual reload triggered');
                  setError(null);
                  setLoading(false);
                  setTimeout(() => loadData(), 100);
                }}
              >
                Cancel & Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Hierarchy Mappings</h2>
          <p className="text-muted-foreground">
            Map external source identifiers to internal ProAct hierarchy (Units, Assets, etc.)
            {isSuperAdmin && selectedTenantId && (
              <span className="ml-2">
                • Viewing mappings for: <strong>{tenants.find(t => t.id === selectedTenantId)?.name}</strong>
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {currentTenantId && (
            <Button
              variant="outline"
              onClick={handleSeedTestData}
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Seed Test Data
            </Button>
          )}
          <Button onClick={() => handleOpenDialog()} disabled={!currentTenantId}>
            <Plus className="w-4 h-4 mr-2" />
            Create Mapping
          </Button>
        </div>
      </div>
      
      {/* Tenant selector for SuperAdmin */}
      {isSuperAdmin && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Label className="whitespace-nowrap">Select Tenant:</Label>
              <Select
                value={selectedTenantId || ''}
                onValueChange={(value) => {
                  setSelectedTenantId(value);
                  setLoading(true);
                  setTimeout(() => loadData(), 100);
                }}
              >
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select a tenant..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTenantId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedTenantId(null);
                    setMappings([]);
                    setUnits([]);
                    setAssets([]);
                  }}
                >
                  Clear Selection
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Mappings automatically tag events from external sources (PI, OPCUA, Modbus, etc.) with your internal hierarchy.
          Higher priority mappings are checked first. Pattern mappings support wildcards.
        </AlertDescription>
      </Alert>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by identifier or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label>Source Type</Label>
              <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="PI">PI</SelectItem>
                  <SelectItem value="OPCUA">OPC UA</SelectItem>
                  <SelectItem value="Modbus">Modbus</SelectItem>
                  <SelectItem value="MQTT">MQTT</SelectItem>
                  <SelectItem value="Database">Database</SelectItem>
                  <SelectItem value="RESTAPI">REST API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mappings List */}
      <Card>
        <CardHeader>
          <CardTitle>Mappings ({filteredMappings.length})</CardTitle>
          <CardDescription>
            List of all hierarchy mappings for your tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredMappings.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No mappings found</p>
              <Button onClick={() => handleOpenDialog()} className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Create First Mapping
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMappings.map((mapping) => (
                <Card key={mapping.id} className={!mapping.isActive ? 'opacity-60' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={mapping.isActive ? 'default' : 'secondary'}>
                            {mapping.sourceType}
                          </Badge>
                          <Badge variant={mapping.isPattern ? 'outline' : 'default'}>
                            {mapping.isPattern ? 'Pattern' : 'Direct'}
                          </Badge>
                          <Badge variant="outline">
                            Priority: {mapping.priority}
                          </Badge>
                          {mapping.isActive ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        
                        <div>
                          <p className="font-medium">
                            {mapping.isPattern ? (
                              <span>
                                Pattern: <code className="text-sm bg-muted px-1 py-0.5 rounded">{mapping.pattern}</code>
                              </span>
                            ) : (
                              <span>
                                Source: <code className="text-sm bg-muted px-1 py-0.5 rounded">{mapping.sourceIdentifier}</code>
                              </span>
                            )}
                          </p>
                          {mapping.sourcePath && (
                            <p className="text-sm text-muted-foreground">
                              Path: {mapping.sourcePath}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">
                            Maps to <strong>{mapping.targetType}</strong>: {getTargetName(mapping)}
                          </span>
                        </div>

                        {mapping.description && (
                          <p className="text-sm text-muted-foreground">{mapping.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={mapping.isActive}
                          onCheckedChange={() => handleToggleActive(mapping)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(mapping)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(mapping.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMapping ? 'Edit Mapping' : 'Create New Mapping'}
            </DialogTitle>
            <DialogDescription>
              Configure how external source identifiers map to your internal hierarchy
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Source Type *</Label>
                <Select
                  value={formData.sourceType}
                  onValueChange={(value) => setFormData({ ...formData, sourceType: value as SourceType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PI">PI</SelectItem>
                    <SelectItem value="OPCUA">OPC UA</SelectItem>
                    <SelectItem value="Modbus">Modbus</SelectItem>
                    <SelectItem value="MQTT">MQTT</SelectItem>
                    <SelectItem value="Database">Database</SelectItem>
                    <SelectItem value="RESTAPI">REST API</SelectItem>
                    <SelectItem value="*">All Sources (*)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Target Type *</Label>
                <Select
                  value={formData.targetType}
                  onValueChange={(value) => {
                    setFormData({ ...formData, targetType: value as TargetType, targetId: '' });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unit">Unit</SelectItem>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="tenant">Tenant</SelectItem>
                    <SelectItem value="organization">Organization</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Switch
                  id="isPattern"
                  checked={formData.isPattern}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPattern: checked })}
                />
                <Label htmlFor="isPattern">Pattern-based mapping (use wildcards)</Label>
              </div>
            </div>

            {formData.isPattern ? (
              <div>
                <Label>Pattern * (e.g., "PI\\Plant1\\Line1\\*")</Label>
                <Input
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  placeholder="PI\\Plant1\\Line1\\*"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use * for wildcards. Double backslashes are required.
                </p>
              </div>
            ) : (
              <div>
                <Label>Source Identifier *</Label>
                <Input
                  value={formData.sourceIdentifier}
                  onChange={(e) => setFormData({ ...formData, sourceIdentifier: e.target.value })}
                  placeholder="e.g., PI WebId, OPC UA NodeId, MQTT Topic"
                />
              </div>
            )}

            <div>
              <Label>Source Path (Optional)</Label>
              <Input
                value={formData.sourcePath}
                onChange={(e) => setFormData({ ...formData, sourcePath: e.target.value })}
                placeholder="Full hierarchical path in source system"
              />
            </div>

            <div>
              <Label>Target {formData.targetType.charAt(0).toUpperCase() + formData.targetType.slice(1)} *</Label>
              <Select
                value={formData.targetId}
                onValueChange={(value) => setFormData({ ...formData, targetId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${formData.targetType}`} />
                </SelectTrigger>
                <SelectContent>
                  {formData.targetType === 'unit' && units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name} ({unit.code})
                    </SelectItem>
                  ))}
                  {formData.targetType === 'asset' && assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name}
                    </SelectItem>
                  ))}
                  {formData.targetType === 'tenant' && tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                  {formData.targetType === 'organization' && organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority (0-100) *</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 50 })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Higher priority mappings are checked first
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-8">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description for this mapping"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.sourceIdentifier && !formData.pattern}>
              {editingMapping ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HierarchyMappingManager;

