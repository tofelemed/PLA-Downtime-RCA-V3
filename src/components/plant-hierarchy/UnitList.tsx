import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { masterDataService, Unit, Tenant } from '../../services/MasterDataService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Settings, Search, Loader2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { piStore } from '@/services/pi/PIStore';
import { PIClient, createTenantPIClient } from '@/services/pi/PIClient';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Database } from 'lucide-react';

interface UnitFormData {
  name: string;
  code: string;
  description: string;
  tenantId: string;
  capacity: number;
  unitOfMeasure: string;
  idealCycleTime?: number;
}

const UnitList: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<UnitFormData>({
    name: '',
    code: '',
    description: '',
    tenantId: '',
    capacity: 0,
    unitOfMeasure: '',
    idealCycleTime: 60,
  });
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<any>({});
  const isMounted = useRef(true);
  const [piBindingsByUnit, setPiBindingsByUnit] = useState<Record<string, any[]>>({});
  const [piElementCache, setPiElementCache] = useState<Record<string, any>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string>('');
  const [detailsUnit, setDetailsUnit] = useState<Unit | null>(null);
  const [detailsElements, setDetailsElements] = useState<any[]>([]);

  useEffect(() => {
    isMounted.current = true;
    loadData();
    return () => { isMounted.current = false; };
  }, [session]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!session) return;
      const [unitsData, tenantsData] = await Promise.all([
        masterDataService.getUnits({}),
        masterDataService.getTenants({}),
      ]);
      // Load PI bindings for current tenant context (if available)
      const tenantId = session?.tenant?.id || 'default-tenant';
      const bindings = await piStore.listBindings(tenantId);
      const map: Record<string, any[]> = {};
      for (const b of bindings) {
        if (b.boundType === 'unit') {
          if (!map[b.localId]) map[b.localId] = [];
          map[b.localId].push(b);
        }
      }
      if (isMounted.current) {
        setUnits(unitsData);
        setTenants(tenantsData);
        setPiBindingsByUnit(map);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load units and tenants',
        variant: 'destructive',
      });
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const getPIClient = async (): Promise<PIClient | null> => {
    try {
      const tenantId = session?.tenant?.id;
      if (!tenantId) return null;
      const cfg = await piStore.getConnectionByTenant(tenantId);
      if (!cfg) return null;
      return createTenantPIClient(tenantId);
    } catch {
      return null;
    }
  };

  const prefetchElementBasic = async (webIds: string[]) => {
    const client = await getPIClient();
    if (!client) return;
    const toFetch = webIds.filter(w => !piElementCache[w]);
    if (toFetch.length === 0) return;
    try {
      const results = await Promise.allSettled(toFetch.map(w => client.getElement(w)));
      const next: Record<string, any> = {};
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          next[toFetch[idx]] = res.value;
        }
      });
      if (Object.keys(next).length > 0) setPiElementCache(prev => ({ ...prev, ...next }));
    } catch {}
  };

  const openPiDetails = async (unit: Unit) => {
    try {
      setDetailsError('');
      setDetailsLoading(true);
      setDetailsUnit(unit);
      setDetailsOpen(true);
      const client = await getPIClient();
      const bindings = piBindingsByUnit[unit.id] || [];
      if (!client) {
        setDetailsError('PI connection is not configured. Please configure credentials in Connectivity → PI Integration.');
        setDetailsElements(bindings.map((b) => ({ WebId: b.webId })));
        return;
      }
      const results = await Promise.allSettled(bindings.map((b) => client.getElement(b.webId)));
      const els: any[] = results.map((r, i) => (r.status === 'fulfilled' ? r.value : { WebId: bindings[i].webId }));
      setDetailsElements(els);
    } catch (e: any) {
      setDetailsError(e?.message || 'Failed to load PI element details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const truncateMiddle = (value: string, head: number = 8, tail: number = 6) => {
    if (!value) return '';
    if (value.length <= head + tail + 3) return value;
    return `${value.slice(0, head)}…${value.slice(-tail)}`;
  };

  const getFilteredUnits = () => {
    if (!searchQuery) return units;
    
    return units.filter(unit => 
      unit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      unit.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      unit.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getTenantName = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant?.name || 'Unknown Tenant';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Inactive': return 'bg-gray-100 text-gray-800';
      case 'Maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'Offline': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      tenantId: '',
      capacity: 0,
      unitOfMeasure: '',
      idealCycleTime: 60,
    });
    setEditingUnit(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name,
      code: unit.code,
      description: unit.description || '',
      tenantId: unit.tenantId,
      capacity: unit.capacity || 0,
      unitOfMeasure: unit.unitOfMeasure || '',
      idealCycleTime: unit.idealCycleTime || 60,
    });
    setShowForm(true);
  };

  const handleDelete = async (unit: Unit) => {
    if (!window.confirm(`Are you sure you want to delete "${unit.name}"?`)) return;

    try {
      await masterDataService.deleteUnit(unit.id);
      
      toast({
        title: 'Success',
        description: 'Unit deleted successfully',
      });
      loadData();
    } catch (error) {
      console.error('Failed to delete unit:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete unit',
        variant: 'destructive',
      });
    }
  };

  const validateForm = () => {
    const errors: any = {};
    if (!formData.name) errors.name = 'Name is required';
    if (!formData.code) errors.code = 'Code is required';
    if (!formData.tenantId) errors.tenantId = 'Tenant/Plant is required';
    if (formData.capacity < 0) errors.capacity = 'Capacity cannot be negative';
    // Uniqueness check
    const codeExists = units.some(u => u.code === formData.code && (!editingUnit || u.id !== editingUnit.id));
    if (codeExists) errors.code = 'Code must be unique';
    return errors;
  };

  const handleSave = async () => {
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setLoading(true);
    try {
      if (!session) return;
      if (editingUnit) {
        await masterDataService.updateUnit(editingUnit.id, {
          name: formData.name,
          code: formData.code,
          description: formData.description,
          tenantId: formData.tenantId,
          capacity: formData.capacity,
          unitOfMeasure: formData.unitOfMeasure,
          idealCycleTime: formData.idealCycleTime,
        });
        toast({ title: 'Success', description: 'Unit updated successfully' });
      } else {
        await masterDataService.createUnit({
          name: formData.name,
          code: formData.code,
          description: formData.description,
          tenantId: formData.tenantId,
          capacity: formData.capacity,
          unitOfMeasure: formData.unitOfMeasure,
          idealCycleTime: formData.idealCycleTime,
        });
        toast({ title: 'Success', description: 'Unit created successfully' });
      }
      resetForm();
      setShowForm(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save unit',
        variant: 'destructive',
      });
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const renderUnitCard = (unit: Unit) => (
    <Card key={unit.id} className="hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Settings className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{unit.name}</CardTitle>
              <CardDescription className="text-sm">
                Code: {unit.code} • {getTenantName(unit.tenantId)}
              </CardDescription>
            </div>
          </div>
          {piBindingsByUnit[unit.id]?.length ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="outline-none"
                    onMouseEnter={() => prefetchElementBasic((piBindingsByUnit[unit.id] || []).slice(0,3).map((b) => b.webId))}
                    onClick={() => openPiDetails(unit)}
                  >
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 inline-flex items-center gap-1 cursor-pointer">
                      <Database className="w-3 h-3" /> PI Bound ({piBindingsByUnit[unit.id].length})
                    </Badge>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center" sideOffset={8} collisionPadding={16} className="max-w-[520px] break-all">
                  <div className="space-y-1">
                    {(piBindingsByUnit[unit.id] || []).slice(0,3).map((b) => {
                      const el = piElementCache[b.webId];
                      return (
                        <div key={b.id} className="text-xs">
                          <span className="font-medium">{el?.Name || b.webId}</span>
                          {el?.Path && <div className="text-[11px] text-slate-600">{el.Path}</div>}
                        </div>
                      );
                    })}
                    {piBindingsByUnit[unit.id].length > 3 && (
                      <div className="text-[11px] text-muted-foreground">+{piBindingsByUnit[unit.id].length - 3} more…</div>
                    )}
                    <div className="text-[11px] text-blue-700">Click to view full details</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {unit.description && (
            <p className="text-sm text-gray-600">{unit.description}</p>
          )}
          {unit.capacity && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Capacity:</span> {unit.capacity} {unit.unitOfMeasure}
            </p>
          )}
        </div>
        <div className="flex justify-end space-x-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(unit)}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(unit)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderForm = () => (
    <Dialog open={showForm} onOpenChange={setShowForm}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingUnit ? 'Edit Production Unit' : 'Create Production Unit'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            {formErrors.name && <div className="text-red-500 text-xs mt-1">{formErrors.name}</div>}
          </div>
          <div>
            <Label htmlFor="code">Code *</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
            />
            {formErrors.code && <div className="text-red-500 text-xs mt-1">{formErrors.code}</div>}
          </div>
          <div>
            <Label htmlFor="tenantId">Tenant/Plant *</Label>
            <Select
              value={formData.tenantId}
              onValueChange={(value) => setFormData({ ...formData, tenantId: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select tenant/plant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors.tenantId && <div className="text-red-500 text-xs mt-1">{formErrors.tenantId}</div>}
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseFloat(e.target.value) || 0 })}
              />
              {formErrors.capacity && <div className="text-red-500 text-xs mt-1">{formErrors.capacity}</div>}
            </div>
            <div>
              <Label htmlFor="unitOfMeasure">Unit of Measure</Label>
              <Input
                id="unitOfMeasure"
                value={formData.unitOfMeasure}
                onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                placeholder="e.g., tons/hr"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="idealCycleTime">Ideal Cycle Time (seconds/unit)</Label>
            <Input
              id="idealCycleTime"
              type="number"
              step="0.01"
              value={formData.idealCycleTime}
              onChange={e => setFormData({ ...formData, idealCycleTime: parseFloat(e.target.value) || 0 })}
              min={0.01}
              required
            />
            <p className="text-xs text-gray-500">The minimum time (in seconds) required to produce one unit at full speed. Used for OEE Performance.</p>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
              {editingUnit ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">Production Units</h3>
          <p className="text-sm text-gray-500">
            Manage production units and lines
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Unit
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search units..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12"><Loader2 className="animate-spin w-8 h-8 text-gray-400" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getFilteredUnits().map(renderUnitCard)}
          </div>
          {getFilteredUnits().length === 0 && (
            <div className="text-center py-12">
              <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery ? 'No units found' : 'No units yet'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'Get started by creating your first production unit'
                }
              </p>
              {!searchQuery && (
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Unit
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {renderForm()}

      {/* PI Binding Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>PI Bindings{detailsUnit ? ` — ${detailsUnit.name}` : ''}</DialogTitle>
          </DialogHeader>
          {detailsLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : detailsError ? (
            <div className="text-sm text-red-600">{detailsError}</div>
          ) : (
            <div className="space-y-3">
              {detailsElements.length === 0 && (
                <div className="text-sm text-muted-foreground">No PI bindings found.</div>
              )}
              {detailsElements.map((el) => (
                <Card key={el.WebId || el.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate max-w-[420px]">{el.Name || el.WebId || 'Unknown Element'}</CardTitle>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">WebId</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="font-mono text-[11px] bg-slate-50 border rounded px-2 py-0.5 truncate max-w-[280px]" title={el.WebId || ''}>
                                  {truncateMiddle(el.WebId || '—')}
                                </span>
                              </TooltipTrigger>
                              {/* <TooltipContent side="top" align="center" sideOffset={6} collisionPadding={16} className="max-w-[520px] break-all text-[11px]">
                                {el.WebId || '—'}
                              </TooltipContent> */}
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { if (el.WebId) navigator.clipboard.writeText(el.WebId); }}
                            disabled={!el.WebId}
                            className="h-7 px-2 text-xs"
                            title="Copy WebId"
                          >
                            <Copy className="w-3 h-3 mr-1" /> Copy
                          </Button>
                          {el.TemplateName && (
                            <span className="ml-2 text-[11px] text-slate-600">Template: <span className="font-medium">{el.TemplateName}</span></span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { if (el.Path) navigator.clipboard.writeText(el.Path); }}
                        disabled={!el.Path}
                        className="h-7 px-2 text-xs"
                        title="Copy AF Path"
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy Path
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="col-span-3">
                        <div className="text-xs text-muted-foreground">Path</div>
                        <div className="text-slate-800 break-all bg-slate-50 border rounded p-2 min-h-[36px]">{el.Path || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Template</div>
                        <div className="font-medium">{el.TemplateName || '—'}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-muted-foreground">Categories</div>
                        <div>{(el.CategoryNames || []).join(', ') || '—'}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UnitList; 