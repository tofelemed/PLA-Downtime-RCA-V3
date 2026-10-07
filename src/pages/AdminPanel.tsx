
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { masterDataApi, Organization, Tenant, Unit, Asset } from '../services/api/masterDataApi';
import { userApi, UserRecord, UserRole } from '../services/api/userApi';
import { customAttributeService } from '../services/CustomAttributeService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Factory, Wrench, Users, Plus, Edit, Trash2, Settings, Palette } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { defaultStatusAutomationRules } from './EventHub'; // Reuse the config
import { Switch } from '@/components/ui/switch';
import DashboardConfiguration from '@/components/DashboardConfiguration';
import AttributeManagementPanel from '@/components/AttributeManagementPanel';
import CustomAttributeForm from '@/components/CustomAttributeForm';
import BrandingSettings from '@/components/BrandingSettings';

interface HierarchyFormData {
  name: string;
  code: string;
  description: string;
  parentId?: string;
}

export const AdminPanel: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'org' | 'tenant' | 'unit' | 'asset' | 'user'>('org');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<HierarchyFormData>({
    name: '',
    code: '',
    description: '',
  });
  const [customAttributeValues, setCustomAttributeValues] = useState<{ attributeDefinitionId: string; value?: string }[]>([]);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Operator' as UserRole,
    organizationId: '',
    tenantId: '',
  });

  // --- Status Automation Rules State ---
  const [automationRules, setAutomationRules] = useState(() => {
    const saved = localStorage.getItem('statusAutomationRules');
    return saved ? JSON.parse(saved) : defaultStatusAutomationRules;
  });
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [ruleMode, setRuleMode] = useState<'simple' | 'advanced'>('simple');
  const [simpleRule, setSimpleRule] = useState({
    eventType: '*',
    field: '',
    operator: 'isset',
    value: '',
    status: '',
    description: '',
  });

  // Save rules to localStorage
  const saveRules = (rules: any[]) => {
    setAutomationRules(rules);
    localStorage.setItem('statusAutomationRules', JSON.stringify(rules));
    toast({ title: 'Saved', description: 'Automation rules updated.' });
  };

  // Only show to SuperAdmin or TenantAdmin
  const canEditRules = session?.user?.role === 'SuperAdmin' || session?.user?.role === 'TenantAdmin';

  useEffect(() => {
    loadAllData();
  }, [session]);

  const loadAllData = async () => {
    if (!session) return;

    try {
      const [orgsData, tenantsData, unitsData, assetsData, usersData] = await Promise.all([
        masterDataApi.getOrganizations(),
        masterDataApi.getTenants(),
        masterDataApi.getUnits(),
        masterDataApi.getAssets(),
        userApi.getUsers(),
      ]);

      setOrganizations(orgsData);
      setTenants(tenantsData);
      setUnits(unitsData);
      setAssets(assetsData);
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load admin data',
        variant: 'destructive',
      });
    }
  };

  const handleCreateOrganization = async () => {
    try {
      const org = await masterDataApi.createOrganization({
        name: formData.name,
        code: formData.code,
        description: formData.description,
        isActive: true,
      });

      if (customAttributeValues.length > 0) {
        try {
          await customAttributeService.bulkSetAttributeValues(
            org.id,
            'Organization',
            customAttributeValues,
          );
        } catch (attributeError) {
          console.warn('Failed to persist custom attributes', attributeError);
        }
      }
      
      toast({
        title: 'Success',
        description: 'Organization created successfully',
      });
      
      resetForm();
      loadAllData();
    } catch (error) {
      console.error('Failed to create organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to create organization',
        variant: 'destructive',
      });
    }
  };

  const handleCreateTenant = async () => {
    try {
      if (!formData.parentId) {
        throw new Error('Organization is required to create a tenant');
      }
      await masterDataApi.createTenant({
        name: formData.name,
        code: formData.code,
        description: formData.description,
        organizationId: formData.parentId,
        isActive: true,
      });
      
      toast({
        title: 'Success',
        description: 'Tenant created successfully',
      });
      
      resetForm();
      loadAllData();
    } catch (error) {
      console.error('Failed to create tenant:', error);
      toast({
        title: 'Error',
        description: 'Failed to create tenant',
        variant: 'destructive',
      });
    }
  };

  const handleCreateUnit = async () => {
    try {
      if (!formData.parentId) {
        throw new Error('Tenant is required to create a unit');
      }
      await masterDataApi.createUnit({
        name: formData.name,
        code: formData.code,
        description: formData.description,
        tenantId: formData.parentId,
        capacity: 0,
        unitOfMeasure: 'units',
      });
      
      toast({
        title: 'Success',
        description: 'Unit created successfully',
      });
      
      resetForm();
      loadAllData();
    } catch (error) {
      console.error('Failed to create unit:', error);
      toast({
        title: 'Error',
        description: 'Failed to create unit',
        variant: 'destructive',
      });
    }
  };

  const handleCreateAsset = async () => {
    try {
      if (!formData.parentId) {
        throw new Error('Unit is required to create an asset');
      }
      const parentUnit = units.find((unit) => unit.id === formData.parentId);
      if (!parentUnit) {
        throw new Error('Selected unit not found');
      }

      await masterDataApi.createAsset({
        name: formData.name,
        code: formData.code,
        description: formData.description,
        unitId: parentUnit.id,
        tenantId: parentUnit.tenantId,
        assetType: 'Equipment',
        criticality: 'Medium',
        status: 'Active',
      });
      
      toast({
        title: 'Success',
        description: 'Asset created successfully',
      });
      
      resetForm();
      loadAllData();
    } catch (error) {
      console.error('Failed to create asset:', error);
      toast({
        title: 'Error',
        description: 'Failed to create asset',
        variant: 'destructive',
      });
    }
  };

  const handleCreateUser = async () => {
    try {
      await userApi.createUser({
        name: userFormData.name,
        email: userFormData.email,
        password: userFormData.password,
        role: userFormData.role,
        organizationId: userFormData.organizationId || undefined,
        tenantId: userFormData.tenantId || undefined,
        isActive: true,
      });
      
      toast({
        title: 'Success',
        description: 'User created successfully',
      });
      
      setUserFormData({
        name: '',
        email: '',
        password: '',
        role: 'Operator',
        organizationId: '',
        tenantId: '',
      });
      loadAllData();
    } catch (error) {
      console.error('Failed to create user:', error);
      toast({
        title: 'Error',
        description: 'Failed to create user',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    switch (dialogType) {
      case 'org':
        await handleCreateOrganization();
        break;
      case 'tenant':
        await handleCreateTenant();
        break;
      case 'unit':
        await handleCreateUnit();
        break;
      case 'asset':
        await handleCreateAsset();
        break;
      case 'user':
        await handleCreateUser();
        break;
    }
    
    setIsDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({ name: '', code: '', description: '' });
    setEditingItem(null);
    setCustomAttributeValues([]);
  };

  const openDialog = (type: typeof dialogType, parentId?: string) => {
    setDialogType(type);
    setFormData({ ...formData, parentId });
    setIsDialogOpen(true);
  };

  const handleDelete = async (type: 'organizations' | 'tenants' | 'units' | 'assets' | 'users', id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const deleteHandlers = {
        organizations: masterDataApi.deleteOrganization,
        tenants: masterDataApi.deleteTenant,
        units: masterDataApi.deleteUnit,
        assets: masterDataApi.deleteAsset,
        users: userApi.deleteUser,
      } as const;

      const handler = deleteHandlers[type];
      await handler(id);
      toast({
        title: 'Success',
        description: 'Item deleted successfully',
      });
      loadAllData();
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
    }
  };

  if (!session || (session.user.role !== 'SuperAdmin' && session.user.role !== 'TenantAdmin')) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">You don't have permission to access the admin panel.</p>
      </div>
    );
  }

  const eventTypes = ['*', 'ProductionLoss', 'IOW', 'SOL', 'APM', 'FailureWO'];
  const fields = ['recommendedAction', 'failureMode', 'endTime', 'rcaId', 'status'];
  const operators = [
    { label: 'is set', value: 'isset' },
    { label: 'is not set', value: 'notset' },
    { label: 'equals', value: 'eq' },
    { label: 'not equals', value: 'neq' },
  ];

  const statusOptionsByType: Record<string, string[]> = {
    '*': ['Open', 'Coded', 'RCA Required', 'Closed', 'Investigating', 'In Progress', 'Completed', 'Cancelled'],
    'ProductionLoss': ['Open', 'Coded', 'RCA Required', 'Closed', 'Investigating', 'In Progress', 'Completed', 'Cancelled'],
    'IOW': ['Open', 'Investigating', 'Closed', 'Completed', 'Cancelled'],
    'SOL': ['Open', 'Investigating', 'Closed', 'Completed', 'Cancelled'],
    'APM': ['Open', 'Completed', 'Closed', 'Cancelled'],
    'FailureWO': ['Open', 'In Progress', 'Completed', 'Closed', 'Cancelled'],
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Admin Panel</h2>
        <p className="text-muted-foreground">
          Manage organizational hierarchy and user assignments
        </p>
      </div>

      <Tabs defaultValue="hierarchy" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="hierarchy">Hierarchy Management</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="attributes">Custom Attributes</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard Config</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          {canEditRules && <TabsTrigger value="automation">Status Automation</TabsTrigger>}
        </TabsList>

        <TabsContent value="hierarchy" className="space-y-6">
          {/* Organizations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Organizations
                </CardTitle>
                <CardDescription>Manage top-level organizations</CardDescription>
              </div>
              <Button onClick={() => openDialog('org')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Organization
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {organizations.map((org) => (
                  <div key={org.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-sm text-gray-500">{org.code}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDialog('tenant', org.id)}
                      >
                        Add Tenant
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete('organizations', org.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tenants */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="w-5 h-5" />
                Tenants (Plants)
              </CardTitle>
              <CardDescription>Manage plants and facilities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tenants.map((tenant) => {
                  const org = organizations.find(o => o.id === tenant.organizationId);
                  return (
                    <div key={tenant.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-sm text-gray-500">
                          {tenant.code} • {org?.name}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDialog('unit', tenant.id)}
                        >
                          Add Unit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete('tenants', tenant.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Units */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Production Units
              </CardTitle>
              <CardDescription>Manage production units and equipment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {units.map((unit) => {
                  const tenant = tenants.find(t => t.id === unit.tenantId);
                  return (
                    <div key={unit.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{unit.name}</p>
                        <p className="text-sm text-gray-500">
                          {unit.code} • {tenant?.name}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDialog('asset', unit.id)}
                        >
                          Add Asset
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete('units', unit.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  User Assignment
                </CardTitle>
                <CardDescription>Assign users to organizations and tenants</CardDescription>
              </div>
              <Button onClick={() => openDialog('user')}>
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users.map((user) => {
                  const org = organizations.find(o => o.id === user.organizationId);
                  const tenant = tenants.find(t => t.id === user.tenantId);
                  return (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-gray-500">
                          {user.email} • {user.role}
                        </p>
                        <p className="text-xs text-gray-400">
                          {org?.name} {tenant && `• ${tenant.name}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete('users', user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attributes" className="space-y-6">
          <AttributeManagementPanel />
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-6">
          <DashboardConfiguration />
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <BrandingSettings />
        </TabsContent>

        {canEditRules && (
          <TabsContent value="automation">
            <Card>
              <CardHeader>
                <CardTitle>Status Automation Rules</CardTitle>
                <CardDescription>Configure event status automation. Changes are saved locally for now.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Button onClick={() => { setEditingRule({ eventType: '', status: '', description: '', condition: '' }); setIsRuleDialogOpen(true); }}>
                    Add Rule
                  </Button>
                </div>
                <table className="min-w-full text-sm border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2">Event Type</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Condition (JS)</th>
                      <th className="p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {automationRules.map((rule, idx) => (
                      <tr key={rule.id || idx} className="border-t">
                        <td className="p-2">{rule.eventType}</td>
                        <td className="p-2">{rule.status}</td>
                        <td className="p-2">{rule.description}</td>
                        <td className="p-2 font-mono text-xs">{rule.condition.toString()}</td>
                        <td className="p-2">
                          <Button size="sm" variant="outline" onClick={() => { setEditingRule(rule); setIsRuleDialogOpen(true); }}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => saveRules(automationRules.filter((_, i) => i !== idx))}>Delete</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            {/* Rule Edit Dialog */}
            <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingRule?.id ? 'Edit Rule' : 'Add Rule'}</DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-4 mb-2">
                  <span className="font-medium">Simple</span>
                  <Switch checked={ruleMode === 'advanced'} onCheckedChange={v => setRuleMode(v ? 'advanced' : 'simple')} />
                  <span className="font-medium">Advanced</span>
                </div>
                {ruleMode === 'simple' ? (
                  <div className="space-y-2">
                    <Label>Event Type</Label>
                    <Select value={simpleRule.eventType} onValueChange={v => setSimpleRule(r => ({ ...r, eventType: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select event type" /></SelectTrigger>
                      <SelectContent>
                        {eventTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Label>Field</Label>
                    <Select value={simpleRule.field} onValueChange={v => setSimpleRule(r => ({ ...r, field: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
                      <SelectContent>
                        {fields.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Label>Operator</Label>
                    <Select value={simpleRule.operator} onValueChange={v => setSimpleRule(r => ({ ...r, operator: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select operator" /></SelectTrigger>
                      <SelectContent>
                        {operators.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {(simpleRule.operator === 'eq' || simpleRule.operator === 'neq') && (
                      <>
                        <Label>Value</Label>
                        <Input value={simpleRule.value} onChange={e => setSimpleRule(r => ({ ...r, value: e.target.value }))} placeholder="Enter value (e.g. Completed)" />
                      </>
                    )}
                    <Label>Status to Set</Label>
                    <Select value={simpleRule.status} onValueChange={v => setSimpleRule(r => ({ ...r, status: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        {(statusOptionsByType[simpleRule.eventType] || statusOptionsByType['*']).map(status => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>Description</Label>
                    <Input value={simpleRule.description} onChange={e => setSimpleRule(r => ({ ...r, description: e.target.value }))} placeholder="Describe this rule in plain English" />
                    {/* Preview */}
                    <div className="bg-gray-50 p-2 rounded text-xs mt-2">
                      <b>Preview:</b> If <b>{simpleRule.eventType}</b> event's <b>{simpleRule.field}</b> {operators.find(o => o.value === simpleRule.operator)?.label} {simpleRule.value && (simpleRule.operator === 'eq' || simpleRule.operator === 'neq') ? <b>{simpleRule.value}</b> : null}, set status to <b>{simpleRule.status}</b>.<br />
                      <span className="text-gray-500">JS: <code>{(() => {
                        if (!simpleRule.field) return '';
                        if (simpleRule.operator === 'isset') return `return !!event.${simpleRule.field};`;
                        if (simpleRule.operator === 'notset') return `return !event.${simpleRule.field};`;
                        if (simpleRule.operator === 'eq') return `return event.${simpleRule.field} === '${simpleRule.value}';`;
                        if (simpleRule.operator === 'neq') return `return event.${simpleRule.field} !== '${simpleRule.value}';`;
                        return '';
                      })()}</code></span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Event Type</Label>
                    <Input value={editingRule?.eventType || ''} onChange={e => setEditingRule(r => ({ ...r, eventType: e.target.value }))} placeholder="APM, FailureWO, *" />
                    <Label>Status</Label>
                    <Input value={editingRule?.status || ''} onChange={e => setEditingRule(r => ({ ...r, status: e.target.value }))} placeholder="Completed, Coded, etc." />
                    <Label>Description</Label>
                    <Textarea value={editingRule?.description || ''} onChange={e => setEditingRule(r => ({ ...r, description: e.target.value }))} />
                    <Label>Condition (JS, function body, use 'event')</Label>
                    <Textarea value={editingRule?.conditionBody || ''} onChange={e => setEditingRule(r => ({ ...r, conditionBody: e.target.value }))} placeholder="return !!event.recommendedAction;" />
                    <div className="text-xs text-gray-500 mt-1">Advanced users: write a JS function body, e.g. <code>return !!event.recommendedAction;</code></div>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => {
                    let newRule;
                    if (ruleMode === 'simple') {
                      // Generate JS condition
                      let conditionBody = '';
                      if (simpleRule.operator === 'isset') conditionBody = `return !!event.${simpleRule.field};`;
                      if (simpleRule.operator === 'notset') conditionBody = `return !event.${simpleRule.field};`;
                      if (simpleRule.operator === 'eq') conditionBody = `return event.${simpleRule.field} === '${simpleRule.value}';`;
                      if (simpleRule.operator === 'neq') conditionBody = `return event.${simpleRule.field} !== '${simpleRule.value}';`;
                      let condition;
                      try {
                        // eslint-disable-next-line no-new-func
                        condition = new Function('event', conditionBody);
                      } catch (e) {
                        toast({ title: 'Error', description: 'Invalid generated JS condition.' });
                        return;
                      }
                      newRule = {
                        id: editingRule?.id || Math.random().toString(36).slice(2),
                        eventType: simpleRule.eventType,
                        status: simpleRule.status,
                        description: simpleRule.description,
                        condition,
                        conditionBody,
                      };
                    } else {
                      let condition;
                      try {
                        // eslint-disable-next-line no-new-func
                        condition = new Function('event', editingRule.conditionBody);
                      } catch (e) {
                        toast({ title: 'Error', description: 'Invalid JS condition.' });
                        return;
                      }
                      newRule = { ...editingRule, condition, id: editingRule.id || Math.random().toString(36).slice(2) };
                    }
                    let updated;
                    if (editingRule?.id) {
                      updated = automationRules.map(r => r.id === (editingRule.id || newRule.id) ? newRule : r);
                    } else {
                      updated = [...automationRules, newRule];
                    }
                    saveRules(updated);
                    setIsRuleDialogOpen(false);
                  }}>Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create {dialogType === 'org' ? 'Organization' : 
                     dialogType === 'tenant' ? 'Tenant' :
                     dialogType === 'unit' ? 'Unit' :
                     dialogType === 'asset' ? 'Asset' : 'User'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {dialogType !== 'user' ? (
              <>
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
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="userName">Name</Label>
                  <Input
                    id="userName"
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="userEmail">Email</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="userPassword">Password</Label>
                  <Input
                    id="userPassword"
                    type="password"
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="userRole">Role</Label>
                  <Select 
                    value={userFormData.role} 
                    onValueChange={(value) => setUserFormData({ ...userFormData, role: value as UserRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Operator">Operator</SelectItem>
                      <SelectItem value="Engineer">Engineer</SelectItem>
                      <SelectItem value="Analyst">Analyst</SelectItem>
                      <SelectItem value="TenantAdmin">Tenant Admin</SelectItem>
                      <SelectItem value="OrgAdmin">Organization Admin</SelectItem>
                      <SelectItem value="SuperAdmin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="userOrg">Organization</Label>
                  <Select 
                    value={userFormData.organizationId} 
                    onValueChange={(value) => setUserFormData({ ...userFormData, organizationId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="userTenant">Tenant (Optional)</Label>
                  <Select 
                    value={userFormData.tenantId} 
                    onValueChange={(value) => setUserFormData({ ...userFormData, tenantId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants
                        .filter(t => t.organizationId === userFormData.organizationId)
                        .map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            {dialogType === 'org' && (
              <CustomAttributeForm
                entityId=""
                entityType="Organization"
                organizationId={session?.organization?.id}
                onValuesChange={setCustomAttributeValues}
                showValidationErrors={false}
              />
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
    </div>
  );
};
