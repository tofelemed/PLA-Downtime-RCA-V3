import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { masterDataService, ImpactCode, OEECode, Product, Unit, Asset } from '../services/MasterDataService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Code, Package, Building, Wrench, Building2, Factory, Settings, Users, FileText, BarChart3, AlertTriangle, Database, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PlantSelector from '@/components/PlantSelector';
import CodesManagement from '@/components/CodesManagement';
import { Badge } from '@/components/ui/badge';
import ProductList from '../components/ProductList';
import UnitList from '../components/plant-hierarchy/UnitList';
import AssetList from '../components/plant-hierarchy/AssetList';
import RCASettings from '../components/RCASettings';
import PlantHierarchyManager from '../components/plant-hierarchy/PlantHierarchyManager';
import { useNavigate } from 'react-router-dom';
import { useSpring, animated } from '@react-spring/web';
import CustomAttributeDisplay from '../components/CustomAttributeDisplay';
import { storageService } from '../services/StorageService';

export const MasterData: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [impactCodes, setImpactCodes] = useState<ImpactCode[]>([]);
  const [oeeCodes, setOEECodes] = useState<OEECode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'impact' | 'oee' | 'product' | 'unit' | 'asset'>('impact');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category: '',
    costPerHour: 0,
    unitOfMeasure: '',
    capacity: 0,
    assetType: 'Equipment',
    criticality: 'Medium',
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [plantSelection, setPlantSelection] = useState(null);
  const [orgCount, setOrgCount] = useState(0);
  const [tenantCount, setTenantCount] = useState(0);
  const [unitCount, setUnitCount] = useState(0);
  const [assetCount, setAssetCount] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [codeCount, setCodeCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [auditCount, setAuditCount] = useState(0);
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrgs, setExpandedOrgs] = useState<string[]>([]);
  const [expandedTenants, setExpandedTenants] = useState<string[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<string[]>([]);
  const [editingNode, setEditingNode] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addParent, setAddParent] = useState<any>(null);
  const [addType, setAddType] = useState<string>('');
  const [modalType, setModalType] = useState<'add' | 'edit' | null>(null);
  const [modalNodeType, setModalNodeType] = useState<'org' | 'tenant' | 'unit' | 'asset' | null>(null);
  const [modalNode, setModalNode] = useState<any>(null);
  const [modalParent, setModalParent] = useState<any>(null);
  const [deleteNode, setDeleteNode] = useState<any>(null);
  const [deleteNodeType, setDeleteNodeType] = useState<'org' | 'tenant' | 'unit' | 'asset' | null>(null);
  const [modalForm, setModalForm] = useState<any>({ name: '', code: '', description: '', status: 'Active', capacity: 0, unitOfMeasure: '', assetType: 'Equipment', criticality: 'Medium' });
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [attributeEntityType, setAttributeEntityType] = useState<'Organization' | 'Tenant' | 'Unit' | 'Asset'>('Organization');
  const [attributeEntityId, setAttributeEntityId] = useState<string>('');
  const [attributeOrganizationId, setAttributeOrganizationId] = useState<string>('');

  // Helper: recursively filter hierarchy by search, keeping parent branches if any child matches
  const searchHierarchy = (orgs, tenants, units, assets, query) => {
    if (!query) return orgs.map(org => ({ ...org, _show: true }));
    const q = query.toLowerCase();
    // Helper to check if a node matches
    const matches = (item) => (item.name && item.name.toLowerCase().includes(q)) || (item.code && item.code.toLowerCase().includes(q));
    // Filter assets
    const filteredAssets = assets.filter(a => matches(a) || units.some(u => u.id === a.unitId && matches(u)));
    // Filter units, keep if matches or has asset child match
    const filteredUnits = units.filter(u => matches(u) || filteredAssets.some(a => a.unitId === u.id));
    // Filter tenants, keep if matches or has unit/asset child match
    const filteredTenants = tenants.filter(t => matches(t) || filteredUnits.some(u => u.tenantId === t.id));
    // Filter orgs, keep if matches or has tenant/unit/asset child match
    const filteredOrgs = orgs.filter(o => {
      if (matches(o)) return true;
      return filteredTenants.some(t => t.organizationId === o.id);
    });
    return filteredOrgs;
  };

  // After searchHierarchy is defined, add:
  const filteredOrgs = searchHierarchy(orgs, tenants, units, assets, searchQuery);
  const filteredTenants = tenants.filter(t => filteredOrgs.some(o => o.id === t.organizationId));
  const filteredUnits = units.filter(u => filteredTenants.some(t => t.id === u.tenantId));
  const filteredAssets = assets.filter(a => filteredUnits.some(u => u.id === a.unitId));

  useEffect(() => {
    loadData();
    async function fetchCounts() {
      const [orgs, tenants, units, assets, products, impactCodes, oeeCodes, rcaCodes, verificationCodes] = await Promise.all([
        masterDataService.getOrganizations(),
        masterDataService.getTenants(),
        masterDataService.getUnits(),
        masterDataService.getAssets(),
        masterDataService.getProducts({}),
        masterDataService.getImpactCodes({}),
        masterDataService.getOEECodes({}),
        masterDataService.getRCACauseCodes({}),
        masterDataService.getVerificationStatusCodes({}),
      ]);
      setOrgCount(orgs.length);
      setTenantCount(tenants.length);
      setUnitCount(units.length);
      setAssetCount(assets.length);
      setProductCount(products.length);
      setCodeCount(impactCodes.length + oeeCodes.length + rcaCodes.length + verificationCodes.length);
      setUserCount(0);
      setAuditCount(0);
    }
    fetchCounts();
  }, []);

  useEffect(() => {
    async function fetchHierarchy() {
      setOrgs(await masterDataService.getOrganizations());
      setTenants(await masterDataService.getTenants());
      setUnits(await masterDataService.getUnits());
      setAssets(await masterDataService.getAssets());
    }
    fetchHierarchy();
  }, []);

  const loadData = async () => {
    if (!session) return;

    try {
      const [impactData, oeeData, productData, unitData, assetData] = await Promise.all([
        masterDataService.getImpactCodes({ tenantId: session.tenant?.id }),
        masterDataService.getOEECodes({ tenantId: session.tenant?.id }),
        masterDataService.getProducts({ organizationId: session.organization?.id }),
        masterDataService.getUnits({ tenantId: session.tenant?.id }),
        masterDataService.getAssets({}),
      ]);

      setImpactCodes(impactData);
      setOEECodes(oeeData);
      setProducts(productData);
      setUnits(unitData);
      setAssets(assetData);
    } catch (error) {
      console.error('Failed to load master data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load master data',
        variant: 'destructive',
      });
    }
  };

  const handleCreateImpactCode = async () => {
    try {
      await masterDataService.createImpactCode({
        code: formData.code,
        name: formData.name,
        description: formData.description,
        category: formData.category as 'Quality' | 'Availability' | 'Performance',
        costPerHour: formData.costPerHour,
        tenantId: session!.tenant?.id || '',
      });
      
      toast({
        title: 'Success',
        description: 'Impact code created successfully',
      });
      
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to create impact code:', error);
      toast({
        title: 'Error',
        description: 'Failed to create impact code',
        variant: 'destructive',
      });
    }
  };

  const handleCreateOEECode = async () => {
    try {
      await masterDataService.createOEECode({
        code: formData.code,
        name: formData.name,
        description: formData.description,
        category: formData.category as 'Planned' | 'Unplanned',
        impactType: 'Availability',
        tenantId: session!.tenant?.id || '',
      });
      
      toast({
        title: 'Success',
        description: 'OEE code created successfully',
      });
      
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to create OEE code:', error);
      toast({
        title: 'Error',
        description: 'Failed to create OEE code',
        variant: 'destructive',
      });
    }
  };

  const handleCreateProduct = async () => {
    try {
      await masterDataService.createProduct({
        code: formData.code,
        name: formData.name,
        description: formData.description,
        unitOfMeasure: formData.unitOfMeasure,
        standardCost: formData.costPerHour,
        organizationId: session!.organization?.id || '',
      });
      
      toast({
        title: 'Success',
        description: 'Product created successfully',
      });
      
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to create product:', error);
      toast({
        title: 'Error',
        description: 'Failed to create product',
        variant: 'destructive',
      });
    }
  };

  const handleCreateUnit = async () => {
    try {
      await masterDataService.createUnit({
        code: formData.code,
        name: formData.name,
        description: formData.description,
        capacity: formData.capacity,
        unitOfMeasure: formData.unitOfMeasure,
        tenantId: session!.tenant?.id || '',
      });
      
      toast({
        title: 'Success',
        description: 'Unit created successfully',
      });
      
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to create unit:', error);
      toast({
        title: 'Error',
        description: 'Failed to create unit',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    switch (dialogType) {
      case 'impact':
        await handleCreateImpactCode();
        break;
      case 'oee':
        await handleCreateOEECode();
        break;
      case 'product':
        await handleCreateProduct();
        break;
      case 'unit':
        await handleCreateUnit();
        break;
    }
    
    setIsDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      category: '',
      costPerHour: 0,
      unitOfMeasure: '',
      capacity: 0,
      assetType: 'Equipment',
      criticality: 'Medium',
    });
  };

  const openDialog = (type: typeof dialogType) => {
    setDialogType(type);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleSimulateEvents = async () => {
    if (!session?.tenant || units.length === 0) {
      toast({
        title: 'Error',
        description: 'Please create units first',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create some demo impact and OEE codes if they don't exist
      if (impactCodes.length === 0) {
        await Promise.all([
          masterDataService.createImpactCode({
            code: 'Q001',
            name: 'Quality Defect',
            description: 'Product quality issues',
            category: 'Quality',
            costPerHour: 500,
            tenantId: session.tenant.id,
          }),
          masterDataService.createImpactCode({
            code: 'A001',
            name: 'Equipment Breakdown',
            description: 'Unplanned equipment failure',
            category: 'Availability',
            costPerHour: 1000,
            tenantId: session.tenant.id,
          }),
        ]);
      }

      if (oeeCodes.length === 0) {
        await Promise.all([
          masterDataService.createOEECode({
            code: 'UP001',
            name: 'Breakdown',
            description: 'Unplanned equipment breakdown',
            category: 'Unplanned',
            impactType: 'Availability',
            tenantId: session.tenant.id,
          }),
          masterDataService.createOEECode({
            code: 'PL001',
            name: 'Changeover',
            description: 'Planned changeover activity',
            category: 'Planned',
            impactType: 'Availability',
            tenantId: session.tenant.id,
          }),
        ]);
      }

      // Simulate events for the first unit
      await masterDataService.simulateProductionEvents(units[0].id, 10);
      
      toast({
        title: 'Success',
        description: 'Simulated 10 production events',
      });
    } catch (error) {
      console.error('Failed to simulate events:', error);
      toast({
        title: 'Error',
        description: 'Failed to simulate events',
        variant: 'destructive',
      });
    }
  };

  const masterDataModules = [
    {
      id: 'organizations',
      title: 'Organizations',
      description: 'Manage organizational hierarchy',
      icon: Building2,
      status: 'active',
      count: 3,
      color: 'bg-blue-500',
    },
    {
      id: 'tenants',
      title: 'Plants/Tenants',
      description: 'Manage plant locations and configurations',
      icon: Factory,
      status: 'active',
      count: 8,
      color: 'bg-green-500',
    },
    {
      id: 'units',
      title: 'Production Units',
      description: 'Manage production units and lines',
      icon: Settings,
      status: 'active',
      count: 24,
      color: 'bg-orange-500',
    },
    {
      id: 'assets',
      title: 'Assets',
      description: 'Manage equipment and instruments',
      icon: Package,
      status: 'active',
      count: 156,
      color: 'bg-purple-500',
    },
    {
      id: 'products',
      title: 'Products',
      description: 'Manage product catalog',
      icon: FileText,
      status: 'active',
      count: 45,
      color: 'bg-indigo-500',
    },
    {
      id: 'codes',
      title: 'Codes Management',
      description: 'Impact, OEE, RCA, and verification codes',
      icon: Code,
      status: 'active',
      count: 67,
      color: 'bg-pink-500',
    },
    {
      id: 'users',
      title: 'Users & Roles',
      description: 'Manage user accounts and permissions',
      icon: Users,
      status: 'active',
      count: 23,
      color: 'bg-teal-500',
    },
    {
      id: 'audit',
      title: 'Audit Logs',
      description: 'System activity and change tracking',
      icon: Shield,
      status: 'active',
      count: 1247,
      color: 'bg-gray-500',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper: toggle expand/collapse
  const toggleExpand = (id, type) => {
    if (type === 'org') setExpandedOrgs(exp => exp.includes(id) ? exp.filter(x => x !== id) : [...exp, id]);
    if (type === 'tenant') setExpandedTenants(exp => exp.includes(id) ? exp.filter(x => x !== id) : [...exp, id]);
    if (type === 'unit') setExpandedUnits(exp => exp.includes(id) ? exp.filter(x => x !== id) : [...exp, id]);
  };

  // Helper: get status badge color
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Inactive': return 'bg-gray-100 text-gray-800';
      case 'Maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'Offline': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Open Add/Edit modal
  const openModal = (type, nodeType, node = null, parent = null) => {
    setModalType(type);
    setModalNodeType(nodeType);
    setModalNode(node);
    setModalParent(parent);
    setModalForm(node ? { ...node } : { name: '', code: '', description: '', status: 'Active', capacity: 0, unitOfMeasure: '', assetType: 'Equipment', criticality: 'Medium' });
    setShowEditModal(true);
  };
  // Open Delete modal
  const openDeleteModal = (nodeType, node) => {
    setDeleteNodeType(nodeType);
    setDeleteNode(node);
    setShowAddModal(true);
  };

  // Open Attribute modal
  const openAttributeModal = (entityType: 'Organization' | 'Tenant' | 'Unit' | 'Asset', entityId: string, organizationId: string) => {
    console.log('Opening attribute modal with:', { entityType, entityId, organizationId });
    setAttributeEntityType(entityType);
    setAttributeEntityId(entityId);
    setAttributeOrganizationId(organizationId);
    setShowAttributeModal(true);
  };
  // Handle Add/Edit submit
  const handleModalSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalType === 'add') {
        if (modalNodeType === 'org') {
          await masterDataService.createOrganization({ ...modalForm, isActive: true });
        } else if (modalNodeType === 'tenant') {
          await masterDataService.createTenant({ ...modalForm, organizationId: modalParent.id, isActive: true });
        } else if (modalNodeType === 'unit') {
          await masterDataService.createUnit({ ...modalForm, tenantId: modalParent.id });
        } else if (modalNodeType === 'asset') {
          await masterDataService.createAsset({ ...modalForm, unitId: modalParent.id, tenantId: modalParent.tenantId || '' });
        }
      } else if (modalType === 'edit') {
        if (modalNodeType === 'org') {
          await masterDataService.updateOrganization(modalNode.id, modalForm);
        } else if (modalNodeType === 'tenant') {
          await masterDataService.updateTenant(modalNode.id, modalForm);
        } else if (modalNodeType === 'unit') {
          await masterDataService.updateUnit(modalNode.id, modalForm);
        } else if (modalNodeType === 'asset') {
          await masterDataService.updateAsset(modalNode.id, modalForm);
        }
      }
      setShowEditModal(false);
      setModalType(null);
      setModalNodeType(null);
      setModalNode(null);
      setModalParent(null);
      setModalForm({ name: '', code: '', description: '', status: 'Active', capacity: 0, unitOfMeasure: '', assetType: 'Equipment', criticality: 'Medium' });
      // Refresh hierarchy
      setOrgs(await masterDataService.getOrganizations());
      setTenants(await masterDataService.getTenants());
      setUnits(await masterDataService.getUnits());
      setAssets(await masterDataService.getAssets());
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save changes', variant: 'destructive' });
    }
  };
  // Handle Delete
  const handleDelete = async () => {
    try {
      if (deleteNodeType === 'org') {
        await masterDataService.deleteOrganization(deleteNode.id);
      } else if (deleteNodeType === 'tenant') {
        await masterDataService.deleteTenant(deleteNode.id);
      } else if (deleteNodeType === 'unit') {
        await masterDataService.deleteUnit(deleteNode.id);
      } else if (deleteNodeType === 'asset') {
        await masterDataService.deleteAsset(deleteNode.id);
      }
      setShowAddModal(false);
      setDeleteNode(null);
      setDeleteNodeType(null);
      // Refresh hierarchy
      setOrgs(await masterDataService.getOrganizations());
      setTenants(await masterDataService.getTenants());
      setUnits(await masterDataService.getUnits());
      setAssets(await masterDataService.getAssets());
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  if (!session || !['SuperAdmin', 'OrgAdmin', 'TenantAdmin'].includes(session.user.role)) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">You don't have permission to access master data management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Master Data Management</h1>
          <p className="text-muted-foreground">
            Centralized management of all organizational data, configurations, and reference information
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                // Force database recreation by clearing localStorage and reloading
                localStorage.clear();
                sessionStorage.clear();
                toast({
                  title: 'Success',
                  description: 'Storage cleared. Database will be recreated on next load.',
                });
                window.location.reload();
              } catch (error) {
                toast({
                  title: 'Error',
                  description: 'Failed to clear storage',
                  variant: 'destructive',
                });
              }
            }}
            title="Clear storage and recreate database (fixes missing stores)"
          >
            🔄 Fix DB
          </Button>
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Quick Add
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="hierarchy">Plant Hierarchy</TabsTrigger>
          <TabsTrigger value="codes">Codes Management</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="rca">RCA Settings</TabsTrigger>
          <TabsTrigger value="users">Users & Access</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orgCount}</div>
                <p className="text-xs text-muted-foreground">
                  {/* +1 from last month */}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Plants</CardTitle>
                <Factory className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tenantCount}</div>
                <p className="text-xs text-muted-foreground">
                  {/* +2 from last month */}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Production Units</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unitCount}</div>
                <p className="text-xs text-muted-foreground">
                  {/* +3 from last month */}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{assetCount}</div>
                <p className="text-xs text-muted-foreground">
                  {/* +12 from last month */}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Master Data Modules Grid */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Master Data Modules</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {masterDataModules.map((module) => (
                <Card 
                  key={module.id} 
                  className="hover:shadow-md transition-all duration-200 cursor-pointer border-l-4"
                  style={{ borderLeftColor: module.color.replace('bg-', '').split('-')[0] === 'blue' ? '#3B82F6' : 
                          module.color.replace('bg-', '').split('-')[0] === 'green' ? '#10B981' :
                          module.color.replace('bg-', '').split('-')[0] === 'orange' ? '#F59E0B' :
                          module.color.replace('bg-', '').split('-')[0] === 'purple' ? '#8B5CF6' :
                          module.color.replace('bg-', '').split('-')[0] === 'indigo' ? '#6366F1' :
                          module.color.replace('bg-', '').split('-')[0] === 'pink' ? '#EC4899' :
                          module.color.replace('bg-', '').split('-')[0] === 'teal' ? '#14B8A6' : '#6B7280' }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-lg ${module.color} text-white`}>
                        <module.icon className="h-5 w-5" />
                      </div>
                      <Badge className={getStatusColor(module.status)}>
                        {module.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {module.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">
                        {module.id === 'organizations' ? orgCount :
                         module.id === 'tenants' ? tenantCount :
                         module.id === 'units' ? unitCount :
                         module.id === 'assets' ? assetCount :
                         module.id === 'products' ? productCount :
                         module.id === 'codes' ? codeCount :
                         module.id === 'users' ? userCount :
                         module.id === 'audit' ? auditCount : 0}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => {
                        setActiveTab(
                          module.id === 'organizations' ? 'hierarchy' :
                          module.id === 'tenants' ? 'hierarchy' :
                          module.id === 'units' ? 'units' :
                          module.id === 'assets' ? 'assets' :
                          module.id === 'products' ? 'products' :
                          module.id === 'codes' ? 'codes' :
                          module.id === 'users' ? 'users' :
                          module.id === 'audit' ? 'audit' : 'overview'
                        );
                      }}>
                        Manage
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Recent Master Data Activity
              </CardTitle>
              <CardDescription>
                Latest changes and updates to master data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* If audit log data is available, render it here. Otherwise, show a message. */}
                <div className="text-center text-gray-400 text-sm py-8">
                  Recent activity tracking is not yet implemented.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hierarchy" className="space-y-6">
          <PlantHierarchyManager
            onEdit={(type, item, parent) => {
              setModalType('edit');
              setModalNodeType(type);
              setModalNode(item);
              setModalParent(parent);
              setModalForm({
                name: item.name || '',
                code: item.code || '',
                description: item.description || '',
                status: item.status || 'Active',
                capacity: item.capacity || 0,
                unitOfMeasure: item.unitOfMeasure || '',
                assetType: item.assetType || 'Equipment',
                criticality: item.criticality || 'Medium'
              });
              setShowEditModal(true);
            }}
            onDelete={(type, item) => {
              setDeleteNodeType(type);
              setDeleteNode(item);
              setShowAddModal(true);
            }}
            onAdd={(type, parent) => {
              setModalType('add');
              setModalNodeType(type);
              setModalParent(parent);
              setModalForm({
                name: '',
                code: '',
                description: '',
                status: 'Active',
                capacity: 0,
                unitOfMeasure: '',
                assetType: 'Equipment',
                criticality: 'Medium'
              });
              setShowEditModal(true);
            }}
          />
        </TabsContent>

        <TabsContent value="codes" className="space-y-6">
          <CodesManagement />
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <ProductList />
        </TabsContent>

        <TabsContent value="units" className="space-y-6">
          <UnitList />
        </TabsContent>

        <TabsContent value="assets" className="space-y-6">
          <AssetList />
        </TabsContent>

        <TabsContent value="rca" className="space-y-6">
          <RCASettings />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Users & Access Management
              </CardTitle>
              <CardDescription>
                Manage user accounts, roles, and permissions across the organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">User Management Coming Soon</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Advanced user management features will be available in the next phase
                </p>
                <Button variant="outline">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Under Development
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create {dialogType === 'impact' ? 'Impact Code' : 
                     dialogType === 'oee' ? 'OEE Code' :
                     dialogType === 'product' ? 'Product' : 'Unit'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {dialogType === 'impact' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Quality">Quality</SelectItem>
                      <SelectItem value="Availability">Availability</SelectItem>
                      <SelectItem value="Performance">Performance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costPerHour">Cost per Hour ($)</Label>
                  <Input
                    id="costPerHour"
                    type="number"
                    value={formData.costPerHour}
                    onChange={(e) => setFormData({ ...formData, costPerHour: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </>
            )}

            {dialogType === 'oee' && (
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Planned">Planned</SelectItem>
                    <SelectItem value="Unplanned">Unplanned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(dialogType === 'product' || dialogType === 'unit') && (
              <div className="space-y-2">
                <Label htmlFor="unitOfMeasure">Unit of Measure</Label>
                <Input
                  id="unitOfMeasure"
                  value={formData.unitOfMeasure}
                  onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                />
              </div>
            )}

            {dialogType === 'unit' && (
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit/Add modals */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent
          className={modalNodeType === 'asset' ? 'max-w-lg w-full max-h-[90vh] overflow-y-auto' : undefined}
          style={modalNodeType === 'asset' ? { width: '100%', maxWidth: '32rem', maxHeight: '90vh', overflowY: 'auto' } : undefined}
        >
          <DialogHeader>
            <DialogTitle>{modalType === 'add' ? `Add ${modalNodeType}` : `Edit ${modalNodeType}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleModalSubmit} className="space-y-4">
            <div className="mb-3">
              <Label className="mb-2 block">Name</Label>
              <Input value={modalForm.name} onChange={e => setModalForm({ ...modalForm, name: e.target.value })} required />
            </div>
            <div className="mb-3">
              <Label className="mb-2 block">Code</Label>
              <Input value={modalForm.code} onChange={e => setModalForm({ ...modalForm, code: e.target.value })} required />
            </div>
            <div className="mb-3">
              <Label className="mb-2 block">Description</Label>
              <Input value={modalForm.description} onChange={e => setModalForm({ ...modalForm, description: e.target.value })} />
            </div>
            {(modalNodeType === 'org' || modalNodeType === 'tenant' || modalNodeType === 'unit') && (
              <div className="mb-3">
                <Label className="mb-2 block">Status</Label>
                <Select
                  value={modalForm.status}
                  onValueChange={value => setModalForm({ ...modalForm, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {modalNodeType === 'unit' && (
              <>
                <div className="mb-3">
                  <Label className="mb-2 block">Unit of Measure</Label>
                  <Input value={modalForm.unitOfMeasure} onChange={e => setModalForm({ ...modalForm, unitOfMeasure: e.target.value })} />
                </div>
                <div className="mb-3">
                  <Label className="mb-2 block">Capacity</Label>
                  <Input type="number" value={modalForm.capacity} onChange={e => setModalForm({ ...modalForm, capacity: Number(e.target.value) })} />
                </div>
                <div className="mb-3">
                  <Label htmlFor="idealCycleTime">Ideal Cycle Time (seconds/unit) <span title="Theoretical minimum time to produce one unit. Used for OEE Performance calculation." className="text-blue-600 cursor-help">🛈</span></Label>
                  <Input
                    id="idealCycleTime"
                    type="number"
                    value={modalForm.idealCycleTime || ''}
                    onChange={e => setModalForm({ ...modalForm, idealCycleTime: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g. 60"
                  />
                </div>
              </>
            )}
            {modalNodeType === 'asset' && (
              <>
                <div className="mb-3">
                  <Label className="mb-2 block">Asset Type</Label>
                  <Input value={modalForm.assetType} onChange={e => setModalForm({ ...modalForm, assetType: e.target.value })} />
                </div>
                <div className="mb-3">
                  <Label className="mb-2 block">Criticality</Label>
                  <Input value={modalForm.criticality} onChange={e => setModalForm({ ...modalForm, criticality: e.target.value })} />
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button type="submit">{modalType === 'add' ? 'Add' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div>Are you sure you want to delete this {deleteNodeType}?</div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attribute Management Modal */}
      <Dialog open={showAttributeModal} onOpenChange={setShowAttributeModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Custom Attributes - {attributeEntityType}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Add and manage custom attributes for this {attributeEntityType.toLowerCase()}.
            </div>
            
            {/* Custom Attribute Management Component */}
            <div className="border rounded-lg p-4">
              <CustomAttributeDisplay
                entityId={attributeEntityId}
                entityType={attributeEntityType}
                tenantId={attributeEntityType === 'Organization' ? undefined : 
                         attributeEntityType === 'Tenant' ? attributeEntityId : 
                         attributeEntityType === 'Unit' ? 
                           units.find(u => u.id === attributeEntityId)?.tenantId : 
                           assets.find(a => a.id === attributeEntityId)?.tenantId}
                organizationId={attributeOrganizationId}
                showHeader={false}
                maxDisplay={10}
                collapsible={false}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowAttributeModal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MasterData;
